// Store en mémoire (simple et suffisant pour un projet entre amis).
// ⚠️ Les données sont perdues si le serveur redémarre (redeploy, veille des
// hébergeurs gratuits, etc.). Voir le README si tu veux les rendre persistantes.

const crypto = require("crypto");

const conversations = new Map();

function createId() {
  return crypto.randomUUID();
}

function getOrCreateConversation(id) {
  if (!id || !conversations.has(id)) {
    const newId = id || createId();
    conversations.set(newId, {
      id: newId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      aiMode: false,
      messages: [],
    });
    return conversations.get(newId);
  }
  return conversations.get(id);
}

function getConversation(id) {
  return conversations.get(id) || null;
}

function listConversations() {
  return Array.from(conversations.values())
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      lastActivity: c.lastActivity,
      aiMode: c.aiMode,
      messageCount: c.messages.length,
      lastMessage: c.messages[c.messages.length - 1] || null,
    }));
}

function addMessage(conversationId, role, text) {
  const conv = getOrCreateConversation(conversationId);
  const message = {
    id: crypto.randomUUID(),
    role, // 'user' | 'assistant'
    text,
    ts: Date.now(),
  };
  conv.messages.push(message);
  conv.lastActivity = Date.now();
  return message;
}

function setAiMode(conversationId, enabled) {
  const conv = getOrCreateConversation(conversationId);
  conv.aiMode = !!enabled;
  return conv;
}

module.exports = {
  getOrCreateConversation,
  getConversation,
  listConversations,
  addMessage,
  setAiMode,
};
