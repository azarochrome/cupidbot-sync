
import fetch from 'node-fetch';
import Airtable from 'airtable';

const accessToken = process.env.CUPIDBOT_TOKEN;
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const analyticsTable = "CupidBot 24h Stats";

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
  const today = new Date().toISOString().split("T")[0];
  const existing = await base(analyticsTable)
    .select({ filterByFormula: `AND({Metric} = "${row.name}", {Date} = "${today}")`, maxRecords: 1 })
    .firstPage();

  if (existing.length > 0) {
    console.log(`⚠️ Skipping duplicate for: ${row.name}`);
    return;
  }

  await base(analyticsTable).create({
    "Metric": row.name,
    "Value": row.values[0],
    "Date": today
  });
}

(async () => {
  try {
    const rows = await fetchGlobalStats();
    for (const row of rows) {
      await saveToAirtable(row);
    }
    console.log("✅ Synced global 24-hour CupidBot stats.");
  } catch (err) {
    console.error("❌ Script error:", err.message);
    process.exit(1);
  }
})();
