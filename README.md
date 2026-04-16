# ChatGPT Auto Save to Google Drive

A Chrome Extension that automatically detects new ChatGPT responses and saves them to your Google Drive in real-time.

---

## 🚀 Features

* ✅ Automatically detects ChatGPT responses
* ✅ Saves responses to Google Drive
* ✅ Supports custom folder organization
* ✅ No manual interaction required
* ✅ Lightweight and fast (runs in browser)

---

## 📦 Project Structure

```
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

1. Content script monitors ChatGPT page changes
2. Detects new assistant responses
3. Sends content to background script
4. Background script uploads file to Google Drive via API

---

## ⚙️ Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/chatgpt-auto-save-drive.git
cd chatgpt-auto-save-drive
```

---

### 2. Setup Google Cloud

1. Go to Google Cloud Console
2. Create a new project
3. Enable **Google Drive API**
4. Configure **OAuth Consent Screen**
5. Create **OAuth Client ID**

---

### 3. Configure Extension

Open `manifest.json` and replace:

```json
"client_id": "YOUR_CLIENT_ID"
```

with your real client ID:

```json
"client_id": "xxxxxxxxxxxx.apps.googleusercontent.com"
```

---

### 4. (Optional) Set Target Folder

In `background.js`:

```javascript
const metadata = {
  name: filename,
  parents: ["YOUR_FOLDER_ID"]
};
```

---

### 5. Load Extension in Chrome

1. Open Chrome
2. Go to:

```
chrome://extensions
```

3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the project folder

---

## 🧪 Usage

1. Open ChatGPT
2. Start a conversation
3. Wait for a response

👉 The extension will automatically:

* Detect new content
* Upload it to Google Drive

---

## 📁 Output Example

Files will be saved as:

```
chatgpt_auto_YYYY-MM-DD_HH-MM-SS.txt
```

---

## 🔐 Security Notes

* Do NOT commit your real `client_id`
* Use placeholders in public repos
* Keep OAuth configuration private

---

## 🛠 Troubleshooting

### ❌ No file appears in Drive

* Check correct Google account
* Verify OAuth permissions
* Check console logs

### ❌ Extension not triggering

* Refresh ChatGPT page
* Check `content.js` selectors

---

## 🔮 Future Improvements

* Save as Markdown (.md)
* Auto naming based on conversation title
* Folder auto organization by date
* Export to Notion / Obsidian

---

## 📄 License

MIT License

---

## ⭐ Support

If you find this project useful, give it a ⭐ on GitHub!
# chatgpt-auto-save-drive

