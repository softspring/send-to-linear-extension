# Send To Linear

Chrome extension that creates Linear issues from selected text through the right-click context menu.

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

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/home/tatus/Dev/ToLinear`.
5. Open the extension settings from the extension icon.
6. Create a Linear OAuth app and copy its client ID.
7. Add the extension redirect URL shown in settings to the Linear OAuth app.
8. Paste the client ID into the extension settings.
9. Click **Connect to Linear**.
10. Approve access and then refresh teams if needed.

## Public listing assets

- Landing page: `/home/tatus/Dev/ToLinear/site/index.html`
- Privacy policy draft: `/home/tatus/Dev/ToLinear/site/privacy.html`
- Support page: `/home/tatus/Dev/ToLinear/site/support.html`
- Icon source: `/home/tatus/Dev/ToLinear/assets/icon.svg`
- Screenshot mockups: `/home/tatus/Dev/ToLinear/screenshots`

## Notes

- This uses Linear's GraphQL API at `https://api.linear.app/graphql`.
- It also uses Linear OAuth endpoints at `https://linear.app/oauth/authorize` and `https://api.linear.app/oauth/token`.
- The requested scopes are `read` and `issues:create`.
- Chrome context menus only work on standard web pages. Restricted Chrome pages such as `chrome://` are excluded by Chrome itself.
