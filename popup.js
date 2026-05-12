const progressEl = document.getElementById("progress");
const failedListEl = document.getElementById("failedList");
const errorNoticeEl = document.getElementById("errorNotice");
const statusBadgeEl = document.getElementById("statusBadge");
const progressHintEl = document.getElementById("progressHint");
const driveStatusEl = document.getElementById("driveStatus");
const connectButtonEl = document.getElementById("connectButton");
const folderRowEl = document.getElementById("folderRow");
const folderLinkEl = document.getElementById("folderLink");
const extensionIdEl = document.getElementById("extensionId");

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
    failedListEl.innerHTML = '<div style="font-size:12px;color:#6b7280;">No failed uploads</div>';
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
    reason.textContent = `Reason: ${item.error || "Unknown error"}`;

    const btn = document.createElement("button");
    btn.dataset.id = item.id;
    btn.textContent = "Retry";

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Retrying...";

      const result = await sendMessage({ type: "RETRY_FAILED_UPLOAD", id: item.id });
      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = "Retry";
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
    progressHintEl.textContent = "Unable to read extension status";
    return;
  }

  const { isSyncing, isAvailable, isConnected, rootFolderId, failedItems, lastErrorNotice, hasAIChatTab } = result.state;

  latestIsConnected = Boolean(isConnected);
  driveStatusEl.textContent = isConnected ? "Connected" : "Not connected";
  connectButtonEl.textContent = isConnected ? "Disconnect Google Drive" : "Connect Google Drive";
  connectButtonEl.classList.toggle("secondary", isConnected);
  renderDriveFolderLink(isConnected ? rootFolderId : "");

  if (!hasAIChatTab) {
    statusBadgeEl.textContent = "";
    statusBadgeEl.style.background = "transparent";
    progressEl.textContent = "";
    progressHintEl.textContent = "No supported AI chat tab detected";
  } else if (!isConnected) {
    setBadgeAppearance("off", "OFF");
    progressEl.textContent = "OFF";
    progressHintEl.textContent = "Connect Google Drive before syncing";
  } else if (!isAvailable) {
    setBadgeAppearance("off", "OFF");
    progressEl.textContent = "OFF";
    progressHintEl.textContent = "Extension is currently unavailable";
  } else if (isSyncing) {
    setBadgeAppearance("on", "ING");
    progressEl.textContent = "ING";
    progressHintEl.textContent = "Syncing data";
  } else {
    setBadgeAppearance("on", "ON");
    progressEl.textContent = "ON";
    progressHintEl.textContent = "Supported AI chat tab detected";
  }

  if (lastErrorNotice) {
    showError(lastErrorNotice);
  }

  renderFailedList(failedItems);
}

connectButtonEl.addEventListener("click", async () => {
  connectButtonEl.disabled = true;
  showError("");
  const isConnected = latestIsConnected;
  connectButtonEl.textContent = isConnected ? "Disconnecting..." : "Connecting...";

  const result = await sendMessage({
    type: isConnected ? "DISCONNECT_GOOGLE_DRIVE" : "CONNECT_GOOGLE_DRIVE"
  });

  if (!result.ok) {
    showError(result.error || "Google Drive operation failed");
    connectButtonEl.disabled = false;
    connectButtonEl.textContent = isConnected ? "Disconnect Google Drive" : "Connect Google Drive";
    return;
  }

  if (result.rootFolderId) {
    latestIsConnected = true;
    driveStatusEl.textContent = "Connected";
    renderDriveFolderLink(result.rootFolderId);
    progressHintEl.textContent = "Google Drive connected";
  }

  connectButtonEl.disabled = false;
  await refreshStatus();
});

extensionIdEl.textContent = chrome.runtime.id;
refreshStatus();
setInterval(refreshStatus, 1000);
