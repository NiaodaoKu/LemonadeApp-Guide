'use strict';

const DEFAULT_HEAD_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxvBsU8xn5j8FQOq4N02a230sTHNuuUnHdlg3lEp2w/dev';

async function callAppsScriptAction(options = {}) {
  const headWebappUrl = options.headWebappUrl || process.env.LEGACY_GAS_HEAD_URL || DEFAULT_HEAD_WEBAPP_URL;
  const accessToken = options.accessToken;
  const payload = JSON.stringify(options.payload || {});
  if (!accessToken) throw new Error('Missing access token for Apps Script call');

  const initResponse = await fetch(headWebappUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain'
    },
    body: payload,
    redirect: 'manual'
  });

  let finalResponse = initResponse;
  if (initResponse.status >= 300 && initResponse.status < 400) {
    const redirectUrl = initResponse.headers.get('location');
    if (!redirectUrl) {
      throw new Error(`Apps Script redirect missing Location header (status ${initResponse.status})`);
    }
    finalResponse = await fetch(redirectUrl, { method: 'GET' });
  }

  const text = await finalResponse.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Apps Script returned non-JSON response: ${text.slice(0, 200)}`);
  }

  if (!finalResponse.ok) {
    throw new Error(`Apps Script request failed (${finalResponse.status}): ${text}`);
  }
  if (json && json.success === false) {
    throw new Error(`Apps Script action failed: ${json.error || 'unknown error'}`);
  }
  return json.data;
}

async function fetchMigrationRows(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getMigrationRows',
      userKey: options.userKey,
      limit: options.limit,
      startRow: options.startRow
    }
  });
}

async function fetchAllMigrationRows(options = {}) {
  const pageSize = Math.max(1, Math.min(200, Number(options.pageSize) || 100));
  const startRow = Math.max(2, Number(options.startRow) || 2);
  const allRows = [];
  let currentStartRow = startRow;
  let firstPageMeta = null;

  while (true) {
    const page = await fetchMigrationRows({
      accessToken: options.accessToken,
      headWebappUrl: options.headWebappUrl,
      userKey: options.userKey,
      limit: pageSize,
      startRow: currentStartRow
    });
    if (!firstPageMeta) firstPageMeta = page;
    const rows = Array.isArray(page.rows) ? page.rows : [];
    const scannedRowCount = Number.isFinite(Number(page.scannedRowCount))
      ? Number(page.scannedRowCount)
      : rows.length;
    if (rows.length === 0) break;
    allRows.push(...rows);
    if (scannedRowCount < pageSize) break;
    currentStartRow += pageSize;
  }

  return {
    userKey: options.userKey,
    sheetName: firstPageMeta ? firstPageMeta.sheetName : '',
    header: firstPageMeta ? firstPageMeta.header : [],
    rows: allRows
  };
}

async function fetchUserIndexRow(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getMigrationUserIndexRow',
      userKey: options.userKey
    }
  });
}

async function fetchUserIndexRows(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getMigrationUserIndexRows',
      limit: options.limit,
      startRow: options.startRow
    }
  });
}

async function fetchAllUserIndexRows(options = {}) {
  const pageSize = Math.max(1, Math.min(200, Number(options.pageSize) || 100));
  const startRow = Math.max(2, Number(options.startRow) || 2);
  const allRows = [];
  let currentStartRow = startRow;
  let firstPageMeta = null;

  while (true) {
    const page = await fetchUserIndexRows({
      accessToken: options.accessToken,
      headWebappUrl: options.headWebappUrl,
      limit: pageSize,
      startRow: currentStartRow
    });
    if (!firstPageMeta) firstPageMeta = page;
    const rows = Array.isArray(page.rows) ? page.rows : [];
    const scannedRowCount = Number.isFinite(Number(page.scannedRowCount))
      ? Number(page.scannedRowCount)
      : rows.length;
    allRows.push(...rows);
    if (scannedRowCount < pageSize) break;
    currentStartRow += pageSize;
  }

  return {
    sheetName: firstPageMeta ? firstPageMeta.sheetName : '',
    header: firstPageMeta ? firstPageMeta.header : [],
    rows: allRows
  };
}

async function fetchWrongAnswerRows(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getMigrationWrongAnswerRows',
      userKey: options.userKey,
      limit: options.limit,
      startRow: options.startRow
    }
  });
}

async function fetchAllWrongAnswerRows(options = {}) {
  const pageSize = Math.max(1, Math.min(200, Number(options.pageSize) || 100));
  const startRow = Math.max(2, Number(options.startRow) || 2);
  const allRows = [];
  let currentStartRow = startRow;
  let firstPageMeta = null;

  while (true) {
    const page = await fetchWrongAnswerRows({
      accessToken: options.accessToken,
      headWebappUrl: options.headWebappUrl,
      userKey: options.userKey,
      limit: pageSize,
      startRow: currentStartRow
    });
    if (!firstPageMeta) firstPageMeta = page;
    const rows = Array.isArray(page.rows) ? page.rows : [];
    const scannedRowCount = Number.isFinite(Number(page.scannedRowCount))
      ? Number(page.scannedRowCount)
      : rows.length;
    allRows.push(...rows);
    if (scannedRowCount < pageSize) break;
    currentStartRow += pageSize;
  }

  return {
    userKey: options.userKey,
    sheetName: firstPageMeta ? firstPageMeta.sheetName : '',
    header: firstPageMeta ? firstPageMeta.header : [],
    rows: allRows
  };
}

async function fetchUserCategories(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getUserCategories',
      userKey: options.userKey
    }
  });
}

async function fetchStarredWords(options = {}) {
  return callAppsScriptAction({
    headWebappUrl: options.headWebappUrl,
    accessToken: options.accessToken,
    payload: {
      action: 'getStarredWords',
      userKey: options.userKey
    }
  });
}

module.exports = {
  DEFAULT_HEAD_WEBAPP_URL,
  callAppsScriptAction,
  fetchAllMigrationRows,
  fetchAllUserIndexRows,
  fetchAllWrongAnswerRows,
  fetchMigrationRows,
  fetchStarredWords,
  fetchUserIndexRows,
  fetchWrongAnswerRows,
  fetchUserIndexRow,
  fetchUserCategories
};
