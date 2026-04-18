# ChatGPT Auto Save to Google Drive

| English | 中文 |
| --- | --- |
| Chrome extension that detects ChatGPT conversation changes and syncs them to Google Drive as Markdown files. | 一个用于检测 ChatGPT 对话变化，并将内容以 Markdown 形式同步到 Google Drive 的 Chrome 扩展。 |

## Links | 链接

| Item | Value |
| --- | --- |
| GitHub Repository | `https://github.com/zmc0081/chatgpt-auto-save-drive---online` |
| GitHub Pages Home | `https://zmc0081.github.io/chatgpt-auto-save-drive---online/` |
| Privacy Policy | `https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html` |
| Support | `https://github.com/zmc0081/chatgpt-auto-save-drive---online/issues` |

## Features | 功能特性

| English | 中文 |
| --- | --- |
| Auto-detects conversation updates on `chatgpt.com` and `chat.openai.com` | 自动检测 `chatgpt.com` 与 `chat.openai.com` 上的对话更新 |
| Saves one Markdown file per browser window and updates it in place | 每个浏览器窗口对应一个 Markdown 文件，并持续原地更新 |
| Creates or reuses a dedicated Google Drive folder automatically | 自动创建或复用专用的 Google Drive 文件夹 |
| Uses Google OAuth with the safer `drive.file` scope | 使用 Google OAuth，并采用更安全的 `drive.file` 权限范围 |
| Shows authorization, sync status, and failed tasks in the popup | 在弹窗中展示授权状态、同步状态和失败任务 |
| Supports retry for failed uploads | 支持失败任务重试 |
| Includes a GitHub Pages homepage and public privacy policy page for Chrome Web Store submission | 包含 GitHub Pages 首页与公开隐私政策页面，便于 Chrome Web Store 上架 |

## Badge States | 徽标状态

| State | English | 中文 |
| --- | --- | --- |
| `ON` | A ChatGPT tab is open and the extension is idle | 已检测到 ChatGPT 标签页，扩展处于空闲状态 |
| `ING` | Conversation data is currently syncing | 正在同步对话数据 |
| `OFF` | The extension is temporarily unavailable | 扩展当前暂不可用 |
| `AUTH` | Google Drive authorization is required | 需要进行 Google Drive 授权 |
| hidden | No ChatGPT tab is open | 当前浏览器中没有打开 ChatGPT 页面 |

## Project Structure | 项目结构

```text
chatgpt-auto-save-drive---online/
├─ manifest.json
├─ background.js
├─ content.js
├─ popup.html
├─ popup.js
├─ index.html
├─ privacy-policy.html
├─ privacy-policy.md
├─ icons/
├─ store-assets/
└─ README.md
```

## How It Works | 工作原理

| Step | English | 中文 |
| --- | --- | --- |
| 1 | `content.js` watches the ChatGPT page with a `MutationObserver` plus fallback polling. | `content.js` 通过 `MutationObserver` 加定时兜底轮询监听页面变化。 |
| 2 | The extension extracts the current conversation from the page DOM and converts it to Markdown. | 扩展从页面 DOM 中提取当前对话，并转换为 Markdown。 |
| 3 | When the snapshot changes, the content script sends a sync task to `background.js`. | 当对话快照变化时，内容脚本会向 `background.js` 发送同步任务。 |
| 4 | `background.js` gets a valid Google OAuth token and creates or reuses the Drive folder. | `background.js` 获取有效的 Google OAuth token，并创建或复用 Drive 文件夹。 |
| 5 | The extension updates the existing window-bound file or creates a new one in Google Drive. | 扩展会更新当前窗口对应的文件，或在 Google Drive 中创建新文件。 |
| 6 | `popup.js` displays authorization state, sync status, last sync time, and failed tasks. | `popup.js` 展示授权状态、同步状态、最近同步时间和失败任务。 |

## Current Permissions | 当前权限

```json
"permissions": [
  "identity",
  "storage",
  "tabs"
]
```

```json
"host_permissions": [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://www.googleapis.com/*"
]
```

## Setup | 安装与配置

### 1. Clone the project | 克隆项目

```bash
git clone https://github.com/zmc0081/chatgpt-auto-save-drive---online.git
cd chatgpt-auto-save-drive---online
```

### 2. Set up Google Cloud | 配置 Google Cloud

| English | 中文 |
| --- | --- |
| Create or select a Google Cloud project | 创建或选择一个 Google Cloud 项目 |
| Enable the Google Drive API | 启用 Google Drive API |
| Configure the OAuth consent screen | 配置 OAuth 同意屏幕 |
| Create a Chrome extension OAuth client | 创建 Chrome 扩展用 OAuth Client |

