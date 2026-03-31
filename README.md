# HW1 Lemonade App 完整操作流程
> 給同學的教學指南｜從零開始到繳交完成

---

## 🛠 事前準備（確認以下都裝好）
- Android Studio（任意版本）
- Git（Windows 通常內建）
- GitHub 帳號
- Claude.ai 帳號（免費即可）

---

## PHASE 1：取得原始專案

### Step 1：下載官方 Lemonade App
1. 打開瀏覽器，前往：
   ```
   https://github.com/google-developer-training/basic-android-kotlin-compose-training-lemonade
   ```
2. 點綠色 **Code** 按鈕 → **Download ZIP**
3. 解壓縮到你找得到的地方（例如桌面）

### Step 2：用 Android Studio 開啟
1. 打開 **Android Studio**
2. 選 **Open**（不是 New Project）
3. 選取解壓縮後的資料夾（有 `app`、`gradle` 那層）
4. 等右下角 **Gradle Sync** 跑完（約 1～3 分鐘）
5. 底部出現提示「Upgrade Gradle」→ **直接關掉不要按**

確認左側欄看到這個結構就成功了：
```
app/src/main/
├── java/com/example/lemonade/MainActivity.kt
└── res/
     ├── drawable/        ← 檸檬圖片在這
     └── values/
          └── strings.xml
```

---

## PHASE 2：用 Claude 生成新程式碼

### Step 3：開啟 Claude，複製原始 MainActivity.kt
1. 打開 `app/src/main/java/com/example/lemonade/MainActivity.kt`
2. 全選（Ctrl+A）複製所有內容
3. 打開 **claude.ai**，開新對話

### Step 4：貼以下 Prompt 給 Claude（工程師對話）

```
你是 Android Kotlin Compose 專家。
以下是原始 Lemonade App 的 MainActivity.kt，請在這個基礎上修改：

[貼上複製的原始 MainActivity.kt 內容]

請新增以下功能：

【功能需求】
1. 四個步驟的狀態機維持不變（Lemon Tree → Squeeze → Drink → Empty Glass）
2. Squeeze 步驟需要隨機 2~4 次點擊才能完成
3. Squeeze 步驟時，圖片上方疊加顯示「剩餘擠壓次數」的數字（用 Box + overlapping Text）
4. 右上角有一個語言切換按鈕，可在「English」→「中文」→「日本語」三語循環切換
5. 所有顯示文字（標題、說明文字）都要支援三語切換

【技術規格】
- 語言：Kotlin
- UI 框架：Jetpack Compose
- 最低 SDK：API 24
- 不使用外部套件

【輸出要求】
- 輸出完整的 MainActivity.kt
- 附上 res/values/strings.xml（英文）
- 附上 res/values-zh/strings.xml（中文）
- 附上 res/values-ja/strings.xml（日文）
- 附上 res/values/dimens.xml（如原本沒有請新增）
- 每個重要區塊加上行內中文註解

請確保程式碼可直接複製貼上後執行。
```

### Step 5：把 Claude 給的四個檔案貼回 Android Studio

**檔案 1：MainActivity.kt**
- 打開原本的 `MainActivity.kt`
- 全選 → 刪除 → 貼上 Claude 給的新版本

**檔案 2：res/values/strings.xml**
- 打開原本的 `strings.xml` → 全選 → 貼上

**檔案 3：res/values/dimens.xml**
- 如果原本沒有這個檔案：
  - 對 `values` 資料夾右鍵 → New → Values Resource File
  - 檔名輸入 `dimens` → OK
  - 貼上 Claude 給的內容

**檔案 4：res/values-zh/strings.xml（中文）**
- 對 `res` 資料夾右鍵 → New → Android Resource Directory
- Directory name 填 `values-zh` → OK
- 對新建的 `values-zh` 右鍵 → New → Values Resource File
- 檔名填 `strings` → OK → 貼上中文內容

**檔案 5：res/values-ja/strings.xml（日文）**
- 同上，資料夾名改成 `values-ja`

---

## PHASE 3：測試

### Step 6：Build & Run
1. 按右上角 **▶ 綠色執行鍵**
2. 第一次啟動模擬器約需 2～5 分鐘，屬正常
3. 看到模擬器跑起來後，照以下清單測試：

```
測試清單：
[ ] 點檸檬樹 → 進入擠壓畫面
[ ] 擠壓畫面圖片上有數字（2～4 之間）
[ ] 每點一次數字 -1
[ ] 數字歸零 → 自動進入喝檸檬水畫面
[ ] 點檸檬水 → 空杯畫面
[ ] 點空杯 → 回到檸檬樹（循環）
[ ] 右上角按鈕切換語言：English → 中文 → 日本語 → English
[ ] 切換語言後所有文字即時更新
```

