/**
 * ==========================================
 * LexiPulse - 多用戶版（GIS 帳號系統）
 * userKey 由前端 Google Identity Services 提供（Google sub）
 * ==========================================
 */

const SPREADSHEET_ID = '1HN3oEjvmUcUe_cNYPLH5p4yasVxztS52oLlIhDTVNmQ';
const INDEX_SHEET_NAME = '📋 用戶索引';
const WRONG_SHEET_NAME = '❌ 錯題庫';

const IDX_KEY      = 1;
const IDX_NICKNAME = 2;
const IDX_WELCOMED = 3;
const IDX_CREATED  = 4;
const IDX_LASTSEEN = 5;

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('LexiPulse')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    switch(action) {
      case 'getUserInfo':          result = getUserInfo(data.userKey); break;
      case 'markWelcomed':         result = markWelcomed(data.userKey, data.nickname); break;
      case 'deleteMyAccount':      result = deleteMyAccount(data.userKey); break;
      case 'getDashboardData':     result = getDashboardData(data.userKey); break;
      case 'getAllSetsData':        result = getAllSetsData(data.userKey); break;
      case 'getRawQuizData':       result = getRawQuizData(data.userKey); break;
      case 'addWordsManually':     result = addWordsManually(data.userKey, data.wordListStr); break;
      case 'completeOneRound':     result = completeOneRound(data.userKey, data.row); break;
      case 'processOfflineQueue':  result = processOfflineQueue(data.userKey, data.queueItems); break;
      case 'saveWrongAnswer':      result = saveWrongAnswer(data.userKey, data.en, data.zh); break;
      case 'recordCorrectAnswer':  result = recordCorrectAnswer(data.userKey, data.en); break;
      case 'getWrongAnswers':      result = getWrongAnswers(data.userKey); break;
      case 'deleteWordSet':        result = deleteWordSet(data.userKey, data.row); break;
      case 'addSentencesManually': result = addSentencesManually(data.userKey, data.textStr); break;
      case 'getAllSentencesData':   result = getAllSentencesData(data.userKey); break;
      case 'editWord':             result = editWord(data.userKey, data.oldEn, data.newEn, data.newZh); break;
      case 'getWordIndexData':     result = getWordIndexData(data.userKey); break;
      case 'updateWordInGroup':    result = updateWordInGroup(data.userKey, data.row, data.wIdx, data.newEn, data.newZh, data.newCtx); break;
      case 'saveContextByEn':      result = saveContextByEn(data.userKey, data.wordEn, data.ctx); break;
      case 'getStarredWords':      result = getStarredWords(data.userKey); break;
      case 'saveStarredWords':     result = saveStarredWords(data.userKey, data.arr); break;
      case 'deleteWordFromGroup':  result = deleteWordFromGroup(data.userKey, data.row, data.wIdx); break;
      case 'getMonthlyRecap':      result = getMonthlyRecap(data.userKey); break;
      case 'clearWrongAnswers':    result = clearWrongAnswers(data.userKey); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function validateUserKey(userKey) {
  if (!userKey || typeof userKey !== 'string' || userKey.trim().length < 4) {
    throw new Error('無效的用戶身分，請重新登入。');
  }
  return userKey.trim();
}

// ============================================================
// 用戶索引工具
// ============================================================
function getIndexSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(INDEX_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INDEX_SHEET_NAME, 0);
    sheet.appendRow(['UserKey', '暱稱', '已歡迎', '建立時間', '最後登入']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 5).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setColumnWidth(1, 260);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 160);
  }
  return sheet;
}

function findUserRow(sheet, userKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const keys = sheet.getRange(2, IDX_KEY, lastRow - 1, 1).getValues().flat();
  const idx = keys.indexOf(userKey);
  return idx === -1 ? -1 : idx + 2;
}

function getOrCreateUserRecord(userKey) {
  const sheet = getIndexSheet();
  const row = findUserRow(sheet, userKey);
  const now = new Date();
  if (row === -1) {
    sheet.appendRow([userKey, '', false, now, now]);
    return { nickname: '', welcomed: false, sheetRow: sheet.getLastRow() };
  }
  sheet.getRange(row, IDX_LASTSEEN).setValue(now);
  const data = sheet.getRange(row, 1, 1, 5).getValues()[0];
  return {
    nickname: String(data[IDX_NICKNAME - 1] || ''),
    welcomed: data[IDX_WELCOMED - 1] === true || data[IDX_WELCOMED - 1] === 'TRUE',
    sheetRow: row
  };
}

function getWrongSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(WRONG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WRONG_SHEET_NAME, 1);
    sheet.appendRow(['UserKey', '英文', '中文', '錯誤次數', '更新時間', '連續答對']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 6).setBackground('#7f1d1d').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setColumnWidth(1, 260);
  }
  return sheet;
}

function getUserSheet(userKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(userKey);
  if (!sheet) {
    sheet = ss.insertSheet(userKey);
    sheet.appendRow(['最後複習日', '單字組內容', '錄入方式', 'off', 'remaining', '累積次數', 'round']);
  }
  return sheet;
}

// ============================================================
// 公開 API（所有函式第一參數為 userKey）
// ============================================================

function getUserInfo(userKey) {
  const appUrl = ScriptApp.getService().getUrl();
  try { userKey = validateUserKey(userKey); } catch(e) {
    return { loggedIn: false, appUrl: appUrl };
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(userKey)) getUserSheet(userKey);
  const record = getOrCreateUserRecord(userKey);
  return {
    loggedIn:    true,
    appUrl:      appUrl,
    displayName: record.nickname || '',
    showWelcome: !record.welcomed
  };
}

function markWelcomed(userKey, nickname) {
  userKey = validateUserKey(userKey);
  const name = (nickname || '').trim() || '匿名用戶';
  const sheet = getIndexSheet();
  const row = findUserRow(sheet, userKey);
  if (row === -1) {
    sheet.appendRow([userKey, name, true, new Date(), new Date()]);
  } else {
    sheet.getRange(row, IDX_NICKNAME).setValue(name);
    sheet.getRange(row, IDX_WELCOMED).setValue(true);
    sheet.getRange(row, IDX_LASTSEEN).setValue(new Date());
  }
}

function deleteMyAccount(userKey) {
  userKey = validateUserKey(userKey);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const wordSheet = ss.getSheetByName(userKey);
  if (wordSheet) ss.deleteSheet(wordSheet);
  const wrongSheet = ss.getSheetByName(WRONG_SHEET_NAME);
  if (wrongSheet && wrongSheet.getLastRow() >= 2) {
    const data = wrongSheet.getRange(2, 1, wrongSheet.getLastRow() - 1, 1).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === userKey) wrongSheet.deleteRow(i + 2);
    }
  }
  const indexSheet = getIndexSheet();
  const row = findUserRow(indexSheet, userKey);
  if (row !== -1) indexSheet.deleteRow(row);
  PropertiesService.getScriptProperties().deleteProperty('reset_' + userKey);
  return "DELETED";
}

function needsDailyReset(userKey) {
  const sp = PropertiesService.getScriptProperties();
  const todayStr = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
  const lastKey = 'reset_' + userKey;
  if (sp.getProperty(lastKey) !== todayStr) {
    sp.setProperty(lastKey, todayStr);
    return true;
  }
  return false;
}

function mergeContextIntoGroup(bCell, iCell) {
  const bStr = String(bCell || '');
  const iStr = String(iCell || '').trim();
  if (!iStr) return bStr;
  const words = bStr.split(' @@ ');
  const ctxs  = iStr.split(' @@ ');
  return words.map((w, i) => {
    const ctx = (ctxs[i] || '').trim();
    return ctx ? w.trim() + ' > ' + ctx : w.trim();
  }).join(' @@ ');
}

function getDashboardData(userKey) {
  userKey = validateUserKey(userKey);
  if (needsDailyReset(userKey)) dailyReset(userKey);
  const ss = getUserSheet(userKey);
  const data = ss.getDataRange().getValues();
  let tasks = [], total = 0, totalWords = 0;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    const wordCount = String(data[i][1]).split(' @@ ').length;
    let totalDone = parseInt(data[i][5]) || 0;
    total += totalDone * wordCount;
    totalWords += wordCount;
    if (parseInt(data[i][4]) > 0) {
      tasks.push({ row: i + 1, wordGroup: mergeContextIntoGroup(data[i][1], data[i][8]), remaining: data[i][4], totalDone: totalDone, type: data[i][7] ? 'sentence' : 'word' });
    }
  }
  return { tasks, totalRecitations: total, totalWords };
}