### 3. Configure the extension | 配置扩展

| English | 中文 |
| --- | --- |
| Open `manifest.json` and set the production OAuth client ID | 打开 `manifest.json`，填写正式 OAuth Client ID |
| No Drive folder ID needs to be configured manually | 无需手动填写 Drive 文件夹 ID |

The current manifest already uses:

```json
"oauth2": {
  "client_id": "413814156152-o4vio4vk5lt1icpbq53t0qt6nn3abds2.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

### 4. Load the extension in Chrome | 在 Chrome 中加载扩展

| English | 中文 |
| --- | --- |
| Open `chrome://extensions` | 打开 `chrome://extensions` |
| Enable `Developer mode` | 开启“开发者模式” |
| Click `Load unpacked` | 点击“加载已解压的扩展程序” |
| Select this project folder | 选择当前项目目录 |

## Usage | 使用方式

| Step | English | 中文 |
| --- | --- | --- |
| 1 | Open ChatGPT in Chrome | 在 Chrome 中打开 ChatGPT |
| 2 | Authorize Google Drive in the extension popup if prompted | 如有提示，在扩展弹窗中完成 Google Drive 授权 |
| 3 | Start or continue a conversation | 开始新对话或继续已有对话 |
| 4 | Wait for the page content to change | 等待页面内容发生变化 |
| 5 | The extension syncs the current window conversation to Google Drive automatically | 扩展会自动将当前窗口中的对话同步到 Google Drive |
| 6 | Open the popup to check authorization, sync state, and failed tasks | 打开弹窗查看授权状态、同步状态和失败任务 |

## Popup Overview | 弹窗概览

| Section | English | 中文 |
| --- | --- | --- |
| Google Drive Authorization | Shows whether the user has authorized Drive access | 展示用户是否已完成 Drive 授权 |
| Sync Status | Shows current state and last sync time | 展示当前状态和最近同步时间 |
| Failed Tasks | Shows failed tasks and allows retry | 展示失败任务并支持重试 |
| Revoke Authorization | Clears cached authorization state locally | 清理本地缓存的授权状态 |

## Store Assets | 商店素材

The Chrome Web Store assets are prepared in [`store-assets/`](./store-assets):

| File | Purpose |
| --- | --- |
| `icon128.png` | Store icon |
| `screenshot-1.png` | Extension working state |
| `screenshot-2.png` | Popup UI |
| `screenshot-3.png` | Drive file view |
| `promo-small.png` | Small promo tile |
| `promo-large-1400x560-fixed.png` | Large promo tile |
| `description-en.txt` | English store description |
| `description-zh.txt` | Chinese store description |
| `privacy-policy.md` | Store-facing privacy policy source |

## Privacy | 隐私说明

| English | 中文 |
| --- | --- |
| No conversation data is stored on any developer-controlled server | 不会将对话数据存储在开发者控制的服务器上 |
| Data flows directly from the browser to the user's own Google Drive | 数据直接从浏览器流向用户自己的 Google Drive |
| OAuth tokens are managed locally through Chrome identity APIs | OAuth token 通过 Chrome identity API 在本地管理 |
| No analytics or user tracking is included | 不包含统计分析或用户追踪 |

Public privacy policy page:

`https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html`

## Troubleshooting | 故障排查

### No file appears in Drive | Drive 中没有出现文件

| English | 中文 |
| --- | --- |
| Confirm the extension was reloaded after local changes | 确认本地修改后已重新加载扩展 |
| Confirm Google OAuth authorization has been granted | 确认已完成 Google OAuth 授权 |
| Check whether the `ChatGPT-AutoSave` Drive folder exists | 检查 `ChatGPT-AutoSave` 文件夹是否已创建 |
| Check service worker logs in `chrome://extensions` | 在 `chrome://extensions` 中查看 service worker 日志 |

### GitHub Pages shows 404 | GitHub Pages 显示 404

| English | 中文 |
| --- | --- |
| Confirm the repo is public | 确认仓库为公开状态 |
| Confirm Pages is configured to deploy from `main` and `/(root)` | 确认 Pages 配置为 `main` 分支和 `/(root)` |
| Wait a few minutes after pushing `index.html` / `.nojekyll` | 推送 `index.html` / `.nojekyll` 后等待几分钟 |

### Upload keeps failing | 上传持续失败

| English | 中文 |
| --- | --- |
| Failed tasks can be retried from the popup | 失败任务可在弹窗中重试 |
| Check Google Drive permissions and account authorization | 检查 Google Drive 权限和账号授权 |
| Review service worker logs for API errors | 查看 service worker 日志中的 API 错误 |

## License | 许可证

| English | 中文 |
| --- | --- |
| MIT License | MIT 许可证 |
