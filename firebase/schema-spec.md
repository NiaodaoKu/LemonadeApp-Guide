# Firebase Schema Spec

## Legend

- `*` = required
- `~` = migrated from legacy Google Sheets
- `->` = reference

## 1. `users/{uid}`

| Field | Type | Required | Notes | Legacy Source |
| --- | --- | --- | --- | --- |
| `uid` | string | * | Firebase Auth UID | User index sheet column A `UserKey` |
| `nickname` | string | * | Display name | User index sheet column B |
| `email` | string |  | Gmail address | User index sheet column F |
| `welcomed` | boolean | * | Finished onboarding | User index sheet column C |
| `timezone` | string | * | Default `Asia/Taipei` | - |
| `createdAt` | Timestamp | * | Creation time | User index sheet column D |
| `lastSeenAt` | Timestamp |  | Last login time | User index sheet column E |

Categories and stars stay in subcollections.

## 2. `users/{uid}/categories/{categoryId}`

| Field | Type | Required | Notes | Legacy Source |
| --- | --- | --- | --- | --- |
| `categoryId` | string | * | Document ID | User index sheet JSON `id` |
| `name` | string | * | Category name | User index sheet JSON `name` |
| `color` | string |  | Color token | User index sheet JSON `color` |
| `noSrs` | boolean | * | Excluded from SRS | User index sheet JSON `noSrs` |
| `order` | number |  | Manual ordering | - |
| `createdAt` | Timestamp | * | Creation time | - |

## 3. `users/{uid}/sets/{setId}`

This maps to one legacy row inside a user sheet.

### 3a. Long-lived SRS fields

| Field | Type | Required | Notes | Legacy Source |
| --- | --- | --- | --- | --- |
| `setId` | string | * | Document ID | - |
| `categoryId` | string | * | -> categories | Derived during migration |
| `kind` | string | * | Start with `wordSet` | - |
| `round` | number | * | Current SRS round | User sheet column G/H depending on legacy mapping |
| `nextReviewAt` | Timestamp | * | Next scheduled review | Derived from last review date + round rules |
| `lastReviewedAt` | Timestamp |  | Previous review time | User sheet column A |
| `totalReviewCount` | number | * | Lifetime review count | User sheet column F |
| `isArchived` | boolean | * | Default `false` | - |
| `legacyRowIndex` | number |  | Stored only for migration tracing | - |
| `createdAt` | Timestamp | * | Creation time | - |
| `updatedAt` | Timestamp | * | Last mutation time | - |

### 3b. `items[]` embedded array

Each set document owns its items as an embedded array.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `itemId` | string | * | Local ID such as `i1`, `i2` |
| `lemma` | string | * | Word or phrase head text |
| `normalizedKey` | string | * | Lowercased query key |
| `displayText` | string |  | UI-facing text, defaults to `lemma` |
| `order` | number | * | Order within the set |
| `rawZh` | string |  | Migration buffer for the original Chinese text |
| `rawContext` | string |  | Migration buffer for the original hint/context string |
| `contexts` | string[] |  | Parsed English hints/examples |
| `hintText` | string |  | Aligned from the legacy hint column |
| `senses` | `Sense[]` |  | Part-of-speech meaning entries |

Each `Sense` object:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `senseKey` | string | * | Example: `i1_s1` |
| `pos` | string |  | Canonical value from Appendix A |
| `posLabel` | string |  | UI label like `v.` or `adj.` |
| `definitionsZh` | string[] | * | Chinese definitions |
| `definitionEn` | string |  | Optional English gloss |

Composite indexes to keep ready:

- `categoryId ASC` + `nextReviewAt ASC`
- `isArchived ASC` + `nextReviewAt ASC`

## 4. `users/{uid}/dailySessions/{yyyy-mm-dd}`

The daily session document holds day-scoped progress so `sets` do not need daily-reset fields.

| Field | Type | Required | Notes | Legacy Source |
| --- | --- | --- | --- | --- |
| `date` | string | * | `YYYY-MM-DD` | - |
| `timezone` | string | * | Default `Asia/Taipei` | - |
| `totalReviewed` | number | * | All reviews finished that day | Legacy daily count |
| `setProgress` | map | * | Per-set daily counters | Derived |
| `createdAt` | Timestamp | * | Creation time | - |
| `updatedAt` | Timestamp | * | Last mutation time | - |

`setProgress[setId]`:

```json
{
  "reviewedCount": 2,
  "remaining": 1
}
```

## 5. `users/{uid}/wrongAnswers/{itemScopedId}`

Document ID format: `{setId}_{itemId}`.

| Field | Type | Required | Notes | Legacy Source |
| --- | --- | --- | --- | --- |
| `wordKey` | string | * | Search/display key | Wrong answers sheet column B |
| `primaryZh` | string |  | Main Chinese meaning | Wrong answers sheet column C |
| `wrongCount` | number | * | Total wrong answers | Wrong answers sheet column D |
| `consecutiveCorrect` | number | * | Graduation counter | Wrong answers sheet column F |
| `lastWrongAt` | Timestamp |  | Last wrong answer time | Wrong answers sheet column E |
| `sourceSetId` | string | * | -> sets | Derived |
| `sourceItemId` | string | * | -> `sets.items[].itemId` | Derived |
| `sourceSenseKey` | string |  | -> `sets.items[].senses[].senseKey` | Derived |
| `updatedAt` | Timestamp | * | Last mutation time | - |

Suggested indexes:

- `wordKey ASC`
- `wrongCount DESC`

## 6. `users/{uid}/starredWords/{itemScopedId}`

Document ID format: `{setId}_{itemId}`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `wordKey` | string | * | English lookup key |
| `sourceSetId` | string | * | -> sets |
| `sourceItemId` | string | * | -> `sets.items[].itemId` |
| `createdAt` | Timestamp | * | Star time |

## Appendix A: Part-of-speech canonical values

| Label | Canonical value |
| --- | --- |
| `v.` | `verb` |
| `n.` | `noun` |
| `adj.` | `adjective` |
| `adv.` | `adverb` |
| `prep.` | `preposition` |
| `conj.` | `conjunction` |
| `pron.` | `pronoun` |
| `interj.` | `interjection` |
| `phr.` | `phrase` |
| `sent.` | `sentence` |
| unknown | `other` |
