/**
 * Google Search Console API integration
 * Fetches search performance, indexing status, and keyword data
 */

const SEARCH_CONSOLE_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';

/**
 * List all verified sites/properties for the authenticated user
 */
export async function listSearchConsoleSites(accessToken) {
  const url = `${SEARCH_CONSOLE_BASE}/sites`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Search Console API error ${response.status}`);
  }
  const data = await response.json();
  return (data.siteEntry || []).map(site => ({
    url: site.siteUrl,
    permissionLevel: site.permissionLevel,
  }));
}

/**
 * Fetch search performance data (queries, pages, countries, devices)
 * @param {string} siteUrl - Verified site URL
 * @param {string} accessToken - Google OAuth access token
 * @param {Object} options - Query options
 */
export async function getSearchPerformance(siteUrl, accessToken, options = {}) {
  const {
    days = 28,
    dimensions = ['query'],
    rowLimit = 25,
  } = options;

  const endDate = formatDate(new Date());
  const startDate = formatDate(daysAgo(days));
  const prevEndDate = formatDate(daysAgo(days + 1));
  const prevStartDate = formatDate(daysAgo(days * 2));

  const [current, previous] = await Promise.all([
    querySearchPerformance(siteUrl, accessToken, startDate, endDate, dimensions, rowLimit),
    querySearchPerformance(siteUrl, accessToken, prevStartDate, prevEndDate, dimensions, rowLimit),
  ]);

  return {
    current: parseSearchRows(current),
    previous: parseSearchRows(previous),
    summary: computeSearchSummary(current, previous),
  };
}

/**
 * Fetch overall search performance summary (totals only)
 */
export async function getSearchSummary(siteUrl, accessToken, days = 28) {
  const endDate = formatDate(new Date());
  const startDate = formatDate(daysAgo(days));
  const prevEndDate = formatDate(daysAgo(days + 1));
  const prevStartDate = formatDate(daysAgo(days * 2));

  const [current, previous] = await Promise.all([
    querySearchPerformance(siteUrl, accessToken, startDate, endDate, [], 1),
    querySearchPerformance(siteUrl, accessToken, prevStartDate, prevEndDate, [], 1),
  ]);

  const cur = current.rows?.[0] || {};
  const prev = previous.rows?.[0] || {};

  return {
    current: {
      clicks: cur.clicks || 0,
      impressions: cur.impressions || 0,
      ctr: cur.ctr || 0,
      position: cur.position || 0,
    },
    previous: {
      clicks: prev.clicks || 0,
      impressions: prev.impressions || 0,
      ctr: prev.ctr || 0,
      position: prev.position || 0,
    },
    changes: {
      clicks: pctChange(cur.clicks || 0, prev.clicks || 0),
      impressions: pctChange(cur.impressions || 0, prev.impressions || 0),
      ctr: pctChange(cur.ctr || 0, prev.ctr || 0),
      position: pctChange(cur.position || 0, prev.position || 0),
    },
  };
}

/**
 * Get top queries with their metrics
 */
export async function getTopQueries(siteUrl, accessToken, days = 28, limit = 20) {
  const endDate = formatDate(new Date());
  const startDate = formatDate(daysAgo(days));
  const data = await querySearchPerformance(siteUrl, accessToken, startDate, endDate, ['query'], limit);
  return parseSearchRows(data);
}

/**
 * Get daily search performance for sparklines
 */
export async function getDailySearchPerformance(siteUrl, accessToken, days = 28) {
  const endDate = formatDate(new Date());
  const startDate = formatDate(daysAgo(days));
  const data = await querySearchPerformance(siteUrl, accessToken, startDate, endDate, ['date'], days);
  return parseSearchRows(data).sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
}

/**
 * Fetch URL inspection data for a specific page
 */
export async function inspectUrl(siteUrl, inspectionUrl, accessToken) {
  const url = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
    }),
  });
  if (!response.ok) {
    throw new Error(`URL Inspection API error ${response.status}`);
  }
  return response.json();
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function querySearchPerformance(siteUrl, accessToken, startDate, endDate, dimensions, rowLimit) {
  const encodedSite = encodeURIComponent(siteUrl);
  const url = `${SEARCH_CONSOLE_BASE}/sites/${encodedSite}/searchAnalytics/query`;
  const body = {
    startDate,
    endDate,
    rowLimit,
  };
  if (dimensions.length > 0) body.dimensions = dimensions;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Search Console query error ${response.status}`);
  }
  return response.json();
}

function parseSearchRows(data) {
  return (data.rows || []).map(row => ({
    keys: row.keys || [],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
}

function computeSearchSummary(current, previous) {
  const curTotals = sumSearchRows(current.rows || []);
  const prevTotals = sumSearchRows(previous.rows || []);
  return {
    current: curTotals,
    previous: prevTotals,
    changes: {
      clicks: pctChange(curTotals.clicks, prevTotals.clicks),
      impressions: pctChange(curTotals.impressions, prevTotals.impressions),
      ctr: pctChange(curTotals.ctr, prevTotals.ctr),
      position: pctChange(curTotals.position, prevTotals.position),
    },
  };
}

function sumSearchRows(rows) {
  const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  if (!rows.length) return totals;
  for (const row of rows) {
    totals.clicks += row.clicks || 0;
    totals.impressions += row.impressions || 0;
    totals.ctr += row.ctr || 0;
    totals.position += row.position || 0;
  }
  totals.ctr /= rows.length;
  totals.position /= rows.length;
  return totals;
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
