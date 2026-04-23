# ChatGPT Auto Save to Google Drive

Chrome extension that watches ChatGPT conversations and saves them directly to the user's own Google Drive as Markdown files.

## Links

- GitHub Repository: `https://github.com/zmc0081/chatgpt-auto-save-drive---online`
- GitHub Pages Home: `https://zmc0081.github.io/chatgpt-auto-save-drive---online/`
- Privacy Policy: `https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html`
- Support: `https://github.com/zmc0081/chatgpt-auto-save-drive---online/issues`

## Features

- Detects conversation changes on `chatgpt.com` and `chat.openai.com`
- Saves content as Markdown files named `ChatGPT title + YYYY-MM-DD`
- Reuses the same daily file for the same conversation title and updates sections in place
- Creates or reuses a dedicated Google Drive folder named `ChatGPT-AutoSave`
- Uses Google OAuth with the limited `drive.file` scope
- Requires explicit popup authorization before Drive syncing starts
- Shows authorization status, sync status, last sync time, and failed tasks in the popup
- Supports retrying failed uploads
- Does not use any developer-controlled server

## Badge States

- `ON`: A ChatGPT tab is open and the extension is idle
- `ING`: A conversation is currently syncing
- `OFF`: No active sync is available
- `AUTH`: Google Drive authorization is required
- hidden: No ChatGPT tab is open

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

1. `content.js` watches ChatGPT pages with a `MutationObserver` plus fallback polling.
2. The current conversation is extracted from the page DOM and converted into Markdown.
3. When the snapshot changes, the content script sends a sync task to `background.js`.
4. The user clicks `Authorize Google Drive` in the popup to complete Google OAuth and verify or create the target Drive folder.
5. `background.js` syncs only with an already granted token. If authorization is missing or expired, the popup instructs the user to authorize again.
6. The extension creates or updates the daily Markdown file and merges content by conversation section.

## Permissions

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
  "client_id": "413814156152-o4vio4vk5lt1icpbq53t0qt6nn3abds2.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

## Local Development

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder
5. Open the popup and click `Authorize Google Drive`

## Usage

1. Open ChatGPT in Chrome.
2. Open the extension popup.
3. Click `Authorize Google Drive` and approve Google OAuth.
4. Start or continue a conversation on ChatGPT.
5. Wait a few seconds after the page content changes.
6. Check the popup for sync status and failed tasks.
7. Verify files in the `ChatGPT-AutoSave` folder in Google Drive.

## Popup Overview

- Google Drive Authorization: Shows whether Drive access has been granted
- Sync Status: Shows current state and last sync time
- Failed Tasks: Shows failed uploads and allows retry
- Revoke Authorization: Clears cached local authorization state

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

## Privacy

- No conversation data is stored on any developer-controlled server
- All data flows directly from the browser to the user's own Google Drive
- OAuth tokens are managed locally through Chrome identity APIs
- No analytics or user tracking is included

Public privacy policy page:

`https://zmc0081.github.io/chatgpt-auto-save-drive---online/privacy-policy.html`

## Troubleshooting

### No file appears in Drive

- Confirm the extension was reloaded after local changes
- Confirm Google OAuth authorization has been granted from the popup
- Confirm the OAuth client is bound to the Chrome Web Store item ID
- Check whether the `ChatGPT-AutoSave` folder exists
- Check service worker logs in `chrome://extensions`

### Authorization keeps failing

- Confirm the OAuth consent screen is in production
- Confirm the Chrome extension OAuth client uses the correct Chrome Web Store item ID
- Wait a few minutes after updating the OAuth client configuration

### Upload keeps failing

- Retry failed tasks from the popup
- Confirm the signed-in Google account still has Drive access
- Review service worker logs for Google Drive API errors

## License

MIT License
