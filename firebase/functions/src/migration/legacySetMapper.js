'use strict';

const { buildLegacySetItems, normalizeWhitespace } = require('./legacyRowParser');

const LEGACY_USER_SHEET_COLUMNS = Object.freeze({
  LAST_REVIEWED_AT: 0,
  RAW_GROUP_TEXT: 1,
  INPUT_MODE: 2,
  DAYS_OFF: 3,
  REMAINING: 4,
  TOTAL_REVIEW_COUNT: 5,
  ROUND: 6,
  SENTENCE_FLAG: 7,
  RAW_HINT_TEXT: 8,
  CATEGORY_ID: 9,
  COOLDOWN_UNTIL: 10
});

const TAIPEI_OFFSET_MINUTES = 8 * 60;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const asDate = new Date(numeric);
    if (!Number.isNaN(asDate.getTime())) return asDate;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDayAtOffset(date, offsetMinutes = TAIPEI_OFFSET_MINUTES) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMinutes * 60 * 1000);
}

function addDaysAtOffsetMidnight(date, days, offsetMinutes = TAIPEI_OFFSET_MINUTES) {
  return new Date(startOfDayAtOffset(date, offsetMinutes).getTime() + days * 86400000);
}

function targetReviewsForRound(roundValue) {
  const round = Math.max(0, Math.floor(toNumber(roundValue, 0)));
  if (round === 0) return 3;
  if (round === 1) return 3;
  if (round === 2) return 2;
  if (round === 3) return 2;
  return 1;
}

function scheduledGapDays(roundValue) {
  const round = Math.max(0, Math.floor(toNumber(roundValue, 0)));
  if (round === 0) return 0;
  if (round < 5) return 1;
  return Math.max(2, round - 3);
}

function deriveNextReviewAt(input = {}) {
  const now = coerceDate(input.now) || new Date();
  const remaining = Math.max(0, Math.floor(toNumber(input.remaining, 0)));
  const cooldownUntil = coerceDate(input.cooldownUntil);
  if (remaining > 0) {
    if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
      return cooldownUntil;
    }
    return now;
  }

  const round = Math.max(0, Math.floor(toNumber(input.round, 0)));
  const lastReviewedAt = coerceDate(input.lastReviewedAt) || now;
  return addDaysAtOffsetMidnight(lastReviewedAt, scheduledGapDays(round));
}

function deriveCurrentDayProgress(input = {}) {
  const remaining = Math.max(0, Math.floor(toNumber(input.remaining, 0)));
  const round = Math.max(0, Math.floor(toNumber(input.round, 0)));
  const reviewedCount = Math.max(0, targetReviewsForRound(round) - remaining);
  return {
    reviewedCount,
    remaining
  };
}

function buildLegacySetDocument(input = {}) {
  const row = Array.isArray(input.legacyRow) ? input.legacyRow : [];
  const rowIndex = toNumber(input.rowIndex, 0);
  const setId = input.setId || `legacy_r${rowIndex || 0}`;
  const now = coerceDate(input.now) || new Date();
  const lastReviewedAt = coerceDate(row[LEGACY_USER_SHEET_COLUMNS.LAST_REVIEWED_AT]);
  const rawGroupText = String(row[LEGACY_USER_SHEET_COLUMNS.RAW_GROUP_TEXT] || '');
  const rawHintText = String(row[LEGACY_USER_SHEET_COLUMNS.RAW_HINT_TEXT] || '');
  const parsedItems = buildLegacySetItems({ rawGroupText, rawHintText });
  const remaining = Math.max(0, Math.floor(toNumber(row[LEGACY_USER_SHEET_COLUMNS.REMAINING], 0)));
  const round = Math.max(0, Math.floor(toNumber(row[LEGACY_USER_SHEET_COLUMNS.ROUND], 0)));
  const cooldownUntil = coerceDate(row[LEGACY_USER_SHEET_COLUMNS.COOLDOWN_UNTIL]);
  const totalReviewCount = Math.max(0, Math.floor(toNumber(row[LEGACY_USER_SHEET_COLUMNS.TOTAL_REVIEW_COUNT], 0)));
  const createdAt = coerceDate(input.createdAt) || lastReviewedAt || now;
  const updatedAt = coerceDate(input.updatedAt) || now;
  const categoryId = normalizeWhitespace(input.categoryId || row[LEGACY_USER_SHEET_COLUMNS.CATEGORY_ID]);
  const isSentenceSet = Boolean(row[LEGACY_USER_SHEET_COLUMNS.SENTENCE_FLAG]);

  return {
    setDoc: {
      setId,
      categoryId,
      kind: isSentenceSet ? 'sentenceSet' : 'wordSet',
      round,
      nextReviewAt: deriveNextReviewAt({
        now,
        remaining,
        cooldownUntil,
        lastReviewedAt,
        round
      }),
      lastReviewedAt,
      totalReviewCount,
      isArchived: false,
      legacyRowIndex: rowIndex || null,
      createdAt,
      updatedAt,
      items: parsedItems.items
    },
    migrationArtifacts: {
      rawGroupText,
      rawHintText,
      rawParsedItems: parsedItems.rawParsedItems,
      hintSegments: parsedItems.hintSegments,
      detachedContexts: parsedItems.detachedContexts,
      inputMode: normalizeWhitespace(row[LEGACY_USER_SHEET_COLUMNS.INPUT_MODE]),
      cooldownUntil,
      dailyProgress: deriveCurrentDayProgress({ remaining, round })
    }
  };
}

module.exports = {
  LEGACY_USER_SHEET_COLUMNS,
  addDaysAtOffsetMidnight,
  buildLegacySetDocument,
  coerceDate,
  deriveCurrentDayProgress,
  deriveNextReviewAt,
  scheduledGapDays,
  startOfDayAtOffset,
  targetReviewsForRound
};
