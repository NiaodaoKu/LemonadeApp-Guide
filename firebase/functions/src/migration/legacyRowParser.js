'use strict';

const POS_LABEL_TO_POS = Object.freeze({
  'v.': 'verb',
  'vt.': 'verb',
  'vi.': 'verb',
  'n.': 'noun',
  'adj.': 'adjective',
  'a.': 'adjective',
  'adv.': 'adverb',
  'ad.': 'adverb',
  'prep.': 'preposition',
  'conj.': 'conjunction',
  'pron.': 'pronoun',
  'interj.': 'interjection',
  'phr.': 'phrase',
  'ph.': 'phrase',
  'sent.': 'sentence'
});

const RAW_POS_ALIASES = Object.freeze({
  v: 'v.',
  'v.': 'v.',
  verb: 'v.',
  vt: 'vt.',
  'vt.': 'vt.',
  transitive: 'vt.',
  vi: 'vi.',
  'vi.': 'vi.',
  intransitive: 'vi.',
  n: 'n.',
  'n.': 'n.',
  noun: 'n.',
  adj: 'adj.',
  'adj.': 'adj.',
  adjective: 'adj.',
  a: 'a.',
  'a.': 'a.',
  adv: 'adv.',
  'adv.': 'adv.',
  adverb: 'adv.',
  ad: 'ad.',
  'ad.': 'ad.',
  prep: 'prep.',
  'prep.': 'prep.',
  preposition: 'prep.',
  conj: 'conj.',
  'conj.': 'conj.',
  conjunction: 'conj.',
  pron: 'pron.',
  'pron.': 'pron.',
  pronoun: 'pron.',
  interj: 'interj.',
  'interj.': 'interj.',
  interjection: 'interj.',
  phr: 'phr.',
  'phr.': 'phr.',
  phrase: 'phr.',
  ph: 'ph.',
  'ph.': 'ph.',
  sent: 'sent.',
  'sent.': 'sent.',
  sentence: 'sent.'
});

const POS_LABELS = Object.freeze(Object.keys(POS_LABEL_TO_POS).sort((a, b) => b.length - a.length));
const POS_LABEL_PATTERN = POS_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const CJK_CHAR_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/u;

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function containsCjk(value) {
  return CJK_CHAR_RE.test(String(value || ''));
}

function findFirstCjkIndex(value) {
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    if (CJK_CHAR_RE.test(text[index])) {
      return index;
    }
  }
  return -1;
}

function splitLegacySegments(rawValue, options = {}) {
  const keepEmpty = options.keepEmpty === true;
  const parts = String(rawValue || '')
    .split('@@')
    .map((part) => normalizeWhitespace(part));

  return keepEmpty ? parts : parts.filter(Boolean);
}

function parseHintSegments(rawHintText) {
  return splitLegacySegments(rawHintText, { keepEmpty: true });
}

