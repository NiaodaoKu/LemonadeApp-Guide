'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  defaultSetIdFromRow,
  firestorePathSegment,
  isTrue,
  parseArgs
} = require('../src/migration/runLegacySetMigration');

test('parseArgs supports dryRun, userKey, and include flags', () => {
  assert.deepEqual(
    parseArgs([
      '--dryRun=true',
      '--userKey=115433568839629910502',
      '--includeWrongAnswers=false',
      '--includeStarredWords=true'
    ]),
    {
      dryRun: 'true',
      userKey: '115433568839629910502',
      includeWrongAnswers: 'false',
      includeStarredWords: 'true'
    }
  );
});

test('isTrue only treats explicit true values as enabled', () => {
  assert.equal(isTrue(true), true);
  assert.equal(isTrue('true'), true);
  assert.equal(isTrue(false), false);
  assert.equal(isTrue('false'), false);
  assert.equal(isTrue(undefined), false);
});

test('defaultSetIdFromRow pads legacy sheet row numbers', () => {
  assert.equal(defaultSetIdFromRow(2), 'legacy_r0002');
  assert.equal(defaultSetIdFromRow(115), 'legacy_r0115');
});

test('firestorePathSegment encodes legacy user keys that contain slashes', () => {
  assert.equal(firestorePathSegment('101226132430314472232'), '101226132430314472232');
  assert.equal(
    firestorePathSegment('u_AKf3uptVW/uuIxKod9PHJ2z6UgwS1U'),
    'u_AKf3uptVW%2FuuIxKod9PHJ2z6UgwS1U'
  );
});
