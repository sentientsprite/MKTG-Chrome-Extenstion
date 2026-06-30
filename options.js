/**
 * AI Growth Coach — Options / Settings Page Script
 */

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

// ── Field bindings ────────────────────────────────────────────────────────────

const FIELDS = [
  'businessName',
  'industry',
  'location',
  'avgOrderValue',
  'ga4PropertyId',
  'searchConsoleSite',
  'adsCustomerId',
  'adsDeveloperToken',
  'gmbLocationName',
  'openAiApiKey',
];

function getFormValues() {
  const values = {};
  for (const field of FIELDS) {
    const el = document.getElementById(field);
    if (el) values[field] = el.value.trim();
  }
  return values;
}

function setFormValues(settings) {
  for (const field of FIELDS) {
    const el = document.getElementById(field);
    if (el && settings[field] !== undefined) {
      el.value = settings[field];
    }
  }
}

// ── Auth UI ───────────────────────────────────────────────────────────────────

async function updateAuthUI() {
  const labelEl = document.getElementById('auth-label');
  const btnEl = document.getElementById('btn-auth');

  try {
    const { isSignedIn, user } = await sendMessage('GET_AUTH_STATUS');

    if (isSignedIn && user) {
      if (labelEl) labelEl.textContent = user.email || user.name || 'Signed in';
      if (btnEl) {
        btnEl.textContent = 'Sign Out';
        btnEl.className = 'btn-danger';
        btnEl.onclick = handleSignOut;
      }
    } else {
      if (labelEl) labelEl.textContent = 'Not signed in';
      if (btnEl) {
        btnEl.textContent = 'Sign In with Google';
        btnEl.className = 'btn-secondary';
        btnEl.onclick = handleSignIn;
      }
    }
  } catch {
    if (labelEl) labelEl.textContent = 'Not signed in';
  }
}

async function handleSignIn() {
  const btn = document.getElementById('btn-auth');
  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  try {
    await sendMessage('SIGN_IN');
    await updateAuthUI();
  } catch (err) {
    showStatus(`Sign-in failed: ${err.message}`, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleSignOut() {
  if (!confirm('Sign out and clear all cached data?')) return;
  try {
    await sendMessage('SIGN_OUT');
    await updateAuthUI();
    showStatus('Signed out successfully.');
  } catch (err) {
    showStatus(`Error: ${err.message}`, true);
  }
}

// ── Discover helpers ──────────────────────────────────────────────────────────

async function discoverGA4Properties() {
  const btn = document.getElementById('btn-discover-ga4');
  const picker = document.getElementById('ga4-picker');
  const list = document.getElementById('ga4-list');

  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const { properties } = await sendMessage('LIST_GA4_PROPERTIES');
    if (!properties?.length) {
      showStatus('No GA4 properties found for this account.', true);
      return;
    }

    list.innerHTML = properties.map(p => `
      <div class="picker-item" data-id="${escapeAttr(p.id)}">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${escapeHtml(p.accountName)} · ID: ${escapeHtml(p.id)}</span>
      </div>`).join('');

    list.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('ga4PropertyId').value = item.dataset.id;
        picker.classList.add('hidden');
      });
    });

    picker.classList.remove('hidden');
  } catch (err) {
    showStatus(`Failed to discover GA4 properties: ${err.message}`, true);
  } finally {
    btn.textContent = 'Discover';
    btn.disabled = false;
  }
}

async function discoverSCSites() {
  const btn = document.getElementById('btn-discover-sc');
  const picker = document.getElementById('sc-picker');
  const list = document.getElementById('sc-list');

  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const { sites } = await sendMessage('LIST_SC_SITES');
    if (!sites?.length) {
      showStatus('No Search Console sites found for this account.', true);
      return;
    }

    list.innerHTML = sites.map(s => `
      <div class="picker-item" data-url="${escapeAttr(s.url)}">
        <strong>${escapeHtml(s.url)}</strong>
        <span>Permission: ${escapeHtml(s.permissionLevel)}</span>
      </div>`).join('');

    list.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('searchConsoleSite').value = item.dataset.url;
        picker.classList.add('hidden');
      });
    });

    picker.classList.remove('hidden');
  } catch (err) {
    showStatus(`Failed to discover Search Console sites: ${err.message}`, true);
  } finally {
    btn.textContent = 'Discover';
    btn.disabled = false;
  }
}

async function discoverGMBLocations() {
  const btn = document.getElementById('btn-discover-gmb');
  const picker = document.getElementById('gmb-picker');
  const list = document.getElementById('gmb-list');

  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const { locations } = await sendMessage('LIST_GMB_ACCOUNTS');
    if (!locations?.length) {
      showStatus('No Google Business Profile locations found.', true);
      return;
    }

    list.innerHTML = locations.map(l => `
      <div class="picker-item" data-name="${escapeAttr(l.name)}">
        <strong>${escapeHtml(l.title)}</strong>
        <span>${escapeHtml(l.address || l.accountName)}</span>
      </div>`).join('');

    list.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('gmbLocationName').value = item.dataset.name;
        picker.classList.add('hidden');
      });
    });

    picker.classList.remove('hidden');
  } catch (err) {
    showStatus(`Failed to discover GMB locations: ${err.message}`, true);
  } finally {
    btn.textContent = 'Discover';
    btn.disabled = false;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveSettings() {
  const settings = getFormValues();

  // Normalize ads customer ID (strip dashes)
  if (settings.adsCustomerId) {
    settings.adsCustomerId = settings.adsCustomerId.replace(/-/g, '');
  }

  // Parse average order value as a number
  if (settings.avgOrderValue) {
    const parsed = parseFloat(settings.avgOrderValue);
    settings.avgOrderValue = isNaN(parsed) ? undefined : parsed;
  }

  const btn = document.getElementById('btn-save');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  try {
    await sendMessage('SAVE_SETTINGS', { settings });
    showStatus('✓ Settings saved successfully!');
  } catch (err) {
    showStatus(`Failed to save: ${err.message}`, true);
  } finally {
    btn.textContent = 'Save Settings';
    btn.disabled = false;
  }
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'save-status error' : 'save-status';
  setTimeout(() => { el.textContent = ''; }, 4000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await updateAuthUI();

  try {
    const settings = await sendMessage('GET_SETTINGS');
    setFormValues(settings);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Wire up discover buttons
  document.getElementById('btn-discover-ga4')?.addEventListener('click', discoverGA4Properties);
  document.getElementById('btn-discover-sc')?.addEventListener('click', discoverSCSites);
  document.getElementById('btn-discover-gmb')?.addEventListener('click', discoverGMBLocations);

  // Save button
  document.getElementById('btn-save')?.addEventListener('click', saveSettings);

  // Sign-out button (in settings page bottom)
  document.getElementById('btn-signout')?.addEventListener('click', handleSignOut);

  // Auth button default handler
  document.getElementById('btn-auth')?.addEventListener('click', handleSignIn);
}

document.addEventListener('DOMContentLoaded', init);

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
