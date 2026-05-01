'use strict';

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item))
      }
    };
  }

  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    case 'object': {
      const fields = {};
      Object.entries(value).forEach(([key, nested]) => {
        if (nested === undefined) return;
        fields[key] = toFirestoreValue(nested);
      });
      return { mapValue: { fields } };
    }
    default:
      return { stringValue: String(value) };
  }
}

function toFirestoreDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Firestore document payload must be an object');
  }
  return {
    fields: Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, toFirestoreValue(nested)])
    )
  };
}

async function writeDocument(options = {}) {
  const projectId = options.projectId;
  const documentPath = options.documentPath;
  const accessToken = options.accessToken;
  const document = options.document;
  if (!projectId) throw new Error('Missing Firestore projectId');
  if (!documentPath) throw new Error('Missing Firestore document path');
  if (!accessToken) throw new Error('Missing Firestore access token');

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(toFirestoreDocument(document))
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firestore write failed (${response.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function listDocuments(options = {}) {
  const projectId = options.projectId;
  const documentPath = options.documentPath;
  const accessToken = options.accessToken;
  const pageSize = Math.max(1, Math.min(500, Number(options.pageSize) || 100));
  if (!projectId) throw new Error('Missing Firestore projectId');
  if (!documentPath) throw new Error('Missing Firestore document path');
  if (!accessToken) throw new Error('Missing Firestore access token');

  const results = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Firestore list failed (${response.status}): ${text}`);
    }
    const json = JSON.parse(text);
    results.push(...(json.documents || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return results;
}

module.exports = {
  listDocuments,
  toFirestoreDocument,
  toFirestoreValue,
  writeDocument
};
