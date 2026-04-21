const MAX_RETRY = 10;
const UPLOAD_STATE_KEY = "uploadState";
const CHATGPT_URL_PATTERNS = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*"
];

// ===== OAuth Token management =====

const FOLDER_NAME = "ChatGPT-AutoSave";
const FOLDER_STORAGE_KEY = "drive_folder_id";
const FILE_MAP_PREFIX = "file_map_";

let uploadQueue = [];
let processing = false;

function getDefaultState() {
  return {
    pendingCount: 0,
    isSyncing: false,
    isAvailable: true,
    requiresAuth: false,
    lastSyncTime: "",
    failedItems: [],
    lastErrorNotice: ""
  };
}

async function getState() {
  const result = await chrome.storage.local.get(UPLOAD_STATE_KEY);
  return result[UPLOAD_STATE_KEY] || getDefaultState();
}

async function hasOpenChatGPTTab() {
  const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS });
  return tabs.length > 0;
}

async function setBadgeTextColor(color) {
  if (typeof chrome.action.setBadgeTextColor === "function") {
    await chrome.action.setBadgeTextColor({ color });
  }
}

function getBadgeConfig(stateName) {
  const config = {
    ON: { text: "ON", color: "#4CAF50" },
    ING: { text: "ING", color: "#FF9800" },
    OFF: { text: "OFF", color: "#9E9E9E" },
    AUTH: { text: "AUTH", color: "#F44336" }
  };
  return config[stateName] || config.OFF;
}

async function setBadge(stateName) {
  const badge = getBadgeConfig(stateName);
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await setBadgeTextColor("#FFFFFF");
  await chrome.action.setBadgeText({ text: badge.text });
}

async function clearBadge() {
  await chrome.action.setBadgeText({ text: "" });
}

async function updateBadge(state) {
  const hasChatGPT = await hasOpenChatGPTTab();
  if (!hasChatGPT) {
    await clearBadge();
    return;
  }

  if (state.requiresAuth) {
    await setBadge("AUTH");
    return;
  }

  if (!state.isAvailable) {
    await setBadge("OFF");
    return;
  }

  if (state.isSyncing && state.pendingCount > 0) {
    await setBadge("ING");
    return;
  }

  await setBadge("ON");
}

async function setState(state) {
  await chrome.storage.local.set({ [UPLOAD_STATE_KEY]: state });
  await updateBadge(state);
}

async function refreshBadgeFromCurrentState() {
  await updateBadge(await getState());
}

function getFileMapKey(key) {
  return `${FILE_MAP_PREFIX}${key ?? "default"}`;
}

function sanitizeFileNamePart(value, fallback = "conversation") {
  const sanitized = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return sanitized || fallback;
}

function buildFileDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFileBucketKey(payload = {}) {
  const titleKey = sanitizeFileNamePart(payload.conversationTitle, "chatgpt-conversation")
    .toLowerCase();
  return `${titleKey}_${buildFileDateStamp()}`;
}

function buildConversationSectionKey(payload = {}) {
  if (payload.conversationId) {
    return `conversation_${payload.conversationId}`;
  }

  if (payload.pageUrl) {
    return `url_${payload.pageUrl}`;
  }

  return `window_${payload.windowId ?? "default"}`;
}

function buildFileName(payload = {}) {
  const titlePart = sanitizeFileNamePart(payload.conversationTitle, "ChatGPT Conversation");
  return `${titlePart} ${buildFileDateStamp()}.md`;
}

function buildSectionLabel(payload = {}) {
  if (payload.conversationId) {
    return `Conversation ${payload.conversationId}`;
  }

  if (payload.pageUrl) {
    return payload.pageUrl;
  }

  return `Window ${payload.windowId ?? "default"}`;
}

