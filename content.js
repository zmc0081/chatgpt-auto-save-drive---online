let lastSavedSnapshot = "";
let saveTimer = null;
let lastKnownUrl = location.href;

// 模型配置
const AI_MODELS = {
  chatgpt: {
    name: "ChatGPT",
    urlPatterns: ["https://chatgpt.com", "https://chat.openai.com"],
    folderName: "ChatGPT"
  },
  claude: {
    name: "Claude",
    urlPatterns: ["https://claude.ai"],
    folderName: "Claude"
  },
  deepseek: {
    name: "DeepSeek",
    urlPatterns: ["https://chat.deepseek.com"],
    folderName: "DeepSeek"
  },
  gemini: {
    name: "Gemini",
    urlPatterns: ["https://gemini.google.com"],
    folderName: "Gemini"
  },
  grok: {
    name: "Grok",
    urlPatterns: ["https://grok.x.com"],
    folderName: "Grok"
  },
  llama: {
    name: "Llama",
    urlPatterns: ["https://llama.meta.com"],
    folderName: "Llama"
  },
  mistral: {
    name: "Mistral",
    urlPatterns: ["https://chat.mistral.ai"],
    folderName: "Mistral"
  },
  qwen: {
    name: "Qwen",
    urlPatterns: ["https://qwenlm.aliyun.com"],
    folderName: "Qwen"
  },
  minimax: {
    name: "MiniMax",
    urlPatterns: ["https://chat.minimax.ai"],
    folderName: "MiniMax"
  },
  olmo: {
    name: "Olmo",
    urlPatterns: ["https://olmo.allenai.org"],
    folderName: "Olmo"
  },
  kimi: {
    name: "Kimi",
    urlPatterns: ["https://kimi.moonshot.cn"],
    folderName: "Kimi"
  }
};

// 检测当前模型
function detectCurrentModel() {
  const url = location.href;
  for (const [modelKey, config] of Object.entries(AI_MODELS)) {
    if (config.urlPatterns.some(p => url.startsWith(p))) {
      return modelKey;
    }
  }
  return "chatgpt"; // 默认
}

const currentModel = detectCurrentModel();
const currentModelName = AI_MODELS[currentModel]?.name || "Unknown";

const ROLE_SELECTOR_CONFIGS = [
  { selector: "[data-message-author-role]", attr: "data-message-author-role" },
  { selector: "[data-author-role]", attr: "data-author-role" },
  {
    selector: [
      "[data-testid*='user-message' i]",
      "[data-test-id*='user-message' i]",
      "[data-testid*='user-query' i]",
      "[data-test-id*='user-query' i]",
      "[class*='user-message' i]",
      "[class*='human-message' i]",
      "[class*='font-user-message' i]",
      "user-query"
    ].join(","),
    role: "user"
  },
  {
    selector: [
      "[data-testid*='assistant-message' i]",
      "[data-test-id*='assistant-message' i]",
      "[data-testid*='bot-message' i]",
      "[data-test-id*='bot-message' i]",
      "[data-testid*='model-response' i]",
      "[data-test-id*='model-response' i]",
      "[class*='assistant-message' i]",
      "[class*='bot-message' i]",
      "[class*='model-response' i]",
      "[class*='response-container' i]",
      "[class*='font-claude-message' i]",
      "model-response",
      "response-container"
    ].join(","),
    role: "assistant"
  }
];

const GENERIC_MESSAGE_SELECTORS = [
  "[data-message-id]",
  "[data-testid*='conversation-turn' i]",
  "[data-test-id*='conversation-turn' i]",
  "[data-testid*='message' i]",
  "[data-test-id*='message' i]",
  "[class*='conversation-turn' i]",
  "[class*='chat-message' i]",
  "[class*='message-content' i]",
  "[class*='message-text' i]",
  "[class*='message_text' i]",
  "article"
];

