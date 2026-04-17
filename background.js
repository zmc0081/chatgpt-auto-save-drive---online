const DRIVE_FOLDER_ID = "1Mu4eKgcwvtv_Q53lf5MIjOWylwc3esiF";
const MAX_RETRY = 10;
const UPLOAD_STATE_KEY = "uploadState";

let uploadQueue = [];
let processing = false;

function getDefaultState() {
  return {
    totalCount: 0,
    successCount: 0,
    failedItems: [],
    lastErrorNotice: ""
  };
}

async function getState() {
  const result = await chrome.storage.local.get(UPLOAD_STATE_KEY);
  return result[UPLOAD_STATE_KEY] || getDefaultState();
}

async function setState(state) {
  await chrome.storage.local.set({ [UPLOAD_STATE_KEY]: state });
  await updateBadge(state.successCount, state.totalCount);
}

async function updateBadge(success, total) {
  await chrome.action.setBadgeBackgroundColor({ color: "#0A84FF" });
  if (total <= 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  await chrome.action.setBadgeText({ text: `${success}/${total}`.slice(0, 4) });
}

async function getAccessToken() {
  const result = await chrome.identity.getAuthToken({ interactive: true });
  if (typeof result === "string") return result;
  if (result && typeof result.token === "string") return result.token;
  throw new Error("未获取到 access token");
}

async function uploadTextFileToDrive({ filename, content, mimeType = "text/markdown" }) {
  const token = await getAccessToken();

  const metadata = {
    name: filename,
    parents: [DRIVE_FOLDER_ID]
  };

  const boundary = "foo_bar_baz";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelim;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
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
    throw new Error(`上传失败: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

async function processQueue() {
  if (processing || uploadQueue.length === 0) return;

  processing = true;
  const item = uploadQueue.shift();

  try {
    await uploadTextFileToDrive(item.payload);

    const state = await getState();
    state.successCount += 1;
    await setState(state);
  } catch (error) {
    item.retry = (item.retry || 0) + 1;

    if (item.retry < MAX_RETRY) {
      uploadQueue.push(item);
    } else {
      const state = await getState();
      state.lastErrorNotice = "文件上传失败";
      state.failedItems.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        payload: item.payload,
        error: error.message,
        retry: item.retry
      });
      await setState(state);
    }
  } finally {
    processing = false;
    if (uploadQueue.length > 0) {
      setTimeout(processQueue, 800);
    }
  }
}

async function enqueueUpload(payload) {
  const state = await getState();
  state.totalCount += 1;
  await setState(state);

  uploadQueue.push({ payload, retry: 0 });
  processQueue();
}

chrome.runtime.onInstalled.addListener(async () => {
  await setState(getDefaultState());
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === "ENQUEUE_UPLOAD") {
    enqueueUpload(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_UPLOAD_STATUS") {
    getState()
      .then((state) => sendResponse({ ok: true, state }))
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
        await setState(state);
        uploadQueue.push({ payload: failedItem.payload, retry: 0 });
        processQueue();

        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
