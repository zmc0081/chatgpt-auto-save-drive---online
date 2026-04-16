# ChatGPT Auto Save to Google Drive

A Chrome Extension that automatically detects ChatGPT responses and saves them to Google Drive in Markdown format.

---

## 🚀 Features

* ✅ Detects ChatGPT page updates via MutationObserver + polling (works without manual refresh)
* ✅ Uses **conversation title + timestamp** as file name prefix
* ✅ Saves content as **Markdown (.md)**
* ✅ Built-in upload retry (up to 10 times)
* ✅ Shows failed uploads and supports manual re-upload from popup
* ✅ Displays upload progress in `success/total` format (e.g. `3/5`)
* ✅ Popup UI shows runtime state and failure notice (`文件上传失败`)

---

## 📦 Project Structure

```bash
chatgpt-auto-save-drive/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── README.md
```

---

## 🧠 How It Works

1. `content.js` monitors chat changes in real-time (DOM mutation + periodic checks)
2. New assistant reply is converted to Markdown
3. File name is generated using conversation title + current timestamp
4. Task is pushed to background upload queue
5. `background.js` uploads to Google Drive and retries failures (max 10)
6. Popup displays progress, status, and manual retry list

---

## ⚙️ Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/chatgpt-auto-save-drive.git
cd chatgpt-auto-save-drive
```

### 2. Setup Google Cloud

1. Go to Google Cloud Console
2. Create a new project
3. Enable **Google Drive API**
4. Configure **OAuth Consent Screen**
5. Create **OAuth Client ID**

### 3. Configure Extension

Open `manifest.json` and replace:

```json
"client_id": "YOUR_CLIENT_ID"
```

with your real client ID.

### 4. (Optional) Set Target Folder

In `background.js`, update:

```javascript
const DRIVE_FOLDER_ID = "YOUR_FOLDER_ID";
```

### 5. Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select this project folder

---

## 🧪 Usage

1. Open ChatGPT and ask questions
2. Wait for assistant response
3. Extension auto-saves the latest response to Google Drive
4. Open popup to check:
   * Upload progress (`已成功/总数`)
   * Failed uploads list
   * Manual retry actions

---

## 📁 Output Example

```text
How_to_build_a_scraper_2026-04-16_08-35-22.md
```

---

## 🛠 Troubleshooting

### ❌ No file appears in Drive

* Verify Google account and OAuth authorization
* Check extension service worker logs
* Confirm `DRIVE_FOLDER_ID` is valid

### ❌ Upload keeps failing

* Extension retries automatically up to 10 times
* If still failing, popup shows `文件上传失败`
* Use manual retry in failed list after checking network/permissions

---

## 📄 License

MIT License