---

## PHASE 4：上傳 GitHub

### Step 7：在 GitHub 建立 Private Repo
1. 登入 **github.com**
2. 右上角 **＋** → **New repository**
3. Repository name：`LemonadeApp`（或自己取名）
4. 選 🔒 **Private**
5. **三個勾選框全部不要勾**
6. 按 **Create repository**

### Step 8：在 Android Studio 連結 GitHub
1. 選單 **VCS → Git → GitHub → Log In via GitHub**
2. 瀏覽器跳出授權頁面 → 按 **Authorize**
3. 回到 Android Studio 確認登入成功

### Step 9：上傳專案
1. 選單 **VCS → Git → GitHub → Share Project on GitHub**
2. 確認 Repository name 和 Private 勾選
3. 按 **Share**

⚠️ 如果出現錯誤訊息「Author identity unknown」：
在 Android Studio 下方 **Terminal** 執行：
```bash
git config --global user.email "你的GitHub信箱"
git config --global user.name "你的名字"
```
然後重新 push：
```bash
git add .
git commit -m "feat: Lemonade App with multilingual support and squeeze counter"
git push -u origin master
```

⚠️ 如果出現「src refspec main does not match any」：
代表分支是 `master` 不是 `main`，執行：
```bash
git push -u origin master
```

### Step 10：加入助教帳號
1. 打開 GitHub repo 頁面
2. **Settings → Collaborators → Add people**
3. 分別搜尋並加入：
   - `cookiecatowo`
   - `penpenpenguin`

---

## PHASE 5：生成 README 和作業文件

### Step 11：讓 Claude 生成 README.md
在同一個 Claude 工程師對話貼以下 Prompt：

```
請根據你剛才生成的完整 MainActivity.kt 程式碼，
幫我寫一份 GitHub README.md，使用繁體中文，包含：

1. 專案說明（這個 App 做什麼）
2. 環境需求（Android Studio 版本、Kotlin、Min SDK）
3. 如何 Clone 並在 Android Studio 執行的步驟
4. 新增的功能說明：三語系切換與擠壓次數顯示的實作方式
5. 專案結構說明

GitHub repo 位置：https://github.com/[你的帳號]/LemonadeApp
請輸出標準 Markdown，可直接貼入 GitHub README.md。
```

貼完後：
1. 在專案最外層新建 `README.md` 檔案
2. 貼入 Claude 給的內容
3. 在 Terminal 執行：
```bash
git add .
git commit -m "docs: add README"
git push origin master
```

### Step 12：生成作業說明文件
開另一個 Claude 對話，貼以下 Prompt：

```
請幫我生成一份 Android 作業說明文件（Word 格式），
使用微軟正黑體、藍色標題配色，內容包含：

1. 基本資訊表：
   - 姓名：[填入]
   - 學號：[填入]
   - GitHub：https://github.com/[帳號]/LemonadeApp（Private）
   - 助教帳號：cookiecatowo、penpenpenguin
   - 繳交期限：2026/4/8

2. 程式功能說明（多語系切換、擠壓次數顯示）

3. 使用工具與 Prompt 紀錄表（工具名稱、用途、Prompt 摘要、結果）

4. 如何 Compile 與執行

5. 遇到的最大困難與解決方式
   - Git push 失敗：設定 user.email/user.name
   - 分支名稱是 master 不是 main

6. 作業完成 Checklist

7. 完整 Prompt 原文
```

---

## ✅ 最終繳交確認清單

```
[ ] GitHub Repo 是 Private
[ ] cookiecatowo 已加入且能存取
[ ] penpenpenguin 已加入且能存取
[ ] README.md 有 Compile 與執行說明
[ ] 作業文件有 GitHub 連結
[ ] 作業文件有完整 Prompt 紀錄
[ ] 作業文件有困難與解決方式
[ ] 程式在模擬器可正常執行
[ ] 4/8 前繳交
```

---

## ⚡ 常見問題快速排解

| 問題 | 解決方式 |
|------|---------|
| Gradle Sync 失敗 | 等網路，或重新 File → Sync Project with Gradle Files |
| 模擬器一直轉圈 | 正常，第一次啟動等 5 分鐘 |
| Build Error | 把錯誤訊息貼給 Claude，請它修正 |
| git push 失敗（Author unknown） | 設定 git config user.email 和 user.name |
| git push 失敗（main not found） | 改用 git push -u origin master |
| 語言切換沒反應 | 確認 values-zh 和 values-ja 資料夾建立正確 |
