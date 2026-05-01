'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyCategoryDocuments,
  fallbackCategoryId,
  isTruthy
} = require('../src/migration/legacyCategoryMapper');

test('isTruthy normalizes legacy boolean-ish values', () => {
  assert.equal(isTruthy(true), true);
  assert.equal(isTruthy(1), true);
  assert.equal(isTruthy('true'), true);
  assert.equal(isTruthy('TRUE'), true);
  assert.equal(isTruthy(false), false);
  assert.equal(isTruthy('false'), false);
});

test('fallbackCategoryId generates deterministic ids for missing legacy ids', () => {
  assert.equal(fallbackCategoryId(0), 'legacy_cat_001');
  assert.equal(fallbackCategoryId(12), 'legacy_cat_013');
});

test('buildLegacyCategoryDocuments normalizes legacy category objects for Firestore', () => {
  const createdAt = new Date('2026-04-24T08:00:00.000Z');
  const docs = buildLegacyCategoryDocuments({
    createdAt,
    legacyCategories: [
      { id: 'c1775564300140', name: '財管', color: 'amber', noSrs: false },
      { id: 'c1775568972714', name: '統計學', color: 'purple', noSRS: 'true' },
      { name: '無 ID 類別', colour: 'emerald', excludeFromSrs: 1 },
      null,
      { id: 'c1775564300140', name: 'duplicate should skip' }
    ]
  });

  assert.deepEqual(docs, [
    {
      categoryId: 'c1775564300140',
      name: '財管',
      color: 'amber',
      noSrs: false,
      order: 0,
      createdAt
    },
    {
      categoryId: 'c1775568972714',
      name: '統計學',
      color: 'purple',
      noSrs: true,
      order: 1,
      createdAt
    },
    {
      categoryId: 'legacy_cat_003',
      name: '無 ID 類別',
      color: 'emerald',
      noSrs: true,
      order: 2,
      createdAt
    }
  ]);
});
