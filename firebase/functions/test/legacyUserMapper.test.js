'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEGACY_USER_INDEX_COLUMNS,
  buildLegacyUserDocument
} = require('../src/migration/legacyUserMapper');

test('buildLegacyUserDocument maps legacy user-index values into the users document shape', () => {
  const values = new Array(6).fill('');
  values[LEGACY_USER_INDEX_COLUMNS.UID] = '101226132430314472232';
  values[LEGACY_USER_INDEX_COLUMNS.NICKNAME] = ' NiaodaoKu ';
  values[LEGACY_USER_INDEX_COLUMNS.WELCOMED] = 'TRUE';
  values[LEGACY_USER_INDEX_COLUMNS.CREATED_AT] = '2026-04-06T06:51:54.000Z';
  values[LEGACY_USER_INDEX_COLUMNS.LAST_SEEN_AT] = '2026-04-23T03:38:10.000Z';
  values[LEGACY_USER_INDEX_COLUMNS.EMAIL] = 'niaoyue0041@gmail.com';

  const user = buildLegacyUserDocument({
    values,
    timezone: 'Asia/Taipei',
    now: new Date('2026-04-24T08:00:00.000Z')
  });

  assert.equal(user.uid, '101226132430314472232');
  assert.equal(user.nickname, 'NiaodaoKu');
  assert.equal(user.welcomed, true);
  assert.equal(user.timezone, 'Asia/Taipei');
  assert.equal(user.createdAt.toISOString(), '2026-04-06T06:51:54.000Z');
  assert.equal(user.lastSeenAt.toISOString(), '2026-04-23T03:38:10.000Z');
  assert.equal(user.email, 'niaoyue0041@gmail.com');
});

test('buildLegacyUserDocument handles missing optional fields but requires uid', () => {
  const values = ['u_abc', '', false, '', '', ''];
  const now = new Date('2026-04-24T08:00:00.000Z');
  const user = buildLegacyUserDocument({ values, now });

  assert.equal(user.uid, 'u_abc');
  assert.equal(user.nickname, '');
  assert.equal(user.welcomed, false);
  assert.equal(user.timezone, 'Asia/Taipei');
  assert.equal(user.createdAt.toISOString(), now.toISOString());
  assert.equal(user.lastSeenAt, null);
  assert.equal(user.email, '');
});
