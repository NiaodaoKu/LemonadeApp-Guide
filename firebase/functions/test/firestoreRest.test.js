'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { toFirestoreDocument } = require('../src/migration/firestoreRest');

test('toFirestoreDocument maps nested migration payloads into Firestore REST format', () => {
  const document = toFirestoreDocument({
    setId: 'legacy_r0002',
    round: 3,
    isArchived: false,
    nextReviewAt: new Date('2026-04-24T16:00:00.000Z'),
    items: [
      {
        itemId: 'i1',
        lemma: 'conduct',
        contexts: ['The bank will conduct an internal review.']
      }
    ]
  });

  assert.equal(document.fields.setId.stringValue, 'legacy_r0002');
  assert.equal(document.fields.round.integerValue, '3');
  assert.equal(document.fields.isArchived.booleanValue, false);
  assert.equal(document.fields.nextReviewAt.timestampValue, '2026-04-24T16:00:00.000Z');
  assert.equal(
    document.fields.items.arrayValue.values[0].mapValue.fields.lemma.stringValue,
    'conduct'
  );
});
