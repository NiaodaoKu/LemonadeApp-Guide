'use strict';

const { normalizeWordKey, normalizeWhitespace } = require('./legacyRowParser');
const { coerceDate } = require('./legacySetMapper');

const LEGACY_WRONG_ANSWER_COLUMNS = Object.freeze({
  USER_KEY: 0,
  EN: 1,
  ZH: 2,
  WRONG_COUNT: 3,
  UPDATED_AT: 4,
  CONSECUTIVE_CORRECT: 5
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function itemScopedId(sourceSetId, sourceItemId) {
  return `${sourceSetId}_${sourceItemId}`;
}

function scoreItemCandidate(candidate, primaryZh) {
  let score = 0;
  const targetZh = normalizeWhitespace(primaryZh);
  if (!targetZh) return score;

  const haystacks = [];
  if (candidate.rawZh) haystacks.push(normalizeWhitespace(candidate.rawZh));
  if (Array.isArray(candidate.senses)) {
    candidate.senses.forEach((sense) => {
      (sense.definitionsZh || []).forEach((definition) => {
        haystacks.push(normalizeWhitespace(definition));
      });
    });
  }

  for (const haystack of haystacks) {
    if (!haystack) continue;
    if (haystack === targetZh) score = Math.max(score, 100);
    else if (haystack.includes(targetZh) || targetZh.includes(haystack)) score = Math.max(score, 50);
  }

  return score;
}

function buildSetItemLookup(setSummaries = []) {
  const lookup = new Map();

  setSummaries.forEach((setSummary) => {
    (setSummary.items || []).forEach((item) => {
      const key = normalizeWordKey(item.normalizedKey || item.lemma);
      if (!key) return;
      const candidate = {
        sourceSetId: setSummary.setId,
        sourceItemId: item.itemId,
        lemma: item.lemma,
        normalizedKey: key,
        rawZh: item.rawZh || '',
        senses: item.senses || []
      };
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(candidate);
    });
  });

  return lookup;
}

function resolveWrongAnswerTarget(input = {}) {
  const key = normalizeWordKey(input.wordKey);
  const candidates = (input.lookup && input.lookup.get(key)) || [];
  if (candidates.length === 0) {
    return { status: 'missing', candidate: null, candidates: [] };
  }
  if (candidates.length === 1) {
    return { status: 'resolved', candidate: candidates[0], candidates };
  }

  const primaryZh = normalizeWhitespace(input.primaryZh);
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreItemCandidate(candidate, primaryZh)
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0].score > 0) {
    const topScore = scored[0].score;
    const equallyBest = scored.filter((entry) => entry.score === topScore);
    if (equallyBest.length === 1) {
      return { status: 'resolved', candidate: equallyBest[0].candidate, candidates };
    }
  }

  return { status: 'ambiguous', candidate: null, candidates };
}

function buildLegacyWrongAnswerDocument(input = {}) {
  const values = Array.isArray(input.values) ? input.values : [];
  const wordKey = normalizeWhitespace(values[LEGACY_WRONG_ANSWER_COLUMNS.EN]);
  if (!wordKey) throw new Error('Wrong-answer row is missing the English key');
  const primaryZh = normalizeWhitespace(values[LEGACY_WRONG_ANSWER_COLUMNS.ZH]);
  const resolved = resolveWrongAnswerTarget({
    wordKey,
    primaryZh,
    lookup: input.lookup
  });
  if (resolved.status !== 'resolved') {
    return {
      status: resolved.status,
      wordKey,
      primaryZh,
      document: null
    };
  }

  const candidate = resolved.candidate;
  const lastWrongAt = coerceDate(values[LEGACY_WRONG_ANSWER_COLUMNS.UPDATED_AT]);
  const updatedAt = coerceDate(input.updatedAt || input.now) || lastWrongAt || new Date();
  return {
    status: 'resolved',
    wordKey,
    primaryZh,
    documentId: itemScopedId(candidate.sourceSetId, candidate.sourceItemId),
    document: {
      wordKey,
      primaryZh,
      wrongCount: Math.max(1, toNumber(values[LEGACY_WRONG_ANSWER_COLUMNS.WRONG_COUNT], 1)),
      consecutiveCorrect: Math.max(0, toNumber(values[LEGACY_WRONG_ANSWER_COLUMNS.CONSECUTIVE_CORRECT], 0)),
      lastWrongAt,
      sourceSetId: candidate.sourceSetId,
      sourceItemId: candidate.sourceItemId,
      updatedAt
    }
  };
}

module.exports = {
  LEGACY_WRONG_ANSWER_COLUMNS,
  buildLegacyWrongAnswerDocument,
  buildSetItemLookup,
  itemScopedId,
  resolveWrongAnswerTarget,
  scoreItemCandidate
};
