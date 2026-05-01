'use strict';

const fs = require('fs');
const path = require('path');

function getDefaultClaspCredentialPath() {
  return path.join(process.env.USERPROFILE || process.env.HOME || '', '.clasprc.json');
}

function loadClaspCredentials(filePath = getDefaultClaspCredentialPath()) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!raw.tokens || !raw.tokens.default) {
    throw new Error(`Missing default token block in ${filePath}`);
  }
  return raw.tokens.default;
}

async function refreshGoogleAccessToken(credentials) {
  const body = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(`Failed to refresh Google access token: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

module.exports = {
  getDefaultClaspCredentialPath,
  loadClaspCredentials,
  refreshGoogleAccessToken
};
