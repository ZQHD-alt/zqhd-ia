require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");

const store = require("./lib/store");
const ai = require("./lib/ai");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const COOKIE_NAME = "zqhd_admin_token";

if (!ADMIN_PASSWORD) {
  console.warn(
    "⚠️  ADMIN_PASSWORD n'est pas défini. Définis-le dans .env avant de déployer !"
  );
}

// --- Session admin en mémoire (tokens actifs) ---
const activeAdminTokens = new Set();

function isValidAdminToken(token) {
  return Boolean(token) && activeAdminTokens.has(token);
}

// --- App Express ---
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!isValidAdminToken(token)) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// --- Auth admin ---
app.post("/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  activeAdminTokens.add(token);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  });
  res.json({ ok: true });
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  activeAdminTokens.delete(req.cookies[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/admin/api/me", requireAdmin, (req, res) => {
  res.json({ ok: true, aiAvailable: ai.isAiConfigured() });
});

// --- API admin : conversations ---
app.get("/admin/api/conversations", requireAdmin, (req, res) => {
  res.json(store.listConversations());
});

app.get("/admin/api/conversations/:id", requireAdmin, (req, res) => {
  const conv = store.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation introuvable" });
  res.json(conv);
});

app.post("/admin/api/conversations/:id/ai-mode", requireAdmin, (req, res) => {
  const { enabled } = req.body || {};
  const conv = store.setAiMode(req.params.id, enabled);
  io.to("admins").emit("conversation_updated", { conversationId: conv.id, aiMode: conv.aiMode });
  res.json({ ok: true, aiMode: conv.aiMode });
});

app.post("/admin/api/conversations/:id/suggest", requireAdmin, async (req, res) => {
  try {
    const conv = store.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation introuvable" });
    const suggestion = await ai.generateReply(conv.messages);
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API publique : historique d'une conversation (accessible via l'ID, non listable) ---
app.get("/api/conversations/:id/messages", (req, res) => {
  const conv = store.getConversation(req.params.id);
  if (!conv) return res.json({ id: req.params.id, messages: [] });
  res.json({ id: conv.id, messages: conv.messages });
});

// --- Serveur HTTP + Socket.IO ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

io.on("connection", (socket) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = cookies[COOKIE_NAME];
  socket.isAdmin = isValidAdminToken(token);

  if (socket.isAdmin) {
    socket.join("admins");
  }

  socket.on("join", ({ conversationId }) => {
    if (!conversationId) return;
    store.getOrCreateConversation(conversationId);
    socket.join(conversationId);
    socket.conversationId = conversationId;
  });

  socket.on("user_message", async ({ conversationId, text }) => {
    if (!conversationId || !text || !text.trim()) return;
    const conv = store.getOrCreateConversation(conversationId);
    const message = store.addMessage(conversationId, "user", text.trim());

    io.to(conversationId).emit("new_message", { conversationId, message });
    io.to("admins").emit("new_message", { conversationId, message });

    if (conv.aiMode) {
      await sendAssistantReply(conversationId, { viaAi: true });
    }
  });

  socket.on("admin_reply", async ({ conversationId, text }) => {
    if (!socket.isAdmin) return;
    if (!conversationId || !text || !text.trim()) return;
    await sendAssistantReply(conversationId, { manualText: text.trim() });
  });

  socket.on("admin_toggle_ai", ({ conversationId, enabled }) => {
    if (!socket.isAdmin) return;
    const conv = store.setAiMode(conversationId, enabled);
    io.to("admins").emit("conversation_updated", {
      conversationId: conv.id,
      aiMode: conv.aiMode,
    });
  });
});

/**
 * Envoie une réponse "assistant" avec un temps de réflexion réaliste.
 * Soit un texte manuel (écrit par l'admin), soit généré par l'IA.
 */
async function sendAssistantReply(conversationId, { manualText, viaAi }) {
  io.to(conversationId).emit("assistant_typing", { conversationId });

  const minDelay = 900 + Math.random() * 1600; // 0.9s à 2.5s
  const start = Date.now();

  let text = manualText;
  try {
    if (viaAi) {
      const conv = store.getConversation(conversationId);
      text = await ai.generateReply(conv ? conv.messages : []);
    }
  } catch (err) {
    console.error("Erreur génération IA:", err.message);
    text = "Désolé, je n'ai pas pu répondre pour le moment.";
  }

  const elapsed = Date.now() - start;
  const remaining = Math.max(0, minDelay - elapsed);
  await new Promise((resolve) => setTimeout(resolve, remaining));

  if (!text) return;
  const message = store.addMessage(conversationId, "assistant", text);
  io.to(conversationId).emit("new_message", { conversationId, message });
  io.to("admins").emit("new_message", { conversationId, message });
}

httpServer.listen(PORT, () => {
  console.log(`ZQHD.ia lancé sur le port ${PORT}`);
});
