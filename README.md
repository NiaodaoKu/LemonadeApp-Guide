# LexisPulse Showcase

## 專案簡介

`LexisPulse-showcase` 是一個用來展示作品、範例資料與前端互動的示範專案。此專案的目標是提供一組乾淨、可重用的 UI 與資料結構，讓你在撰寫個人作品集（Portfolio）時可直接參考或重用展示資料與實作細節。

本 README 以繁體中文（zh-TW）撰寫，包含：功能摘要、專案架構、前後端建議、以及詳細的 Firebase 後端遷移與部署流程，便於你把作品集資料與展示邏輯整合到雲端。

---

## 目的與使用情境

- 作為作品集範例資料來源：可直接重用或改寫 `index.html` 與 UI 模板。
- 作為後端遷移模板：包含將資料搬到 Firebase（Cloud Firestore）的推薦資料模型與遷移步驟。
- 作為部署參考：說明本機開發、Emulator 測試與生產部署流程。

---

## 專案高階結構

- `index.html` — 展示／前端頁面。
- `sw.js` — Service Worker（若需離線快取）。
- `firebase/` — (若存在) Firebase 規則、索引與設定樣板。
- `functions/` — (若存在) Cloud Functions 或後端 API 範例。
- `README.md` — 本檔。

視實際內容決定細節；若你要把此專案當作作品集資料來源，請優先同步 `firebase/` 與 `functions/` 的設定到你的 Firebase 專案。

---

## 後端：我們使用 Firebase（必讀）

你已計畫把後端「搬家到 Firebase」。因此 README 假設後端資料庫採用 Cloud Firestore，並針對 Firebase 的產品組合、資料模型、安全規則與遷移流程給出建議。

### 建議使用的 Firebase 產品

- Firebase Authentication：如果需要使用者帳號/權限管理。
- Cloud Firestore：文件型資料庫，適用於作品、評論、標籤等結構化資料。
- Firebase Hosting：部署靜態前端（如 `index.html`）。
- Cloud Functions（選用）：處理 server-side 任務、資料遷移或 webhook。
- Firebase Emulator Suite：在本機完整模擬 Firestore、Auth 與 Functions，建議開發階段使用。

### 建議資料模型（Cloud Firestore 範例）

- `projects` (collection)
  - `{projectId}` (document)
    - `title`: string
    - `summary`: string
    - `description`: string (可支援 Markdown/HTML)
    - `tags`: array[string]
    - `images`: array[string] (URL)
    - `publishedAt`: timestamp
    - `authorId`: string (參照 `users`)

- `users` (collection)
  - `{userId}` (document)
    - `name`, `avatarUrl`, `bio`

- `comments` 或 `reviews` (collection)
  - `{commentId}` (document)
    - `projectId`: string
    - `userId`: string
    - `rating`: number
    - `content`: string
    - `createdAt`: timestamp

可視情況新增 `categories`、`assets`、或 `revisions` 等 collection。

### 基本安全規則（範例）

以下為簡單範例，請務必根據實際需求強化欄位檢查與商業規則：

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.admin == true;
    }
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

補充：限制寫入欄位、限制陣列長度、以及驗證時間戳等都是常見加固項目。

### 索引

若使用複合查詢（例如 `where('tags', 'array-contains', 'x').orderBy('publishedAt')`），請在 `firestore.indexes.json` 新增對應索引或在 Console 建立。

---

## 從現有資料遷移到 Firebase（細節步驟）

1. 建立 Firebase 專案（Console）。啟用 Firestore、Auth 與 Hosting（視需求）。
2. 在本地建立或更新 `firestore.indexes.json`、`firestore.rules` 與 `firebase.json`。
3. 撰寫遷移腳本（建議 Node.js + `firebase-admin`）：

```js
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function importProject(p) {
  await db.collection('projects').doc(p.id).set(p);
}
```

注意：大量寫入請採分批 (batch) 或節流，並處理重試/回滾機制。

4. 使用 Firebase Emulator 在本機驗證遷移流程：

```bash
npm install -g firebase-tools
firebase login
firebase init emulators
firebase emulators:start
```

5. 在 staging 環境驗證安全規則與索引無誤後，再部署到 production（Hosting / Functions / Rules / Indexes）。

---

## 本機開發（快速指南）

1. Clone 專案：

```bash
git clone https://github.com/NiaodaoKu/LexisPulse-showcase.git
cd LexisPulse-showcase
```

2. 安裝相依（如有 `package.json`）：

```bash
npm install
```

3. 啟動開發伺服器（視專案設定）：

```bash
npm run dev
```

4. 若整合 Firebase Emulator：

```bash
firebase emulators:start
```

5. 若連線到真實 Firebase，請在本機使用環境變數或 CI secret 設定 Firebase config 與 service account，切勿將憑證推上公開 Repo。

---

## 部署（快速指令）

- 部署 Hosting：

```bash
firebase deploy --only hosting
```

- 部署 Functions：

```bash
firebase deploy --only functions
```

建議在 CI 中使用 service account 與環境變數自動化部署。

---

## 在作品集撰寫時如何引用此 Showcase

1. 保留資料欄位映射表（`title`、`summary`、`images` 等），便於未來同步到 Firestore。
2. 在每篇作品頁註明資料來源（例如：示範資料來自 `LexisPulse-showcase`，以利日後維護）。
3. 若希望即時反映資料變更，可在前端使用 Firestore 的 `onSnapshot` 即時監聽。

---

## 常見問題（FAQ）

- Q：可以使用 Realtime Database 嗎？
  - A：可以，但 Cloud Firestore 在查詢彈性與擴展性上通常更合適作品集型的資料模型。

- Q：如何保護私人資產（私密圖片）？
  - A：將敏感檔案放在受限的 Cloud Storage bucket，並以 Firebase Auth + Storage Rules 控制存取。

---

## 貢獻與 PR 流程

- 使用 `feature/*` 分支開發。
- 提交 PR 前請移除任何敏感金鑰或私人憑證。
- 修改資料模型時同步更新 `firestore.indexes.json` 與 `firestore.rules`。

---

## 把 README 推到遠端（我已協助）

我已在本機為你建立並合併 README，接下來我會：

- 把更新推送到遠端 `https://github.com/NiaodaoKu/LexisPulse-showcase.git`。

若你要我現在執行推送或建立 PR，請確認要使用的遠端分支（`main` 或 `master`），或允許我建立 PR 到 `main`。

---

若要我直接幫你建立 PR 或執行 `git push`，回覆 `建立 PR` 或 `直接 push` 即可；若要我先改 README 內容再推，請說明要修改的項目。
