'use strict';

const {
  fetchAllUserIndexRows,
  fetchAllMigrationRows,
  fetchAllWrongAnswerRows,
  fetchStarredWords,
  fetchMigrationRows,
  fetchUserIndexRow,
  fetchUserCategories,
  DEFAULT_HEAD_WEBAPP_URL
} = require('./appsScriptClient');
const { buildLegacyCategoryDocuments } = require('./legacyCategoryMapper');
const { buildLegacyUserDocument } = require('./legacyUserMapper');
const {
  listDocuments,
  writeDocument
} = require('./firestoreRest');
const { loadClaspCredentials, refreshGoogleAccessToken } = require('./googleOAuth');
const { buildLegacySetDocument } = require('./legacySetMapper');
const {
  buildLegacyWrongAnswerDocument,
  buildSetItemLookup
} = require('./legacyWrongAnswerMapper');
const {
  buildLegacyStarredWordDocument,
  normalizeStarredWords
} = require('./legacyStarredWordMapper');

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, rawValue] = arg.slice(2).split('=');
    parsed[rawKey] = rawValue === undefined ? true : rawValue;
  }
  return parsed;
}

function defaultSetIdFromRow(rowIndex) {
  return `legacy_r${String(rowIndex).padStart(4, '0')}`;
}

function firestorePathSegment(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Firestore path segment is missing');
  return encodeURIComponent(text);
}

function isTrue(value) {
  return value === true || value === 'true';
}