function getAllSetsData(userKey) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const data = ss.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][1] || data[i][7]) continue;
    result.push({
      row: i + 1,
      wordGroup: mergeContextIntoGroup(data[i][1], data[i][8]),
      totalDone: parseInt(data[i][5]) || 0,
      date: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), "GMT+8", "yyyy/MM/dd") : ""
    });
  }
  return result.reverse();
}

function getRawQuizData(userKey) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  if (ss.getLastRow() < 2) return [];
  const data = ss.getRange(2, 1, ss.getLastRow() - 1, 9).getValues();
  return data.filter(r => r[1] && !r[7]).map(r => mergeContextIntoGroup(r[1], r[8]));
}

function _getWordMap(userKey) {
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  const map = new Map();
  if (lastRow >= 2) {
    const data = ss.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach((row, i) => {
      if (!row[1] || row[7]) return;
      String(row[1]).split(" @@ ").forEach((w, wIdx) => {
        const t = w.trim();
        const spaceIdx = t.indexOf(' ');
        const enKey = (spaceIdx > 0 ? t.substring(0, spaceIdx) : t).toLowerCase().replace(/\.$/, '');
        const zh = spaceIdx > 0 ? t.substring(spaceIdx + 1).trim() : '';
        if (enKey && !map.has(enKey)) {
          map.set(enKey, { sheetRow: i + 2, wIdx, zh, fullGroup: String(row[1]) });
        }
      });
    });
  }
  return map;
}

