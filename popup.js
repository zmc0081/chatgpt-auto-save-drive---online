const progressEl = document.getElementById("progress");
const failedListEl = document.getElementById("failedList");
const errorNoticeEl = document.getElementById("errorNotice");
const statusBadgeEl = document.getElementById("statusBadge");

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
      <button data-id="${item.id}">手动上传</button>
    `;

    const btn = row.querySelector("button");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "重试中...";

      const result = await sendMessage({ type: "RETRY_FAILED_UPLOAD", id: item.id });
      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = "手动上传";
      }

      await refreshStatus();
    });

    failedListEl.appendChild(row);
  });
}

async function refreshStatus() {
  const result = await sendMessage({ type: "GET_UPLOAD_STATUS" });
  if (!result.ok || !result.state) {
    statusBadgeEl.textContent = "异常";
    statusBadgeEl.style.background = "#fee2e2";
    statusBadgeEl.style.color = "#991b1b";
    return;
  }

  const { totalCount, successCount, failedItems, lastErrorNotice } = result.state;
  progressEl.textContent = `${successCount}/${totalCount}`;

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
