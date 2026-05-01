'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEGACY_USER_SHEET_COLUMNS,
  buildLegacySetDocument,
  deriveCurrentDayProgress,
  deriveNextReviewAt,
  scheduledGapDays
} = require('../src/migration/legacySetMapper');

function buildRow(overrides = {}) {
  const row = new Array(11).fill('');
  row[LEGACY_USER_SHEET_COLUMNS.LAST_REVIEWED_AT] = new Date('2026-04-24T03:00:00.000Z');
  row[LEGACY_USER_SHEET_COLUMNS.RAW_GROUP_TEXT] = 'insensitive 感覺遲鈍的 @@ conduct v. 進行；實施';
  row[LEGACY_USER_SHEET_COLUMNS.INPUT_MODE] = '手動錄入';
  row[LEGACY_USER_SHEET_COLUMNS.DAYS_OFF] = 0;
  row[LEGACY_USER_SHEET_COLUMNS.REMAINING] = 1;
  row[LEGACY_USER_SHEET_COLUMNS.TOTAL_REVIEW_COUNT] = 21;
  row[LEGACY_USER_SHEET_COLUMNS.ROUND] = 3;
  row[LEGACY_USER_SHEET_COLUMNS.SENTENCE_FLAG] = '';
  row[LEGACY_USER_SHEET_COLUMNS.RAW_HINT_TEXT] = '@@ The bank will conduct an internal review.';
  row[LEGACY_USER_SHEET_COLUMNS.CATEGORY_ID] = 'c_finance';
  row[LEGACY_USER_SHEET_COLUMNS.COOLDOWN_UNTIL] = '';

  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }

  return row;
}

test('scheduledGapDays matches the current SRS rules', () => {
  assert.equal(scheduledGapDays(0), 0);
  assert.equal(scheduledGapDays(1), 1);
  assert.equal(scheduledGapDays(4), 1);
  assert.equal(scheduledGapDays(5), 2);
  assert.equal(scheduledGapDays(8), 5);
});

test('deriveNextReviewAt returns cooldown when there are pending same-day reviews', () => {
  const now = new Date('2026-04-24T02:00:00.000Z');
  const cooldownUntil = new Date('2026-04-24T02:30:00.000Z');

  const nextReviewAt = deriveNextReviewAt({
    now,
    remaining: 2,
    cooldownUntil,
    lastReviewedAt: new Date('2026-04-24T01:00:00.000Z'),
    round: 0
  });

  assert.equal(nextReviewAt.toISOString(), cooldownUntil.toISOString());
});

test('deriveNextReviewAt returns local midnight on the next scheduled day after a round completes', () => {
  const nextReviewAt = deriveNextReviewAt({
    now: new Date('2026-04-24T06:00:00.000Z'),
    remaining: 0,
    cooldownUntil: '',
    lastReviewedAt: new Date('2026-04-24T03:00:00.000Z'),
    round: 5
  });

  assert.equal(nextReviewAt.toISOString(), '2026-04-25T16:00:00.000Z');
});

test('deriveCurrentDayProgress infers reviewed count from remaining reviews', () => {
  assert.deepEqual(deriveCurrentDayProgress({ round: 0, remaining: 2 }), {
    reviewedCount: 1,
    remaining: 2
  });

  assert.deepEqual(deriveCurrentDayProgress({ round: 4, remaining: 0 }), {
    reviewedCount: 1,
    remaining: 0
  });
});

test('buildLegacySetDocument maps a legacy row into a Firebase-ready set document and artifacts', () => {
  const row = buildRow();
  const now = new Date('2026-04-24T02:00:00.000Z');
  const mapped = buildLegacySetDocument({
    rowIndex: 12,
    setId: 'set_0012',
    legacyRow: row,
    now,
    createdAt: new Date('2026-04-23T16:00:00.000Z'),
    updatedAt: now
  });

  assert.equal(mapped.setDoc.setId, 'set_0012');
  assert.equal(mapped.setDoc.categoryId, 'c_finance');
  assert.equal(mapped.setDoc.kind, 'wordSet');
  assert.equal(mapped.setDoc.round, 3);
  assert.equal(mapped.setDoc.totalReviewCount, 21);
  assert.equal(mapped.setDoc.items.length, 2);
  assert.equal(mapped.setDoc.items[1].lemma, 'conduct');
  assert.equal(mapped.setDoc.items[1].hintText, 'The bank will conduct an internal review.');
  assert.equal(mapped.migrationArtifacts.dailyProgress.reviewedCount, 1);
  assert.equal(mapped.migrationArtifacts.inputMode, '手動錄入');
});

test('buildLegacySetDocument keeps sentence rows distinct when the legacy sentence flag is present', () => {
  const row = buildRow({
    [LEGACY_USER_SHEET_COLUMNS.SENTENCE_FLAG]: '1',
    [LEGACY_USER_SHEET_COLUMNS.REMAINING]: 0,
    [LEGACY_USER_SHEET_COLUMNS.ROUND]: 5
  });
  const mapped = buildLegacySetDocument({
    rowIndex: 8,
    legacyRow: row,
    now: new Date('2026-04-24T02:00:00.000Z')
  });

  assert.equal(mapped.setDoc.kind, 'sentenceSet');
  assert.equal(mapped.setDoc.items[0].lemma, 'insensitive');
  assert.equal(mapped.setDoc.nextReviewAt.toISOString(), '2026-04-25T16:00:00.000Z');
});
