const { google } = require('googleapis');

// ── OAuth client factory ───────────────────────────────────────────────────────
function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ── Get auth URL for connecting Drive ────────────────────────────────────────
function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive',         // read + write Drive files
      'https://www.googleapis.com/auth/documents',     // read + write Google Docs
    ],
    prompt: 'consent',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });
}

// ── Exchange auth code for tokens ─────────────────────────────────────────────
async function exchangeCodeForTokens(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken({
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });
  return tokens;
}

// ── Get authenticated Drive client using stored company token ─────────────────
function getDriveClient(token) {
  const client = createOAuthClient();
  client.setCredentials(token);

  // Auto-refresh token when it expires
  client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      token.refresh_token = newTokens.refresh_token;
    }
    token.access_token = newTokens.access_token;
    token.expiry_date  = newTokens.expiry_date;
  });

  return google.drive({ version: 'v3', auth: client });
}

// ── List site folders inside root folder ─────────────────────────────────────
async function listSiteFolders(drive, rootFolderId) {
  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name',
  });
  return res.data.files;
}

// ── Get contents of a site folder ─────────────────────────────────────────────
async function getSiteContents(drive, siteFolderId) {
  const res = await drive.files.list({
    q: `'${siteFolderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
  });

  const files = res.data.files;
  return {
    dateFolders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
    reportFiles: files.filter(f =>
      f.name.toLowerCase().endsWith('.docx') ||
      f.mimeType === 'application/vnd.google-apps.document'
    ),
  };
}

// ── Download or export a file as Buffer ───────────────────────────────────────
async function downloadFile(drive, fileId, mimeType) {
  // Native Google Docs must be exported
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export(
      { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
  }

  // All other files download directly
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

// ── Get photos from a folder (checks /images subfolder first) ─────────────────
async function getPhotosFromDateFolder(drive, dateFolderId, maxPhotos) {
  // Check for /images subfolder
  const subRes = await drive.files.list({
    q: `'${dateFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='images' and trashed=false`,
    fields: 'files(id, name)',
  });

  const photoFolderId = subRes.data.files.length > 0
    ? subRes.data.files[0].id
    : dateFolderId;

  const res = await drive.files.list({
    q: `'${photoFolderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: maxPhotos,
  });

  return res.data.files.slice(0, maxPhotos);
}

// ── Date matching helpers ─────────────────────────────────────────────────────
function normalizeDate(d) {
  return d.replace(/[-\/\s]/g, '');
}

function datesMatch(d1, d2) {
  const n1 = normalizeDate(d1);
  const n2 = normalizeDate(d2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

function findDateFolder(dateFolders, targetDate) {
  return dateFolders.find(f => datesMatch(f.name, targetDate));
}

// ── Parse entries by date from raw DOCX text ─────────────────────────────────
function parseEntriesByDate(rawText, selectedDates) {
  const entries     = [];
  const lines       = rawText.split('\n');
  const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/;
  let   currentDate = null;
  let   currentLines = [];

  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      if (currentDate) {
        entries.push({ date: currentDate, rawText: currentLines.join('\n').trim() });
      }
      currentDate  = match[1];
      currentLines = [line];
    } else if (currentDate) {
      currentLines.push(line);
    }
  }
  if (currentDate) {
    entries.push({ date: currentDate, rawText: currentLines.join('\n').trim() });
  }

  if (selectedDates && selectedDates.length > 0) {
    return entries.filter(e => selectedDates.some(sd => datesMatch(e.date, sd)));
  }
  return entries;
}

// exports moved to bottom

// ── Create a folder inside a parent folder ────────────────────────────────────
async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
  });
  return res.data;
}

// ── Find or create a folder by name inside a parent ───────────────────────────
async function findOrCreateFolder(drive, name, parentId) {
  // Search for existing folder first
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (res.data.files.length > 0) return res.data.files[0];
  return await createFolder(drive, name, parentId);
}

// ── Upload a file buffer to a Drive folder ────────────────────────────────────
async function uploadFileToDrive(drive, buffer, fileName, mimeType, parentId) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name',
  });
  return res.data;
}

// ── Append notes to a Google Doc (as plain text) ──────────────────────────────
async function appendNotesToDoc(drive, fileId, date, notes) {
  const { google } = require('googleapis');

  // Get auth — try multiple paths for compatibility across googleapis versions
  const auth = drive.context?._options?.auth
    || drive._options?.auth
    || drive.context?.auth;

  if (!auth) throw new Error('Could not get auth from Drive client for Docs API.');

  const docs = google.docs({ version: 'v1', auth });

  // Get current document to find the end index for appending
  const docRes    = await docs.documents.get({ documentId: fileId });
  const content   = docRes.data.body.content || [];
  const endIndex  = content.reduce((max, el) => Math.max(max, el.endIndex || 0), 1);

  // Subtract 1 — last character in a Google Doc is always a trailing newline
  const insertIndex = Math.max(endIndex - 1, 1);
  const newEntry    = `\n\n${date}\n${notes}`;

  await docs.documents.batchUpdate({
    documentId: fileId,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: insertIndex },
          text: newEntry,
        },
      }],
    },
  });
}

// ── Append notes to an uploaded DOCX file ────────────────────────────────────
// For non-Google-Doc files we download, modify, re-upload
async function appendNotesToDocx(drive, fileId, date, notes, mimeType) {
  const mammoth = require('mammoth');
  const { Document, Packer, Paragraph, TextRun } = require('docx');

  // Download current file
  const buffer = await downloadFile(drive, fileId, mimeType);
  const { value: existingText } = await mammoth.extractRawText({ buffer });

  // Append new entry
  const newText = `${existingText.trim()}\n\n${date}\n${notes}`;

  // Re-upload as same file (update, not create)
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: stream,
    },
  });
}

module.exports = {
  createOAuthClient,
  getAuthUrl,
  exchangeCodeForTokens,
  getDriveClient,
  listSiteFolders,
  getSiteContents,
  downloadFile,
  getPhotosFromDateFolder,
  findDateFolder,
  parseEntriesByDate,
  datesMatch,
  findOrCreateFolder,
  uploadFileToDrive,
  appendNotesToDoc,
  appendNotesToDocx,
};