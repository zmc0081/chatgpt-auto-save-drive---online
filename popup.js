const progressEl = document.getElementById("progress");
const failedListEl = document.getElementById("failedList");
const errorNoticeEl = document.getElementById("errorNotice");
const statusBadgeEl = document.getElementById("statusBadge");
const progressHintEl = document.getElementById("progressHint");

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

function renderFailedList(items) {
  failedListEl.innerHTML = "";

  if (!items || items.length === 0) {
    failedListEl.innerHTML = '<div style="font-size:12px;color:#6b7280;">暂无失败任务</div>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div><strong>${item.payload.filename}</strong></div>
      <div style="color:#6b7280;">失败原因：${item.error || "未知错误"}</div>
      <button data-id="${item.id}">手动重传</button>
    `;

    const btn = row.querySelector("button");
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

  const { isSyncing, isAvailable, failedItems, lastErrorNotice, hasChatGPTTab } = result.state;

  if (!hasChatGPTTab) {
    statusBadgeEl.textContent = "";
    statusBadgeEl.style.background = "transparent";
    progressEl.textContent = "";
    progressHintEl.textContent = "未检测到 ChatGPT 页面";
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
    progressHintEl.textContent = "已检测到 ChatGPT 页面";
  }

  if (lastErrorNotice) {
    errorNoticeEl.style.display = "block";
    errorNoticeEl.textContent = lastErrorNotice;
    await sendMessage({ type: "CLEAR_UPLOAD_NOTICE" });
  } else {
    errorNoticeEl.style.display = "none";
  }

  renderFailedList(failedItems);
}

refreshStatus();
setInterval(refreshStatus, 1000);
