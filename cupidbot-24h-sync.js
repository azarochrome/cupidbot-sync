
import fetch from 'node-fetch';
import Airtable from 'airtable';

const accessToken = process.env.CUPIDBOT_TOKEN;
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const analyticsTable = "Cupid 1H Sync";
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

async function fetchGlobalStats() {
  const url = `https://cupidbot-382905.uc.r.appspot.com/api/getAnalytics?accessToken=${accessToken}&isAPI=true&version=0.19.0&viewingApps=instagram&lastDays=1`;
  const res = await fetch(url);
  const text = await res.text();
  console.log("📦 Raw API Response:", text);
  if (!res.ok) throw new Error(`CupidBot API error: ${res.status}`);
  const data = JSON.parse(text);
  return data?.rows || [];
}

async function saveToAirtable(row) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    const existing = await base(analyticsTable)
      .select({ filterByFormula: `AND({Metric} = "${row.name}", DATETIME_FORMAT({Date}, 'YYYY-MM-DD') = "${today}")`, maxRecords: 1 })
      .firstPage();

    if (existing.length > 0) {
      console.log(`⚠️ Skipping duplicate for: ${row.name}`);
      return;
    }

    await base(analyticsTable).create({
      "Metric": row.name,
      "Value": row.values[0],
      "Date": now
    });
  } catch (err) {
    console.error("❌ Airtable write error:", err);
    await notifyTelegram(`❌ Airtable write failed: ${err.message}`);
    throw err;
  }
}

async function notifyTelegram(message) {
  try {
    console.log("📬 Sending Telegram message...");
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text: message })
    });
    const data = await res.json();
    console.log("📬 Telegram response:", data);
  } catch (err) {
    console.error("❌ Telegram notification error:", err);
  }
}

(async () => {
  try {
    const rows = await fetchGlobalStats();
    let summary = "";
    for (const row of rows) {
      await saveToAirtable(row);
      summary += `\n${row.name}: ${row.values[0]}`;
    }

    const timestamp = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" });
    await notifyTelegram(`✅ CupidBot stats synced at ${timestamp}${summary}`);
    console.log("✅ Synced global 24-hour CupidBot stats.");
  } catch (err) {
    console.error("❌ Script error:", err.message);
    await notifyTelegram(`❌ CupidBot sync failed: ${err.message}`);
    process.exit(1);
  }
})();
