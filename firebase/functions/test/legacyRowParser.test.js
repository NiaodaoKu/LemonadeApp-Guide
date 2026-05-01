'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  POS_LABEL_TO_POS,
  buildLegacySetItems,
  isLikelyContextText,
  normalizePosLabel,
  parseGroupSegment,
  parseHintSegments,
  splitLegacySegments
} = require('../src/migration/legacyRowParser');

test('splitLegacySegments trims entries and can preserve empty hint slots', () => {
  assert.deepEqual(
    splitLegacySegments('insensitive 感覺遲鈍的 @@ wizard 巫師 @@', { keepEmpty: false }),
    ['insensitive 感覺遲鈍的', 'wizard 巫師']
  );

  assert.deepEqual(
    splitLegacySegments('@@ A scar is a mark left on the skin. @@ @@ To conceal means to hide something.', { keepEmpty: true }),
    ['', 'A scar is a mark left on the skin.', '', 'To conceal means to hide something.']
  );
});

test('normalizePosLabel maps aliases onto canonical UI labels', () => {
  assert.equal(normalizePosLabel('Verb'), 'v.');
  assert.equal(normalizePosLabel('vt.'), 'vt.');
  assert.equal(normalizePosLabel('vi'), 'vi.');
  assert.equal(normalizePosLabel('adj'), 'adj.');
  assert.equal(normalizePosLabel('ph'), 'ph.');
  assert.equal(normalizePosLabel('phr.'), 'phr.');
  assert.equal(POS_LABEL_TO_POS['adj.'], 'adjective');
  assert.equal(POS_LABEL_TO_POS['vt.'], 'verb');
});

test('parseGroupSegment handles phrases with Chinese meanings', () => {
  const parsed = parseGroupSegment('on purpose 故意地');

  assert.equal(parsed.guessType, 'wordZh');
  assert.equal(parsed.lemma, 'on purpose');
  assert.equal(parsed.normalizedKey, 'on purpose');
  assert.equal(parsed.rawZh, '故意地');
  assert.deepEqual(parsed.senses, [
    {
      senseKey: 's1',
      pos: 'other',
      posLabel: '',
      definitionsZh: ['故意地'],
      definitionEn: ''
    }
  ]);
});

test('parseGroupSegment extracts trailing pos labels and multiple Chinese definitions', () => {
  const parsed = parseGroupSegment('conduct v. 進行；實施', { itemId: 'i3' });

  assert.equal(parsed.guessType, 'wordZh');
  assert.equal(parsed.lemma, 'conduct');
  assert.equal(parsed.posLabel, 'v.');
  assert.deepEqual(parsed.senses, [
    {
      senseKey: 'i3_s1',
      pos: 'verb',
      posLabel: 'v.',
      definitionsZh: ['進行', '實施'],
      definitionEn: ''
    }
  ]);
});

test('parseGroupSegment detects correct and misplaced part-of-speech formats', () => {
  const correct = parseGroupSegment('permissions n. 權限', { itemId: 'i1' });
  assert.equal(correct.guessType, 'wordZh');
  assert.equal(correct.lemma, 'permissions');
  assert.equal(correct.rawZh, '權限');
  assert.equal(correct.posLabel, 'n.');
  assert.deepEqual(correct.senses, [
    {
      senseKey: 'i1_s1',
      pos: 'noun',
      posLabel: 'n.',
      definitionsZh: ['權限'],
      definitionEn: ''
    }
  ]);

  const misplaced = parseGroupSegment('aftermath 後果 n.', { itemId: 'i2' });
  assert.equal(misplaced.guessType, 'wordZh');
  assert.equal(misplaced.lemma, 'aftermath');
  assert.equal(misplaced.rawZh, '後果');
  assert.equal(misplaced.posLabel, 'n.');
  assert.deepEqual(misplaced.senses, [
    {
      senseKey: 'i2_s1',
      pos: 'noun',
      posLabel: 'n.',
      definitionsZh: ['後果'],
      definitionEn: ''
    }
  ]);
});

