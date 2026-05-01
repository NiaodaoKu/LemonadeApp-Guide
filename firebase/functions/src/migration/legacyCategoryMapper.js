'use strict';

const { normalizeWhitespace } = require('./legacyRowParser');

function isTruthy(value) {
  return value === true || value === 1 || String(value || '').trim().toLowerCase() === 'true';
}

function fallbackCategoryId(index) {
  return `legacy_cat_${String(index + 1).padStart(3, '0')}`;
}

function buildLegacyCategoryDocuments(input = {}) {
  const rawCategories = Array.isArray(input.legacyCategories) ? input.legacyCategories : [];
  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date();
  const seenIds = new Set();

  return rawCategories.reduce((acc, rawCategory, index) => {
    if (!rawCategory || typeof rawCategory !== 'object') return acc;

    let categoryId = normalizeWhitespace(
      rawCategory.id ||
      rawCategory.categoryId ||
      rawCategory.key
    );
    if (!categoryId) categoryId = fallbackCategoryId(index);
    if (seenIds.has(categoryId)) return acc;
    seenIds.add(categoryId);

    const name = normalizeWhitespace(rawCategory.name || rawCategory.label || rawCategory.title);
    if (!name) return acc;

    const color = normalizeWhitespace(rawCategory.color || rawCategory.colour || '');
    const orderCandidate = Number(rawCategory.order);
    const order = Number.isFinite(orderCandidate) ? orderCandidate : index;

    acc.push({
      categoryId,
      name,
      color,
      noSrs: isTruthy(rawCategory.noSrs || rawCategory.noSRS || rawCategory.excludeFromSrs),
      order,
      createdAt
    });
    return acc;
  }, []);
}

module.exports = {
  buildLegacyCategoryDocuments,
  fallbackCategoryId,
  isTruthy
};