function parseLineRobust(rawLine) {
  let t = String(rawLine).trim();
  if (!t) return null;
  let ctx = '';
  const sepMatch = t.match(/ [<>] /);
  if (sepMatch) {
    ctx = t.substring(sepMatch.index + 3).trim();
    t = t.substring(0, sepMatch.index).trim();
  }
  t = t.replace(/^[\u2460-\u2473\d]+[.)、\s]\s*/, '').trim();
  t = t.replace(/^\([^)]+\)\s*/, '').trim();
  if (!t) return null;
  t = t.replace(/([a-zA-Z0-9\-_'.\s])[，、,](\s*[\u4e00-\u9fa5])/, '$1 $2');
  let m = t.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/);
  let idx = m ? m.index : -1;
  let en = '', zh = '';
  if (idx > 0) {
    en = t.substring(0, idx).replace(/[,，;；:：!！?？\s]+$/, '').trim();
    zh = t.substring(idx).trim();
  } else if (idx === 0) {
    return null;
  } else {
    en = t.replace(/[,，;；:：!！?？]+$/, '').trim();
    zh = '';
  }
  if (!en) return null;
  en = en.toLowerCase().replace(/\.$/, '').trim();
  return { en, zh, checkKey: en, ctx };
}

function addWordsManually(userKey, wordListStr) {
  userKey = validateUserKey(userKey);
  if (!wordListStr.trim()) return { status: "Empty", added: 0, duplicates: 0, dropped: 0 };
  const rawLines = wordListStr.split('\n');
  const wordMap = _getWordMap(userKey);
  const ss = getUserSheet(userKey);
  let finalWords = [], mergedCount = 0, duplicateCount = 0, droppedCount = 0;
  const mergeUpdates = new Map();

  rawLines.forEach(line => {
    if (!line.trim()) return;
    const parsed = parseLineRobust(line);
    if (!parsed) { droppedCount++; return; }

    if (wordMap.has(parsed.checkKey)) {
      const existing = wordMap.get(parsed.checkKey);
      if (!parsed.zh) {
        duplicateCount++;
      } else {
        const existingZhParts = existing.zh.split('、').map(z => z.trim()).filter(Boolean);
        if (existingZhParts.includes(parsed.zh.trim())) {
          duplicateCount++;
        } else {
          const newZh = existing.zh ? existing.zh + '、' + parsed.zh.trim() : parsed.zh.trim();
          const parts = existing.fullGroup.split(' @@ ');
          const enPart = parts[existing.wIdx].trim().split(' ')[0];
          parts[existing.wIdx] = enPart + ' ' + newZh;
          const newGroup = parts.join(' @@ ');
          if (mergeUpdates.has(existing.sheetRow)) {
            mergeUpdates.get(existing.sheetRow).newGroup = newGroup;
          } else {
            mergeUpdates.set(existing.sheetRow, { sheetRow: existing.sheetRow, newGroup });
          }
          wordMap.set(parsed.checkKey, { ...existing, zh: newZh, fullGroup: newGroup });
          mergedCount++;
        }
      }
    } else {
      wordMap.set(parsed.checkKey, { sheetRow: -1, wIdx: -1, zh: parsed.zh || '', fullGroup: '' });
      finalWords.push({ str: parsed.zh ? `${parsed.en} ${parsed.zh}` : parsed.en, ctx: parsed.ctx || '' });
    }
  });

  mergeUpdates.forEach(({ sheetRow, newGroup }) => {
    ss.getRange(sheetRow, 2).setValue(newGroup);
  });

  if (finalWords.length > 0) {
    const bStr = finalWords.map(w => w.str).join(' @@ ');
    const iStr = finalWords.map(w => w.ctx).join(' @@ ');
    ss.appendRow([new Date(), bStr, "手動錄入", 0, 3, 0, 0, '', iStr]);
  }

  if (finalWords.length === 0 && mergedCount === 0 && (duplicateCount > 0 || droppedCount > 0)) {
    return { status: "All_Processed_No_Add", added: 0, duplicates: duplicateCount, dropped: droppedCount, merged: 0 };
  }
  if (finalWords.length === 0 && mergedCount === 0) return { status: "Empty", added: 0, duplicates: 0, dropped: 0, merged: 0 };
  return { status: "OK", added: finalWords.length, duplicates: duplicateCount, dropped: droppedCount, merged: mergedCount };
}

function dailyReset(userKey) {
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  if (lastRow < 2) return;
  const range = ss.getRange(2, 1, lastRow - 1, 7);
  const data = range.getValues();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let updates = data.map(row => {
    if (!row[0]) return [row[3], row[4]];
    let lastDate = new Date(row[0]);
    lastDate.setHours(0, 0, 0, 0);
    let off = Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / 86400000));
    let round = parseInt(row[6]) || 0;
    let remaining = 0;
    if (round < 5) {
      const roundTable = [3, 3, 2, 2, 1];
      if (round === 0 && off === 0) remaining = roundTable[0];
      else if (round > 0 && off >= 1 && row[4] === 0) remaining = roundTable[round];
      else remaining = row[4];
    } else {
      const requiredOff = Math.max(2, round - 3);
      remaining = off >= requiredOff ? 1 : 0;
    }
    return [off, remaining];
  });
  ss.getRange(2, 4, updates.length, 2).setValues(updates);
}

function completeOneRound(userKey, row) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const dataRange = ss.getRange(row, 5, 1, 3);
  const v = dataRange.getValues()[0];
  const remaining = parseInt(v[0]) || 0;
  const totalDone  = parseInt(v[1]) || 0;
  const round      = parseInt(v[2]) || 0;
  if (remaining <= 0) return "OK";
  const newRemaining = remaining - 1;
  const newTotalDone = totalDone + 1;
  if (newRemaining === 0) {
    dataRange.setValues([[0, newTotalDone, round + 1]]);
    ss.getRange(row, 1).setValue(new Date());
  } else {
    dataRange.setValues([[newRemaining, newTotalDone, round]]);
  }
  return "OK";
}

function processOfflineQueue(userKey, queueItems) {
  userKey = validateUserKey(userKey);
  queueItems.forEach(item => {
    if (item.action === 'completeOneRound') completeOneRound(userKey, item.payload[0]);
    if (item.action === 'saveWrongAnswer') saveWrongAnswer(userKey, item.payload[0], item.payload[1]);
  });
  return "SYNC_SUCCESS";
}