function stripConversationHeader(content) {
  return String(content || "")
    .replace(/^# ChatGPT Conversation\s*\n> Synced at: .*?\n\n---\n\n/s, "")
    .trim();
}

function buildDocumentHeader(payload = {}) {
  const title = payload.conversationTitle || "ChatGPT Conversation";
  const date = buildFileDateStamp();
  return `# ${title}\n\n> Archive date: ${date}\n> Source: ChatGPT Auto Save to Google Drive\n`;
}

function buildConversationSection(payload = {}) {
  const sectionLabel = buildSectionLabel(payload);
  const sourceLines = [
    `## ${sectionLabel}`,
    "",
    `> Last synced: ${new Date().toISOString()}`
  ];

  if (payload.pageUrl) {
    sourceLines.push(`> URL: ${payload.pageUrl}`);
  }

  if (payload.conversationId) {
    sourceLines.push(`> Conversation ID: ${payload.conversationId}`);
  }

  const body = stripConversationHeader(payload.content);
  return `${sourceLines.join("\n")}\n\n${body}\n`;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeConversationContent(existingContent, payload = {}) {
  const sectionKey = buildConversationSectionKey(payload);
  const startMarker = `<!-- AUTOSAVE SECTION START: ${sectionKey} -->`;
  const endMarker = `<!-- AUTOSAVE SECTION END: ${sectionKey} -->`;
  const sectionBlock =
    `${startMarker}\n${buildConversationSection(payload)}\n${endMarker}`;

  const hasExistingContent = String(existingContent || "").trim().length > 0;
  const baseContent = hasExistingContent
    ? String(existingContent).trim()
    : buildDocumentHeader(payload).trim();

  const sectionPattern = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    "m"
  );

  if (sectionPattern.test(baseContent)) {
    return `${baseContent.replace(sectionPattern, sectionBlock)}\n`;
  }

  return `${baseContent}\n\n---\n\n${sectionBlock}\n`;
}

function buildSyncPayloadFromMessage(message, windowId) {
  if (message?.type === "SYNC_CONVERSATION") {
    return {
      content: String(message.content || ""),
      mimeType: "text/markdown",
      windowId: windowId ?? "default",
      conversationId: String(message.conversationId || ""),
      conversationTitle: String(message.conversationTitle || ""),
      pageUrl: String(message.pageUrl || "")
    };
  }

  return {
    ...message.payload,
    windowId: windowId ?? "default"
  };
}

async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(token || "");
    });
  });
}

async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

function isAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("oauth2 not granted") ||
    message.includes("user did not approve access") ||
    message.includes("user canceled") ||
    message.includes("login required") ||
    message.includes("not signed in")
  );
}

async function getValidToken() {
  let token = "";

  try {
    token = await getAuthToken(false);
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }
  }

  if (!token) {
    token = await getAuthToken(true);
  }

  const res = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`
  );

  if (!res.ok) {
    await removeCachedToken(token);
    token = await getAuthToken(true);
  }

  return token;
}

function buildDriveError(action, response, responseText) {
  const error = new Error(`${action}: ${response.status} ${responseText}`);
  error.status = response.status;
  error.responseText = responseText;
  return error;
}

async function driveFetch(url, options = {}) {
  let token = await getValidToken();
  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status !== 401) {
    return response;
  }

  await removeCachedToken(token);
  token = await getAuthToken(true);

  response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  return response;
}

// ===== Google Drive folder management =====

async function validateFolder(token, folderId) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed,mimeType`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    return !data.trashed && data.mimeType === "application/vnd.google-apps.folder";
  } catch {
    return false;
  }
}

async function getOrCreateFolder(token) {
  const cached = await chrome.storage.local.get(FOLDER_STORAGE_KEY);
  if (cached[FOLDER_STORAGE_KEY]) {
    const folderId = cached[FOLDER_STORAGE_KEY];
    const valid = await validateFolder(token, folderId);
    if (valid) return folderId;
  }

  const searchUrl =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      spaces: "drive"
    });

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchText = await searchRes.text();
  if (!searchRes.ok) {
    throw buildDriveError("Search folder failed", searchRes, searchText);
  }

  const searchData = JSON.parse(searchText);
  if (searchData.files && searchData.files.length > 0) {
    const folderId = searchData.files[0].id;
    await chrome.storage.local.set({ [FOLDER_STORAGE_KEY]: folderId });
    return folderId;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder"
    })
  });
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw buildDriveError("Create folder failed", createRes, createText);
  }

  const folder = JSON.parse(createText);
  await chrome.storage.local.set({ [FOLDER_STORAGE_KEY]: folder.id });
  return folder.id;
}

// ===== File upload / update =====

