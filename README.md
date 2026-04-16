# Send To Linear

Send To Linear is a Chrome extension that creates Linear issues from selected text through the right-click context menu.

## What it does

1. Select text in any normal Chrome page.
2. Right-click.
3. Choose `Send To Linear`.
4. Pick the target team.
5. The extension creates a Linear issue using the selected text.

The issue title is derived from the first part of the selected text. The full selection, page title, and page URL are added to the issue description.

## Security model

- The extension uses Linear OAuth 2.0 with PKCE.
- OAuth tokens are stored locally using `chrome.storage.local`.
- Storage access is restricted to trusted extension contexts with `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`.
- The extension calls only Linear's OAuth and GraphQL endpoints.

## Setup

1. Install Send To Linear from the Chrome Web Store.
2. Open the extension settings from the extension icon.
3. Click **Connect to Linear**.
4. Approve access to your Linear account.
5. Refresh teams if needed.

## Support and privacy

- Homepage: `https://softspring.github.io/send-to-linear-extension/`
- Privacy policy: `https://softspring.github.io/send-to-linear-extension/privacy.html`
- Support: `https://softspring.github.io/send-to-linear-extension/support.html`

## Notes

- This uses Linear's GraphQL API at `https://api.linear.app/graphql`.
- It also uses Linear OAuth endpoints at `https://linear.app/oauth/authorize` and `https://api.linear.app/oauth/token`.
- The requested scopes are `read` and `issues:create`.
- Chrome context menus only work on standard web pages. Restricted Chrome pages such as `chrome://` are excluded by Chrome itself.
