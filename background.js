const DRIVE_FOLDER_ID = "1Mu4eKgcwvtv_Q53lf5MIjOWylwc3esiF";
const MAX_RETRY = 10;
const UPLOAD_STATE_KEY = "uploadState";
const WINDOW_FILE_MAP_KEY = "windowFileMap";
const CHATGPT_URL_PATTERNS = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*"
];

let uploadQueue = [];
let processing = false;

function getDefaultState() {
  return {
    pendingCount: 0,
    isSyncing: false,
    isAvailable: true,
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

async function setState(state) {
  await chrome.storage.local.set({ [UPLOAD_STATE_KEY]: state });
  await updateBadge(state);
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
  const hasChatGPT = await hasOpenChatGPTTab();
  if (!hasChatGPT) {
    await clearBadge();
    return;
  }

  if (!state.isAvailable) {
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

async function getWindowFileMap() {
  const result = await chrome.storage.local.get(WINDOW_FILE_MAP_KEY);
  return result[WINDOW_FILE_MAP_KEY] || {};
}

async function setWindowFileMap(windowFileMap) {
  await chrome.storage.local.set({ [WINDOW_FILE_MAP_KEY]: windowFileMap });
}

async function getAccessToken() {
  try {
    const cached = await chrome.identity.getAuthToken({ interactive: false });
    if (typeof cached === "string" && cached) return cached;
    if (cached?.token) return cached.token;
  } catch (error) {
    // Fall through to interactive auth.
  }

  const result = await chrome.identity.getAuthToken({ interactive: true });
  if (typeof result === "string" && result) return result;
  if (result?.token) return result.token;
  throw new Error("未获取到 Google Drive access token");
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

async function createTextFileInDrive({ filename, content, mimeType = "text/markdown" }) {
  const token = await getAccessToken();
  const metadata = {
    name: filename,
    parents: [DRIVE_FOLDER_ID]
  };
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

function buildWindowFileName(windowId) {
  return `chatgpt-window-${windowId}.md`;
}

async function isMappedFileUsable(fileId) {
  try {
    const metadata = await fetchDriveFileMetadata(fileId);
    if (metadata?.trashed) {
      return false;
    }

    if (Array.isArray(metadata?.parents) && !metadata.parents.includes(DRIVE_FOLDER_ID)) {
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
  const filename = buildWindowFileName(windowId);
  const uploadPayload = {
    filename,
    content: payload.content,
    mimeType: payload.mimeType || "text/markdown"
  };

  const windowFileMap = await getWindowFileMap();
  const existingFileId = windowFileMap[windowId];

  if (existingFileId) {
    const canReuse = await isMappedFileUsable(existingFileId);
    if (canReuse) {
      await updateTextFileInDrive(existingFileId, uploadPayload);
      return { filename };
    }

    delete windowFileMap[windowId];
    await setWindowFileMap(windowFileMap);
  }

  const createdFile = await createTextFileInDrive(uploadPayload);
  windowFileMap[windowId] = createdFile.id;
  await setWindowFileMap(windowFileMap);
  return { filename };
}

async function markItemFinished() {
  const state = await getState();
  state.pendingCount = Math.max(0, state.pendingCount - 1);
  state.isSyncing = state.pendingCount > 0 || uploadQueue.length > 0;
  state.isAvailable = true;
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

    if (item.retry < MAX_RETRY) {
      uploadQueue.push(item);
    } else {
      const state = await getState();
      state.lastErrorNotice = "文件上传失败";
      state.isAvailable = false;
      state.failedItems.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        payload: {
          ...item.payload,
          filename: buildWindowFileName(item.payload.windowId ?? "default")
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
  state.pendingCount += 1;
  state.isSyncing = true;
  state.isAvailable = true;
  await setState(state);

  uploadQueue.push({ payload, retry: 0 });
  void processQueue();
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

  if (message.type === "ENQUEUE_UPLOAD") {
    const windowId = sender?.tab?.windowId;
    enqueueUpload({
      ...message.payload,
      windowId
    })
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