async function validateFile(token, fileId, folderId) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed,parents`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data.trashed) return false;
    if (folderId && Array.isArray(data.parents) && !data.parents.includes(folderId)) {
      return false;
    }
    return Boolean(data.id);
  } catch {
    return false;
  }
}

async function createFile(token, folderId, fileName, content) {
  const metadata = {
    name: fileName,
    mimeType: "text/markdown",
    parents: [folderId]
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([content], { type: "text/markdown" }));

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw buildDriveError("Create file failed", res, text);
  }

  const data = JSON.parse(text);
  return data.id;
}

async function findFileIdByName(token, folderId, fileName) {
  const searchUrl =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q: [
        `name='${fileName.replace(/'/g, "\\'")}'`,
        `'${folderId}' in parents`,
        "trashed=false"
      ].join(" and "),
      fields: "files(id,name)",
      spaces: "drive"
    });

  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  if (!res.ok) {
    throw buildDriveError("Find file by name failed", res, text);
  }

  const data = JSON.parse(text);
  return data.files?.[0]?.id || null;
}

async function readFileContent(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw buildDriveError("Read file failed", res, text);
  }
  return text;
}

async function updateFile(token, fileId, content) {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/markdown"
      },
      body: content
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw buildDriveError("Update file failed", res, text);
  }
}

async function syncToDrive(payload) {
  let token = await getValidToken();
  let folderId = await getOrCreateFolder(token);
  const fileName = buildFileName(payload);
  const fileMapKey = getFileMapKey(buildFileBucketKey(payload));
  const cached = await chrome.storage.local.get(fileMapKey);
  let fileId = cached[fileMapKey] || null;

  if (fileId) {
    const valid = await validateFile(token, fileId, folderId);
    if (!valid) fileId = null;
  }

  try {
    if (!fileId) {
      fileId = await findFileIdByName(token, folderId, fileName);
      if (fileId) {
        await chrome.storage.local.set({ [fileMapKey]: fileId });
      }
    }

    let mergedContent = mergeConversationContent("", payload);

    if (fileId) {
      const existingContent = await readFileContent(token, fileId);
      mergedContent = mergeConversationContent(existingContent, payload);
      await updateFile(token, fileId, mergedContent);
      return { fileId, fileName };
    }

    fileId = await createFile(token, folderId, fileName, mergedContent);
    await chrome.storage.local.set({ [fileMapKey]: fileId });
    return { fileId, fileName };
  } catch (error) {
    if (error?.status !== 401) {
      throw error;
    }

    await removeCachedToken(token);
    token = await getAuthToken(true);
    folderId = await getOrCreateFolder(token);

    if (!fileId) {
      fileId = await findFileIdByName(token, folderId, fileName);
      if (fileId) {
        await chrome.storage.local.set({ [fileMapKey]: fileId });
      }
    }

    let mergedContent = mergeConversationContent("", payload);

    if (fileId) {
      const existingContent = await readFileContent(token, fileId);
      mergedContent = mergeConversationContent(existingContent, payload);
      await updateFile(token, fileId, mergedContent);
      return { fileId, fileName };
    }

    fileId = await createFile(token, folderId, fileName, mergedContent);
    await chrome.storage.local.set({ [fileMapKey]: fileId });
    return { fileId, fileName };
  }
}

function buildFailedItem(payload, error, retry) {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    payload: {
      ...payload,
      filename: buildFileName(payload)
    },
    error: error.message,
    retry
  };
}

async function markItemFinished() {
  const state = await getState();
  state.pendingCount = Math.max(0, state.pendingCount - 1);
  state.isSyncing = state.pendingCount > 0 || uploadQueue.length > 0;
  state.isAvailable = true;
  state.requiresAuth = false;
  state.lastSyncTime = new Date().toISOString();
  await setState(state);
}

async function markItemFailed(item, error) {
  const state = await getState();
  state.lastErrorNotice = isAuthError(error) ? "Google authorization is required" : "File upload failed";
  state.isAvailable = !isAuthError(error);
  state.requiresAuth = isAuthError(error);
  state.failedItems.push(buildFailedItem(item.payload, error, item.retry));
  state.pendingCount = Math.max(0, state.pendingCount - 1);
  state.isSyncing = state.pendingCount > 0 || uploadQueue.length > 0;
  await setState(state);
}

async function processQueue() {
  if (processing || uploadQueue.length === 0) return;

  processing = true;
  const item = uploadQueue.shift();

  try {
    await syncToDrive(item.payload);
    await markItemFinished();
  } catch (error) {
    item.retry = (item.retry || 0) + 1;

    if (item.retry < MAX_RETRY && !isAuthError(error)) {
      uploadQueue.push(item);
    } else {
      await markItemFailed(item, error);
    }
  } finally {
    processing = false;

    if (uploadQueue.length > 0) {
      setTimeout(processQueue, 800);
      return;
    }

    const state = await getState();
    if (state.pendingCount === 0 && state.isSyncing) {
      state.isSyncing = false;
      await setState(state);
    }
  }
}

