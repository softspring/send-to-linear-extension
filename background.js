const LINEAR_API_URL = "https://api.linear.app/graphql";
const LINEAR_OAUTH_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const LINEAR_OAUTH_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_OAUTH_REVOKE_URL = "https://api.linear.app/oauth/revoke";
const LINEAR_SCOPES = ["read", "issues:create"];
const ROOT_MENU_ID = "send-to-linear-root";
const SETTINGS_MENU_ID = "send-to-linear-settings";
const TEAM_MENU_PREFIX = "send-to-linear-team:";

chrome.runtime.onInstalled.addListener(async () => {
  await initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  await initialize();
});

chrome.action.onClicked.addListener(async () => {
  await chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.oauth || changes.teams || changes.openIssueAfterCreate || changes.linearClientId) {
    await rebuildMenus();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === SETTINGS_MENU_ID) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  if (!String(info.menuItemId).startsWith(TEAM_MENU_PREFIX)) {
    return;
  }

  const teamId = String(info.menuItemId).slice(TEAM_MENU_PREFIX.length);
  const selectionText = typeof info.selectionText === "string" ? info.selectionText.trim() : "";

  if (!selectionText) {
    await notify("Send To Linear", "No selected text was provided to the extension.");
    return;
  }

  try {
    const { teams = [], openIssueAfterCreate = true } = await chrome.storage.local.get([
      "teams",
      "openIssueAfterCreate"
    ]);

    const token = await getValidAccessToken();
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) {
      await notify("Send To Linear", "That team is no longer cached. Refresh teams in settings.");
      return;
    }

    const issue = await createIssue({
      accessToken: token,
      teamId,
      selectionText,
      pageTitle: tab?.title || "",
      pageUrl: tab?.url || ""
    });

    await notify("Send To Linear", `Created ${issue.identifier} in ${team.name}.`);

    if (openIssueAfterCreate && issue.url) {
      await chrome.tabs.create({ url: issue.url });
    }
  } catch (error) {
    await notify("Send To Linear", getErrorMessage(error));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "startOAuth") {
    authorizeWithLinear(message.clientId)
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  if (message?.type === "refreshTeams") {
    syncTeams()
      .then((teams) => sendResponse({ ok: true, teams }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  if (message?.type === "getSettings") {
    getSettingsState()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  if (message?.type === "disconnectOAuth") {
    disconnectOAuth()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  return false;
});

async function initialize() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const settings = await getSettingsState();

  if (settings.isAuthenticated && settings.teams.length === 0) {
    try {
      await syncTeams();
      return;
    } catch (_error) {
      // Keep the extension usable even if Linear is temporarily unavailable.
    }
  }

  await rebuildMenus();
}

async function getSettingsState() {
  const { linearClientId = "", teams = [], openIssueAfterCreate, oauth } = await chrome.storage.local.get([
    "linearClientId",
    "teams",
    "openIssueAfterCreate",
    "oauth"
  ]);

  return {
    linearClientId,
    teams,
    openIssueAfterCreate: openIssueAfterCreate !== false,
    isAuthenticated: Boolean(oauth?.refreshToken && linearClientId),
    viewer: oauth?.viewer || null
  };
}

async function rebuildMenus() {
  const settings = await getSettingsState();

  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: ROOT_MENU_ID,
    title: "Send To Linear",
    contexts: ["selection"]
  });

  if (!settings.linearClientId) {
    chrome.contextMenus.create({
      id: SETTINGS_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: "Configure Linear OAuth",
      contexts: ["selection"]
    });
    return;
  }

  if (!settings.isAuthenticated) {
    chrome.contextMenus.create({
      id: SETTINGS_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: "Connect to Linear",
      contexts: ["selection"]
    });
    return;
  }

  if (settings.teams.length === 0) {
    chrome.contextMenus.create({
      id: SETTINGS_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: "Refresh teams in settings",
      contexts: ["selection"]
    });
    return;
  }

  for (const team of settings.teams) {
    chrome.contextMenus.create({
      id: `${TEAM_MENU_PREFIX}${team.id}`,
      parentId: ROOT_MENU_ID,
      title: team.name,
      contexts: ["selection"]
    });
  }

  chrome.contextMenus.create({
    id: SETTINGS_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: "Settings",
    contexts: ["selection"]
  });
}

async function authorizeWithLinear(clientId) {
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedClientId) {
    throw new Error("Add a Linear OAuth client ID before connecting.");
  }

  const redirectUri = chrome.identity.getRedirectURL("linear");
  const state = randomString(24);
  const codeVerifier = randomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const scope = LINEAR_SCOPES.join(",");

  const authorizationUrl = new URL(LINEAR_OAUTH_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("client_id", normalizedClientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scope);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("actor", "user");
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizationUrl.toString(),
    interactive: true
  });

  if (!responseUrl) {
    throw new Error("Linear did not return an authorization response.");
  }

  const callbackUrl = new URL(responseUrl);
  const returnedState = callbackUrl.searchParams.get("state");
  const code = callbackUrl.searchParams.get("code");
  const oauthError = callbackUrl.searchParams.get("error");

  if (oauthError) {
    throw new Error(`Linear authorization failed: ${oauthError}`);
  }

  if (!code || returnedState !== state) {
    throw new Error("OAuth callback could not be verified.");
  }

  const tokenResponse = await exchangeCodeForToken({
    clientId: normalizedClientId,
    code,
    codeVerifier,
    redirectUri
  });

  const viewer = await fetchViewer(tokenResponse.access_token);
  const oauthState = buildOAuthState(tokenResponse, viewer);

  await chrome.storage.local.set({
    linearClientId: normalizedClientId,
    oauth: oauthState
  });

  await syncTeams();

  return {
    viewer,
    redirectUri
  };
}

