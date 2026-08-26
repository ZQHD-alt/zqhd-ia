(function () {
  const loginScreen = document.getElementById("loginScreen");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("passwordInput");
  const loginError = document.getElementById("loginError");

  const convList = document.getElementById("convList");
  const emptyState = document.getElementById("emptyState");
  const threadView = document.getElementById("threadView");
  const threadTitle = document.getElementById("threadTitle");
  const threadMessages = document.getElementById("threadMessages");
  const aiToggle = document.getElementById("aiToggle");
  const replyForm = document.getElementById("replyForm");
  const replyInput = document.getElementById("replyInput");
  const suggestBtn = document.getElementById("suggestBtn");

  let socket = null;
  let conversations = new Map();
  let activeId = null;

  function shortId(id) {
    return id.slice(0, 8);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  async function checkSession() {
    const res = await fetch("/admin/api/me");
    if (res.ok) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  async function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    connectSocket();
    await refreshConversations();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    if (res.ok) {
      passwordInput.value = "";
      showDashboard();
    } else {
      loginError.hidden = false;
    }
  });

  function connectSocket() {
    if (socket) return;
    socket = io();

    socket.on("new_message", ({ conversationId, message }) => {
      const conv = conversations.get(conversationId);
      if (conv) {
        conv.lastMessage = message;
        conv.lastActivity = message.ts;
      }
      renderConvList();
      if (conversationId === activeId) {
        appendMessageToThread(message);
      }
    });

    socket.on("conversation_updated", ({ conversationId, aiMode }) => {
      const conv = conversations.get(conversationId);
      if (conv) conv.aiMode = aiMode;
      renderConvList();
      if (conversationId === activeId) {
        aiToggle.checked = aiMode;
      }
    });
  }

  async function refreshConversations() {
    const res = await fetch("/admin/api/conversations");
    const list = await res.json();
    conversations = new Map(list.map((c) => [c.id, c]));
    renderConvList();
  }

  function renderConvList() {
    const items = Array.from(conversations.values()).sort(
      (a, b) => (b.lastActivity || 0) - (a.lastActivity || 0)
    );
    convList.innerHTML = "";
    items.forEach((conv) => {
      const el = document.createElement("div");
      el.className = "conv-item" + (conv.id === activeId ? " active" : "");
      el.innerHTML = `
        <div class="conv-item-top">
          <span class="conv-item-id">#${shortId(conv.id)}</span>
          ${conv.aiMode ? '<span class="ai-badge">IA auto</span>' : ""}
        </div>
        <div class="conv-item-preview">${
          conv.lastMessage ? escapeHtml(conv.lastMessage.text) : "(aucun message)"
        }</div>
      `;
      el.addEventListener("click", () => openConversation(conv.id));
      convList.appendChild(el);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function openConversation(id) {
    activeId = id;
    emptyState.hidden = true;
    threadView.hidden = false;
    threadTitle.textContent = `#${shortId(id)}`;

    const res = await fetch(`/admin/api/conversations/${id}`);
    const conv = await res.json();
    aiToggle.checked = !!conv.aiMode;

    threadMessages.innerHTML = "";
    conv.messages.forEach(appendMessageToThread);
    renderConvList();
  }

  function appendMessageToThread(message) {
    const row = document.createElement("div");
    row.className = `bubble-row ${message.role}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.text;
    row.appendChild(bubble);
    threadMessages.appendChild(row);
    threadMessages.scrollTop = threadMessages.scrollHeight;
  }

  aiToggle.addEventListener("change", async () => {
    if (!activeId) return;
    await fetch(`/admin/api/conversations/${activeId}/ai-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: aiToggle.checked }),
    });
    socket.emit("admin_toggle_ai", { conversationId: activeId, enabled: aiToggle.checked });
  });

  replyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = replyInput.value.trim();
    if (!text || !activeId) return;
    socket.emit("admin_reply", { conversationId: activeId, text });
    replyInput.value = "";
  });

  suggestBtn.addEventListener("click", async () => {
    if (!activeId) return;
    suggestBtn.disabled = true;
    suggestBtn.textContent = "…";
    try {
      const res = await fetch(`/admin/api/conversations/${activeId}/suggest`, { method: "POST" });
      const data = await res.json();
      if (data.suggestion) {
        replyInput.value = data.suggestion;
        replyInput.focus();
      } else if (data.error) {
        alert("Erreur IA : " + data.error);
      }
    } catch (err) {
      alert("Erreur réseau lors de la suggestion IA.");
    } finally {
      suggestBtn.disabled = false;
      suggestBtn.textContent = "✨ Suggérer (IA)";
    }
  });

  checkSession();
})();