function saveWrongAnswer(userKey, en, zh) {
  userKey = validateUserKey(userKey);
  const sheet = getWrongSheet();
  const lastRow = sheet.getLastRow();
  const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 6).getValues() : [];
  let foundRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === userKey && data[i][1] === en) { foundRow = i + 2; break; }
  }
  if (foundRow !== -1) {
    const errCount = parseInt(data[foundRow - 2][3]) + 1;
    sheet.getRange(foundRow, 4, 1, 3).setValues([[errCount, new Date(), 0]]);
  } else {
    sheet.appendRow([userKey, en, zh, 1, new Date(), 0]);
  }
}

function recordCorrectAnswer(userKey, en) {
  userKey = validateUserKey(userKey);
  const sheet = getWrongSheet();
  if (sheet.getLastRow() < 2) return;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === userKey && data[i][1] === en) {
      const streak = parseInt(data[i][5] || 0) + 1;
      const sheetRow = i + 2;
      if (streak >= 3) { sheet.deleteRow(sheetRow); }
      else { sheet.getRange(sheetRow, 6).setValue(streak); }
      return;
    }
  }
}

function getWrongAnswers(userKey) {
  try {
    userKey = validateUserKey(userKey);
    const sheet = getWrongSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    return data
      .filter(r => r[0] === userKey && String(r[1]).trim())
      .map(r => ({
        en: String(r[1]).trim(),
        zh: String(r[2]).trim(),
        count: Number(r[3]) || 1,
        streak: Number(r[5]) || 0
      }));
  } catch(e) { return []; }
}

function deleteWordSet(userKey, row) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  if (row < 2 || row > lastRow) throw new Error('無效的行號');
  ss.deleteRow(row);
  return "DELETED";
}

function addSentencesManually(userKey, textStr) {
  userKey = validateUserKey(userKey);
  const lines = textStr.split('\n').map(l => l.trim()).filter(l => l);
  const sentences = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const en = lines[i].trim();
    const zh = lines[i + 1].trim();
    if (en && zh) sentences.push(en + ' ' + zh);
  }
  if (!sentences.length) return { status: "Empty", added: 0 };
  const ss = getUserSheet(userKey);
  ss.appendRow([new Date(), sentences.join(" @@ "), "句子錄入", 0, 3, 0, 0, 1]);
  return { status: "OK", added: sentences.length };
}

function getAllSentencesData(userKey) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const data = ss.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][1] || !data[i][7]) continue;
    result.push({
      row: i + 1,
      wordGroup: data[i][1],
      totalDone: parseInt(data[i][5]) || 0,
      remaining: parseInt(data[i][4]) || 0,
      date: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), "GMT+8", "yyyy/MM/dd") : ""
    });
  }
  return result.reverse();
}

function editWord(userKey, oldEn, newEn, newZh) {
  userKey = validateUserKey(userKey);
  oldEn = String(oldEn).trim().toLowerCase();
  newEn = String(newEn).trim().toLowerCase().replace(/\.$/, '');
  newZh = String(newZh).trim();
  if (!oldEn || !newEn) throw new Error('英文不能為空');
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  if (lastRow < 2) throw new Error('無資料');
  const data = ss.getRange(2, 1, lastRow - 1, 8).getValues();
  let updated = false;
  for (let i = 0; i < data.length; i++) {
    if (!data[i][1] || data[i][7]) continue;
    const groups = String(data[i][1]).split(' @@ ');
    let changed = false;
    const newGroups = groups.map(item => {
      const t = item.trim();
      const m = t.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/);
      const en = m ? t.substring(0, m.index).replace(/[,，\s]+$/, '').trim().toLowerCase() : t.toLowerCase();
      if (en === oldEn) { changed = true; return newZh ? `${newEn} ${newZh}` : newEn; }
      return item;
    });
    if (changed) { ss.getRange(i + 2, 2).setValue(newGroups.join(' @@ ')); updated = true; }
  }
  if (!updated) throw new Error('找不到該單字');
  return 'OK';
}

function getWordIndexData(userKey) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  if (lastRow < 2) return [];
  const data = ss.getRange(2, 1, lastRow - 1, 9).getValues();
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][1] && !data[i][7]) {
      result.push({ row: i + 2, wordGroup: mergeContextIntoGroup(data[i][1], data[i][8]) });
    }
  }
  return result;
}

