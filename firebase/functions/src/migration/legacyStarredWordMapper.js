'use strict';

const { normalizeWordKey } = require('./legacyRowParser');
const { itemScopedId, resolveWrongAnswerTarget } = require('./legacyWrongAnswerMapper');
const { coerceDate } = require('./legacySetMapper');

function normalizeStarredWords(rawStarredWords = []) {
  if (!Array.isArray(rawStarredWords)) return [];
  return Array.from(new Set(
    rawStarredWords
      .map((wordKey) => normalizeWordKey(wordKey))
      .filter(Boolean)
  ));
}

function resolveStarredWordTarget(input = {}) {
  return resolveWrongAnswerTarget({
    wordKey: input.wordKey,
    primaryZh: '',
    lookup: input.lookup
  });
}

function buildLegacyStarredWordDocument(input = {}) {
  const wordKey = normalizeWordKey(input.wordKey);
  if (!wordKey) throw new Error('Starred word is missing the English key');

  const resolved = resolveStarredWordTarget({
    wordKey,
    lookup: input.lookup
  });
  if (resolved.status !== 'resolved') {
    return {
      status: resolved.status,
      wordKey,
      document: null
    };
  }

  const candidate = resolved.candidate;
  const createdAt = coerceDate(input.createdAt || input.now) || new Date();
  return {
    status: 'resolved',
    wordKey,
    documentId: itemScopedId(candidate.sourceSetId, candidate.sourceItemId),
    document: {
      wordKey,
      sourceSetId: candidate.sourceSetId,
      sourceItemId: candidate.sourceItemId,
      createdAt
    }
  };
}

module.exports = {
  buildLegacyStarredWordDocument,
  normalizeStarredWords,
  resolveStarredWordTarget
};
