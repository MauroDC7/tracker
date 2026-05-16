/**
 * MV3 service worker — pushes metadata for the focused window's active tab only.
 * Ignores incognito, inactive tabs, and non-http(s) URLs (e.g. chrome://, extension://).
 */
const LOCAL_ENDPOINT = 'http://127.0.0.1:3210/browser-event';

async function reportActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab || tab.incognito) return;
    const url = tab.url || '';
    if (!/^https?:\/\//i.test(url)) return;

    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = '';
    }

    const payload = {
      url,
      title: tab.title || '',
      domain,
      is_incognito: !!tab.incognito,
      observed_at: new Date().toISOString(),
    };

    await fetch(LOCAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
    });
  } catch {
    // Desktop agent may be offline; fail silently.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void reportActiveTab();
});

chrome.tabs.onActivated.addListener(() => {
  void reportActiveTab();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    void reportActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  void reportActiveTab();
});
