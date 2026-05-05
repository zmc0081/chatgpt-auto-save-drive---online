# AI Chats Auto Save

Chrome extension that saves supported AI chat conversations to the user's own Google Drive as Markdown files after the user explicitly connects Google Drive from the extension popup.

## Links

- GitHub Repository: `https://github.com/zmc0081/chatgpt-auto-save-drive---online`
- GitHub Pages Home: `https://zmc0081.github.io/chatgpt-auto-save-drive---online/`
- Privacy Policy: `https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html`
- Support: `https://github.com/zmc0081/chatgpt-auto-save-drive---online/issues`

## Current Version

- Extension name: `AI Chats Auto Save`
- Version: `1.2.0`
- Manifest description: `After you connect Google Drive, automatically save supported AI chat conversations as Markdown files.`

## Supported Sites

The current content script runs on these chat products:

- ChatGPT: `https://chatgpt.com/*`, `https://chat.openai.com/*`
- Claude: `https://claude.ai/*`
- DeepSeek: `https://chat.deepseek.com/*`
- Gemini: `https://gemini.google.com/*`
- Grok: `https://grok.x.com/*`
- Llama: `https://llama.meta.com/*`
- Mistral: `https://chat.mistral.ai/*`
- Qwen: `https://qwenlm.aliyun.com/*`
- MiniMax: `https://chat.minimax.ai/*`
- Olmo: `https://olmo.allenai.org/*`
- Kimi: `https://kimi.moonshot.cn/*`

## Features

- Detects supported AI chat pages and watches conversation changes.
- Converts the visible conversation transcript into Markdown.
- Uploads Markdown directly from the browser to Google Drive.
- Creates or reuses a Google Drive root folder named `AI Chats Auto Save`.
- Creates per-platform subfolders such as `ChatGPT`, `Claude`, `Gemini`, and `Kimi`.
- Stores one Markdown file per supported platform and Chrome window, for example `chatgpt-window-123.md`.
- Reuses mapped Drive files and updates them when the transcript changes.
- Uses Chrome Identity OAuth with the limited `https://www.googleapis.com/auth/drive.file` scope.
- Requires the user to click `Connect Google Drive` before syncing starts.
- Shows Drive connection status, sync status, and failed upload tasks in the popup.
- Supports manual retry for failed uploads.
- Does not use a developer-controlled server for conversation data.

## Badge States

- `ON`: A supported AI chat tab is open, Google Drive is connected, and syncing is idle.
- `ING`: A conversation upload is currently queued or syncing.
- `OFF`: Google Drive is not connected or the extension is unavailable.
- hidden: No supported AI chat tab is open.

## Project Structure

```text
chatgpt-auto-save-drive---online/
|- manifest.json
|- background.js
|- content.js
|- popup.html
|- popup.js
|- index.html
|- privacy-policy.html
|- privacy-policy.md
|- icons/
|- store-assets/
`- README.md
```

## How It Works

1. `content.js` runs on supported AI chat sites.
2. It extracts visible conversation messages from the page DOM.
3. It formats the conversation as Markdown with source, URL, update time, and message count.
4. A `MutationObserver` plus fallback polling detects transcript changes.
5. When the transcript snapshot changes, the content script sends an `ENQUEUE_UPLOAD` message to `background.js`.
6. `background.js` uploads only after the user has connected Google Drive from the popup.
7. On first sync, the extension creates or reuses `AI Chats Auto Save` in the user's Drive and creates a platform subfolder.
8. The extension creates or updates the mapped Markdown file for that platform and browser window.

## Popup Flow

- `Connect Google Drive`: starts interactive Google OAuth and verifies the Drive folder.
- `Disconnect Google Drive`: clears cached Chrome Identity tokens and stops local syncing.
- Drive status: shows whether Google Drive is connected.
- Current status: shows `ON`, `ING`, or `OFF`.
- Failed task list: shows failed uploads and provides a manual retry button.

## Permissions

```json
"permissions": [
  "storage",
  "identity"
]
```

```json
"host_permissions": [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://claude.ai/*",
  "https://chat.deepseek.com/*",
  "https://gemini.google.com/*",
  "https://grok.x.com/*",
  "https://llama.meta.com/*",
  "https://chat.mistral.ai/*",
  "https://qwenlm.aliyun.com/*",
  "https://chat.minimax.ai/*",
  "https://olmo.allenai.org/*",
  "https://kimi.moonshot.cn/*",
  "https://www.googleapis.com/*"
]
```

## Google Cloud Setup

1. Create or select a Google Cloud project.
2. Enable the Google Drive API.
3. Configure the OAuth consent screen.
4. Create a Chrome extension OAuth client.
5. Bind the OAuth client to the Chrome Web Store item ID of the published extension.
6. Put the production OAuth client ID into `manifest.json`.

The current manifest uses:

```json
"oauth2": {
  "client_id": "776131550478-l3fehq9jkffh6ecrfba3s3evdtkq86o6.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

For Chrome Web Store review, make sure the OAuth client is bound to the submitted extension ID so reviewers can complete the `Connect Google Drive` flow.

## Local Development

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this project folder.
5. Open a supported AI chat page.
6. Open the extension popup and click `Connect Google Drive`.
7. Start or continue a conversation and wait a few seconds for syncing.

## Usage

1. Open one of the supported AI chat sites.
2. Open the extension popup.
3. Click `Connect Google Drive` and approve Google OAuth.
4. Start or continue a conversation.
5. Wait a few seconds after the conversation changes.
6. Check the popup for sync status and failed tasks.
7. Verify Markdown files in Google Drive under `AI Chats Auto Save/<Platform>/`.

## Store Assets

Chrome Web Store assets are stored in [`store-assets/`](./store-assets):

- `icon128.png`
- `screenshot-1.png`
- `screenshot-2.png`
- `screenshot-3.png`
- `promo-small.png`
- `promo-large-1400x560-fixed.png`
- `description-en.txt`
- `description-zh.txt`
- `privacy-policy.md`
- `review-notes-en.txt`

Generated review ZIP files are ignored by Git through `.gitignore` and should be built locally when preparing a Chrome Web Store submission.

## Privacy

- No conversation data is stored on a developer-controlled server.
- Conversation data flows directly from the browser to the user's own Google Drive.
- OAuth tokens are managed locally through Chrome Identity APIs.
- The extension uses the limited `drive.file` scope.
- No analytics or user tracking is included.

Public privacy policy page:

`https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html`

## Troubleshooting

### No file appears in Drive

- Confirm Google Drive has been connected from the extension popup.
- Confirm the current page is one of the supported AI chat URLs.
- Wait a few seconds after the conversation text changes.
- Check whether `AI Chats Auto Save` and the platform subfolder exist in Google Drive.
- Check service worker logs in `chrome://extensions`.

### Authorization keeps failing

- Confirm the OAuth consent screen is configured and available to the reviewer account.
- Confirm the Chrome extension OAuth client uses the correct Chrome Web Store item ID.
- Confirm the `oauth2.client_id` in `manifest.json` is the production client ID.
- Wait a few minutes after updating OAuth client configuration.

### Upload keeps failing

- Retry failed tasks from the popup.
- Confirm the signed-in Google account still has Drive access.
- Confirm the mapped Drive file or folder was not deleted or moved.
- Review service worker logs for Google Drive API errors.

## License

MIT License
