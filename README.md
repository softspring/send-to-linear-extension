# Send To Linear (Screenshot Fork)

> Fork of [softspring/send-to-linear-extension](https://github.com/softspring/send-to-linear-extension) that adds a **Screenshot → Linear** context menu: right-click any page (no text selection needed), pick a team, and the extension captures the visible tab, uploads the PNG to Linear's asset storage, and creates an issue with the screenshot embedded.

Send To Linear is a Chrome extension that creates Linear issues from selected text through the right-click context menu.

## What it does

1. Select text in any normal Chrome page.
2. Right-click.
3. Choose `Send To Linear`.
4. Pick the target team.
5. The extension creates a Linear issue using the selected text.

The issue title is derived from the first part of the selected text. The full selection, page title, and page URL are added to the issue description.

### Screenshot capture (fork addition)

1. Right-click anywhere on a page (a text selection is optional).
2. Choose `Screenshot → Linear`.
3. Pick the target team.
4. The extension captures the visible tab, uploads the PNG via Linear's `fileUpload` GraphQL mutation, and creates an issue with the screenshot embedded in the description.

The issue title comes from the page title (or the selection, if one exists). Source title, source URL, and any selected text are included in the description. If you connected to Linear before this feature existed, disconnect and reconnect once — uploads require the `write` OAuth scope, which older tokens do not have.

## Differences from upstream

- New `Screenshot → Linear` root context menu (page, selection, link, image, and other non-editable contexts) with the same team submenu.
- Screenshot upload through Linear's `fileUpload` mutation + pre-signed `PUT` to Google Cloud Storage.
- OAuth scopes are now `read`, `write`, and `issues:create` (was `read` + `issues:create`).
- Manifest adds the `activeTab` permission and an `https://storage.googleapis.com/*` host permission (Linear's pre-signed upload URLs live on GCS).
- Same manifest `key` and OAuth client ID as upstream so the Linear OAuth redirect keeps working. **Disable or uninstall the Chrome Web Store version before loading this fork** — they share an extension ID and cannot coexist.

## Security model

- The extension uses Linear OAuth 2.0 with PKCE.
- OAuth tokens are stored locally using `chrome.storage.local`.
- Storage access is restricted to trusted extension contexts with `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`.
- The extension calls only Linear's OAuth, GraphQL, and upload endpoints.

## Setup

1. Install Send To Linear from the Chrome Web Store. **Fork users:** disable the store version, then load this repo unpacked via `chrome://extensions` → Developer mode → Load unpacked.
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
- The requested scopes are `read`, `write`, and `issues:create`.
- Chrome context menus only work on standard web pages. Restricted Chrome pages such as `chrome://` are excluded by Chrome itself, and tab capture fails there too.
