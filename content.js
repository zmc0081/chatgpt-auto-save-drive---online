const SELECTORS = {
  conversationContainer: [
    "main div.flex.flex-col.items-center",
    'main div[class*="react-scroll-to-bottom"]',
    'div[role="presentation"]',
    "main"
  ],
  messageItem: [
    "div[data-message-id]",
    "[data-message-author-role]",
    "div.group\\/conversation-turn",
    'div[class*="ConversationItem"]',
    "article"
  ],
  messageContent: [
    "div.markdown",
    'div[class*="markdown"]',
    "div.whitespace-pre-wrap"
  ]
};

const DEBOUNCE_MS = 3000;
const FALLBACK_CHECK_MS = 10000;

let lastSnapshot = "";
let lastKnownUrl = location.href;
let debounceTimer = null;

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function queryWithFallback(parent, selectorList) {
  for (const selector of selectorList) {
    const result = parent.querySelectorAll(selector);
    if (result.length > 0) {
      return Array.from(result);
    }
  }

  return [];
}

function detectRole(messageEl) {
  const author = messageEl.getAttribute("data-message-author-role");
  if (author) {
    return author;
  }

  const labeledNode = messageEl.querySelector("[data-message-author-role]");
  const labeledAuthor = labeledNode?.getAttribute("data-message-author-role");
  if (labeledAuthor) {
    return labeledAuthor;
  }

  const img = messageEl.querySelector("img[alt]");
  if (img && img.alt.toLowerCase().includes("user")) {
    return "user";
  }

  return "assistant";
}

function getContainerRoot() {
  const candidates = queryWithFallback(document, SELECTORS.conversationContainer);
  return candidates[0] || document;
}

function extractMessageText(messageEl) {
  const contentEls = queryWithFallback(messageEl, SELECTORS.messageContent);
  if (contentEls.length > 0) {
    return normalizeText(contentEls.map((el) => el.innerText || el.textContent || "").join("\n"));
  }

  return normalizeText(messageEl.innerText || messageEl.textContent || "");
}

function extractConversation() {
  const root = getContainerRoot();
  const messageEls = queryWithFallback(root, SELECTORS.messageItem);
  if (messageEls.length === 0) {
    return null;
  }

  let markdown = "# ChatGPT Conversation\n";
  markdown += `> Synced at: ${new Date().toISOString()}\n\n---\n\n`;

  let appendedCount = 0;

  messageEls.forEach((messageEl) => {
    const role = detectRole(messageEl) === "user" ? "**User**" : "**ChatGPT**";
    const content = extractMessageText(messageEl);

    if (!content) {
      return;
    }

    markdown += `### ${role}\n\n${content}\n\n---\n\n`;
    appendedCount += 1;
  });

  return appendedCount > 0 ? markdown : null;
}

function extractConversationId() {
  const match = location.pathname.match(/\/c\/([A-Za-z0-9-]+)/);
  return match ? match[1] : "";
}

function extractConversationTitle() {
  const docTitle = normalizeText(document.title.replace(/\s*-\s*ChatGPT\s*$/i, ""));
  if (docTitle && !/^chatgpt$/i.test(docTitle)) {
    return docTitle;
  }

  const heading = document.querySelector("main h1, main h2");
  return normalizeText(heading?.textContent || "") || "ChatGPT Conversation";
}

function sendConversationSync(markdownContent) {
  chrome.runtime.sendMessage(
    {
      type: "SYNC_CONVERSATION",
      content: markdownContent,
      conversationId: extractConversationId(),
      conversationTitle: extractConversationTitle(),
      pageUrl: location.href
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("[content] sendMessage failed:", chrome.runtime.lastError.message);
      }
    }
  );
}

function scheduleSync(markdownContent) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    sendConversationSync(markdownContent);
  }, DEBOUNCE_MS);
}

function checkForChanges() {
  if (location.href !== lastKnownUrl) {
    lastKnownUrl = location.href;
    lastSnapshot = "";
  }

  const currentSnapshot = extractConversation();
  if (!currentSnapshot) {
    return;
  }

  if (currentSnapshot !== lastSnapshot) {
    lastSnapshot = currentSnapshot;
    scheduleSync(currentSnapshot);
  }
}

const observer = new MutationObserver(() => {
  checkForChanges();
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

  checkForChanges();
}

startObserver();
setInterval(checkForChanges, FALLBACK_CHECK_MS);