async function syncTeams() {
  const token = await getValidAccessToken();
  const query = `
    query Teams {
      teams {
        nodes {
          id
          name
        }
      }
    }
  `;

  const data = await fetchGraphQL(token, query);
  const teams = (data.teams?.nodes || []).sort((left, right) => left.name.localeCompare(right.name));

  await chrome.storage.local.set({ teams });
  await rebuildMenus();

  return teams;
}

async function createIssue({ accessToken, teamId, selectionText, pageTitle, pageUrl }) {
  const title = deriveTitle(selectionText);
  const description = buildDescription(selectionText, pageTitle, pageUrl);
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;

  const data = await fetchGraphQL(accessToken, mutation, {
    input: {
      teamId,
      title,
      description
    }
  });

  const result = data.issueCreate;
  if (!result?.success || !result.issue) {
    throw new Error("Linear did not return a created issue.");
  }

  return result.issue;
}

async function fetchViewer(accessToken) {
  const query = `
    query Viewer {
      viewer {
        id
        name
        email
      }
    }
  `;

  const data = await fetchGraphQL(accessToken, query);
  return data.viewer;
}

async function getValidAccessToken() {
  const { oauth, linearClientId = "" } = await chrome.storage.local.get(["oauth", "linearClientId"]);
  if (!linearClientId) {
    throw new Error("Configure a Linear OAuth client ID in the extension settings.");
  }

  if (!oauth?.refreshToken) {
    throw new Error("Connect the extension to Linear first.");
  }

  if (oauth.accessToken && oauth.expiresAt && Date.now() < oauth.expiresAt - 60_000) {
    return oauth.accessToken;
  }

  const refreshed = await refreshAccessToken(linearClientId, oauth.refreshToken);
  const nextState = {
    ...oauth,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope || oauth.scope
  };

  if (!nextState.viewer) {
    nextState.viewer = await fetchViewer(refreshed.access_token);
  }

  await chrome.storage.local.set({ oauth: nextState });
  return nextState.accessToken;
}

async function disconnectOAuth() {
  const { oauth } = await chrome.storage.local.get(["oauth"]);

  if (oauth?.refreshToken) {
    try {
      await revokeToken(oauth.refreshToken);
    } catch (_error) {
      // Local cleanup should still succeed if revoke fails.
    }
  }

  await chrome.storage.local.remove(["oauth", "teams"]);
  await rebuildMenus();
}

async function exchangeCodeForToken({ clientId, code, codeVerifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri
  });

  return fetchOAuthToken(body);
}

async function refreshAccessToken(clientId, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken
  });

  return fetchOAuthToken(body);
}

async function fetchOAuthToken(body) {
  const response = await fetch(LINEAR_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || `Linear OAuth request failed with status ${response.status}.`);
  }

  return payload;
}

async function revokeToken(token) {
  const body = new URLSearchParams({
    token,
    token_type_hint: "refresh_token"
  });

  await fetch(LINEAR_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
}

async function fetchGraphQL(accessToken, query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Linear API request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" "));
  }

  return payload.data;
}

function buildOAuthState(tokenResponse, viewer) {
  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    scope: tokenResponse.scope || LINEAR_SCOPES.join(" "),
    viewer
  };
}

async function generateCodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

function deriveTitle(selectionText) {
  const normalized = normalizeWhitespace(selectionText);
  const firstLine = normalized.split(/(?<=[.!?])\s+|\n/)[0] || normalized;

  if (firstLine.length <= 80) {
    return firstLine;
  }

  return `${firstLine.slice(0, 77).trimEnd()}...`;
}

function buildDescription(selectionText, pageTitle, pageUrl) {
  const normalizedSelection = selectionText.trim();
  const sourceLines = [];

  if (pageTitle) {
    sourceLines.push(`- Source title: ${pageTitle}`);
  }

  if (pageUrl) {
    sourceLines.push(`- Source URL: ${pageUrl}`);
  }

  return [
    "Created from Chrome selected text.",
    "",
    sourceLines.join("\n"),
    "",
    "Selected text:",
    "```",
    normalizedSelection,
    "```"
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function notify(title, message) {
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-128.png",
    title,
    message
  });
}
