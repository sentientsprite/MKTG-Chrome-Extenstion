/**
 * Background Service Worker
 * Handles OAuth authentication, periodic data refresh, and notifications
 */

import { getTrafficOverview, getTrafficByChannel, getDailyTraffic, listGA4Properties } from './lib/analytics.js';
import { getSearchSummary, getTopQueries, getDailySearchPerformance, listSearchConsoleSites } from './lib/searchconsole.js';
import { getCampaignPerformance, getAccountSummary, getDailySpend, listCustomers } from './lib/googleads.js';
import { listBusinessAccounts, listLocations, getLocationPerformance, getLocationReviews, analyzeReviews } from './lib/gmb.js';
import { detectIssues, generateAIAdvice, askCoach } from './lib/ai-coach.js';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_ALARM = 'data-refresh';

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Get a valid Google OAuth access token, refreshing if needed
 */
async function getAccessToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: SCOPES.split(' ') }, token => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Remove cached token and force re-authentication
 */
async function revokeToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      if (!token) { resolve(); return; }
      chrome.identity.removeCachedAuthToken({ token }, () => {
        // Also revoke server-side
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
          .finally(() => resolve());
      });
    });
  });
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    console.error('[AI Growth Coach] Error handling message:', err);
    sendResponse({ error: err.message });
  });
  return true; // Keep the message channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_AUTH_STATUS':
      return getAuthStatus();
    case 'SIGN_IN':
      return signIn();
    case 'SIGN_OUT':
      return signOut();
    case 'FETCH_ALL_DATA':
      return fetchAllData(message.forceRefresh);
    case 'FETCH_ANALYTICS':
      return fetchAnalyticsData();
    case 'FETCH_SEARCH_CONSOLE':
      return fetchSearchConsoleData();
    case 'FETCH_ADS':
      return fetchAdsData();
    case 'FETCH_GMB':
      return fetchGmbData();
    case 'GET_ISSUES':
      return getDetectedIssues();
    case 'GET_AI_ADVICE':
      return getAIAdvice(message.forceRefresh);
    case 'ASK_COACH':
      return askAICoach(message.question);
    case 'GET_SETTINGS':
      return getSettings();
    case 'SAVE_SETTINGS':
      return saveSettings(message.settings);
    case 'LIST_GA4_PROPERTIES':
      return listAvailableGA4Properties();
    case 'LIST_SC_SITES':
      return listAvailableSCSites();
    case 'LIST_GMB_ACCOUNTS':
      return listAvailableGMBAccounts();
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// ── Auth actions ─────────────────────────────────────────────────────────────

async function getAuthStatus() {
  try {
    const token = await getAccessToken(false);
    if (!token) return { isSignedIn: false };
    const userInfo = await fetchUserInfo(token);
    return { isSignedIn: true, user: userInfo };
  } catch {
    return { isSignedIn: false };
  }
}

async function signIn() {
  const token = await getAccessToken(true);
  const userInfo = await fetchUserInfo(token);
  await chrome.storage.local.set({ isSignedIn: true, user: userInfo });
  return { isSignedIn: true, user: userInfo };
}

async function signOut() {
  await revokeToken();
  await chrome.storage.local.remove([
    'isSignedIn', 'user', 'cachedData', 'cachedAdvice', 'cachedIssues', 'lastFetch',
  ]);
  return { isSignedIn: false };
}