async function migrateUser(options = {}) {
  const {
    accessToken,
    dryRun,
    hasLimit,
    headWebappUrl,
    includeDetails,
    includeStarredWords,
    includeWrongAnswers,
    limit,
    now,
    previewLimit,
    projectId,
    startRow,
    userKey
  } = options;
  const userDocumentId = firestorePathSegment(userKey);

  const rawUserIndexRow = await fetchUserIndexRow({
    accessToken,
    headWebappUrl,
    userKey
  });
  if (!rawUserIndexRow || !Array.isArray(rawUserIndexRow.values)) {
    throw new Error(`Legacy user index row not found for user ${userKey}`);
  }
  const userDocument = buildLegacyUserDocument({
    values: rawUserIndexRow.values,
    timezone: 'Asia/Taipei',
    now
  });

  if (!dryRun) {
    await writeDocument({
      projectId,
      accessToken,
      documentPath: `users/${userDocumentId}`,
      document: userDocument
    });
  }

  const rawCategories = await fetchUserCategories({
    accessToken,
    headWebappUrl,
    userKey
  });
  const categories = buildLegacyCategoryDocuments({
    legacyCategories: rawCategories,
    createdAt: now
  });

  if (!dryRun) {
    for (const category of categories) {
      await writeDocument({
        projectId,
        accessToken,
        documentPath: `users/${userDocumentId}/categories/${category.categoryId}`,
        document: category
      });
    }
  }

  const source = hasLimit
    ? await fetchMigrationRows({
        accessToken,
        headWebappUrl,
        userKey,
        limit,
        startRow
      })
    : await fetchAllMigrationRows({
        accessToken,
        headWebappUrl,
        userKey,
        startRow
      });

  if (!source || !Array.isArray(source.rows)) {
    throw new Error('Legacy source did not return a row array');
  }

  const migrated = [];
  const setSummaries = [];
  const knownCategoryIds = new Set(categories.map((category) => category.categoryId));
  const categoryReferenceWarnings = [];
  for (const row of source.rows) {
    if (!String((row.values || [])[1] || '').trim()) continue;
    const setId = defaultSetIdFromRow(row.rowIndex);
    const mapped = buildLegacySetDocument({
      rowIndex: row.rowIndex,
      setId,
      legacyRow: row.values,
      now
    });

    if (!dryRun) {
      await writeDocument({
        projectId,
        accessToken,
        documentPath: `users/${userDocumentId}/sets/${setId}`,
        document: mapped.setDoc
      });
    }

    setSummaries.push({
      setId,
      rowIndex: row.rowIndex,
      items: mapped.setDoc.items
    });

    if (mapped.setDoc.categoryId && !knownCategoryIds.has(mapped.setDoc.categoryId)) {
      categoryReferenceWarnings.push({
        rowIndex: row.rowIndex,
        setId,
        missingCategoryId: mapped.setDoc.categoryId
      });
    }

    migrated.push({
      rowIndex: row.rowIndex,
      setId,
      categoryId: mapped.setDoc.categoryId,
      kind: mapped.setDoc.kind,
      itemCount: mapped.setDoc.items.length,
      items: mapped.setDoc.items.map((item) => ({
        itemId: item.itemId,
        lemma: item.lemma,
        senseCount: item.senses.length,
        hintText: item.hintText
      })),
      nextReviewAt: mapped.setDoc.nextReviewAt ? mapped.setDoc.nextReviewAt.toISOString() : null
    });
  }

  let firestoreSetCount = null;
  if (!dryRun) {
    firestoreSetCount = (
      await listDocuments({
        projectId,
        accessToken,
        documentPath: `users/${userDocumentId}/sets`,
        pageSize: 200
      })
    ).length;
  }

  let wrongAnswerSummary = {
    sourceCount: 0,
    migratedCount: 0,
    missingTargetCount: 0,
    ambiguousCount: 0,
    firestoreCount: null,
    warnings: []
  };
  const lookup = buildSetItemLookup(setSummaries);

  if (includeWrongAnswers) {
    const wrongSource = await fetchAllWrongAnswerRows({
      accessToken,
      headWebappUrl,
      userKey
    });
    const warnings = [];
    let migratedCount = 0;
    for (const row of wrongSource.rows) {
      const mapped = buildLegacyWrongAnswerDocument({
        values: row.values,
        lookup,
        now
      });
      if (mapped.status !== 'resolved') {
        warnings.push({
          rowIndex: row.rowIndex,
          wordKey: mapped.wordKey,
          primaryZh: mapped.primaryZh,
          status: mapped.status
        });
        continue;
      }
      if (!dryRun) {
        await writeDocument({
          projectId,
          accessToken,
          documentPath: `users/${userDocumentId}/wrongAnswers/${mapped.documentId}`,
          document: mapped.document
        });
      }
      migratedCount += 1;
    }
    const firestoreWrongAnswerCount = dryRun
      ? null
      : (
          await listDocuments({
            projectId,
            accessToken,
            documentPath: `users/${userDocumentId}/wrongAnswers`,
            pageSize: 200
          })
        ).length;
    wrongAnswerSummary = {
      sourceCount: wrongSource.rows.length,
      migratedCount,
      missingTargetCount: warnings.filter((warning) => warning.status === 'missing').length,
      ambiguousCount: warnings.filter((warning) => warning.status === 'ambiguous').length,
      firestoreCount: firestoreWrongAnswerCount,
      warnings
    };
  }

  let starredWordSummary = {
    sourceCount: 0,
    migratedCount: 0,
    missingTargetCount: 0,
    ambiguousCount: 0,
    firestoreCount: null,
    warnings: []
  };

  if (includeStarredWords) {
    const rawStarredWords = await fetchStarredWords({
      accessToken,
      headWebappUrl,
      userKey
    });
    const starredWords = normalizeStarredWords(rawStarredWords);
    const warnings = [];
    let migratedCount = 0;
    for (const wordKey of starredWords) {
      const mapped = buildLegacyStarredWordDocument({
        wordKey,
        lookup,
        now
      });
      if (mapped.status !== 'resolved') {
        warnings.push({
          wordKey: mapped.wordKey,
          status: mapped.status
        });
        continue;
      }
      if (!dryRun) {
        await writeDocument({
          projectId,
          accessToken,
          documentPath: `users/${userDocumentId}/starredWords/${mapped.documentId}`,
          document: mapped.document
        });
      }
      migratedCount += 1;
    }
    const firestoreStarredWordCount = dryRun
      ? null
      : (
          await listDocuments({
            projectId,
            accessToken,
            documentPath: `users/${userDocumentId}/starredWords`,
            pageSize: 200
          })
        ).length;
    starredWordSummary = {
      sourceCount: starredWords.length,
      migratedCount,
      missingTargetCount: warnings.filter((warning) => warning.status === 'missing').length,
      ambiguousCount: warnings.filter((warning) => warning.status === 'ambiguous').length,
      firestoreCount: firestoreStarredWordCount,
      warnings
    };
  }

  return {
    userKey,
    userDocumentId,
    user: {
      uid: userDocument.uid,
      nickname: userDocument.nickname,
      welcomed: userDocument.welcomed,
      timezone: userDocument.timezone,
      createdAt: userDocument.createdAt ? userDocument.createdAt.toISOString() : null,
      lastSeenAt: userDocument.lastSeenAt ? userDocument.lastSeenAt.toISOString() : null,
      email: userDocument.email
    },
    categories: categories.map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      color: category.color,
      noSrs: category.noSrs,
      order: category.order
    })),
    categoryReferenceWarnings,
    sheetName: source.sheetName,
    startRow,
    limit,
    sourceSetRowCount: source.rows.filter((row) => String((row.values || [])[1] || '').trim()).length,
    migratedSetCount: migrated.length,
    firestoreSetCount,
    includeWrongAnswers,
    wrongAnswers: wrongAnswerSummary,
    includeStarredWords,
    starredWords: starredWordSummary,
    dryRun,
    migratedPreview: includeDetails ? migrated : migrated.slice(0, previewLimit),
    migratedPreviewCount: includeDetails ? migrated.length : Math.min(migrated.length, previewLimit),
    migratedOmittedCount: includeDetails ? 0 : Math.max(0, migrated.length - previewLimit)
  };
}