function updateWordInGroup(userKey, row, wIdx, newEn, newZh, newCtx) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const bCell = ss.getRange(row, 2);
  const bParts = String(bCell.getValue()).split(' @@ ');
  if (wIdx < 0 || wIdx >= bParts.length) throw new Error('索引超出範圍');
  bParts[wIdx] = newZh ? newEn.toLowerCase().trim() + ' ' + newZh.trim()
                       : newEn.toLowerCase().trim();
  bCell.setValue(bParts.join(' @@ '));
  const iCell = ss.getRange(row, 9);
  const iRaw = String(iCell.getValue() || '');
  const iParts = iRaw ? iRaw.split(' @@ ') : [];
  while (iParts.length <= wIdx) iParts.push('');
  iParts[wIdx] = String(newCtx || '').trim();
  iCell.setValue(iParts.join(' @@ '));
  return "OK";
}

function saveContextByEn(userKey, wordEn, ctx) {
  userKey = validateUserKey(userKey);
  wordEn = String(wordEn).trim().toLowerCase();
  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  if (lastRow < 2) return "NOT_FOUND";
  const data = ss.getRange(2, 1, lastRow - 1, 9).getValues();
  for (let i = 0; i < data.length; i++) {
    if (!data[i][1] || data[i][7]) continue;
    const bParts = String(data[i][1]).split(' @@ ');
    for (let j = 0; j < bParts.length; j++) {
      const t = bParts[j].trim();
      const m = t.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/);
      const en = (m ? t.substring(0, m.index) : t).replace(/[,，\s]+$/, '').trim().toLowerCase();
      if (en === wordEn) {
        const iCell = ss.getRange(i + 2, 9);
        const iRaw = String(iCell.getValue() || '');
        const iParts = iRaw ? iRaw.split(' @@ ') : [];
        while (iParts.length <= j) iParts.push('');
        iParts[j] = String(ctx || '').trim();
        iCell.setValue(iParts.join(' @@ '));
        return "OK";
      }
    }
  }
  return "NOT_FOUND";
}

function getStarredWords(userKey) {
  userKey = validateUserKey(userKey);
  const raw = PropertiesService.getScriptProperties().getProperty('stars_' + userKey);
  return raw ? JSON.parse(raw) : [];
}

function saveStarredWords(userKey, arr) {
  userKey = validateUserKey(userKey);
  PropertiesService.getScriptProperties().setProperty('stars_' + userKey, JSON.stringify(arr || []));
}

function deleteWordFromGroup(userKey, row, wIdx) {
  userKey = validateUserKey(userKey);
  const ss = getUserSheet(userKey);
  const cell = ss.getRange(row, 2);
  const current = String(cell.getValue());
  const parts = current.split(' @@ ');
  if (wIdx < 0 || wIdx >= parts.length) throw new Error('索引超出範圍');
  parts.splice(wIdx, 1);
  if (parts.length === 0) {
    ss.deleteRow(row);
  } else {
    cell.setValue(parts.join(' @@ '));
  }
  return "OK";
}

function getMonthlyRecap(userKey) {
  userKey = validateUserKey(userKey);
  const sp = PropertiesService.getScriptProperties();
  const now = new Date();
  const thisMonth = Utilities.formatDate(now, 'GMT+8', 'yyyy-MM');
  const day = parseInt(Utilities.formatDate(now, 'GMT+8', 'd'));

  const ss = getUserSheet(userKey);
  const lastRow = ss.getLastRow();
  let currentWords = 0, currentRecitations = 0;
  if (lastRow >= 2) {
    ss.getRange(2, 1, lastRow - 1, 6).getValues().forEach(row => {
      if (!row[1]) return;
      const wc = String(row[1]).split(' @@ ').length;
      currentWords += wc;
      currentRecitations += (parseInt(row[5]) || 0) * wc;
    });
  }

  const baselineKey = 'mbase_' + userKey;
  const shownKey   = 'mshown_' + userKey;
  const raw = sp.getProperty(baselineKey);
  const baseline = raw ? JSON.parse(raw) : null;
  let recap = null;

  if (day === 1) {
    const alreadyShown = sp.getProperty(shownKey) === thisMonth;
    if (!alreadyShown && baseline && baseline.month !== thisMonth) {
      recap = {
        month:    baseline.month,
        newWords: Math.max(0, currentWords      - baseline.words),
        reviews:  Math.max(0, currentRecitations - baseline.recitations)
      };
      sp.setProperty(shownKey, thisMonth);
    }
  }

  if (!baseline || baseline.month !== thisMonth) {
    sp.setProperty(baselineKey, JSON.stringify({
      words: currentWords, recitations: currentRecitations, month: thisMonth
    }));
  }

  return recap;
}

