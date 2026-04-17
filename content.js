let lastSavedSnapshot = "";
let saveTimer = null;
let lastKnownUrl = location.href;

function sanitizeFileName(name) {
  return (name || "untitled")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "untitled";
}

function getConversationTitle() {
  const candidates = [
    document.querySelector("header h1"),
    document.querySelector("h1"),
    document.querySelector("title")
  ];

  for (const node of candidates) {
    const text = (node?.innerText || node?.textContent || "").trim();
    if (text && text.toLowerCase() !== "chatgpt") {
      return sanitizeFileName(text);
    }
  }

  const title = (document.title || "").replace(/\s*-\s*ChatGPT$/i, "").trim();
  return sanitizeFileName(title || "chatgpt_conversation");
}

function normalizeText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectRoleBasedMessages() {
  const nodes = document.querySelectorAll("[data-message-author-role]");
  const messages = [];

  nodes.forEach((node) => {
    const role = node.getAttribute("data-message-author-role");
    const text = normalizeText(node.innerText || node.textContent || "");
    if (!role || !text) return;

    messages.push({ role, text });
  });

  return messages;
}

function collectArticleMessages() {
  const articles = document.querySelectorAll("article");
  const messages = [];

  articles.forEach((article, index) => {
    const text = normalizeText(article.innerText || article.textContent || "");
    if (!text) return;

    const role = index % 2 === 0 ? "user" : "assistant";
    messages.push({ role, text });
  });

  return messages;
}

function getConversationMessages() {
  const roleBased = collectRoleBasedMessages();
  if (roleBased.length > 0) {
    return roleBased;
  }

  return collectArticleMessages();
}

function toMarkdownContent(title, messages) {
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const body = messages
    .map((message) => {
      const heading = message.role === "assistant" ? "## Assistant" : "## User";
      return `${heading}\n\n${message.text}`;
    })
    .join("\n\n---\n\n");

  return `# ${title}\n\n- 更新时间: ${timestamp}\n- 消息数: ${messages.length}\n\n---\n\n${body}\n`;
}

function queueConversationSync() {
  const messages = getConversationMessages();
  if (messages.length === 0) {
    return;
  }

  const snapshot = messages.map((item) => `${item.role}:${item.text}`).join("\n\n");
  if (!snapshot || snapshot === lastSavedSnapshot) {
    return;
  }

  lastSavedSnapshot = snapshot;

  const title = getConversationTitle();
  chrome.runtime.sendMessage(
    {
      type: "ENQUEUE_UPLOAD",
      payload: {
        content: toMarkdownContent(title, messages),
        mimeType: "text/markdown",
        conversationTitle: title,
        rawText: snapshot
      }
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("[content] sendMessage failed:", chrome.runtime.lastError.message);
      }
    }
  );
}

function scheduleSync(delay = 1500) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(queueConversationSync, delay);
}

const observer = new MutationObserver(() => {
  scheduleSync(1200);
});

function startObserver() {
  if (!document.body) {
    setTimeout(startObserver, 300);
    return;
  }

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  scheduleSync(2000);
}

startObserver();

setInterval(() => {
  if (location.href !== lastKnownUrl) {
    lastKnownUrl = location.href;
    lastSavedSnapshot = "";
  }

  queueConversationSync();
}, 3000);
