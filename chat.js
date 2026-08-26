(function () {
  const CHAT_KEY = "zqhd_conversation_id";

  function getConversationId() {
    let id = localStorage.getItem(CHAT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAT_KEY, id);
    }
    return id;
  }

  const conversationId = getConversationId();
  const socket = io();

  const chatEl = document.getElementById("chat");
  const form = document.getElementById("composerForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const typingRow = document.getElementById("typingRow");
  const welcome = document.querySelector(".welcome");

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function removeWelcome() {
    if (welcome) welcome.remove();
  }

  function renderMessage(message) {
    removeWelcome();
    const row = document.createElement("div");
    row.className = `bubble-row ${message.role === "user" ? "user" : "assistant"}`;

    const wrap = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = `bubble ${message.role === "user" ? "bubble-user" : "bubble-assistant"}`;
    bubble.textContent = message.text;

    const time = document.createElement("div");
    time.className = "msg-time";
    time.style.textAlign = message.role === "user" ? "right" : "left";
    time.textContent = formatTime(message.ts);

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    row.appendChild(wrap);
    chatEl.appendChild(row);
    scrollToBottom();
  }

  function scrollToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function showTyping() {
    typingRow.hidden = false;
    scrollToBottom();
  }

  function hideTyping() {
    typingRow.hidden = true;
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (data.messages && data.messages.length) {
        data.messages.forEach(renderMessage);
      }
    } catch (err) {
      console.error("Impossible de charger l'historique", err);
    }
  }

  socket.on("connect", () => {
    socket.emit("join", { conversationId });
  });

  socket.on("new_message", ({ conversationId: cid, message }) => {
    if (cid !== conversationId) return;
    hideTyping();
    renderMessage(message);
  });

  socket.on("assistant_typing", ({ conversationId: cid }) => {
    if (cid !== conversationId) return;
    showTyping();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit("user_message", { conversationId, text });
    input.value = "";
    autoResize();
    input.focus();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }
  input.addEventListener("input", autoResize);

  loadHistory();
})();
