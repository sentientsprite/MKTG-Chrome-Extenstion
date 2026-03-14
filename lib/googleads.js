/**
 * Google Ads API integration (REST/JSON API)
 * Fetches campaign performance, ad spend, and lead quality metrics
 */

const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v17';

/**
 * Fetch all accessible customer accounts
 * @param {string} accessToken - Google OAuth access token
 * @param {string} developerToken - Google Ads Developer Token
 */
export async function listCustomers(accessToken, developerToken) {
  const url = `${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
    },
  });
  if (!response.ok) {
    throw new Error(`Google Ads API error ${response.status}`);
  }
  const data = await response.json();
  return (data.resourceNames || []).map(name => name.replace('customers/', ''));
}

/**
 * Run a GAQL query against a customer account
 * @param {string} customerId - Google Ads customer ID (no dashes)
 * @param {string} accessToken
 * @param {string} developerToken
 * @param {string} query - GAQL query string
 */
export async function runGaqlQuery(customerId, accessToken, developerToken, query) {
  const url = `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Google Ads query error ${response.status}: ${JSON.stringify(err)}`);
  }
  return response.json();
}

/**
 * Fetch campaign performance summary for the last N days
 */
export async function getCampaignPerformance(customerId, accessToken, developerToken, days = 30) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion,
      metrics.conversion_rate
    FROM campaign
    WHERE segments.date DURING LAST_${days}_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 20
  `;

  const data = await runGaqlQuery(customerId, accessToken, developerToken, query);
  return (data.results || []).map(row => ({
    id: row.campaign?.id,
    name: row.campaign?.name,
    status: row.campaign?.status,
    channelType: row.campaign?.advertisingChannelType,
    impressions: parseInt(row.metrics?.impressions || 0),
    clicks: parseInt(row.metrics?.clicks || 0),
    ctr: parseFloat(row.metrics?.ctr || 0),
    avgCpc: microsToDollars(row.metrics?.averageCpc),
    spend: microsToDollars(row.metrics?.costMicros),
    conversions: parseFloat(row.metrics?.conversions || 0),
    costPerConversion: microsToDollars(row.metrics?.costPerConversion),
    conversionRate: parseFloat(row.metrics?.conversionRate || 0),
  }));
}

/**
 * Fetch account-level performance summary
 */
export async function getAccountSummary(customerId, accessToken, developerToken, days = 30) {
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion,
      metrics.all_conversions,
      metrics.search_impression_share
    FROM customer
    WHERE segments.date DURING LAST_${days}_DAYS
  `;

  const data = await runGaqlQuery(customerId, accessToken, developerToken, query);
  const row = data.results?.[0] || {};
  return {
    customerId: row.customer?.id,
    accountName: row.customer?.descriptiveName,
    impressions: parseInt(row.metrics?.impressions || 0),
    clicks: parseInt(row.metrics?.clicks || 0),
    ctr: parseFloat(row.metrics?.ctr || 0),
    avgCpc: microsToDollars(row.metrics?.averageCpc),
    totalSpend: microsToDollars(row.metrics?.costMicros),
    conversions: parseFloat(row.metrics?.conversions || 0),
    costPerConversion: microsToDollars(row.metrics?.costPerConversion),
    allConversions: parseFloat(row.metrics?.allConversions || 0),
    searchImpressionShare: parseFloat(row.metrics?.searchImpressionShare || 0),
  };
}

/**
 * Fetch top performing keywords
 */
export async function getKeywordPerformance(customerId, accessToken, developerToken, days = 30) {
  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date DURING LAST_${days}_DAYS
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 25
  `;

  const data = await runGaqlQuery(customerId, accessToken, developerToken, query);
  return (data.results || []).map(row => ({
    keyword: row.adGroupCriterion?.keyword?.text,
    matchType: row.adGroupCriterion?.keyword?.matchType,
    qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore,
    impressions: parseInt(row.metrics?.impressions || 0),
    clicks: parseInt(row.metrics?.clicks || 0),
    ctr: parseFloat(row.metrics?.ctr || 0),
    avgCpc: microsToDollars(row.metrics?.averageCpc),
    spend: microsToDollars(row.metrics?.costMicros),
    conversions: parseFloat(row.metrics?.conversions || 0),
  }));
}

/**
 * Fetch daily spend trend
 */
export async function getDailySpend(customerId, accessToken, developerToken, days = 30) {
  const query = `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM customer
    WHERE segments.date DURING LAST_${days}_DAYS
    ORDER BY segments.date ASC
  `;

  const data = await runGaqlQuery(customerId, accessToken, developerToken, query);
  return (data.results || []).map(row => ({
    date: row.segments?.date,
    spend: microsToDollars(row.metrics?.costMicros),
    conversions: parseFloat(row.metrics?.conversions || 0),
    clicks: parseInt(row.metrics?.clicks || 0),
    impressions: parseInt(row.metrics?.impressions || 0),
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function microsToDollars(micros) {
  if (!micros) return 0;
  return parseFloat(micros) / 1_000_000;
}
