// Service worker handles export/download requests
self.addEventListener('install', () => {
  // no-op
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;
  if (message.action === 'export') {
    const { dataStr, filename, mime } = message;
    try {
      // Create blob URL and download it
      const blob = new Blob([dataStr], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename }, (downloadId) => {
        // Revoke after a few seconds
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
        sendResponse({ success: true, downloadId });
      });
      // Indicate we'll call sendResponse asynchronously
      return true;
    } catch (err) {
      console.error('Export error', err);
      sendResponse({ success: false, error: err && err.message });
    }
  } else if (message.action === 'clearBets') {
    chrome.storage.local.set({ bets: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
