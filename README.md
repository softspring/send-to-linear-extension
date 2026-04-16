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
4. Select the repository root folder.
5. In your Linear OAuth app, add the extension redirect URL shown in the settings page.
6. Reload the unpacked extension.
7. Open the extension settings from the extension icon.
8. Click **Connect to Linear**.
9. Approve access and then refresh teams if needed.

## Public listing assets

- Landing page source: [`site/index.html`](site/index.html)
- Privacy policy source: [`site/privacy.html`](site/privacy.html)
- Support page source: [`site/support.html`](site/support.html)
- Icon source: [`assets/icon.svg`](assets/icon.svg)
- Screenshot mockups: [`screenshots/`](screenshots)
- Live landing page: `https://softspring.github.io/send-to-linear-extension/`
- Live privacy policy: `https://softspring.github.io/send-to-linear-extension/privacy.html`
- Live support page: `https://softspring.github.io/send-to-linear-extension/support.html`

## Notes

- This uses Linear's GraphQL API at `https://api.linear.app/graphql`.
- It also uses Linear OAuth endpoints at `https://linear.app/oauth/authorize` and `https://api.linear.app/oauth/token`.
- The requested scopes are `read` and `issues:create`.
- Chrome context menus only work on standard web pages. Restricted Chrome pages such as `chrome://` are excluded by Chrome itself.

## GitHub Pages

- The repo includes a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.
- Once Pages is enabled for GitHub Actions, the public site URLs will be:
- `https://softspring.github.io/send-to-linear-extension/`
- `https://softspring.github.io/send-to-linear-extension/privacy.html`
- `https://softspring.github.io/send-to-linear-extension/support.html`
