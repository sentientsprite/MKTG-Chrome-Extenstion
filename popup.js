/**
 * AI Growth Coach — Popup Script
 * Orchestrates the popup UI, data display, and user interactions
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

function showScreen(id) {
  ['signin-screen', 'setup-screen', 'loading-screen', 'main-screen'].forEach(sid => {
    document.getElementById(sid).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
}

function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

function formatPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

function formatChange(pct, invertBetter = false) {
  if (pct === null || pct === undefined || isNaN(pct)) return { text: '—', cls: 'neutral' };
  const sign = pct >= 0 ? '+' : '';
  const text = `${sign}${pct.toFixed(1)}%`;
  let isGood = pct >= 0;
  if (invertBetter) isGood = pct <= 0; // e.g. bounce rate — lower is better
  const cls = Math.abs(pct) < 1 ? 'neutral' : isGood ? 'up' : 'down';
  return { text, cls };
}

function setMetric(valueId, changeId, value, changePct, opts = {}) {
  const valEl = document.getElementById(valueId);
  const chgEl = document.getElementById(changeId);
  if (valEl) valEl.textContent = value;
  if (chgEl && changePct !== undefined) {
    const { text, cls } = formatChange(changePct, opts.invertBetter);
    chgEl.textContent = text + ' vs prev period';
    chgEl.className = `metric-change ${cls}`;
  }
}

function showError(msg, duration = 5000) {
  const toast = document.getElementById('error-toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

function setLoadingMessage(msg) {
  const el = document.getElementById('loading-message');
  if (el) el.textContent = msg;
}

function showDemoBanner() {
  if (document.getElementById('demo-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  banner.className = 'demo-banner';
  banner.textContent = 'Demo mode — sample data for screenshots. Disable in Settings.';
  document.getElementById('app')?.insertBefore(banner, document.querySelector('.header'));
}

function showOAuthWarning() {
  const note = document.querySelector('.signin-note');
  if (note) {
    note.innerHTML =
      'OAuth is not configured yet. Add your Client ID to <code>manifest.json</code> — see <a href="https://github.com/sentientsprite/MKTG-Chrome-Extenstion/blob/main/docs/OAUTH_SETUP.md" target="_blank">setup guide</a>. Or enable Demo mode in Settings.';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  showScreen('loading-screen');
  setLoadingMessage('Checking authentication...');

  try {
    const settings = await sendMessage('GET_SETTINGS');

    if (settings?.demoMode) {
      const emailEl = document.getElementById('user-email');
      if (emailEl) emailEl.textContent = 'Demo — Main Street Bakery';
      showDemoBanner();
      showScreen('main-screen');
      await loadData();
      return;
    }

    const { isSignedIn, user, oauthConfigured } = await sendMessage('GET_AUTH_STATUS');
    if (!isSignedIn) {
      if (oauthConfigured === false) showOAuthWarning();
      showScreen('signin-screen');
      return;
    }

    // Show user email
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user?.email || user?.name || 'Signed in';

    // Check if data sources are configured
    const hasConfig = settings?.ga4PropertyId || settings?.searchConsoleSite;

    if (!hasConfig) {
      showScreen('setup-screen');
      return;
    }

    showScreen('main-screen');
    await loadData();
  } catch (err) {
    console.error('Init error:', err);
    showScreen('signin-screen');
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadData(forceRefresh = false) {
  setLoadingMessage('Fetching your data...');

  try {
    const result = await sendMessage('FETCH_ALL_DATA', { forceRefresh });
    const { data, issues, errors } = result;

    // Show last updated time
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    renderDashboard(data, errors);
    renderIssues(issues || []);

    // Check AI key setting and show appropriate UI
    const settings = await sendMessage('GET_SETTINGS');
    if (settings?.openAiApiKey || settings?.demoMode) {
      document.getElementById('no-ai-prompt')?.classList.add('hidden');
      document.getElementById('coach-content')?.classList.remove('hidden');
    } else {
      document.getElementById('no-ai-prompt')?.classList.remove('hidden');
      document.getElementById('coach-content')?.classList.add('hidden');
    }
  } catch (err) {
    showError(`Failed to load data: ${err.message}`);
  }
}

// ── Dashboard rendering ───────────────────────────────────────────────────────

function renderDashboard(data, errors = {}) {
  if (!data) return;

  let hasAnyData = false;

  // Analytics
  if (data.analytics?.overview) {
    hasAnyData = true;
    const { current, changes } = data.analytics.overview;
    setMetric('val-sessions', 'chg-sessions', formatNumber(current.sessions), changes.sessions);
    setMetric('val-users', 'chg-users', formatNumber(current.users), changes.users);
    setMetric('val-bounce', 'chg-bounce', formatPct(current.bounceRate), changes.bounceRate, { invertBetter: true });
    setMetric('val-conversions', 'chg-conversions', formatNumber(current.conversions), changes.conversions);
  } else if (errors.analytics) {
    console.warn('Analytics error:', errors.analytics);
  }

  // Search Console
  if (data.searchConsole?.summary) {
    hasAnyData = true;
    const { current, changes } = data.searchConsole.summary;
    setMetric('val-clicks', 'chg-clicks', formatNumber(current.clicks), changes.clicks);
    setMetric('val-impressions', 'chg-impressions', formatNumber(current.impressions), changes.impressions);
    setMetric('val-ctr', 'chg-ctr', formatPct(current.ctr), changes.ctr);
    setMetric('val-position', 'chg-position', current.position?.toFixed(1) || '—', changes.position, { invertBetter: true });
  }

  // Google Ads
  if (data.ads?.summary) {
    hasAnyData = true;
    const s = data.ads.summary;
    document.getElementById('ads-section-label').style.display = '';
    document.getElementById('card-spend').classList.remove('hidden');
    document.getElementById('card-ad-conversions').classList.remove('hidden');
    document.getElementById('card-cpa').classList.remove('hidden');

    document.getElementById('val-spend').textContent = `$${s.totalSpend?.toFixed(0) || '0'}`;
    document.getElementById('val-ad-conversions').textContent = formatNumber(s.conversions);
    document.getElementById('val-cpa').textContent = s.costPerConversion > 0 ? `$${s.costPerConversion.toFixed(2)}` : '—';
  }

  // GMB
  if (data.gmb) {
    hasAnyData = true;
    document.getElementById('gmb-section-label').style.display = '';
    document.getElementById('card-rating').classList.remove('hidden');
    document.getElementById('card-reviews').classList.remove('hidden');
    document.getElementById('card-gmb-clicks').classList.remove('hidden');

    if (data.gmb.reviewStats) {
      document.getElementById('val-rating').textContent = data.gmb.reviewStats.averageRating?.toFixed(1) + ' ⭐';
      document.getElementById('val-reviews').textContent = formatNumber(data.gmb.reviewStats.total);
    }

    if (data.gmb.performance?.totals) {
      const t = data.gmb.performance.totals;
      document.getElementById('val-gmb-clicks').textContent = formatNumber(t.WEBSITE_CLICKS || 0);
    }
  }

  // Channels
  if (data.analytics?.channels?.length) {
    renderChannels(data.analytics.channels);
    document.getElementById('section-channels').style.display = '';
  }

  // Search queries
  if (data.searchConsole?.queries?.length) {
    renderQueries(data.searchConsole.queries);
    document.getElementById('section-queries').style.display = '';
  }

  // No-data prompt
  const noDataEl = document.getElementById('no-data-prompt');
  if (noDataEl) noDataEl.classList.toggle('hidden', hasAnyData);
}

function renderChannels(channels) {
  const container = document.getElementById('channels-list');
  if (!container) return;

  const maxSessions = Math.max(...channels.map(c => c.sessions), 1);
  container.innerHTML = channels.slice(0, 6).map(ch => {
    const pct = (ch.sessions / maxSessions) * 100;
    return `
      <div class="channel-row">
        <span class="channel-name">${escapeHtml(ch.channel)}</span>
        <div class="channel-bar-wrap">
          <div class="channel-bar" style="width:${pct}%"></div>
        </div>
        <span class="channel-value">${formatNumber(ch.sessions)}</span>
      </div>`;
  }).join('');
}

function renderQueries(queries) {
  const container = document.getElementById('queries-list');
  if (!container) return;

  container.innerHTML = queries.slice(0, 8).map(q => `
    <div class="query-row">
      <span class="query-text" title="${escapeHtml(q.keys[0])}">${escapeHtml(q.keys[0])}</span>
      <span class="query-clicks">${formatNumber(q.clicks)} clicks · pos ${q.position?.toFixed(0)}</span>
    </div>`).join('');
}

// ── Issues rendering ──────────────────────────────────────────────────────────

function renderIssues(issues) {
  const container = document.getElementById('issues-list');
  const badge = document.getElementById('issue-badge');

  if (!container) return;

  const criticalCount = issues.filter(i => i.severity === 'critical' || i.severity === 'warning').length;
  if (badge) {
    badge.textContent = criticalCount;
    badge.classList.toggle('hidden', criticalCount === 0);
  }

  if (!issues.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No issues detected. Your marketing looks healthy!</p>
      </div>`;
    return;
  }

  container.innerHTML = issues.map(issue => `
    <div class="issue-card ${issue.severity}">
      <div class="issue-header">
        <span class="issue-badge ${issue.severity}">${issue.severity}</span>
        <span class="issue-title">${escapeHtml(issue.title)}</span>
      </div>
      <p class="issue-desc">${escapeHtml(issue.description)}</p>
      ${issue.actions?.length ? `
        <ul class="issue-actions">
          ${issue.actions.slice(0, 3).map(a => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>` : ''}
    </div>`).join('');
}

// ── AI Coach ──────────────────────────────────────────────────────────────────

async function loadAIAdvice(forceRefresh = false) {
  const container = document.getElementById('advice-content');
  if (!container) return;

  container.innerHTML = '<div class="loading-content" style="padding:16px"><div class="spinner"></div></div>';

  try {
    const { advice, error, fromCache } = await sendMessage('GET_AI_ADVICE', { forceRefresh });
    if (error) {
      container.innerHTML = `<div class="advice-placeholder"><p style="color:var(--color-text-muted)">${escapeHtml(error)}</p><a href="options.html" target="_blank" class="btn-secondary">Open Settings →</a></div>`;
      return;
    }
    container.textContent = advice || 'No advice generated.';
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-critical)">${escapeHtml(err.message)}</p>`;
  }
}

async function askCoach() {
  const input = document.getElementById('coach-question');
  const responseEl = document.getElementById('ask-response');
  const question = input?.value?.trim();

  if (!question || !responseEl) return;

  responseEl.classList.remove('hidden');
  responseEl.textContent = 'Thinking...';

  try {
    const { answer } = await sendMessage('ASK_COACH', { question });
    responseEl.textContent = answer;
    if (input) input.value = '';
  } catch (err) {
    responseEl.textContent = `Error: ${err.message}`;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Sign-in button
  document.getElementById('btn-signin')?.addEventListener('click', async () => {
    showScreen('loading-screen');
    setLoadingMessage('Signing in...');
    try {
      await sendMessage('SIGN_IN');
      await init();
    } catch (err) {
      showScreen('signin-screen');
      showError(`Sign-in failed: ${err.message}`);
    }
  });

  // Refresh button
  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
    try {
      await loadData(true);
    } finally {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  });

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  // AI Advice button
  document.getElementById('btn-get-advice')?.addEventListener('click', () => loadAIAdvice());
  document.getElementById('btn-refresh-advice')?.addEventListener('click', () => loadAIAdvice(true));

  // Ask the Coach
  document.getElementById('btn-ask')?.addEventListener('click', askCoach);
  document.getElementById('coach-question')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') askCoach();
  });

  // Initialize
  init();
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
