// CLV Debug Logging Helper
// This file adds comprehensive logging to diagnose CLV issues
// Import this in manifest.json background scripts

(function() {
  try {
    console.log('🐛 [CLV DEBUG] Debug logging module loaded');

    // Use local reference to avoid conflicts
    const localApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : {});

    // Intercept fetch calls to log CLV API requests
    // Use self.fetch for compatibility with service workers
    const originalFetch = self.fetch;
    self.fetch = async function(...args) {
  const url = args[0];
  const options = args[1] || {};
  
  // Log CLV-related fetches (CSV & The Odds API)
  if (typeof url === 'string' && (url.includes('127.0.0.1:8765') || url.includes('football-data.co.uk') || url.includes('api.the-odds-api.com'))) {
    console.log('🐛 [CLV DEBUG] FETCH INTERCEPTED:', {
      url: url,
      method: options.method || 'GET',
      headers: options.headers,
      bodyPreview: options.body ? options.body.substring(0, 200) + '...' : null
    });
    
    try {
      const response = await originalFetch.apply(this, args);
      console.log('🐛 [CLV DEBUG] FETCH RESPONSE:', {
        url: url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries([...response.headers.entries()])
      });
      
      // Clone response to read body without consuming it
      const clone = response.clone();
      try {
        const text = await clone.text();
        console.log('🐛 [CLV DEBUG] RESPONSE BODY:', text.substring(0, 500));
      } catch (e) {
        console.log('🐛 [CLV DEBUG] Could not read response body:', e.message);
      }
      
      return response;
    } catch (error) {
      console.error('🐛 [CLV DEBUG] FETCH ERROR:', {
        url: url,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        errorConstructor: error.constructor.name,
        errorToString: error.toString(),
        rawError: error
      });
      throw error;
    }
  }
  
  // Non-CLV fetch, pass through
  return originalFetch.apply(this, args);
};

// Intercept chrome.runtime.sendMessage to log CLV messages
const originalSendMessage = localApi.runtime.sendMessage;
localApi.runtime.sendMessage = function(...args) {
  const message = args[0];
  
  if (message && (message.action === 'forceClvCheck' || message.action === 'forcePropsPoll')) {
    console.log('🐛 [CLV DEBUG] SEND MESSAGE:', {
      action: message.action,
      fullMessage: message,
      argsCount: args.length
    });
    
    // Wrap callback to log response
    const originalCallback = args[args.length - 1];
    if (typeof originalCallback === 'function') {
      args[args.length - 1] = function(response) {
        console.log('🐛 [CLV DEBUG] MESSAGE RESPONSE:', {
          action: message.action,
          response: response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : null,
          success: response?.success,
          error: response?.error
        });
        return originalCallback.apply(this, arguments);
      };
    }
  }
  
  return originalSendMessage.apply(this, args);
};

// Log incoming messages without interfering
localApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && (message.action === 'forceClvCheck' || message.action === 'forcePropsPoll')) {
    console.log('🐛 [CLV DEBUG] ON MESSAGE RECEIVED:', {
      action: message.action,
      sender: sender?.tab?.id || 'extension',
      message: message
    });
  }
  // Don't return anything - let other listeners handle it
});

console.log('🐛 [CLV DEBUG] Interceptors installed for fetch and sendMessage');
console.log('🐛 [CLV DEBUG] All CLV-related calls will be logged with 🐛 prefix');
console.log('🐛 [CLV DEBUG] Ready to debug! Click "Force Check Now" and watch the console.');

  } catch (error) {
    console.error('🐛 [CLV DEBUG] Failed to initialize debug logging:', error);
    console.error('🐛 [CLV DEBUG] Stack:', error.stack);
    // Don't throw - allow other scripts to load
  }
})();
