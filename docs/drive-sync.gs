/**
 * The House of 1400 → Google Drive poster sync.
 *
 * Runs in Parth's own Google account (script.google.com), so no keys or passwords leave Google.
 * Every hour it reads https://house-of-1400.vercel.app/posters/latest/manifest.json and, when a new
 * edition's posters appear, saves them into a dated folder inside "The House of 1400 · Posters".
 *
 * One-time setup:
 *   1. Open https://script.google.com → New project. Name it "House of 1400 posters".
 *   2. Replace the sample code with this whole file. Save.
 *   3. Choose the function "install" in the toolbar and press Run. Approve the permission prompt
 *      (Drive, and connecting to an external service). It runs once now and then every hour.
 */
const SITE = "https://house-of-1400.vercel.app";
const PARENT_FOLDER_ID = "1kb0FGbr46iRzbXWVLneNKwfK9Zh9FGIm"; // "The House of 1400 · Posters" in My Drive

function syncPosters() {
  const res = UrlFetchApp.fetch(`${SITE}/posters/latest/manifest.json?t=${Date.now()}`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return;
  const m = JSON.parse(res.getContentText());
  const props = PropertiesService.getScriptProperties();
  if (!m.date || props.getProperty("last_synced") === m.date) return;

  const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const it = parent.getFoldersByName(m.date);
  const day = it.hasNext() ? it.next() : parent.createFolder(m.date);
  const have = {};
  const files = day.getFiles();
  while (files.hasNext()) have[files.next().getName()] = true;

  let saved = 0;
  for (const f of m.files) {
    const name = `${f.title}.jpg`;
    if (have[name]) continue;
    const img = UrlFetchApp.fetch(`${SITE}/posters/latest/${encodeURIComponent(f.name)}?d=${m.date}`, { muteHttpExceptions: true });
    if (img.getResponseCode() !== 200) return; // try again next hour; nothing is marked done
    day.createFile(img.getBlob().setName(name));
    saved++;
  }
  props.setProperty("last_synced", m.date);
  console.log(`Saved ${saved} poster(s) for ${m.date}`);
}

function install() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncPosters").timeBased().everyHours(1).create();
  syncPosters();
}
