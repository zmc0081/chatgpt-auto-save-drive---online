const ROOT_FOLDER_NAME = "AI Chats Auto Save";
const MAX_RETRY = 10;
const UPLOAD_STATE_KEY = "uploadState";
const WINDOW_FILE_MAP_KEY = "windowFileMap";
const ROOT_FOLDER_CACHE_KEY = "rootFolderId";
const SUBFOLDER_CACHE_KEY = "subfolderCache";
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// AI模型配置
const AI_MODELS = {
  chatgpt: {
    name: "ChatGPT",
    urlPatterns: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    folderName: "ChatGPT"
  },
  claude: {
    name: "Claude",
    urlPatterns: ["https://claude.ai/*"],
    folderName: "Claude"
  },
  deepseek: {
    name: "DeepSeek",
    urlPatterns: ["https://chat.deepseek.com/*"],
    folderName: "DeepSeek"
  },
  gemini: {
    name: "Gemini",
    urlPatterns: ["https://gemini.google.com/*"],
    folderName: "Gemini"
  },
  grok: {
    name: "Grok",
    urlPatterns: ["https://grok.x.com/*"],
    folderName: "Grok"
  },
  llama: {
    name: "Llama",
    urlPatterns: ["https://llama.meta.com/*"],
    folderName: "Llama"
  },
  mistral: {
    name: "Mistral",
    urlPatterns: ["https://chat.mistral.ai/*"],
    folderName: "Mistral"
  },
  qwen: {
    name: "Qwen",
    urlPatterns: ["https://qwenlm.aliyun.com/*"],
    folderName: "Qwen"
  },
  minimax: {
    name: "MiniMax",
    urlPatterns: ["https://chat.minimax.ai/*"],
    folderName: "MiniMax"
  },
  olmo: {
    name: "Olmo",
    urlPatterns: ["https://olmo.allenai.org/*"],
    folderName: "Olmo"
  },
  kimi: {
    name: "Kimi",
    urlPatterns: ["https://kimi.moonshot.cn/*"],
    folderName: "Kimi"
  }
};

// 支持所有模型的URL patterns
const ALL_URL_PATTERNS = Object.values(AI_MODELS).flatMap(m => m.urlPatterns);

let uploadQueue = [];
let processing = false;

function getDefaultState() {
  return {
    pendingCount: 0,
    isSyncing: false,
    isAvailable: true,
    isConnected: false,
    rootFolderId: "",
    failedItems: [],
    lastErrorNotice: ""
  };
}

function normalizeState(state = {}) {
  const defaults = getDefaultState();
  return {
    ...defaults,
    ...state,
    failedItems: Array.isArray(state.failedItems) ? state.failedItems : defaults.failedItems
  };
}

async function getState() {
  const result = await chrome.storage.local.get(UPLOAD_STATE_KEY);
  return normalizeState(result[UPLOAD_STATE_KEY]);
}

async function hasAIChatTab() {
  try {
    const tabs = await chrome.tabs.query({ url: ALL_URL_PATTERNS });
    return tabs.length > 0;
  } catch (error) {
    console.warn("[background] unable to query AI chat tabs:", error);
    return false;
  }
}

// 获取标签页所属的大模型
async function getModelFromTab(tab) {
  const url = tab.url || "";
  for (const [modelKey, modelConfig] of Object.entries(AI_MODELS)) {
    const matches = modelConfig.urlPatterns.map(p => p.replace("/*", ""));
    if (matches.some(pattern => url.startsWith(pattern))) {
      return modelKey;
    }
  }
  return null;
}

// 根据URL获取大模型
function getModelFromUrl(url = "") {
  for (const [modelKey, modelConfig] of Object.entries(AI_MODELS)) {
    const matches = modelConfig.urlPatterns.map(p => p.replace("/*", ""));
    if (matches.some(pattern => url.startsWith(pattern))) {
      return modelKey;
    }
  }
  return null;
}

function normalizeModelKey(modelKey, url = "") {
  if (modelKey && AI_MODELS[modelKey]) {
    return modelKey;
  }

  return getModelFromUrl(url) || "chatgpt";
}

async function setState(state) {
  const nextState = normalizeState(state);
  await chrome.storage.local.set({ [UPLOAD_STATE_KEY]: nextState });
  try {
    await updateBadge(nextState);
  } catch (error) {
    console.warn("[background] unable to update badge:", error);
  }
}

async function setBadgeTextColor(color) {
  if (typeof chrome.action.setBadgeTextColor === "function") {
    await chrome.action.setBadgeTextColor({ color });
  }
}

async function clearBadge() {
  await chrome.action.setBadgeText({ text: "" });
}