function clearWrongAnswers(userKey) {
  try {
    userKey = validateUserKey(userKey);
    const sheet = getWrongSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "OK";
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === userKey) sheet.deleteRow(i + 2);
    }
    return "OK";
  } catch(e) { throw new Error('清除失敗: ' + e.message); }
}

// ============================================================
// 管理工具（在 Apps Script 編輯器直接執行，不需要 userKey 參數）
// ============================================================
function getUserKey() {
  const temp = Session.getTemporaryActiveUserKey();
  if (!temp) throw new Error('無法識別用戶身分');
  const sp = PropertiesService.getScriptProperties();
  const lookupKey = 'tk_' + temp.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80);
  const stored = sp.getProperty(lookupKey);
  if (stored) return stored;
  const cleaned = temp.replace(/[^a-zA-Z0-9]/g, '');
  const newKey = 'u_' + (cleaned.length >= 16 ? cleaned.substring(0, 28)
                                               : Utilities.getUuid().replace(/-/g, '').substring(0, 28));
  sp.setProperty(lookupKey, newKey);
  return newKey;
}

function testSRSAlgorithm() {
  Logger.log("=== SRS 演算法單元測試 ===");
  let round = 0, lastDay = 0;
  const reviewDays = [];
  for (let day = 0; day <= 35; day++) {
    const off = day - lastDay;
    let tasks = 0;
    if (round === 0 && off === 0) tasks = 5;
    else if (round >= 1 && round < 5 && off >= 1) tasks = [3,3,2,2,1][round];
    else if (round >= 5) {
      const req = Math.max(2, round - 3);
      if (off >= req) tasks = 1;
    }
    if (tasks > 0) { reviewDays.push(day); lastDay = day; round++; }
  }
  const expected = [0,1,2,3,4,6,8,11,15,20,26];
  let pass = 0;
  expected.forEach((d, i) => {
    const ok = reviewDays[i] === d;
    if (ok) pass++;
    Logger.log(`輪次${i+1}: 期望day${d}, 實際day${reviewDays[i]} ${ok?'✅':'❌'}`);
  });
  Logger.log(`結果: ${pass}/${expected.length} 通過`);
}

function normalizeWordsToLowercase() {
  const userKey = getUserKey();
  const sheet = getUserSheet(userKey);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('沒有資料需要處理'); return; }
  const range = sheet.getRange(2, 2, lastRow - 1, 1);
  const data = range.getValues();
  let changedRows = 0;
  const updated = data.map(([cell]) => {
    if (!cell) return [cell];
    const groups = String(cell).split(' @@ ');
    const normalized = groups.map(item => {
      const t = item.trim();
      if (!t) return t;
      const m = t.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/);
      if (m && m.index > 0) {
        const en = t.substring(0, m.index).replace(/[,，\s]+$/, '').trim().toLowerCase();
        const zh = t.substring(m.index).trim();
        return zh ? `${en} ${zh}` : en;
      } else { return t.toLowerCase(); }
    });
    const newCell = normalized.join(' @@ ');
    if (newCell !== String(cell)) changedRows++;
    return [newCell];
  });
  range.setValues(updated);
  Logger.log(`完成：共修改 ${changedRows} 列`);
}

function forceResetToday() {
  const userKey = getUserKey();
  PropertiesService.getScriptProperties().deleteProperty('reset_' + userKey);
  dailyReset(userKey);
  Logger.log('強制重算完成：' + userKey);
}
