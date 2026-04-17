let lastSavedText = "";
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

function getLatestAssistantMessage() {
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
    'article'
  ];

  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    if (nodes && nodes.length > 0) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const text = (nodes[i].innerText || "").trim();
        if (text && text.length > 20) {
          return text;
        }
      }
    }
  }

  return "";
}

function generateFileName(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `${prefix}_${year}-${month}-${day}_${hour}-${minute}-${second}.md`;
}

function toMarkdownContent(title, text) {
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  return `# ${title}\n\n- 保存时间: ${timestamp}\n\n---\n\n${text}\n`;
}

function saveLatestReply() {
  const text = getLatestAssistantMessage();
  if (!text || text === lastSavedText) {
    return;
  }

  lastSavedText = text;

  const title = getConversationTitle();
  const filename = generateFileName(title);
  const markdownContent = toMarkdownContent(title, text);

  chrome.runtime.sendMessage(
    {
      type: "ENQUEUE_UPLOAD",
      payload: {
        filename,
        content: markdownContent,
        mimeType: "text/markdown",
        conversationTitle: title,
        rawText: text
      }
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("[CS] 发送消息失败:", chrome.runtime.lastError.message);
      }
    }
  );
}

const observer = new MutationObserver(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLatestReply, 1500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

setInterval(() => {
  if (location.href !== lastKnownUrl) {
    lastKnownUrl = location.href;
    lastSavedText = "";
  }
  saveLatestReply();
}, 3000);

setTimeout(saveLatestReply, 2500);