test('parseGroupSegment handles legacy vt vi and ph abbreviations in both positions', () => {
  const transitive = parseGroupSegment('daunt vt. 使畏懼', { itemId: 'i1' });
  assert.equal(transitive.lemma, 'daunt');
  assert.equal(transitive.posLabel, 'vt.');
  assert.equal(transitive.senses[0].pos, 'verb');
  assert.deepEqual(transitive.senses[0].definitionsZh, ['使畏懼']);

  const phrase = parseGroupSegment('case history ph. 病歷', { itemId: 'i2' });
  assert.equal(phrase.lemma, 'case history');
  assert.equal(phrase.posLabel, 'ph.');
  assert.equal(phrase.senses[0].pos, 'phrase');
  assert.deepEqual(phrase.senses[0].definitionsZh, ['病歷']);

  const misplaced = parseGroupSegment('deteriorated 惡化 vi.', { itemId: 'i3' });
  assert.equal(misplaced.lemma, 'deteriorated');
  assert.equal(misplaced.posLabel, 'vi.');
  assert.equal(misplaced.senses[0].pos, 'verb');
  assert.deepEqual(misplaced.senses[0].definitionsZh, ['惡化']);
});

test('parseGroupSegment can split multiple senses when the Chinese text carries explicit labels', () => {
  const parsed = parseGroupSegment('conduct v. 進行；實施； n. 行為；操守', { itemId: 'i7' });

  assert.equal(parsed.guessType, 'wordZh');
  assert.deepEqual(parsed.senses, [
    {
      senseKey: 'i7_s1',
      pos: 'verb',
      posLabel: 'v.',
      definitionsZh: ['進行', '實施'],
      definitionEn: ''
    },
    {
      senseKey: 'i7_s2',
      pos: 'noun',
      posLabel: 'n.',
      definitionsZh: ['行為', '操守'],
      definitionEn: ''
    }
  ]);
});

test('isLikelyContextText catches English hint sentences without confusing short phrases', () => {
  assert.equal(isLikelyContextText('A scar is a mark left on the skin.'), true);
  assert.equal(isLikelyContextText('To conceal means to hide something.'), true);
  assert.equal(isLikelyContextText('on record'), false);
});

test('buildLegacySetItems aligns hint slots to word order and keeps raw parsing traces', () => {
  const built = buildLegacySetItems({
    rawGroupText: 'insensitive 感覺遲鈍的 @@ on purpose 故意地 @@ conduct v. 進行；實施',
    rawHintText: '@@ It means deliberately, not by accident. @@ The bank will conduct an internal review.'
  });

  assert.equal(built.items.length, 3);
  assert.equal(built.rawParsedItems.length, 3);

  assert.deepEqual(
    built.items.map((item) => ({
      itemId: item.itemId,
      lemma: item.lemma,
      hintText: item.hintText,
      senseCount: item.senses.length
    })),
    [
      { itemId: 'i1', lemma: 'insensitive', hintText: '', senseCount: 1 },
      { itemId: 'i2', lemma: 'on purpose', hintText: 'It means deliberately, not by accident.', senseCount: 1 },
      { itemId: 'i3', lemma: 'conduct', hintText: 'The bank will conduct an internal review.', senseCount: 1 }
    ]
  );

  assert.deepEqual(built.items[2].senses[0].definitionsZh, ['進行', '實施']);
  assert.deepEqual(parseHintSegments(built.rawHintText), [
    '',
    'It means deliberately, not by accident.',
    'The bank will conduct an internal review.'
  ]);
});

test('buildLegacySetItems keeps detached context segments when they appear inside the group text', () => {
  const built = buildLegacySetItems({
    rawGroupText: 'wizard 巫師 @@ A scar is a mark left on the skin. @@ terminal n. 終點站；終端',
    rawHintText: 'A person with magic powers. @@ A place where a journey ends.'
  });

  assert.deepEqual(built.detachedContexts, ['A scar is a mark left on the skin.']);
  assert.equal(built.items.length, 2);
  assert.equal(built.items[1].senses[0].pos, 'noun');
});