const ROLE_HINTS = {
  user: ["user", "human", "customer", "visitor", "you", "prompt", "query", "question"],
  assistant: [
    "assistant",
    "bot",
    "ai",
    "model",
    "answer",
    "response",
    "agent",
    "gemini",
    "claude",
    "chatgpt",
    "deepseek",
    "qwen",
    "kimi",
    "mistral",
    "minimax",
    "olmo",
    "grok",
    "llama"
  ]
};

const UI_NOISE_LINES = new Set([
  "copy",
  "copy code",
  "edit",
  "retry",
  "regenerate",
  "share",
  "like",
  "dislike",
  "thumbs up",
  "thumbs down"
]);

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
    if (text && text.toLowerCase() !== currentModelName.toLowerCase()) {
      return sanitizeFileName(text);
    }
  }

  const title = (document.title || "").replace(new RegExp(`\\s*-\\s*${currentModelName}$`, "i"), "").trim();
  return sanitizeFileName(title || `${currentModel}_conversation`);
}

function normalizeText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasRoleHint(haystack, hints) {
  return hints.some((hint) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(hint)}([^a-z0-9]|$)`, "i");
    return pattern.test(haystack);
  });
}

function normalizeRole(role) {
  const value = String(role || "")
    .replace(/user-select[-_\w]*/gi, "")
    .toLowerCase();

  if (hasRoleHint(value, ROLE_HINTS.user)) {
    return "user";
  }

  if (hasRoleHint(value, ROLE_HINTS.assistant)) {
    return "assistant";
  }

  return null;
}

function safeQuerySelectorAll(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    console.warn("[content] invalid selector skipped:", selector, error);
    return [];
  }
}

function isVisibleElement(node) {
  if (!(node instanceof Element)) {
    return false;
  }

  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  return node.getClientRects().length > 0;
}

function stripUiNoise(text) {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => !UI_NOISE_LINES.has(line.toLowerCase()))
    .join("\n")
    .trim();
}

function getNodeText(node) {
  const clone = node.cloneNode(true);
  clone
    .querySelectorAll("script, style, noscript, svg, button, input, textarea, select, nav, aside, footer, header, [aria-hidden='true']")
    .forEach((child) => child.remove());

  return stripUiNoise(clone.innerText || clone.textContent || node.innerText || node.textContent || "");
}

function getRoleFromNode(node) {
  const attrNames = [
    "data-message-author-role",
    "data-author-role",
    "data-role",
    "data-testid",
    "data-test-id",
    "aria-label",
    "class",
    "id"
  ];
  const values = [];
  let current = node;

  for (let depth = 0; current && current !== document.body && depth < 4; depth += 1) {
    attrNames.forEach((attr) => {
      const value = current.getAttribute?.(attr);
      if (value) values.push(value);
    });
    current = current.parentElement;
  }

  return normalizeRole(values.join(" "));
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, " ");
}

function isProbablyMessageText(text) {
  const compact = compactText(text);
  if (compact.length < 2 || compact.length > 60000) {
    return false;
  }

  const lowered = compact.toLowerCase();
  const pageTitle = (document.title || "").trim().toLowerCase();
  if (lowered === currentModelName.toLowerCase() || (pageTitle && lowered === pageTitle)) {
    return false;
  }

  return true;
}

function appendCandidate(candidates, node, role, text) {
  if (!isProbablyMessageText(text)) {
    return;
  }

  const compact = compactText(text);
  const duplicate = candidates.some((item) => item.compact === compact);
  if (duplicate) {
    return;
  }

  const containsExisting = candidates.some((item) => node.contains(item.node) && compact.includes(item.compact));
  if (containsExisting) {
    return;
  }

  candidates.push({
    node,
    role,
    text: normalizeText(text),
    compact
  });
}

function sortCandidatesByDomOrder(candidates) {
  return candidates.sort((a, b) => {
    if (a.node === b.node) return 0;
    const position = a.node.compareDocumentPosition(b.node);
    return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
  });
}

function finalizeCandidates(candidates, allowSingleConversation = false) {
  const ordered = sortCandidatesByDomOrder(candidates);
  if (ordered.length === 1 && allowSingleConversation && !ordered[0].role) {
    return [{ role: "conversation", text: ordered[0].text }];
  }

  return ordered.map((item, index) => ({
    role: item.role || (index % 2 === 0 ? "user" : "assistant"),
    text: item.text
  }));
}

function collectRoleBasedMessages() {
  const nodes = document.querySelectorAll("[data-message-author-role]");
  const messages = [];

  nodes.forEach((node) => {
    const role = normalizeRole(node.getAttribute("data-message-author-role"));
    const text = getNodeText(node);
    if (!role || !text) return;

    messages.push({ role, text });
  });

  return messages;
}

function collectConfiguredMessages(configs, allowUnknownRole = false) {
  const candidates = [];

  configs.forEach((config) => {
    safeQuerySelectorAll(config.selector).forEach((node) => {
      if (!isVisibleElement(node)) {
        return;
      }

      const role = config.role || normalizeRole(node.getAttribute(config.attr)) || getRoleFromNode(node);
      if (!role && !allowUnknownRole) {
        return;
      }

      appendCandidate(candidates, node, role, getNodeText(node));
    });
  });

  return finalizeCandidates(candidates);
}

function collectArticleMessages() {
  const articles = document.querySelectorAll("article");
  const messages = [];

  articles.forEach((article, index) => {
    const text = getNodeText(article);
    if (!text) return;

    const role = getRoleFromNode(article) || (index % 2 === 0 ? "user" : "assistant");
    messages.push({ role, text });
  });

  return messages;
}

function collectGenericMessages() {
  const candidates = [];

  GENERIC_MESSAGE_SELECTORS.forEach((selector) => {
    safeQuerySelectorAll(selector).forEach((node) => {
      if (!isVisibleElement(node)) {
        return;
      }

      appendCandidate(candidates, node, getRoleFromNode(node), getNodeText(node));
    });
  });

  if (candidates.length === 0) {
    return [];
  }

  const hasRoleAwareCandidate = candidates.some((item) => item.role);
  if (candidates.length === 1 && !hasRoleAwareCandidate && candidates[0].compact.length < 40) {
    return [];
  }

  return finalizeCandidates(candidates, true);
}

function collectMainTranscript() {
  const roots = [
    document.querySelector("main"),
    document.querySelector("[role='main']"),
    document.querySelector("[data-testid*='conversation' i]"),
    document.querySelector("[class*='conversation' i]")
  ].filter(Boolean);

  const candidates = roots
    .map((root) => ({
      role: "conversation",
      text: getNodeText(root)
    }))
    .filter((item) => isProbablyMessageText(item.text))
    .sort((a, b) => b.text.length - a.text.length);

  if (candidates.length === 0 || compactText(candidates[0].text).length < 80) {
    return [];
  }

  return [candidates[0]];
}

function getConversationMessages() {
  const roleBased = collectRoleBasedMessages();
  if (roleBased.length > 0) {
    return roleBased;
  }

  const configured = collectConfiguredMessages(ROLE_SELECTOR_CONFIGS);
  if (configured.length > 0) {
    return configured;
  }

  const generic = collectGenericMessages();
  if (generic.length > 0) {
    return generic;
  }

  const articleMessages = collectArticleMessages();
  if (articleMessages.length > 0) {
    return articleMessages;
  }

  return collectMainTranscript();
}

function toMarkdownContent(title, messages) {
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const roleLabels = {
    assistant: "Assistant",
    user: "User",
    conversation: "Conversation"
  };
  const body = messages
    .map((message) => {
      const heading = `## ${roleLabels[message.role] || "Message"}`;
      return `${heading}\n\n${message.text}`;
    })
    .join("\n\n---\n\n");

  return `# ${title}\n\n- 来源: ${currentModelName}\n- URL: ${location.href}\n- 更新时间: ${timestamp}\n- 消息数: ${messages.length}\n\n---\n\n${body}\n`;
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
        sourceUrl: location.href,
        rawText: snapshot,
        modelKey: currentModel
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
