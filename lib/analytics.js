/**
 * Google Analytics 4 Data API integration
 * Fetches traffic metrics, event data, and trend analysis
 */

const GA4_BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';

/**
 * Run a GA4 report for a given property
 * @param {string} propertyId - GA4 property ID (e.g. "123456789")
 * @param {string} accessToken - Google OAuth access token
 * @param {Object} reportRequest - GA4 RunReportRequest body
 */
export async function runGA4Report(propertyId, accessToken, reportRequest) {
  const url = `${GA4_BASE_URL}/properties/${propertyId}:runReport`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportRequest),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`GA4 API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch traffic overview for the last N days
 * Returns sessions, users, bounce rate, avg session duration
 */
export async function getTrafficOverview(propertyId, accessToken, days = 30) {
  const endDate = 'today';
  const startDate = `${days}daysAgo`;
  const prevStartDate = `${days * 2}daysAgo`;
  const prevEndDate = `${days + 1}daysAgo`;

  const report = await runGA4Report(propertyId, accessToken, {
    dateRanges: [
      { startDate, endDate, name: 'current' },
      { startDate: prevStartDate, endDate: prevEndDate, name: 'previous' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
      { name: 'conversions' },
    ],
    dimensions: [{ name: 'dateRange' }],
  });

  return parseOverviewReport(report);
}

/**
 * Fetch traffic by channel for trend analysis
 */
export async function getTrafficByChannel(propertyId, accessToken, days = 30) {
  const report = await runGA4Report(propertyId, accessToken, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'conversions' },
    ],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  return parseChannelReport(report);
}

/**
 * Fetch daily sessions over time for sparkline/trend
 */
export async function getDailyTraffic(propertyId, accessToken, days = 30) {
  const report = await runGA4Report(propertyId, accessToken, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    dimensions: [{ name: 'date' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  });

  return parseDailyReport(report);
}

/**
 * Fetch top landing pages by sessions
 */
export async function getTopPages(propertyId, accessToken, days = 30) {
  const report = await runGA4Report(propertyId, accessToken, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'conversions' },
    ],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  return parsePageReport(report);
}

/**
 * Fetch conversion events
 */
export async function getConversionSummary(propertyId, accessToken, days = 30) {
  const report = await runGA4Report(propertyId, accessToken, {
    dateRanges: [
      { startDate: `${days}daysAgo`, endDate: 'today', name: 'current' },
      { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
    ],
    metrics: [{ name: 'conversions' }, { name: 'sessions' }],
    dimensions: [{ name: 'dateRange' }, { name: 'eventName' }],
  });

  return parseConversionReport(report);
}

/**
 * List GA4 properties available to the user
 */
export async function listGA4Properties(accessToken) {
  const url = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries';
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Analytics Admin API error ${response.status}`);
  }
  const data = await response.json();
  const properties = [];
  for (const account of (data.accountSummaries || [])) {
    for (const prop of (account.propertySummaries || [])) {
      properties.push({
        id: prop.property.replace('properties/', ''),
        name: prop.displayName,
        accountName: account.displayName,
      });
    }
  }
  return properties;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

function parseOverviewReport(report) {
  const rows = report.rows || [];
  const current = {};
  const previous = {};

  for (const row of rows) {
    const period = row.dimensionValues?.[0]?.value;
    const vals = row.metricValues || [];
    const obj = {
      sessions: parseFloat(vals[0]?.value || 0),
      users: parseFloat(vals[1]?.value || 0),
      bounceRate: parseFloat(vals[2]?.value || 0),
      avgSessionDuration: parseFloat(vals[3]?.value || 0),
      pagesPerSession: parseFloat(vals[4]?.value || 0),
      conversions: parseFloat(vals[5]?.value || 0),
    };
    if (period === 'current') Object.assign(current, obj);
    else Object.assign(previous, obj);
  }

  return {
    current,
    previous,
    changes: computeChanges(current, previous),
  };
}

function parseChannelReport(report) {
  return (report.rows || []).map(row => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: parseFloat(row.metricValues?.[0]?.value || 0),
    users: parseFloat(row.metricValues?.[1]?.value || 0),
    conversions: parseFloat(row.metricValues?.[2]?.value || 0),
  }));
}

function parseDailyReport(report) {
  return (report.rows || []).map(row => ({
    date: row.dimensionValues?.[0]?.value || '',
    sessions: parseFloat(row.metricValues?.[0]?.value || 0),
    users: parseFloat(row.metricValues?.[1]?.value || 0),
  }));
}

function parsePageReport(report) {
  return (report.rows || []).map(row => ({
    path: row.dimensionValues?.[0]?.value || '/',
    title: row.dimensionValues?.[1]?.value || '',
    sessions: parseFloat(row.metricValues?.[0]?.value || 0),
    bounceRate: parseFloat(row.metricValues?.[1]?.value || 0),
    avgDuration: parseFloat(row.metricValues?.[2]?.value || 0),
    conversions: parseFloat(row.metricValues?.[3]?.value || 0),
  }));
}

function parseConversionReport(report) {
  const currentEvents = {};
  const previousEvents = {};
  for (const row of (report.rows || [])) {
    const period = row.dimensionValues?.[0]?.value;
    const event = row.dimensionValues?.[1]?.value;
    const conversions = parseFloat(row.metricValues?.[0]?.value || 0);
    if (period === 'current') currentEvents[event] = conversions;
    else previousEvents[event] = conversions;
  }
  return { currentEvents, previousEvents };
}

function computeChanges(current, previous) {
  const changes = {};
  for (const key of Object.keys(current)) {
    const cur = current[key] || 0;
    const prev = previous[key] || 0;
    if (prev === 0) {
      changes[key] = cur > 0 ? 100 : 0;
    } else {
      changes[key] = ((cur - prev) / prev) * 100;
    }
  }
  return changes;
}
