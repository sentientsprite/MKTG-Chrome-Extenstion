/**
 * Google Business Profile (formerly GMB) API integration
 * Fetches business metrics, reviews, and local insights
 */

const GMB_ACCOUNT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GMB_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GMB_PERF_BASE = 'https://businessprofileperformance.googleapis.com/v1';

/**
 * List all business accounts for the authenticated user
 */
export async function listBusinessAccounts(accessToken) {
  const url = `${GMB_ACCOUNT_BASE}/accounts`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`GMB Accounts API error ${response.status}`);
  }
  const data = await response.json();
  return (data.accounts || []).map(account => ({
    name: account.name,
    accountName: account.accountName,
    type: account.type,
    state: account.state,
  }));
}

/**
 * List all locations (business listings) for an account
 */
export async function listLocations(accountName, accessToken) {
  const url = `${GMB_INFO_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,metadata,profile`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`GMB Locations API error ${response.status}`);
  }
  const data = await response.json();
  return (data.locations || []).map(loc => ({
    name: loc.name,
    title: loc.title,
    address: formatAddress(loc.storefrontAddress),
    phone: loc.phoneNumbers?.primaryPhone || '',
    website: loc.websiteUri || '',
    isVerified: loc.metadata?.isVerified || false,
    hasPendingEdits: loc.metadata?.hasPendingEdits || false,
    mapsUri: loc.metadata?.mapsUri || '',
    newReviewUri: loc.metadata?.newReviewUri || '',
  }));
}

/**
 * Get performance metrics for a location
 * Fetches impressions, clicks, calls, direction requests
 */
export async function getLocationPerformance(locationName, accessToken, days = 28) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const dailyMetrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_DIRECTION_REQUESTS',
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_BOOKINGS',
    'BUSINESS_FOOD_ORDERS',
  ];

  // This endpoint requires GET with query parameters
  const params = new URLSearchParams();
  params.set('dailyRange.startDate.year', startDate.getFullYear());
  params.set('dailyRange.startDate.month', startDate.getMonth() + 1);
  params.set('dailyRange.startDate.day', startDate.getDate());
  params.set('dailyRange.endDate.year', endDate.getFullYear());
  params.set('dailyRange.endDate.month', endDate.getMonth() + 1);
  params.set('dailyRange.endDate.day', endDate.getDate());

  for (const metric of dailyMetrics) {
    params.append('dailyMetrics', metric);
  }

  const perfUrl = `${GMB_PERF_BASE}/${locationName}:fetchMultiDailyMetricsTimeSeries?${params}`;
  const perfResponse = await fetch(perfUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!perfResponse.ok) {
    throw new Error(`GMB Performance API error ${perfResponse.status}`);
  }

  const data = await perfResponse.json();
  return parsePerformanceData(data);
}

/**
 * Fetch reviews for a location
 */
export async function getLocationReviews(locationName, accessToken, pageSize = 20) {
  // Reviews API is part of the older v4.9 API
  const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=${pageSize}&orderBy=updateTime+desc`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    // Reviews endpoint may require different scopes; return empty gracefully
    console.warn(`GMB Reviews API error ${response.status}`);
    return { reviews: [], averageRating: null, totalReviewCount: 0 };
  }
  const data = await response.json();
  return {
    reviews: (data.reviews || []).map(r => ({
      reviewId: r.reviewId,
      reviewer: r.reviewer?.displayName || 'Anonymous',
      starRating: r.starRating,
      comment: r.comment || '',
      createTime: r.createTime,
      updateTime: r.updateTime,
      hasReply: !!r.reviewReply,
      replyComment: r.reviewReply?.comment || '',
    })),
    averageRating: data.averageRating || null,
    totalReviewCount: data.totalReviewCount || 0,
  };
}

/**
 * Get review summary stats (rating distribution, unanswered count)
 */
export function analyzeReviews(reviews) {
  if (!reviews.length) return null;

  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalStars = 0;
  let unanswered = 0;
  let recentNegative = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const review of reviews) {
    const stars = ratingMap[review.starRating] || 0;
    distribution[stars] = (distribution[stars] || 0) + 1;
    totalStars += stars;
    if (!review.hasReply) unanswered++;
    if (stars <= 2 && new Date(review.updateTime) > thirtyDaysAgo) recentNegative++;
  }

  return {
    averageRating: totalStars / reviews.length,
    distribution,
    unanswered,
    recentNegative,
    total: reviews.length,
  };
}

// ── Parsers ─────────────────────────────────────────────────────────────────

function parsePerformanceData(data) {
  const result = {};
  for (const series of (data.multiDailyMetricTimeSeries || [])) {
    for (const ts of (series.dailyMetricTimeSeries || [])) {
      const metric = ts.dailyMetric;
      const points = (ts.timeSeries?.datedValues || []).map(dv => ({
        date: `${dv.date.year}-${String(dv.date.month).padStart(2, '0')}-${String(dv.date.day).padStart(2, '0')}`,
        value: parseInt(dv.value || '0', 10),
      }));
      result[metric] = points;
    }
  }

  // Compute totals
  const totals = {};
  for (const [metric, points] of Object.entries(result)) {
    totals[metric] = points.reduce((sum, p) => sum + p.value, 0);
  }

  return { timeSeries: result, totals };
}

function formatAddress(address) {
  if (!address) return '';
  const parts = [
    address.addressLines?.join(', '),
    address.locality,
    address.administrativeArea,
    address.postalCode,
  ].filter(Boolean);
  return parts.join(', ');
}
