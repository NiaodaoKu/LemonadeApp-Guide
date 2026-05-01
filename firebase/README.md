# Firebase Migration Scaffold

This folder is the staging area for the Firebase-backed backend rebuild.

Current contents:

- `schema-spec.md`: checked-in schema contract for Firestore collections
- `firestore.indexes.json`: draft composite indexes for the first query paths
- `functions/src/migration/legacyRowParser.js`: parser helpers for legacy Google Sheets row data
- `functions/test/legacyRowParser.test.js`: unit tests for the parser and hint alignment rules
- `functions/src/migration/runLegacySetMigration.js`: sample runner for migrating one user's legacy set rows into Firestore

Near-term implementation order:

1. Lock down parser behavior against real legacy row samples.
2. Add migration mappers that convert legacy sheets rows into `users`, `sets`, and `wrongAnswers` documents.
3. Rebuild the first Firebase callable/API handlers on top of the new schema.
4. Run side-by-side verification before any production migration.

## Current runner flow

The migration runner currently uses the Apps Script `HEAD` deployment as a safe read-only legacy source.

- Apps Script helper action: `getMigrationRows`
- Source URL: `https://script.google.com/macros/s/AKfycbxvBsU8xn5j8FQOq4N02a230sTHNuuUnHdlg3lEp2w/dev`
- Firestore targets:
  - `users/{uid}`
  - `users/{uid}/categories/{categoryId}`
  - `users/{uid}/sets/{setId}`

### Usage

1. Push the tracked Apps Script files to `HEAD`:

```bash
clasp push --force
```

2. Run tests:

```bash
npm run test:firebase-parser
```

3. Dry-run the sample migration:

```bash
npm run migrate:legacy-sample -- --userKey=101226132430314472232 --limit=5 --dryRun=true
```

4. Write the first five rows into Firestore:

```bash
npm run migrate:legacy-sample -- --userKey=101226132430314472232 --limit=5
```

The runner refreshes the local `clasp` OAuth token from `~/.clasprc.json`, reads the real user-index row and set rows through the `HEAD /dev` Apps Script deployment, maps them with `legacyUserMapper` and `legacySetMapper`, and writes them via Firestore REST.
It also fetches legacy category JSON through `getUserCategories`, writes normalized category documents, and reports any set rows whose `categoryId` does not match the migrated category list.