async function fetchUserInfo(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return response.json();
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchAllData(forceRefresh = false) {
  const lastFetch = (await chrome.storage.local.get('lastFetch')).lastFetch;
  if (!forceRefresh && lastFetch && (Date.now() - lastFetch) < CACHE_TTL_MS) {
    const cached = (await chrome.storage.local.get('cachedData')).cachedData;
    if (cached) return { data: cached, fromCache: true };
  }

  const settings = await getSettings();
  const token = await getAccessToken(false);
  if (!token) throw new Error('Not authenticated. Please sign in.');

  const data = {};
  const errors = {};

  // Fetch all data sources in parallel
  await Promise.allSettled([
    fetchAnalyticsData(token, settings).then(r => { data.analytics = r; }).catch(e => { errors.analytics = e.message; }),
    fetchSearchConsoleData(token, settings).then(r => { data.searchConsole = r; }).catch(e => { errors.searchConsole = e.message; }),
    fetchAdsData(token, settings).then(r => { data.ads = r; }).catch(e => { errors.ads = e.message; }),
    fetchGmbData(token, settings).then(r => { data.gmb = r; }).catch(e => { errors.gmb = e.message; }),
  ]);

  // Detect issues from all data, using configured average order value if set
  const issues = detectIssues(data, { avgOrderValue: settings?.avgOrderValue });

  await chrome.storage.local.set({
    cachedData: data,
    cachedIssues: issues,
    lastFetch: Date.now(),
  });

  return { data, issues, errors };
}

async function fetchAnalyticsData(token, settings) {
  if (!token) {
    const s = await getSettings();
    settings = s;
    token = await getAccessToken(false);
  }
  const propertyId = settings?.ga4PropertyId;
  if (!propertyId) return null;

  const [overview, channels, daily] = await Promise.all([
    getTrafficOverview(propertyId, token),
    getTrafficByChannel(propertyId, token),
    getDailyTraffic(propertyId, token),
  ]);

  return { overview, channels, daily };
}

async function fetchSearchConsoleData(token, settings) {
  if (!token) {
    const s = await getSettings();
    settings = s;
    token = await getAccessToken(false);
  }
  const siteUrl = settings?.searchConsoleSite;
  if (!siteUrl) return null;

  const [summary, queries, daily] = await Promise.all([
    getSearchSummary(siteUrl, token),
    getTopQueries(siteUrl, token),
    getDailySearchPerformance(siteUrl, token),
  ]);

  return { summary, queries, daily };
}

async function fetchAdsData(token, settings) {
  if (!token) {
    const s = await getSettings();
    settings = s;
    token = await getAccessToken(false);
  }
  const customerId = settings?.adsCustomerId;
  const developerToken = settings?.adsDeveloperToken;
  if (!customerId || !developerToken) return null;

  const [summary, campaigns, daily] = await Promise.all([
    getAccountSummary(customerId, token, developerToken),
    getCampaignPerformance(customerId, token, developerToken),
    getDailySpend(customerId, token, developerToken),
  ]);

  return { summary, campaigns, daily };
}

async function fetchGmbData(token, settings) {
  if (!token) {
    const s = await getSettings();
    settings = s;
    token = await getAccessToken(false);
  }
  const locationName = settings?.gmbLocationName;
  if (!locationName) return null;

  const [performance, reviewData] = await Promise.all([
    getLocationPerformance(locationName, token).catch(() => null),
    getLocationReviews(locationName, token).catch(() => ({ reviews: [], totalReviewCount: 0 })),
  ]);

  const reviewStats = analyzeReviews(reviewData.reviews);

  return { performance, reviews: reviewData.reviews.slice(0, 5), reviewStats };
}

// ── Issues & AI ──────────────────────────────────────────────────────────────

async function getDetectedIssues() {
  const { cachedIssues, cachedData, lastFetch } = await chrome.storage.local.get([
    'cachedIssues', 'cachedData', 'lastFetch',
  ]);

  if (cachedIssues && lastFetch && (Date.now() - lastFetch) < CACHE_TTL_MS) {
    return { issues: cachedIssues };
  }

  if (cachedData) {
    const settings = await getSettings();
    const issues = detectIssues(cachedData, { avgOrderValue: settings?.avgOrderValue });
    await chrome.storage.local.set({ cachedIssues: issues });
    return { issues };
  }

  return { issues: [] };
}

async function getAIAdvice(forceRefresh = false) {
  const settings = await getSettings();
  if (!settings.openAiApiKey) {
    return { advice: null, error: 'OpenAI API key not configured. Add it in Settings.' };
  }

  const { cachedAdvice, cachedAdviceTime } = await chrome.storage.local.get([
    'cachedAdvice', 'cachedAdviceTime',
  ]);

  // Cache advice for 1 hour
  if (!forceRefresh && cachedAdvice && cachedAdviceTime && (Date.now() - cachedAdviceTime) < 60 * 60 * 1000) {
    return { advice: cachedAdvice, fromCache: true };
  }

  const { cachedData } = await chrome.storage.local.get('cachedData');
  const { cachedIssues } = await chrome.storage.local.get('cachedIssues');

  if (!cachedData) {
    return { advice: null, error: 'No data available. Please refresh your data first.' };
  }

  const context = {
    ...cachedData,
    businessName: settings.businessName,
    industry: settings.industry,
    location: settings.location,
  };

  const advice = await generateAIAdvice(context, settings.openAiApiKey, cachedIssues || []);

  await chrome.storage.local.set({ cachedAdvice: advice, cachedAdviceTime: Date.now() });
  return { advice };
}

async function askAICoach(question) {
  const settings = await getSettings();
  if (!settings.openAiApiKey) {
    throw new Error('OpenAI API key not configured. Add it in Settings.');
  }

  const { cachedData } = await chrome.storage.local.get('cachedData');

  const context = {
    ...(cachedData || {}),
    businessName: settings.businessName,
    industry: settings.industry,
    location: settings.location,
  };

  const answer = await askCoach(question, context, settings.openAiApiKey);
  return { answer };
}

// ── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || {};
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
  // Clear cache when settings change
  await chrome.storage.local.remove(['cachedData', 'cachedIssues', 'cachedAdvice', 'lastFetch']);
  return { success: true };
}

