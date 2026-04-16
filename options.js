const form = document.querySelector("#settings-form");
const redirectUriNode = document.querySelector("#redirect-uri");
const clientIdNoteNode = document.querySelector("#client-id-note");
const authSummaryNode = document.querySelector("#auth-summary");
const openIssueInput = document.querySelector("#open-issue");
const connectButton = document.querySelector("#connect-linear");
const refreshButton = document.querySelector("#refresh-teams");
const disconnectButton = document.querySelector("#disconnect-linear");
const statusNode = document.querySelector("#status");
const teamCountNode = document.querySelector("#team-count");
const teamListNode = document.querySelector("#team-list");

initialize();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setBusy(true);

  try {
    await chrome.storage.local.set({ openIssueAfterCreate: openIssueInput.checked });

    const response = await chrome.runtime.sendMessage({ type: "startOAuth" });

    if (!response?.ok) {
      throw new Error(response?.error || "Failed to connect to Linear.");
    }

    const teamsResponse = await chrome.runtime.sendMessage({ type: "refreshTeams" });
    if (!teamsResponse?.ok) {
      throw new Error(teamsResponse?.error || "Connected, but failed to refresh teams.");
    }

    renderConnectedState(response.state.viewer);
    renderTeams(teamsResponse.teams || []);
    renderStatus(`Connected to Linear and synced ${teamsResponse.teams.length} team(s).`, false);
  } catch (error) {
    renderStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", async () => {
  setBusy(true);

  try {
    await chrome.storage.local.set({ openIssueAfterCreate: openIssueInput.checked });

    const response = await chrome.runtime.sendMessage({ type: "refreshTeams" });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to refresh teams.");
    }

    renderTeams(response.teams || []);
    renderStatus(`Synced ${response.teams.length} team(s).`, false);
  } catch (error) {
    renderStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
  }
});

disconnectButton.addEventListener("click", async () => {
  setBusy(true);

  try {
    const response = await chrome.runtime.sendMessage({ type: "disconnectOAuth" });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to disconnect from Linear.");
    }

    authSummaryNode.textContent = "Not connected. Use the button above to connect to Linear.";
    renderTeams([]);
    renderStatus("Disconnected from Linear and cleared cached teams.", false);
  } catch (error) {
    renderStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
  }
});

async function initialize() {
  setBusy(true);
  redirectUriNode.textContent = chrome.identity.getRedirectURL("linear");

  try {
    const response = await chrome.runtime.sendMessage({ type: "getSettings" });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load extension settings.");
    }

    const { teams, openIssueAfterCreate, isAuthenticated, viewer, hasConfiguredClientId } = response.settings;
    openIssueInput.checked = openIssueAfterCreate;
    renderTeams(teams);
    clientIdNoteNode.textContent = hasConfiguredClientId
      ? "This public build uses Softspring's shared Linear OAuth app."
      : "This build is not configured yet. Replace the placeholder client ID in background.js before publishing.";

    if (isAuthenticated && viewer) {
      renderConnectedState(viewer);
    } else {
      authSummaryNode.textContent = "Not connected. Use the button below to connect to Linear.";
    }
  } catch (error) {
    renderStatus(getErrorMessage(error), true);
  } finally {
    setBusy(false);
  }
}

function renderConnectedState(viewer) {
  if (!viewer) {
    authSummaryNode.textContent = "Connected to Linear.";
    return;
  }

  const label = viewer.email ? `${viewer.name} (${viewer.email})` : viewer.name;
  authSummaryNode.textContent = `Connected to Linear as ${label}.`;
}

function renderTeams(teams) {
  teamCountNode.textContent = String(teams.length);
  teamListNode.textContent = "";

  if (teams.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No teams cached yet.";
    teamListNode.append(item);
    return;
  }

  for (const team of teams) {
    const item = document.createElement("li");
    item.textContent = team.name;
    teamListNode.append(item);
  }
}

function renderStatus(message, isError) {
  statusNode.textContent = message;
  statusNode.classList.toggle("error", isError);
  statusNode.classList.toggle("success", !isError && Boolean(message));
}

function setBusy(isBusy) {
  for (const element of [openIssueInput, connectButton, refreshButton, disconnectButton]) {
    element.disabled = isBusy;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
