const SPREADSHEET_ID = "1G6p97MNV9ouUiDrT-x5bh73rqCp7fSiwy9_viWi0Dhk";
const SHEET_NAME = "Signups";

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ ok: true, service: "ArtWall lead register" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("ARTWALL_WEBHOOK_SECRET");
    if (!expectedSecret || payload.secret !== expectedSecret) return jsonResponse({ ok: false, error: "unauthorized" });
    if (!payload.userId || !payload.fullName || !payload.phone) return jsonResponse({ ok: false, error: "missing fields" });

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return jsonResponse({ ok: false, error: "sheet not found" });

    const lastRow = sheet.getLastRow();
    let targetRow = Math.max(5, lastRow + 1);
    if (lastRow >= 5) {
      const userIds = sheet.getRange(5, 2, lastRow - 4, 1).getDisplayValues().flat();
      const existingIndex = userIds.indexOf(String(payload.userId));
      if (existingIndex >= 0) targetRow = existingIndex + 5;
    }

    const values = [[
      new Date(payload.signupTime),
      String(payload.userId),
      String(payload.source || ""),
      String(payload.telegramId || ""),
      String(payload.telegramUsername || ""),
      String(payload.fullName),
      String(payload.phone),
      String(payload.role || "buyer"),
      String(payload.consent || "yes"),
      Number(payload.arDemoOpens || 0),
      Number(payload.cameraStarts || 0),
      Number(payload.viewsSaved || 0),
      Number(payload.shares || 0),
      new Date(payload.lastActivity),
    ]];
    sheet.getRange(targetRow, 1, 1, values[0].length).setValues(values);
    sheet.getRange(targetRow, 1).setNumberFormat("yyyy-mm-dd hh:mm");
    sheet.getRange(targetRow, 14).setNumberFormat("yyyy-mm-dd hh:mm");
    return jsonResponse({ ok: true, row: targetRow });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "unexpected error" });
  } finally {
    lock.releaseLock();
  }
}

