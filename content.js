let lastSavedText = "";
let saveTimer = null;

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

function generateFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `chatgpt_auto_${year}-${month}-${day}_${hour}-${minute}-${second}.txt`;
}

function saveLatestReply() {
  const text = getLatestAssistantMessage();
  console.log("[CS] latest text length:", text.length);

  if (!text) {
    console.log("[CS] 没抓到可保存内容");
    return;
  }

  if (text === lastSavedText) {
    console.log("[CS] 内容未变化，跳过");
    return;
  }

  lastSavedText = text;
  console.log("[CS] 检测到新回复，准备上传");

  chrome.runtime.sendMessage(
    {
      type: "UPLOAD_TO_DRIVE",
      payload: {
        filename: generateFileName(),
        content: text,
        mimeType: "text/plain"
      }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[CS] 发送消息失败:", chrome.runtime.lastError.message);
        return;
      }

      console.log("[CS] background response:", response);

      if (response && response.ok) {
        console.log("[CS] 自动保存成功");
      } else {
        console.error("[CS] 自动保存失败", response);
      }
    }
  );
}

const observer = new MutationObserver(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveLatestReply();
  }, 2500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

setTimeout(() => {
  saveLatestReply();
}, 4000);