// ── Discovery ─────────────────────────────────────────────────────────────────

async function listAvailableGA4Properties() {
  const token = await getAccessToken(false);
  const properties = await listGA4Properties(token);
  return { properties };
}

async function listAvailableSCSites() {
  const token = await getAccessToken(false);
  const sites = await listSearchConsoleSites(token);
  return { sites };
}

async function listAvailableGMBAccounts() {
  const token = await getAccessToken(false);
  const accounts = await listBusinessAccounts(token);
  const allLocations = [];
  for (const account of accounts) {
    try {
      const locs = await listLocations(account.name, token);
      allLocations.push(...locs.map(l => ({ ...l, accountName: account.accountName })));
    } catch (e) {
      console.warn('Could not fetch locations for account:', account.name, e.message);
    }
  }
  return { accounts, locations: allLocations };
}

// ── Alarms & Notifications ───────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === REFRESH_ALARM) {
    try {
      const { isSignedIn } = await chrome.storage.local.get('isSignedIn');
      const settings = await getSettings();
      if (isSignedIn && settings.ga4PropertyId) {
        const result = await fetchAllData(true);
        const criticalIssues = (result.issues || []).filter(i => i.severity === 'critical');

        if (criticalIssues.length > 0) {
          chrome.notifications.create('critical-issues', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Growth Coach Alert',
            message: `${criticalIssues.length} critical issue${criticalIssues.length > 1 ? 's' : ''} detected: ${criticalIssues[0].title}`,
            priority: 2,
          });
        }
      }
    } catch (e) {
      console.error('[AI Growth Coach] Alarm refresh error:', e);
    }
  }
});

// Set up periodic refresh alarm on install
chrome.runtime.onInstalled.addListener(scheduleRefreshAlarm);

// Resume alarm on startup
chrome.runtime.onStartup.addListener(scheduleRefreshAlarm);

function scheduleRefreshAlarm() {
  chrome.alarms.create(REFRESH_ALARM, {
    delayInMinutes: 30,
    periodInMinutes: 30,
  });
}