async function enqueueUpload(payload) {
  const state = await getState();
  state.pendingCount += 1;
  state.isSyncing = true;
  state.isAvailable = true;
  state.requiresAuth = false;
  await setState(state);

  uploadQueue.push({ payload, retry: 0 });
  void processQueue();
}

async function getStatusSummary() {
  const [state, hasChatGPTTab] = await Promise.all([getState(), hasOpenChatGPTTab()]);
  let badgeState = "OFF";

  if (hasChatGPTTab) {
    if (state.requiresAuth) {
      badgeState = "AUTH";
    } else if (!state.isAvailable) {
      badgeState = "OFF";
    } else if (state.isSyncing && state.pendingCount > 0) {
      badgeState = "ING";
    } else {
      badgeState = "ON";
    }
  }

  return {
    state: badgeState,
    lastSyncTime: state.lastSyncTime || "",
    hasChatGPTTab,
    details: state
  };
}

async function getFailedTasks() {
  const state = await getState();
  return state.failedItems.map((item) => ({
    id: item.id,
    windowId: item.payload?.windowId ?? "default",
    filename: item.payload?.filename || "",
    error: item.error || "Unknown error",
    retry: item.retry || 0
  }));
}

async function retryFailedTaskById(taskId) {
  const state = await getState();
  const index = state.failedItems.findIndex((item) => item.id === taskId);
  if (index < 0) {
    throw new Error("Failed task not found");
  }

  const [failedItem] = state.failedItems.splice(index, 1);
  state.pendingCount += 1;
  state.isSyncing = true;
  state.isAvailable = true;
  state.requiresAuth = false;
  await setState(state);

  uploadQueue.push({ payload: failedItem.payload, retry: 0 });
  void processQueue();
}

async function retryAllFailedTasks() {
  const state = await getState();
  if (state.failedItems.length === 0) {
    return 0;
  }

  const queuedItems = state.failedItems.splice(0, state.failedItems.length);
  state.pendingCount += queuedItems.length;
  state.isSyncing = true;
  state.isAvailable = true;
  state.requiresAuth = false;
  await setState(state);

  queuedItems.forEach((item) => {
    uploadQueue.push({ payload: item.payload, retry: 0 });
  });
  void processQueue();

  return queuedItems.length;
}

chrome.runtime.onInstalled.addListener(async () => {
  await setState(getDefaultState());
});

chrome.runtime.onStartup?.addListener(async () => {
  await setState(getDefaultState());
  await refreshBadgeFromCurrentState();
});

chrome.tabs.onActivated.addListener(() => {
  void refreshBadgeFromCurrentState();
});

chrome.tabs.onUpdated.addListener(() => {
  void refreshBadgeFromCurrentState();
});

chrome.tabs.onRemoved.addListener(() => {
  void refreshBadgeFromCurrentState();
});

chrome.windows.onFocusChanged.addListener(() => {
  void refreshBadgeFromCurrentState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === "ENQUEUE_UPLOAD" || message.type === "SYNC_CONVERSATION") {
    const windowId = sender?.tab?.windowId;
    enqueueUpload(buildSyncPayloadFromMessage(message, windowId))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_UPLOAD_STATUS") {
    Promise.all([getState(), hasOpenChatGPTTab()])
      .then(([state, hasChatGPTTab]) => sendResponse({ ok: true, state: { ...state, hasChatGPTTab } }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_STATUS") {
    getStatusSummary()
      .then((summary) => sendResponse({ ok: true, ...summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_FAILED_TASKS") {
    getFailedTasks()
      .then((tasks) => sendResponse({ ok: true, tasks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_UPLOAD_NOTICE") {
    getState()
      .then(async (state) => {
        state.lastErrorNotice = "";
        await setState(state);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RETRY_FAILED_UPLOAD") {
    retryFailedTaskById(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RETRY_TASK") {
    getState()
      .then(async (state) => {
        const task = state.failedItems[Number(message.index)];
        if (!task?.id) {
          sendResponse({ ok: false, error: "Failed task not found" });
          return;
        }

        await retryFailedTaskById(task.id);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RETRY_ALL") {
    retryAllFailedTasks()
      .then((count) => sendResponse({ ok: true, count }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