async function resolveUserKeys(options = {}) {
  if (options.userKey) return [options.userKey];

  const source = await fetchAllUserIndexRows({
    accessToken: options.accessToken,
    headWebappUrl: options.headWebappUrl
  });
  const userKeys = [];
  const seen = new Set();
  for (const row of source.rows || []) {
    const userKey = String((row.values || [])[0] || '').trim();
    if (!userKey || seen.has(userKey)) continue;
    seen.add(userKey);
    userKeys.push(userKey);
  }
  return userKeys;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestedUserKey = args.userKey ? String(args.userKey).trim() : '';
  const hasLimit = args.limit !== undefined;
  const limit = hasLimit ? Math.max(1, Number(args.limit) || 5) : null;
  const startRow = Math.max(2, Number(args.startRow) || 2);
  const projectId = String(args.projectId || 'lexispulse').trim();
  const dryRun = isTrue(args.dryRun);
  const includeWrongAnswers = args.includeWrongAnswers === undefined ? true : isTrue(args.includeWrongAnswers);
  const includeStarredWords = args.includeStarredWords === undefined ? true : isTrue(args.includeStarredWords);
  const includeDetails = isTrue(args.includeDetails);
  const headWebappUrl = String(args.headUrl || process.env.LEGACY_GAS_HEAD_URL || DEFAULT_HEAD_WEBAPP_URL).trim();

  const oauthCredentials = loadClaspCredentials();
  const accessToken = await refreshGoogleAccessToken(oauthCredentials);
  const now = new Date();
  const userKeys = await resolveUserKeys({
    accessToken,
    headWebappUrl,
    userKey: requestedUserKey
  });
  const previewLimit = args.previewLimit === undefined
    ? (requestedUserKey ? 10 : 0)
    : Math.max(0, Number(args.previewLimit) || 0);

  const results = [];
  for (const userKey of userKeys) {
    results.push(await migrateUser({
      accessToken,
      dryRun,
      hasLimit,
      headWebappUrl,
      includeDetails,
      includeStarredWords,
      includeWrongAnswers,
      limit,
      now,
      previewLimit,
      projectId,
      startRow,
      userKey
    }));
  }

  console.log(JSON.stringify({
    projectId,
    dryRun,
    requestedUserKey: requestedUserKey || null,
    userCount: userKeys.length,
    includeWrongAnswers,
    includeStarredWords,
    results
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  defaultSetIdFromRow,
  firestorePathSegment,
  isTrue,
  migrateUser,
  parseArgs
};
