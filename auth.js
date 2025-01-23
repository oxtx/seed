const fs = require('fs/promises');
const { google } = require('googleapis');
const express = require('express');

const fileHandler = require('./fileHandler');

const isProduction = process.env.NODE_ENV === 'production';

const CREDENTIALS_PATH = isProduction ? './credentials.prod.json' : './credentials.dev.json';
const TOKEN_PATH = 'token.json';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const redirectUri = isProduction
  ? `https://${process.env.PUBLIC_DOMAIL}/oauth2callback` // Replace with your production URL
  : 'http://localhost:3000/oauth2callback';

/**
 * Delete the token file if it exists.
 */
async function deleteTokenFile() {
  try {
    await fileHandler.deleteFile(TOKEN_PATH); // Deletes the token file
    console.log('Deleted existing token.json file.');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Ignore "file not found" errors, but throw other errors
      throw err;
    }
  }
}

/**
 * Load client secrets from a local file.
 */
async function loadCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error('Error loading client secret file: ' + err.message);
  }
}

/**
 * Authorize a client with credentials, or get a new authorization token.
 */
async function authorize(app) {

  const credentials = await loadCredentials();
  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we already have a token
  try {
    const token = await fileHandler.readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    console.log('Using existing token.');
    return oAuth2Client;
  } catch (err) {
    // If token doesn't exist, get a new one
    console.log('No valid token found. Generating a new one...');
    return getNewToken(oAuth2Client, app);
  }
}

async function auth(app) {
  const credentials = await loadCredentials();
  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  return getNewToken(oAuth2Client, app);
}

/**
 * Get and store a new token after prompting for user authorization.
 */
async function getNewToken(oAuth2Client, app) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('Authorize this app by visiting this URL:', authUrl);

  // Dynamically import the `open` library
  const open = (await import('open')).default;


  // Create an Express server to handle the callback
  // const app = express();
  // const server = app.listen(3000, () => {
  //   console.log('Listening on http://localhost:3000');
  open(authUrl); // Automatically open the URL in the default browser
  // });

  return new Promise((resolve, reject) => {
    app.get('/oauth2callback', async (req, res) => {
      const code = req.query.code;
      res.send('Authentication successful! You can close this tab.');
      // server.close();

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        await fileHandler.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
        resolve(oAuth2Client);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Export functions for use in other modules
module.exports = {
  loadCredentials,
  authorize,
  auth
};

// authorize();