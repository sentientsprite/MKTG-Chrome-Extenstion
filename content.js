/**
 * Content Script
 * Runs on Google Analytics, Ads, Search Console, and Business Profile pages.
 * Provides a floating "Open AI Growth Coach" button to quickly access insights.
 */

(function () {
  'use strict';

  // Avoid double-injection
  if (document.getElementById('ai-growth-coach-fab')) return;

  // Create floating action button
  const fab = document.createElement('button');
  fab.id = 'ai-growth-coach-fab';
  fab.title = 'Open AI Growth Coach';
  fab.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16">
      <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
    </svg>
    <span>Growth Coach</span>
  `;

  Object.assign(fab.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '24px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
    zIndex: '999999',
    transition: 'transform 0.15s, box-shadow 0.15s',
  });

  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'scale(1.05)';
    fab.style.boxShadow = '0 6px 18px rgba(34, 197, 94, 0.5)';
  });

  fab.addEventListener('mouseleave', () => {
    fab.style.transform = '';
    fab.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
  });

  fab.addEventListener('click', () => {
    // Open the extension popup programmatically isn't possible via content scripts,
    // so we open the options page instead with a message to focus on dashboard
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });

  document.body.appendChild(fab);

  // Listen for data change notifications
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ISSUES_DETECTED' && message.count > 0) {
      showNotificationBadge(fab, message.count);
    }
  });

  function showNotificationBadge(button, count) {
    const existing = document.getElementById('ai-growth-coach-badge');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.id = 'ai-growth-coach-badge';
    badge.textContent = count;
    Object.assign(badge.style, {
      position: 'absolute',
      top: '-6px',
      right: '-6px',
      width: '18px',
      height: '18px',
      background: '#ef4444',
      color: '#fff',
      borderRadius: '50%',
      fontSize: '10px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: '1',
    });

    button.style.position = 'relative';
    button.appendChild(badge);
  }
})();
