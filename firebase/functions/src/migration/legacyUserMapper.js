'use strict';

const { isTruthy } = require('./legacyCategoryMapper');
const { coerceDate } = require('./legacySetMapper');
const { normalizeWhitespace } = require('./legacyRowParser');

const LEGACY_USER_INDEX_COLUMNS = Object.freeze({
  UID: 0,
  NICKNAME: 1,
  WELCOMED: 2,
  CREATED_AT: 3,
  LAST_SEEN_AT: 4,
  EMAIL: 5
});

function buildLegacyUserDocument(input = {}) {
  const values = Array.isArray(input.values) ? input.values : [];
  const timezone = normalizeWhitespace(input.timezone || 'Asia/Taipei') || 'Asia/Taipei';
  const now = input.now instanceof Date ? input.now : new Date();

  const uid = normalizeWhitespace(values[LEGACY_USER_INDEX_COLUMNS.UID] || input.uid);
  if (!uid) throw new Error('Legacy user row is missing UserKey');

  const nickname = normalizeWhitespace(values[LEGACY_USER_INDEX_COLUMNS.NICKNAME]);
  const welcomed = isTruthy(values[LEGACY_USER_INDEX_COLUMNS.WELCOMED]);
  const createdAt = coerceDate(values[LEGACY_USER_INDEX_COLUMNS.CREATED_AT]) || now;
  const lastSeenAt = coerceDate(values[LEGACY_USER_INDEX_COLUMNS.LAST_SEEN_AT]);
  const email = normalizeWhitespace(values[LEGACY_USER_INDEX_COLUMNS.EMAIL]);

  return {
    uid,
    nickname,
    welcomed,
    timezone,
    createdAt,
    lastSeenAt,
    email
  };
}

module.exports = {
  LEGACY_USER_INDEX_COLUMNS,
  buildLegacyUserDocument
};
