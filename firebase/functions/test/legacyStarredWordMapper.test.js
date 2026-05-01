'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSetItemLookup } = require('../src/migration/legacyWrongAnswerMapper');
const {
  buildLegacyStarredWordDocument,
  normalizeStarredWords,
  resolveStarredWordTarget
} = require('../src/migration/legacyStarredWordMapper');

test('normalizeStarredWords lowercases, trims, and de-duplicates legacy keys', () => {
  assert.deepEqual(
    normalizeStarredWords([' Scar ', 'scar', '', null, 'CONCEAL']),
    ['scar', 'conceal']
  );
});

test('buildLegacyStarredWordDocument maps a resolved legacy star into the Firestore shape', () => {
  const lookup = buildSetItemLookup([
    {
      setId: 'legacy_r0002',
      items: [
        { itemId: 'i7', lemma: 'scar', normalizedKey: 'scar', rawZh: '疤痕', senses: [] }
      ]
    }
  ]);

  const mapped = buildLegacyStarredWordDocument({
    wordKey: ' Scar ',
    lookup,
    now: '2026-05-01T01:02:03.000Z'
  });

  assert.equal(mapped.status, 'resolved');
  assert.equal(mapped.documentId, 'legacy_r0002_i7');
  assert.deepEqual(mapped.document, {
    wordKey: 'scar',
    sourceSetId: 'legacy_r0002',
    sourceItemId: 'i7',
    createdAt: new Date('2026-05-01T01:02:03.000Z')
  });
});

test('resolveStarredWordTarget reports ambiguous stars when duplicate word keys exist', () => {
  const lookup = buildSetItemLookup([
    {
      setId: 'legacy_r0002',
      items: [{ itemId: 'i1', lemma: 'conduct', normalizedKey: 'conduct', rawZh: '進行', senses: [] }]
    },
    {
      setId: 'legacy_r0005',
      items: [{ itemId: 'i3', lemma: 'conduct', normalizedKey: 'conduct', rawZh: '行為', senses: [] }]
    }
  ]);

  const resolved = resolveStarredWordTarget({
    wordKey: 'conduct',
    lookup
  });

  assert.equal(resolved.status, 'ambiguous');
});
