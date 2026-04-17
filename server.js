// GEX / Walls Proxy Server (Fixed + Cached)

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ── CONFIG ───────────────────────────────────────────────
const API_KEY = process.env.FREE_FLOW_API_KEY;
const API_BASE = "https://www.free-flow.site";

// ── SIMPLE CACHE (IMPORTANT) ─────────────────────────────
let cache = {};
let lastFetchTime = {};

// 60s cache window (matches your API refresh rate)
const CACHE_TTL = 60 * 1000;

// ── CORS ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── HELPER ───────────────────────────────────────────────
async function fetchFromAPI(path) {
  const url = `${API_BASE}${path}`;

  const resp = await fetch(url, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(`API error ${resp.status}: ${text}`);
  }

  return JSON.parse(text);
}

// ── CACHE WRAPPER (KEY FIX) ──────────────────────────────
async function getWalls(symbol, exp) {
  const key = `${symbol}_${exp}`;
  const now = Date.now();

  if (
    cache[key] &&
    lastFetchTime[key] &&
    now - lastFetchTime[key] < CACHE_TTL
  ) {
    return cache[key];
  }

  const data = await fetchFromAPI(
    `/public/walls?symbol=${symbol}&exp=${exp}`
  );

  cache[key] = data;
  lastFetchTime[key] = now;

  return data;
}

// ── ROUTES ───────────────────────────────────────────────

// GET /levels
app.get("/levels", async (req, res) => {
  const symbol = (req.query.symbol || "SPY").toUpperCase();
  const exp = req.query.exp || "2026-04-17";

  try {
    const data = await getWalls(symbol, exp);

    res.json({
      symbol,
      spot: data.spot ?? null,

      gamma_flip: data.gamma_flip ?? null,

      call_wall: data.call_wall?.strike ?? null,
      put_wall: data.put_wall?.strike ?? null,

      call_wall_gex: data.call_wall?.gex ?? null,
      put_wall_gex: data.put_wall?.gex ?? null,

      updated_at: data.timestamp ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[/levels] ${symbol}:`, err.message);
    res.status(502).json({ error: err.message, symbol });
  }
});

// GET /walls
app.get("/walls", async (req, res) => {
  const symbol = (req.query.symbol || "SPY").toUpperCase();
  const exp = req.query.exp || "2026-04-17";

  try {
    const data = await getWalls(symbol, exp);

    res.json({
      symbol,
      gamma_flip: data.gamma_flip ?? null,
      call_wall: data.call_wall ?? null,
      put_wall: data.put_wall ?? null,
      raw: data,
    });
  } catch (err) {
    console.error(`[/walls] ${symbol}:`, err.message);
    res.status(502).json({ error: err.message, symbol });
  }
});

// GET /gex (placeholder)
app.get("/gex", async (req, res) => {
  const symbol = (req.query.symbol || "SPY").toUpperCase();
  const exp = req.query.exp || "2026-04-17";

  try {
    const data = await getWalls(symbol, exp);

    res.json({
      symbol,
      net_gex: null,
      gamma_flip: data.gamma_flip ?? null,
      call_wall: data.call_wall ?? null,
      put_wall: data.put_wall ?? null,
    });
  } catch (err) {
    console.error(`[/gex] ${symbol}:`, err.message);
    res.status(502).json({ error: err.message, symbol });
  }
});

// ── HEALTH ───────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  if (!API_KEY) console.warn("⚠️ FREE_FLOW_API_KEY is NOT set");
});