async function updateBadge(state) {
  const hasAIChat = await hasAIChatTab();
  if (!hasAIChat) {
    await clearBadge();
    return;
  }

  if (!state.isConnected || !state.isAvailable) {
    await chrome.action.setBadgeBackgroundColor({ color: "#DC2626" });
    await setBadgeTextColor("#FFFFFF");
    await chrome.action.setBadgeText({ text: "OFF" });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#16A34A" });
  await setBadgeTextColor("#FFFFFF");

  if (state.isSyncing && state.pendingCount > 0) {
    await chrome.action.setBadgeText({ text: "ING" });
    return;
  }

  await chrome.action.setBadgeText({ text: "ON" });
}

async function refreshBadgeFromCurrentState() {
  await updateBadge(await getState());
}

async function getSubfolderCache() {
  const result = await chrome.storage.local.get(SUBFOLDER_CACHE_KEY);
  return result[SUBFOLDER_CACHE_KEY] || {};
}

async function setSubfolderCache(cache) {
  await chrome.storage.local.set({ [SUBFOLDER_CACHE_KEY]: cache });
}

async function getRootFolderCache() {
  const result = await chrome.storage.local.get(ROOT_FOLDER_CACHE_KEY);
  return result[ROOT_FOLDER_CACHE_KEY] || "";
}

async function setRootFolderCache(folderId) {
  await chrome.storage.local.set({ [ROOT_FOLDER_CACHE_KEY]: folderId });
}

async function clearRootFolderCache() {
  await chrome.storage.local.remove(ROOT_FOLDER_CACHE_KEY);
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolderByName(folderName, parentFolderId) {
  const token = await getAccessToken();
  const parentClause = parentFolderId ? ` and '${escapeDriveQueryValue(parentFolderId)}' in parents` : "";
  const query = `name='${escapeDriveQueryValue(folderName)}'${parentClause} and trashed=false and mimeType='application/vnd.google-apps.folder'`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&supportsAllDrives=true`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw buildDriveError("查询文件夹失败", response, text);
  }

  const data = JSON.parse(text);
  return data.files?.[0] || null;
}

async function createDriveFolder(folderName, parentFolderId) {
  const token = await getAccessToken();
  const metadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder"
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,parents&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(metadata)
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw buildDriveError("创建文件夹失败", response, text);
  }

  return JSON.parse(text);
}

async function getOrCreateRootFolder() {
  const cachedFolderId = await getRootFolderCache();
  if (cachedFolderId) {
    try {
      const metadata = await fetchDriveFileMetadata(cachedFolderId);
      if (metadata?.id && !metadata.trashed) {
        return metadata.id;
      }
    } catch (error) {
      if (!shouldReplaceMappedFile(error)) {
        throw error;
      }
    }

    await clearRootFolderCache();
  }

  const existingFolder = await findFolderByName(ROOT_FOLDER_NAME);
  const folderId = existingFolder?.id || (await createDriveFolder(ROOT_FOLDER_NAME)).id;
  await setRootFolderCache(folderId);
  return folderId;
}

// 获取或创建子文件夹
async function getOrCreateSubfolder(modelKey) {
  const folderName = AI_MODELS[modelKey]?.folderName;
  if (!folderName) throw new Error(`未知的模型: ${modelKey}`);

  const rootFolderId = await getOrCreateRootFolder();
  const cache = await getSubfolderCache();
  if (cache[modelKey]) {
    try {
      const metadata = await fetchDriveFileMetadata(cache[modelKey]);
      if (metadata?.id && !metadata.trashed && metadata.parents?.includes(rootFolderId)) {
        return cache[modelKey];
      }
    } catch (error) {
      if (!shouldReplaceMappedFile(error)) {
        throw error;
      }
    }

    delete cache[modelKey];
    await setSubfolderCache(cache);
  }

  const existingFolder = await findFolderByName(folderName, rootFolderId);
  const folderId = existingFolder?.id || (await createDriveFolder(folderName, rootFolderId)).id;

  cache[modelKey] = folderId;
  await setSubfolderCache(cache);

  return folderId;
}

async function getWindowFileMap() {
  const result = await chrome.storage.local.get(WINDOW_FILE_MAP_KEY);
  return result[WINDOW_FILE_MAP_KEY] || {};
}

async function setWindowFileMap(windowFileMap) {
  await chrome.storage.local.set({ [WINDOW_FILE_MAP_KEY]: windowFileMap });
}

function buildAuthRequiredError() {
  const error = new Error("请先在扩展弹窗中连接 Google Drive");
  error.requiresAuth = true;
  return error;
}

function getAuthTokenFromChrome(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(
      {
        interactive,
        scopes: DRIVE_SCOPES
      },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const token = typeof result === "string" ? result : result?.token;
        if (!token) {
          reject(new Error("未获取到 Google Drive access token"));
          return;
        }

        resolve(token);
      }
    );
  });
}

async function getAccessToken({ interactive = false } = {}) {
  try {
    return await getAuthTokenFromChrome(false);
  } catch (error) {
    if (!interactive) {
      throw buildAuthRequiredError();
    }
  }

  if (!interactive) {
    throw buildAuthRequiredError();
  }

  return await getAuthTokenFromChrome(true);
}

function buildDriveError(action, response, responseText) {
  const error = new Error(`${action}: ${response.status} ${responseText}`);
  error.status = response.status;
  error.responseText = responseText;
  return error;
}

function shouldReplaceMappedFile(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "");
  const responseText = String(error?.responseText || "");
  const haystack = `${message}\n${responseText}`.toLowerCase();

  if ([403, 404, 410].includes(status)) {
    return true;
  }

  return [
    "notfound",
    "file not found",
    "filenotfound",
    "insufficientfilepermissions",
    "cannot find file",
    "trashed"
  ].some((keyword) => haystack.includes(keyword));
}

function buildMultipartBody(metadata, content, mimeType) {
  const boundary = "foo_bar_baz";
  const delimiter = `--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n" +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelim;

  return { boundary, multipartRequestBody };
}

async function fetchDriveFileMetadata(fileId) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,trashed,parents&supportsAllDrives=true`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw buildDriveError("获取文件状态失败", response, text);
  }

  return JSON.parse(text);
}

async function createTextFileInDrive({ filename, content, mimeType = "text/markdown", parentFolderId }) {
  const token = await getAccessToken();
  const metadata = {
    name: filename
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }
  const { boundary, multipartRequestBody } = buildMultipartBody(metadata, content, mimeType);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw buildDriveError("上传失败", response, text);
  }

  return JSON.parse(text);
}

async function updateTextFileInDrive(fileId, { filename, content, mimeType = "text/markdown" }) {
  const token = await getAccessToken();
  const metadata = { name: filename };
  const { boundary, multipartRequestBody } = buildMultipartBody(metadata, content, mimeType);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw buildDriveError("更新失败", response, text);
  }

  return JSON.parse(text);
}

function buildWindowFileName(windowId, modelKey = "default") {
  return `${modelKey}-window-${windowId}.md`;
}

async function isMappedFileUsable(fileId, parentFolderId) {
  try {
    const metadata = await fetchDriveFileMetadata(fileId);
    if (metadata?.trashed) {
      return false;
    }

    if (parentFolderId && Array.isArray(metadata?.parents) && !metadata.parents.includes(parentFolderId)) {
      return false;
    }

    return Boolean(metadata?.id);
  } catch (error) {
    if (shouldReplaceMappedFile(error)) {
      return false;
    }

    throw error;
  }
}

async function uploadConversationFile(payload) {
  const windowId = payload.windowId ?? "default";
  const modelKey = normalizeModelKey(payload.modelKey, payload.sourceUrl);
  const windowFileMapKey = `${modelKey}_${windowId}`;
  const filename = buildWindowFileName(windowId, modelKey);
  
  // 获取或创建子文件夹
  const subfolderIdPromise = getOrCreateSubfolder(modelKey);
  const subfolderIdOrNull = await subfolderIdPromise.catch(error => {
    console.error("获取子文件夹失败:", error);
    throw error;
  });
  
  const uploadPayload = {
    filename,
    content: payload.content,
    mimeType: payload.mimeType || "text/markdown",
    parentFolderId: subfolderIdOrNull
  };

  const windowFileMap = await getWindowFileMap();
  const existingFileId = windowFileMap[windowFileMapKey];

  if (existingFileId) {
    const canReuse = await isMappedFileUsable(existingFileId, subfolderIdOrNull);
    if (canReuse) {
      await updateTextFileInDrive(existingFileId, uploadPayload);
      return { filename };
    }

    delete windowFileMap[windowFileMapKey];
    await setWindowFileMap(windowFileMap);
  }

  const createdFile = await createTextFileInDrive(uploadPayload);
  windowFileMap[windowFileMapKey] = createdFile.id;
  await setWindowFileMap(windowFileMap);
  return { filename };
}

async function markItemFinished() {
  const state = await getState();
  state.pendingCount = Math.max(0, state.pendingCount - 1);
  state.isSyncing = state.pendingCount > 0 || uploadQueue.length > 0;
  state.isAvailable = true;
  state.isConnected = true;
  await setState(state);
}

async function processQueue() {
  if (processing || uploadQueue.length === 0) return;

  processing = true;
  const item = uploadQueue.shift();

  try {
    await uploadConversationFile(item.payload);
    await markItemFinished();
  } catch (error) {
    item.retry = (item.retry || 0) + 1;

    if (!error.requiresAuth && item.retry < MAX_RETRY) {
      uploadQueue.push(item);
    } else {
      const state = await getState();
      state.lastErrorNotice = error.requiresAuth ? error.message : "文件上传失败";
      state.isAvailable = false;
      if (error.requiresAuth) {
        state.isConnected = false;
      }
      state.failedItems.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        payload: {
          ...item.payload,
          filename: buildWindowFileName(
            item.payload.windowId ?? "default",
            normalizeModelKey(item.payload.modelKey, item.payload.sourceUrl)
          )
        },
        error: error.message,
        retry: item.retry
      });
      state.pendingCount = Math.max(0, state.pendingCount - 1);
      state.isSyncing = state.pendingCount > 0 || uploadQueue.length > 0;
      await setState(state);
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
  if (!state.isConnected) {
    state.isAvailable = false;
    state.isSyncing = false;
    state.lastErrorNotice = "请先在扩展弹窗中连接 Google Drive";
    await setState(state);
    return;
  }

  state.pendingCount += 1;
  state.isSyncing = true;
  state.isAvailable = true;
  await setState(state);

  uploadQueue.push({ payload, retry: 0 });
  void processQueue();
}

async function connectGoogleDrive() {
  await getAccessToken({ interactive: true });
  const rootFolderId = await getOrCreateRootFolder();

  const state = await getState();
  state.isConnected = true;
  state.isAvailable = true;
  state.rootFolderId = rootFolderId;
  state.lastErrorNotice = "";
  await setState(state);

  return { rootFolderId };
}

async function disconnectGoogleDrive() {
  if (typeof chrome.identity.clearAllCachedAuthTokens === "function") {
    await chrome.identity.clearAllCachedAuthTokens();
  }

  uploadQueue = [];
  const state = await getState();
  state.isConnected = false;
  state.isAvailable = false;
  state.isSyncing = false;
  state.pendingCount = 0;
  state.rootFolderId = "";
  state.lastErrorNotice = "";
  await setState(state);
}

async function initializeState() {
  const state = await getState();
  state.pendingCount = 0;
  state.isSyncing = false;

  try {
    await getAccessToken();
    state.isConnected = true;
    state.isAvailable = true;
    state.rootFolderId = await getRootFolderCache();
  } catch (error) {
    state.isConnected = false;
    state.isAvailable = false;
    state.rootFolderId = "";
  }

  await setState(state);
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeState();
});

chrome.runtime.onStartup?.addListener(async () => {
  await initializeState();
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

  if (message.type === "CONNECT_GOOGLE_DRIVE") {
    connectGoogleDrive()
      .then(({ rootFolderId }) => sendResponse({ ok: true, rootFolderId }))
      .catch(async (error) => {
        const state = await getState();
        state.isConnected = false;
        state.isAvailable = false;
        state.lastErrorNotice = error.message || "Google Drive 连接失败";
        await setState(state);
        sendResponse({ ok: false, error: state.lastErrorNotice });
      });
    return true;
  }

  if (message.type === "DISCONNECT_GOOGLE_DRIVE") {
    disconnectGoogleDrive()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ENQUEUE_UPLOAD") {
    const windowId = sender?.tab?.windowId;
    const sourceUrl = message.payload?.sourceUrl || sender?.tab?.url || "";
    enqueueUpload({
      ...message.payload,
      sourceUrl,
      modelKey: normalizeModelKey(message.payload?.modelKey, sourceUrl),
      windowId
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_UPLOAD_STATUS") {
    Promise.all([getState(), hasAIChatTab()])
      .then(([state, hasAIChatTab]) => sendResponse({ ok: true, state: { ...state, hasAIChatTab } }))
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
    getState()
      .then(async (state) => {
        const index = state.failedItems.findIndex((item) => item.id === message.id);
        if (index < 0) {
          sendResponse({ ok: false, error: "未找到失败任务" });
          return;
        }

        if (!state.isConnected) {
          sendResponse({ ok: false, error: "请先在扩展弹窗中连接 Google Drive" });
          return;
        }

        const [failedItem] = state.failedItems.splice(index, 1);
        state.pendingCount += 1;
        state.isSyncing = true;
        state.isAvailable = true;
        await setState(state);

        uploadQueue.push({ payload: failedItem.payload, retry: 0 });
        void processQueue();

        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
