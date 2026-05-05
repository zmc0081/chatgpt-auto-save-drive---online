# Privacy Policy - AI Chats Auto Save

Last updated: May 5, 2026

AI Chats Auto Save is a Chrome extension that saves supported AI chat conversations to the user's own Google Drive after the user explicitly connects Google Drive from the extension popup.

## Data We Read

The extension reads visible conversation content directly from supported AI chat pages in your browser. The current version supports ChatGPT, Claude, DeepSeek, Gemini, Grok, Llama, Mistral, Qwen, MiniMax, Olmo, and Kimi pages listed in the extension manifest.

When a conversation changes, the extension may process:

- Conversation text visible on the page
- The AI chat platform name
- The current page URL
- The conversation title when available
- The update time and message count used in the generated Markdown file

## How We Use Data

Conversation data is used only to create or update Markdown files in your own Google Drive. The extension creates or reuses a root folder named `AI Chats Auto Save` and platform subfolders such as `ChatGPT`, `Claude`, or `Gemini`.

The extension does not send conversation content to a developer-controlled server.

## Local Browser Storage

The extension uses Chrome local storage to keep sync state and make uploads reliable. Locally stored data may include:

- Google Drive folder IDs and file IDs created or reused by the extension
- Sync status, pending upload counts, and error notices
- Failed upload tasks for manual retry
- For failed uploads, the pending Markdown content, raw conversation snapshot, source URL, and related metadata may remain locally in the browser until the retry succeeds or the extension data is cleared

## Google Drive and OAuth

The extension uses Chrome's `identity` API for Google OAuth. OAuth tokens are managed by Chrome and are not manually stored by the extension.

The extension requests the limited Google Drive scope:

```text
https://www.googleapis.com/auth/drive.file
```

This scope is used to create and update files and folders that the extension creates or that the user authorizes the extension to access. Disconnecting Google Drive from the popup clears cached Chrome Identity tokens used by the extension.

## Data Sharing

- We do not sell user data.
- We do not use user data for advertising.
- We do not use conversation data for analytics, profiling, or AI model training.
- We do not operate a server that receives or stores your conversation data.
- Conversation data is sent to Google Drive only when needed to provide the save-to-Drive feature you request.

## Permissions Explained

- `identity`: Used to connect your Google account through Chrome OAuth.
- `storage`: Used to store local sync state, Drive file mappings, folder cache, and failed retry tasks.
- Host permissions for supported AI chat sites: Used to read visible conversation content from those pages.
- Host permission for `https://www.googleapis.com/*`: Used to call the Google Drive API for folder lookup, folder creation, file creation, and file updates.

## User Control

You can stop syncing by disconnecting Google Drive from the extension popup, disabling the extension, uninstalling the extension, or clearing the extension's site and storage data in Chrome.

You can delete exported Markdown files directly from your Google Drive at any time.

## Contact

If you have questions about this privacy policy, contact:

[zm@noyan.cn](mailto:zm@noyan.cn)
