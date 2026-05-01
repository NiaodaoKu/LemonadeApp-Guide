'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyWrongAnswerDocument,
  buildSetItemLookup,
  itemScopedId,
  resolveWrongAnswerTarget
} = require('../src/migration/legacyWrongAnswerMapper');

test('itemScopedId joins setId and itemId deterministically', () => {
  assert.equal(itemScopedId('legacy_r0002', 'i7'), 'legacy_r0002_i7');
});

test('buildSetItemLookup indexes migrated set items by normalized word key', () => {
  const lookup = buildSetItemLookup([
    {
      setId: 'legacy_r0002',
      items: [
        { itemId: 'i1', lemma: 'scar', normalizedKey: 'scar', rawZh: '疤痕', senses: [] },
        { itemId: 'i2', lemma: 'conceal', normalizedKey: 'conceal', rawZh: '隱藏', senses: [] }
      ]
    }
  ]);

  assert.equal(lookup.get('scar').length, 1);
  assert.equal(lookup.get('scar')[0].sourceSetId, 'legacy_r0002');
  assert.equal(lookup.get('scar')[0].sourceItemId, 'i1');
});

test('resolveWrongAnswerTarget prefers a single exact Chinese match when duplicates exist', () => {
  const lookup = buildSetItemLookup([
    {
      setId: 'legacy_r0002',
      items: [
        { itemId: 'i1', lemma: 'conduct', normalizedKey: 'conduct', rawZh: '進行；實施', senses: [] }
      ]
    },
    {
      setId: 'legacy_r0005',
      items: [
        {
          itemId: 'i3',
          lemma: 'conduct',
          normalizedKey: 'conduct',
          rawZh: '行為；操守',
          senses: [{ definitionsZh: ['行為', '操守'] }]
        }
      ]
    }
  ]);

  const resolved = resolveWrongAnswerTarget({
    wordKey: 'conduct',
    primaryZh: '行為',
    lookup
  });

  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.candidate.sourceSetId, 'legacy_r0005');
  assert.equal(resolved.candidate.sourceItemId, 'i3');
});

test('buildLegacyWrongAnswerDocument maps a resolved legacy wrong-answer row into the Firestore shape', () => {
  const lookup = buildSetItemLookup([
    {
      setId: 'legacy_r0002',
      items: [
        { itemId: 'i7', lemma: 'scar', normalizedKey: 'scar', rawZh: '疤痕', senses: [] }
      ]
    }
  ]);

  const mapped = buildLegacyWrongAnswerDocument({
    values: ['101226132430314472232', 'scar', '疤痕', 2, '2026-04-11T13:20:30.000Z', 1],
    lookup,
    now: '2026-05-01T01:02:03.000Z'
  });

  assert.equal(mapped.status, 'resolved');
  assert.equal(mapped.documentId, 'legacy_r0002_i7');
  assert.deepEqual(mapped.document, {
    wordKey: 'scar',
    primaryZh: '疤痕',
    wrongCount: 2,
    consecutiveCorrect: 1,
    lastWrongAt: new Date('2026-04-11T13:20:30.000Z'),
    sourceSetId: 'legacy_r0002',
    sourceItemId: 'i7',
    updatedAt: new Date('2026-05-01T01:02:03.000Z')
  });
});

test('buildLegacyWrongAnswerDocument reports missing targets when no migrated set item matches', () => {
  const mapped = buildLegacyWrongAnswerDocument({
    values: ['101226132430314472232', 'nonexistent', '不存在', 1, '', 0],
    lookup: buildSetItemLookup([])
  });

  assert.equal(mapped.status, 'missing');
  assert.equal(mapped.document, null);
});
