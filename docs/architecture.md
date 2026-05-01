# LexisPulse Architecture Notes

## 1. End-to-End Request Path

```text
Browser SPA
  -> Cloudflare Pages Function (proxy)
  -> Google Apps Script Web App
  -> Google Sheets
```

Why this path:

- Avoid direct browser-to-Apps-Script CORS friction
- Keep backend serverless and low-cost
- Preserve simple deployment flow

## 2. Client Layer

Responsibilities:

- UI rendering and route state
- Session/auth bootstrap via GIS
- IndexedDB caching
- Sync queue enqueue/replay

Key reliability concern:

- Prevent stale view overwrite during async re-renders

## 3. Edge Proxy Layer

Cloudflare Function responsibilities:

- Receive client request
- Forward to Apps Script endpoint
- Return execution result in browser-safe way

Benefits:

- CORS control at edge
- Stable API entry point for frontend

## 4. Apps Script Layer

Responsibilities:

- Action routing (`doPost`)
- CRUD operations for vocabulary sets
- SRS scheduling updates
- Wrong-answer tracking and retirement
- Dashboard aggregation

## 5. Data Model (Google Sheets)

- User index sheet for account-level metadata
- Wrong-answer sheet for error memory logic
- Per-user sheet for isolated vocabulary datasets

Trade-off:

- Excellent speed for prototyping and operations
- Limited by sheet scale and script quotas for very large workloads

## 6. Offline Consistency Strategy

When online:

- Execute remote action
- Refresh/expire related local cache

When offline or remote failure:

- Enqueue action in local queue
- Apply optimistic local update when safe
- Replay queue on reconnect

## 7. Daily Completion Flow

1. Completion feedback animation
2. Attempt `completeOneRound`
3. Fallback to queue + local optimistic cache update
4. Return to dashboard quickly (minimum stay about 300ms)

## 8. Future Evolution Path

If scaling beyond Apps Script limits:

1. Keep frontend contract stable
2. Replace Apps Script with dedicated backend API
3. Move Google Sheets data to managed database
4. Retain queue semantics for offline-first behavior

## 9. Recent Architecture and Product Iterations

### 9.1 Starred Vocabulary Data Flow

- Frontend keeps fast-access starred state for immediate UI response.
- Backend persists starred mapping in index metadata for cross-device consistency.
- Study and quiz modules can consume starred subsets without changing core SRS contracts.

### 9.2 Quiz Source Draft Protection

- During source page background refresh, transient draft state is explicitly preserved.
- This prevents unsubmitted source selections from being overwritten by async re-render cycles.

### 9.3 Dictionary Pipeline Refinements

- Lookup cache keys include query mode dimension to prevent cross-mode cache pollution.
- `zh-en` candidate generation applies cleanup/ranking before rendering.
- Meaning presentation focuses on in-context interpretation to reduce noisy explanations.

### 9.4 Completion Path Under Weak Network

- Daily completion returns to dashboard via local optimistic finalization.
- Remote round finalization runs in background sync instead of blocking completion UX.
- This keeps interaction latency stable in transit-grade network conditions.
