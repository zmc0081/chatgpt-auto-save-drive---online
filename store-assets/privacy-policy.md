# Privacy Policy - ChatGPT Auto Save to Google Drive

## Data Collection
This extension reads the content of your ChatGPT conversations directly from the browser page DOM. The content is sent exclusively to your own Google Drive account.

## Data Storage
- NO conversation data is stored on any external server.
- All data flows directly from your browser to your personal Google Drive.
- OAuth tokens are managed by Chrome's built-in identity API and stored locally.

## Data Sharing
- We do NOT collect, store, or share any user data.
- We do NOT have access to your Google Drive files.
- We do NOT track usage analytics.

## Permissions Explained
- `identity`: Required for Google OAuth authorization.
- `storage`: Required for storing sync state locally in your browser.
- `tabs`: Required for detecting ChatGPT tabs.
- `host_permissions` on `chatgpt.com` and `chat.openai.com`: Required for reading conversation content.
- `host_permissions` on `googleapis.com`: Required for Google Drive API calls.

## Contact
[zm@noyan.cn](mailto:zm@noyan.cn)
