const progressEl = document.getElementById("progress");
const failedListEl = document.getElementById("failedList");
const errorNoticeEl = document.getElementById("errorNotice");
const statusBadgeEl = document.getElementById("statusBadge");
const progressHintEl = document.getElementById("progressHint");
const driveStatusEl = document.getElementById("driveStatus");
const connectButtonEl = document.getElementById("connectButton");
const folderRowEl = document.getElementById("folderRow");
const folderLinkEl = document.getElementById("folderLink");

let latestIsConnected = false;

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response || { ok: false, error: "empty response" });
    });
  });
}

function setBadgeAppearance(mode, text) {
  statusBadgeEl.textContent = text;

  if (mode === "off") {
    statusBadgeEl.style.background = "#DC2626";
    statusBadgeEl.style.color = "#FFFFFF";
    return;
  }

  statusBadgeEl.style.background = "#16A34A";
  statusBadgeEl.style.color = "#FFFFFF";
}

function showError(message) {
  if (!message) {
    errorNoticeEl.style.display = "none";
    errorNoticeEl.textContent = "";
    return;
  }

  errorNoticeEl.style.display = "block";
  errorNoticeEl.textContent = message;
}

function renderDriveFolderLink(rootFolderId) {
  if (!rootFolderId) {
    folderRowEl.style.display = "none";
    folderLinkEl.removeAttribute("href");
    return;
  }

  folderLinkEl.href = `https://drive.google.com/drive/folders/${encodeURIComponent(rootFolderId)}`;
  folderRowEl.style.display = "block";
}

function renderFailedList(items) {
  failedListEl.innerHTML = "";

  if (!items || items.length === 0) {
    failedListEl.innerHTML = '<div style="font-size:12px;color:#6b7280;">暂无失败任务</div>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item";

    const filename = document.createElement("div");
    const filenameText = document.createElement("strong");
    filenameText.textContent = item.payload.filename;
    filename.appendChild(filenameText);

    const reason = document.createElement("div");
    reason.style.color = "#6b7280";
    reason.textContent = `失败原因：${item.error || "未知错误"}`;

    const btn = document.createElement("button");
    btn.dataset.id = item.id;
    btn.textContent = "手动重传";

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "重传中...";

      const result = await sendMessage({ type: "RETRY_FAILED_UPLOAD", id: item.id });
      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = "手动重传";
      }

      await refreshStatus();
    });

    row.append(filename, reason, btn);
    failedListEl.appendChild(row);
  });
}

async function refreshStatus() {
  const result = await sendMessage({ type: "GET_UPLOAD_STATUS" });
  if (!result.ok || !result.state) {
    setBadgeAppearance("off", "OFF");
    progressEl.textContent = "OFF";
    progressHintEl.textContent = "插件当前不可用";
    return;
  }

  const { isSyncing, isAvailable, isConnected, rootFolderId, failedItems, lastErrorNotice, hasAIChatTab } = result.state;

  latestIsConnected = Boolean(isConnected);
  driveStatusEl.textContent = isConnected ? "已连接" : "未连接";
  connectButtonEl.textContent = isConnected ? "断开 Google Drive" : "连接 Google Drive";
  connectButtonEl.classList.toggle("secondary", isConnected);
  renderDriveFolderLink(isConnected ? rootFolderId : "");

  if (!hasAIChatTab) {
    statusBadgeEl.textContent = "";
    statusBadgeEl.style.background = "transparent";
    progressEl.textContent = "";
    progressHintEl.textContent = "未检测到 AI 聊天页面";
  } else if (!isConnected) {
    setBadgeAppearance("off", "OFF");
    progressEl.textContent = "OFF";
    progressHintEl.textContent = "请先连接 Google Drive";
  } else if (!isAvailable) {
    setBadgeAppearance("off", "OFF");
    progressEl.textContent = "OFF";
    progressHintEl.textContent = "插件当前不可用";
  } else if (isSyncing) {
    setBadgeAppearance("on", "ING");
    progressEl.textContent = "ING";
    progressHintEl.textContent = "正在同步数据";
  } else {
    setBadgeAppearance("on", "ON");
    progressEl.textContent = "ON";
    progressHintEl.textContent = "已检测到 AI 聊天页面";
  }

  if (lastErrorNotice) {
    showError(lastErrorNotice);
    await sendMessage({ type: "CLEAR_UPLOAD_NOTICE" });
  } else {
    showError("");
  }

  renderFailedList(failedItems);
}

connectButtonEl.addEventListener("click", async () => {
  connectButtonEl.disabled = true;
  showError("");
  const isConnected = latestIsConnected;
  connectButtonEl.textContent = isConnected ? "断开中..." : "连接中...";

  const result = await sendMessage({
    type: isConnected ? "DISCONNECT_GOOGLE_DRIVE" : "CONNECT_GOOGLE_DRIVE"
  });

  if (!result.ok) {
    showError(result.error || "Google Drive 操作失败");
    connectButtonEl.disabled = false;
    connectButtonEl.textContent = isConnected ? "断开 Google Drive" : "连接 Google Drive";
    return;
  }

  if (result.rootFolderId) {
    latestIsConnected = true;
    driveStatusEl.textContent = "已连接";
    renderDriveFolderLink(result.rootFolderId);
    progressHintEl.textContent = "Google Drive 已连接";
  }

  connectButtonEl.disabled = false;
  await refreshStatus();
});

refreshStatus();
setInterval(refreshStatus, 1000);
