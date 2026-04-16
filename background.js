async function getAccessToken() {
  const result = await chrome.identity.getAuthToken({ interactive: true });

  // 兼容不同返回形式
  if (typeof result === "string") {
    return result;
  }
  if (result && typeof result.token === "string") {
    return result.token;
  }

  throw new Error("未获取到 access token");
}

async function uploadTextFileToDrive({ filename, content, mimeType = "text/plain" }) {
  const token = await getAccessToken();
  console.log("[BG] access token acquired");

  const metadata = {
    name: filename,
    parents: ["1Mu4eKgcwvtv_Q53lf5MIjOWylwc3esiF"]
  };

  const boundary = "foo_bar_baz";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: " + mimeType + "; charset=UTF-8\r\n\r\n" +
    content +
    closeDelim;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "multipart/related; boundary=" + boundary
      },
      body: multipartRequestBody
    }
  );

  const text = await response.text();
  console.log("[BG] raw upload response:", response.status, text);

  if (!response.ok) {
    throw new Error("上传失败: " + response.status + " " + text);
  }

  return JSON.parse(text);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "UPLOAD_TO_DRIVE") {
    console.log("[BG] received upload request", message.payload?.filename);

    uploadTextFileToDrive(message.payload)
      .then((result) => {
        console.log("[BG] 上传成功", result);
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        console.error("[BG] 上传失败", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }
});