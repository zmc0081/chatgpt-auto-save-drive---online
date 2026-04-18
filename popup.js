function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response || { ok: false, error: "Empty response" });
    });
  });
}

function getAuthToken(interactive) {
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

function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function setDisplay(id, visible, displayValue = "block") {
  document.getElementById(id).style.display = visible ? displayValue : "none";
}

function setStatusDot(id, colorClass) {
  document.getElementById(id).className = `status-dot ${colorClass}`.trim();
}

function showAuthError(message) {
  const authError = document.getElementById("authError");
  if (!message) {
    authError.style.display = "none";
    authError.textContent = "";
    return;
  }

  authError.style.display = "block";
  authError.textContent = message;
}

async function updateAuthStatus() {
  try {
    await getAuthToken(false);

    setStatusDot("authDot", "green");
    setText("authText", "Authorized");
    setDisplay("authBtn", false);
    setDisplay("revokeBtn", true);
    showAuthError("");

    const cached = await chrome.storage.local.get("drive_folder_id");
    if (cached.drive_folder_id) {
      setDisplay("folderInfo", true);
      const link = document.getElementById("folderLink");
      link.href = `https://drive.google.com/drive/folders/${cached.drive_folder_id}`;
      link.textContent = "ChatGPT-AutoSave";
    } else {
      setDisplay("folderInfo", false);
    }
  } catch {
    setStatusDot("authDot", "red");
    setText("authText", "Not authorized");
    setDisplay("authBtn", true);
    setDisplay("revokeBtn", false);
    setDisplay("folderInfo", false);
  }
}

async function handleAuth() {
  try {
    showAuthError("");
    await getAuthToken(true);
    await updateAuthStatus();
    await updateSyncStatus();
  } catch (error) {
    showAuthError(`Authorization failed: ${error.message}`);
  }
}

async function handleRevoke() {
  try {
    showAuthError("");
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (value) => {
        resolve(value || "");
      });
    });

    if (token) {
      try {
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`);
      } catch {
        // Ignore revoke endpoint failures and still clear local state.
      }

      await removeCachedAuthToken(token);
    }

    await chrome.storage.local.remove(["drive_folder_id"]);
    await updateAuthStatus();
    await updateSyncStatus();
  } catch (error) {
    showAuthError(`Revoke failed: ${error.message}`);
  }
}

async function updateSyncStatus() {
  const response = await sendMessage({ type: "GET_STATUS" });
  const dot = document.getElementById("syncDot");
  const text = document.getElementById("syncText");
  const lastSync = document.getElementById("lastSync");

  if (!response.ok) {
    dot.className = "status-dot red";
    text.textContent = "Unable to read background status";
    lastSync.textContent = "";
    return;
  }

  const statusMap = {
    ON: { className: "status-dot green", text: "Idle - watching for changes" },
    ING: { className: "status-dot orange", text: "Syncing..." },
    OFF: { className: "status-dot red", text: "No ChatGPT tab detected" },
    AUTH: { className: "status-dot red", text: "Authorization required" }
  };

  const current = statusMap[response.state] || statusMap.OFF;
  dot.className = current.className;
  text.textContent = current.text;
  lastSync.textContent = response.lastSyncTime
    ? `Last sync: ${new Date(response.lastSyncTime).toLocaleString()}`
    : "Last sync: --";
}

async function updateFailedTasks() {
  const response = await sendMessage({ type: "GET_FAILED_TASKS" });
  const section = document.getElementById("failedSection");
  const list = document.getElementById("failedList");

  if (!response.ok || !response.tasks || response.tasks.length === 0) {
    section.style.display = "none";
    list.innerHTML = "";
    return;
  }

  section.style.display = "block";
  list.innerHTML = response.tasks
    .map(
      (task, index) => `
        <div class="failed-item">
          Window ${task.windowId} - ${task.error}
          <button class="retry-btn" data-index="${index}" type="button">Retry</button>
        </div>
      `
    )
    .join("");

  list.querySelectorAll(".retry-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const result = await sendMessage({
        type: "RETRY_TASK",
        index: Number.parseInt(btn.dataset.index || "-1", 10)
      });

      if (!result.ok) {
        btn.disabled = false;
        showAuthError(`Retry failed: ${result.error}`);
        return;
      }

      await refreshPopup();
    });
  });
}

async function handleRetryAll() {
  const result = await sendMessage({ type: "RETRY_ALL" });
  if (!result.ok) {
    showAuthError(`Retry failed: ${result.error}`);
    return;
  }

  await refreshPopup();
}

async function refreshPopup() {
  await updateAuthStatus();
  await updateSyncStatus();
  await updateFailedTasks();
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshPopup();

  document.getElementById("authBtn").addEventListener("click", handleAuth);
  document.getElementById("revokeBtn").addEventListener("click", handleRevoke);
  document.getElementById("retryAllBtn").addEventListener("click", handleRetryAll);

  setInterval(() => {
    void updateSyncStatus();
    void updateFailedTasks();
  }, 2000);
});
