# ChatGPT Auto Save to Google Drive

| English | 中文 |
| --- | --- |
| Chrome extension that detects ChatGPT conversation changes and syncs them to Google Drive as Markdown. | 一个用于检测 ChatGPT 对话变化，并将内容以 Markdown 形式同步到 Google Drive 的 Chrome 扩展。 |

## Features | 功能特性

| English | 中文 |
| --- | --- |
| Auto-detects conversation updates on `chatgpt.com` and `chat.openai.com` | 自动检测 `chatgpt.com` 与 `chat.openai.com` 上的对话更新 |
| Saves one Markdown file per browser window instead of creating many timestamped files | 每个浏览器窗口只维护一个 Markdown 文件，不再持续生成大量带时间戳的新文件 |
| Syncs the full conversation snapshot, not only the latest reply | 同步整段对话快照，而不只是最后一条回复 |
| Reuses the same Drive file for the same window and updates it in place | 同一窗口会复用同一个 Drive 文件并持续更新 |
| Recreates the file automatically if the mapped Drive file was deleted, trashed, or moved away | 如果映射的 Drive 文件被删除、移入回收站或移出目标目录，会自动重新创建文件 |
| Built-in retry queue for failed uploads | 内置失败重试队列 |
| Popup supports manual retry for failed tasks | 弹窗支持对失败任务进行手动重传 |

## Badge States | 徽标状态

| State | English | 中文 |
| --- | --- | --- |
| `ON` | A ChatGPT tab is open and the extension is idle | 已检测到 ChatGPT 标签页，扩展处于空闲状态 |
| `ING` | Data is being synced | 正在同步数据 |
| `OFF` | The extension is currently unavailable | 扩展当前不可用 |
| hidden | No ChatGPT tab is open | 当前浏览器中没有打开 ChatGPT 页面 |

## Project Structure | 项目结构

```text
chatgpt-auto-save-drive/
├─ manifest.json
├─ background.js
├─ content.js
├─ popup.html
├─ popup.js
├─ icons/
└─ README.md
```

## How It Works | 工作原理

| Step | English | 中文 |
| --- | --- | --- |
| 1 | `content.js` watches the ChatGPT page with `MutationObserver` and periodic checks. | `content.js` 通过 `MutationObserver` 和定时检查监听页面变化。 |
| 2 | The extension collects the current conversation content from the page. | 扩展从页面中提取当前对话内容。 |
| 3 | If the conversation snapshot changed, it sends a sync task to `background.js`. | 当对话快照发生变化时，会向 `background.js` 发送同步任务。 |
| 4 | `background.js` uploads or updates the window-bound Markdown file in Google Drive. | `background.js` 会在 Google Drive 中上传或更新当前窗口绑定的 Markdown 文件。 |
| 5 | If the mapped Drive file is no longer usable, the extension creates a new file automatically. | 如果当前映射的 Drive 文件已不可用，扩展会自动创建新的文件。 |
| 6 | `popup.js` shows runtime state, failed items, and retry actions. | `popup.js` 用于显示运行状态、失败项目和重试操作。 |

## Output Behavior | 输出行为

| English | 中文 |
| --- | --- |
| File naming rule: `chatgpt-window-{windowId}.md` | 文件命名规则：`chatgpt-window-{windowId}.md` |
| One browser window maps to one Markdown file | 一个浏览器窗口对应一个 Markdown 文件 |
| Continued chatting in the same window updates the same file | 在同一窗口继续对话时，会持续更新同一个文件 |
| A different browser window creates and maintains a different file | 不同浏览器窗口会创建并维护不同的文件 |

## Setup | 安装配置

### 1. Clone the project | 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/chatgpt-auto-save-drive.git
cd chatgpt-auto-save-drive
```

### 2. Set up Google Cloud | 配置 Google Cloud

| English | 中文 |
| --- | --- |
| Open Google Cloud Console | 打开 Google Cloud Console |
| Create a project | 创建一个项目 |
| Enable Google Drive API | 启用 Google Drive API |
| Configure OAuth Consent Screen | 配置 OAuth Consent Screen |
| Create an OAuth Client ID for the extension | 为扩展创建 OAuth Client ID |

### 3. Configure the extension | 配置扩展

| English | 中文 |
| --- | --- |
| Open `manifest.json` and replace the OAuth client id placeholder before publishing or local testing | 如果需要，请打开 `manifest.json` 并替换 OAuth client id |

```json
"client_id": "<PLACEHOLDER_CLIENT_ID>.apps.googleusercontent.com"
```

| English | 中文 |
| --- | --- |
| No Drive folder id needs to be configured manually; the extension creates or reuses its own folder dynamically at runtime | 无需手动配置 Drive 文件夹 ID；扩展会自动处理 |

### 4. Load the extension in Chrome | 在 Chrome 中加载扩展

| English | 中文 |
| --- | --- |
| Open `chrome://extensions` | 打开 `chrome://extensions` |
| Enable `Developer mode` | 打开“开发者模式” |
| Click `Load unpacked` | 点击“加载已解压的扩展程序” |
| Select this project folder | 选择当前项目目录 |

## Usage | 使用方式

| Step | English | 中文 |
| --- | --- | --- |
| 1 | Open ChatGPT in Chrome | 在 Chrome 中打开 ChatGPT |
| 2 | Start or continue a conversation | 开始新对话或继续现有对话 |
| 3 | Wait for the page content to change | 等待页面内容发生变化 |
| 4 | The extension syncs the current window conversation to Google Drive automatically | 扩展会自动将当前窗口中的对话同步到 Google Drive |
| 5 | Open the popup to check state and failed tasks | 打开弹窗查看状态和失败任务 |

## Troubleshooting | 故障排查

### No file appears in Drive | Drive 中没有出现文件

| English | 中文 |
| --- | --- |
| Confirm the extension has been reloaded after local changes | 确认本地修改后已经重新加载扩展 |
| Confirm Google OAuth authorization has been granted | 确认已经完成 Google OAuth 授权 |
| Check whether the extension-created Drive folder exists and the current account can access it | 检查扩展自动创建的 Drive 文件夹是否可用 |
| Check the extension service worker logs in `chrome://extensions` | 在 `chrome://extensions` 中查看扩展 service worker 日志 |

### File was deleted in Drive and no new file appears | Drive 文件被删除后没有生成新文件

| English | 中文 |
| --- | --- |
| Reload the extension and test again | 重新加载扩展后再次测试 |
| Make sure the conversation content actually changed after the deletion | 确保删除文件后，对话内容确实发生了变化 |
| Check popup failed tasks and service worker logs | 检查弹窗中的失败任务以及 service worker 日志 |

### Upload keeps failing | 上传持续失败

| English | 中文 |
| --- | --- |
| The extension retries automatically up to `10` times | 扩展会自动重试，最多 `10` 次 |
| Failed items are shown in the popup | 失败项目会显示在弹窗中 |
| Use manual retry after checking Drive permissions or network state | 检查 Drive 权限或网络状态后，可使用手动重传 |

## Current UI Notes | 当前界面说明

| English | 中文 |
| --- | --- |
| The popup reflects the same `ON / ING / OFF` logic as the badge | 弹窗与浏览器徽标使用相同的 `ON / ING / OFF` 状态逻辑 |
| The extension currently uses the `AAC` icon set from the `icons/` folder | 扩展当前使用 `icons/` 目录下的 `AAC` 图标资源 |

## License | 许可证

| English | 中文 |
| --- | --- |
| MIT License | MIT 许可证 |