function normalizeWordKey(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizePosLabel(rawLabel) {
  const key = normalizeWhitespace(rawLabel).toLowerCase();
  return RAW_POS_ALIASES[key] || '';
}

function posFromLabel(rawLabel) {
  const posLabel = normalizePosLabel(rawLabel);
  return POS_LABEL_TO_POS[posLabel] || 'other';
}

function isLikelyContextText(rawValue) {
  const text = normalizeWhitespace(rawValue);
  if (!text || containsCjk(text)) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return false;
  return /[.?!]$/.test(text) || /^To\s/i.test(text) || /^[A-Z]/.test(text);
}

function extractLemmaAndPosLabel(prefixText) {
  const prefix = normalizeWhitespace(prefixText);
  const lowerPrefix = prefix.toLowerCase();

  for (const label of POS_LABELS) {
    if (lowerPrefix === label) {
      return { lemma: '', posLabel: label };
    }
    if (lowerPrefix.endsWith(` ${label}`)) {
      return {
        lemma: prefix.slice(0, prefix.length - label.length).trim(),
        posLabel: label
      };
    }
  }

  return { lemma: prefix, posLabel: '' };
}

function extractTrailingPosLabel(rawText) {
  const text = normalizeWhitespace(rawText);
  const lowerText = text.toLowerCase();

  for (const label of POS_LABELS) {
    if (lowerText === label) {
      return { text: '', posLabel: label };
    }
    if (lowerText.endsWith(` ${label}`)) {
      return {
        text: text.slice(0, text.length - label.length).trim(),
        posLabel: label
      };
    }
  }

  return { text, posLabel: '' };
}

function stripLeadingPosLabel(rawText) {
  const text = normalizeWhitespace(rawText);
  const lowerText = text.toLowerCase();
  for (const label of POS_LABELS) {
    if (lowerText.startsWith(`${label} `)) {
      return text.slice(label.length).trim();
    }
    if (lowerText === label) {
      return '';
    }
  }
  return text;
}

function splitDefinitionsZh(rawText) {
  return normalizeWhitespace(rawText)
    .replace(/^[：:,-]\s*/, '')
    .split(/[；;、]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function buildSense(shape, index, itemId) {
  const posLabel = normalizePosLabel(shape.posLabel);
  return {
    senseKey: itemId ? `${itemId}_s${index + 1}` : `s${index + 1}`,
    pos: posLabel ? posFromLabel(posLabel) : 'other',
    posLabel,
    definitionsZh: shape.definitionsZh,
    definitionEn: shape.definitionEn || ''
  };
}

function parseSenses(rawZh, fallbackPosLabel, itemId) {
  const text = normalizeWhitespace(rawZh);
  if (!text) return [];

  const matches = [];
  const labelRegex = new RegExp(`(^|[；;])\\s*(${POS_LABEL_PATTERN})\\s*`, 'gi');
  let match;

  while ((match = labelRegex.exec(text)) !== null) {
    matches.push({
      startIndex: match.index,
      contentStart: labelRegex.lastIndex,
      posLabel: normalizePosLabel(match[2])
    });
  }

  const parsed = [];

  if (matches.length === 0) {
    const definitionsZh = splitDefinitionsZh(stripLeadingPosLabel(text));
    if (!definitionsZh.length) return [];
    return [buildSense({ posLabel: fallbackPosLabel, definitionsZh }, 0, itemId)];
  }

  if (matches[0].startIndex > 0) {
    const leadingDefinitions = splitDefinitionsZh(text.slice(0, matches[0].startIndex));
    if (leadingDefinitions.length) {
      parsed.push({
        posLabel: fallbackPosLabel,
        definitionsZh: leadingDefinitions
      });
    }
  }

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const segment = text.slice(current.contentStart, next ? next.startIndex : text.length);
    const definitionsZh = splitDefinitionsZh(segment);
    if (!definitionsZh.length) continue;
    parsed.push({
      posLabel: current.posLabel,
      definitionsZh
    });
  }

  return parsed.map((shape, index) => buildSense(shape, index, itemId));
}

function parseGroupSegment(rawSegment, options = {}) {
  const itemId = options.itemId || '';
  const raw = normalizeWhitespace(rawSegment);

  if (!raw) {
    return { raw: '', guessType: 'empty' };
  }

  if (isLikelyContextText(raw)) {
    return {
      raw,
      guessType: 'context',
      contextText: raw
    };
  }

  const cjkIndex = findFirstCjkIndex(raw);
  if (cjkIndex === -1) {
    return {
      raw,
      guessType: 'unknown'
    };
  }

  const prefix = normalizeWhitespace(raw.slice(0, cjkIndex));
  let rawZh = normalizeWhitespace(raw.slice(cjkIndex));
  const extracted = extractLemmaAndPosLabel(prefix);
  const lemma = extracted.lemma;
  let posLabel = extracted.posLabel;

  if (!lemma) {
    return {
      raw,
      guessType: 'unknown'
    };
  }

  if (!posLabel) {
    const trailing = extractTrailingPosLabel(rawZh);
    rawZh = trailing.text;
    posLabel = trailing.posLabel;
  }

  return {
    raw,
    guessType: 'wordZh',
    lemma,
    normalizedKey: normalizeWordKey(lemma),
    displayText: lemma,
    rawZh,
    posLabel,
    senses: parseSenses(rawZh, posLabel, itemId)
  };
}

function buildLegacySetItems(input = {}) {
  const rawGroupText = String(input.rawGroupText || '');
  const rawHintText = String(input.rawHintText || '');
  const parsedSegments = splitLegacySegments(rawGroupText).map((segment) => parseGroupSegment(segment));
  const hintSegments = parseHintSegments(rawHintText);

  const items = [];
  const detachedContexts = [];
  let wordIndex = 0;

  for (const segment of parsedSegments) {
    if (segment.guessType === 'context') {
      detachedContexts.push(segment.contextText);
      continue;
    }
    if (segment.guessType !== 'wordZh') {
      continue;
    }

    const itemId = `i${wordIndex + 1}`;
    const hintText = normalizeWhitespace(hintSegments[wordIndex] || '');
    const reparsed = parseGroupSegment(segment.raw, { itemId });

    items.push({
      itemId,
      lemma: reparsed.lemma,
      normalizedKey: reparsed.normalizedKey,
      displayText: reparsed.displayText,
      order: wordIndex,
      rawZh: reparsed.rawZh,
      rawContext: hintText,
      contexts: hintText ? [hintText] : [],
      hintText,
      senses: reparsed.senses
    });

    wordIndex += 1;
  }

  return {
    rawGroupText,
    rawHintText,
    rawParsedItems: parsedSegments,
    hintSegments,
    detachedContexts,
    items
  };
}

module.exports = {
  POS_LABEL_TO_POS,
  buildLegacySetItems,
  containsCjk,
  findFirstCjkIndex,
  isLikelyContextText,
  normalizePosLabel,
  normalizeWhitespace,
  normalizeWordKey,
  parseGroupSegment,
  parseHintSegments,
  parseSenses,
  posFromLabel,
  splitDefinitionsZh,
  splitLegacySegments
};
