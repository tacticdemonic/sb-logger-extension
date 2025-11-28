// Surebet Helper - Content Script for surebet.com valuebets
(
function () {
  if (window.__surebetHelperInjected) return;
  window.__surebetHelperInjected = true;

  const DISABLE_STORAGE_KEY = 'extensionDisabled';
  let isInitialized = false;
  let isDisabled = false;
  let mutationObserver = null;
  
  // Cache for retrieved bet data to prevent multiple consumers from triggering double-clears
  let cachedPendingBet = null;
  let cachedPendingBetPromise = null;
  
  // Debug Logger for auto-fill diagnostics
  class BetDebugLogger {
    constructor() {
      this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      this.logs = [];
      this.exchange = this.detectExchange();
    }
    
    detectExchange() {
      const hostname = location.hostname.toLowerCase();
      if (hostname.includes('betfair')) return 'betfair';
      if (hostname.includes('smarkets')) return 'smarkets';
      if (hostname.includes('matchbook')) return 'matchbook';
      if (hostname.includes('betdaq')) return 'betdaq';
      return 'unknown';
    }
    
    log(component, message, data = {}, level = 'info') {
      const entry = {
        ts: new Date().toISOString(),
        sessionId: this.sessionId,
        component,
        level,
        msg: message,
        data,
        url: location.href,
        exchange: this.exchange
      };
      this.logs.push(entry);
      const prefix = `Surebet Helper [${component}]:`;
      if (level === 'error') console.error(prefix, message, data);
      else if (level === 'warn') console.warn(prefix, message, data);
      else console.log(prefix, message, data);
      return entry;
    }
    
    getLogs() {
      return this.logs;
    }
    
    attachToBet(bet) {
      if (!bet.debugLogs) bet.debugLogs = [];
      bet.debugLogs.push(...this.logs);
      return bet;
    }
  }
  
  let debugLogger = new BetDebugLogger();
  
  // Utility to filter debug logs to last 24 hours
  function filterLogsLast24Hours(logs) {
    if (!Array.isArray(logs)) return [];
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return logs.filter(log => {
      try {
        return new Date(log.ts) >= cutoffTime;
      } catch {
        return false;
      }
    });
  }
  
  const clickHandlers = {
    surebetLink: null,
    global: null
  };
  const DEFAULT_STAKING_SETTINGS = {
    bankroll: 1000,
    baseBankroll: 1000,
    fraction: 0.25,
    useCommission: true,
    customCommissionRates: {},
    adjustForPending: false,
    maxBetPercent: null,
    effectiveBankroll: null
  };
  
  const DEFAULT_COMMISSION_RATES = {
    'betfair': 0.05,
    'smarkets': 0.02,
    'matchbook': 0.01,
    'betdaq': 0.025
  };

  const DEFAULT_ROUNDING_SETTINGS = {
    enabled: false,
    increment: null
  };
  
  const DEFAULT_UI_PREFERENCES = {
    hideLayBets: false
  };
  
  const DEFAULT_AUTOFILL_SETTINGS = {
    enabled: false,
    bookmakers: {
      betfair: true,
      matchbook: true,
      smarkets: true,
      betdaq: true
    },
    timeout: 10000,
    requireConfirmation: false
  };

  const DEFAULT_ACTIONS_SETTINGS = {
    skipStakePrompt: false,
    skipDeleteConfirmation: false,
    skipOddsPrompt: false,
    skipMarketPrompt: false,
    dustbinActionAfterSave: 'none' // 'none' | 'hide-valuebet' | 'hide-event'
  };

  // Betting slip selectors for each exchange/betting site
  // 
  // HOW TO ADD A NEW BETTING SITE:
  // ==============================
  // 1. Use the DOM collector tool (popup.html "Contribute" button) on the target site
  //    to capture the betting slip structure when a bet is in the slip
  // 
  // 2. Add entry to BETTING_SLIP_SELECTORS below with:
  //    - bettingSlip: Array of selectors to find the betting slip container
  //    - stakeInput: Array of selectors to find the stake input field (most specific first)
  //    - odds: Array of selectors to find odds display/input (for validation)
  //    - selection: Selector to find selection name (for validation)
  //    - backBet/layBet: Optional selectors for back/lay specific containers
  //
  // 3. Add to SUPPORTED_SITES (near getExchangeFromHostname) with:
  //    - hostnames: Array of hostname patterns to match
  //    - displayName: Human-readable name
  //    - asyncLoading: true if site loads betting slip content asynchronously
  //
  // 4. Add to DEFAULT_AUTOFILL_SETTINGS.bookmakers above (set to true)
  //
  // 5. Add commission rate to DEFAULT_COMMISSION_RATES above
  //
  // 6. Update settings.html: Add checkbox in autofill-section
  //
  // 7. Update settings.js:
  //    - Add to DEFAULT_AUTOFILL_SETTINGS.bookmakers
  //    - Add checkbox load handler in loadAllSettings()
  //    - Add checkbox save handler in save-autofill-btn click handler
  //
  // TIPS:
  // - Selectors are tried in order, put most specific/reliable first
  // - Use .class1.class2 for elements with multiple classes
  // - Test with logged-in AND logged-out states (DOM may differ)
  // - Check if site uses SPA (React/Vue/Angular) - may need asyncLoading: true
  //
  const BETTING_SLIP_SELECTORS = {
    betfair: {
      bettingSlip: [
        // New Betfair Exchange layout (2024+)
        '[data-testid="betslip-container"]',
        '[class*="BetslipContainer"]',
        '[class*="betslip-container"]',
        // Legacy selectors
        '[class*="betslip"]',
        '[class*="bet-slip"]',
        '[data-testid*="betslip"]',
        '#betslip',
        // Mobile/responsive variants
        '[class*="BetSlip"]'
      ],
      stakeInput: [
        // New Betfair Exchange layout (2024+) - most specific first
        '[data-testid="betslip-stake-input"] input',
        '[data-testid="stake-input"]',
        'input[data-testid*="stake"]',
        // Legacy Angular selectors
        'input.betslip-size-input[ng-model*="size"]',
        'input[bf-number-restrict]',
        'input.betslip-size-input',
        // Generic fallbacks
        'input[name="stake"]',
        'input[placeholder*="stake" i]',
        'input[aria-label*="stake" i]',
        // React component selectors
        '[class*="StakeInput"] input',
        '[class*="stake-input"] input'
      ],
      backBet: '[data-side="back"], [class*="back-bet"], [data-testid*="back"]',
      layBet: '[data-side="lay"], [class*="lay-bet"], [data-testid*="lay"]',
      odds: '[class*="odds"], [class*="price"], [data-testid*="odds"], [class*="Price"]',
      selection: '[class*="selection"], [class*="leg"], [class*="Selection"], [class*="runner-name"]'
    },
    smarkets: {
      bettingSlip: [
        // Primary Smarkets containers (checked Nov 2025)
        '.bet-slip-container',
        '.bet-slip-content',
        '.bet-slip-bets-container',
        // Alternative React component names
        '[class*="betSlip"]',
        '[class*="BetSlip"]',
        '[data-testid*="bet-slip"]',
        // Sidebar container (fallback)
        '[class*="right-sidebar"]',
        '[class*="RightSidebar"]'
      ],
      stakeInput: [
        // Primary Smarkets stake selectors (checked Nov 2025)
        '.bet-slip-container input.box-input.numeric-value.input-value.with-prefix',
        '.bet-slip-container input.box-input.numeric-value.input-value:not([disabled])',
        // Broader match without container scope (for DOM changes)
        'input.box-input.numeric-value.input-value.with-prefix',
        'input.box-input.numeric-value.input-value:not([disabled])',
        // Generic class match
        'input[type="text"].box-input.numeric-value.with-prefix',
        'input.box-input.numeric-value:not([disabled])',
        // React-based selectors (alternative names)
        '[class*="stake-input"] input',
        '[class*="StakeInput"] input',
        // Placeholder-based fallback
        'input[placeholder*="stake" i]',
        'input[placeholder*="£"]',
        'input[placeholder*="€"]'
      ],
      odds: '[class*="odds"], [class*="price"], [class*="Odds"], [class*="Price"]',
      selection: '[class*="selection"], [class*="Selection"], [class*="event-name"]'
    },
    matchbook: {
      bettingSlip: [
        // Primary Matchbook selectors
        '.Betslip-module__betslip',
        '[class*="Betslip-module"]',
        '[data-hook*="betslip"]',
        '.Offers-module__offers',
        '[class*="RightSidebar"]',
        // Alternative React class names
        '[class*="betslip"]',
        '[class*="Betslip"]'
      ],
      stakeInput: [
        // Primary Matchbook stake selectors
        'input[data-hook^="betslip-stake-"]',
        'input[data-hook*="stake"]',
        'input[name="backInput"][class*="OfferEdit-module__betslipInput"]',
        'input[class*="OfferEdit-module__betslipInput"]',
        // Fallback generic selectors
        'input[placeholder*="stake" i]',
        'input[aria-label*="stake" i]',
        '[class*="StakeInput"] input'
      ],
      odds: [
        'input[data-hook^="betslip-back-"]',
        'input[data-hook*="odds"]',
        'input[name="oddsInput"][class*="OfferEdit-module__betslipInput"]',
        'input[class*="odds"], [class*="price"]'
      ],
      selection: '[class*="selection"], [class*="Selection"], [class*="runner"]'
    },
    betdaq: {
      bettingSlip: [
        // Primary Betdaq selectors (checked Nov 2025)
        '.betslip-container',
        '.betslip-common-wrapper',
        '.betslip3',
        '#betslip',
        // Alternative class patterns
        '[class*="betslip"]',
        '[class*="Betslip"]',
        // Angular component wrapper
        'betslip-component'
      ],
      stakeInput: [
        // Back bet stake inputs (most specific first)
        '.back.polarity input.input.stake',
        '.back.polarity input.stake',
        // Container-scoped selectors
        '.betslip-container input.input.stake',
        '.betslip-common-wrapper input.input.stake',
        '.betslip3 input.input.stake',
        '#betslip input.input.stake',
        // Generic stake input (fallback)
        'input.input.stake',
        'input.stake:not([disabled])',
        // Placeholder-based fallback
        'input[placeholder*="stake" i]'
      ],
      odds: [
        '.back.polarity input.input.odds',
        '.back.polarity input.odds',
        '.betslip-container input.input.odds',
        '.betslip-common-wrapper input.input.odds',
        '.betslip3 input.input.odds',
        '#betslip input.input.odds',
        'input.input.odds',
        'input.odds:not([disabled])'
      ],
      selection: '.selname, .event-name, [class*="selection"], [class*="runner"]'
    }
  };
  
  let stakingSettings = { ...DEFAULT_STAKING_SETTINGS };
  let roundingSettings = { ...DEFAULT_ROUNDING_SETTINGS };
  let uiPreferences = { ...DEFAULT_UI_PREFERENCES };
  let autoFillSettings = { ...DEFAULT_AUTOFILL_SETTINGS };
  let defaultActionsSettings = { ...DEFAULT_ACTIONS_SETTINGS };
  let stakePanel = null;
  let recalculateDebounceTimer = null;
  let bettingSlipDetector = null;
  let bettingSlipDetectorPolling = null;

  function generateBetUid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `surebet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // Run on surebet.com valuebets page OR any bookmaker site (not Surebet)
  console.log('Surebet Helper: Script loaded on:', location.hostname, location.pathname);
  
  const isSurebetValuebets = location.hostname.includes('surebet.com') && location.pathname.includes('valuebets');
  const isBookmakerSite = !location.hostname.includes('surebet.com');
  
  if (!isSurebetValuebets && !isBookmakerSite) {
    console.log('Surebet Helper: Not on supported page, exiting');
    return;
  }
  
  console.log('Surebet Helper: ✓ On supported page, continuing initialization');
  
  // Determine which site we're on
  const onBookmakerSite = isBookmakerSite;

  // Bookmaker preset configurations
  // Note: To select only the main version without country codes, just use "Betfair"
  // To select a specific country version, use "Betfair (AU)", "Betfair (BR)", etc.
  const BOOKMAKER_PRESETS = {
    normal: [
      '10Bet', '888sport', 'Bet365', 'Betfair', 'Betway', 
      'Bwin', 'Ladbrokes', 'Paddy Power', 
      'Unibet', 'BetVictor', 'Betfred'
    ],
    exchanges: [
      'Betfair', 'Betdaq', 'Smarkets', 'Matchbook'
    ]
  };

  const CSS = `
    .surebet-helper-save-btn {
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      margin-left: 4px;
      transition: background 0.2s;
    }
    .surebet-helper-save-btn:hover {
      background: #218838;
    }
    .surebet-helper-save-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }
    #surebet-helper-toast-container {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 999999;
      pointer-events: none;
    }
    .surebet-helper-toast {
      background: #28a745;
      color: #fff;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: surebetToastSlideIn 0.3s ease;
      pointer-events: auto;
    }
    .surebet-helper-toast.error {
      background: #dc3545;
    }
    .surebet-helper-toast.warning {
      background: #ffc107;
      color: #000;
    }
    @keyframes surebetToastSlideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes surebetToastSlideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    .surebet-helper-preset-container {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .surebet-helper-preset-btn {
      background: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: 500;
      transition: all 0.2s;
      flex: 1;
    }
    .surebet-helper-preset-btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .surebet-helper-preset-btn.exchanges {
      background: #6f42c1;
    }
    .surebet-helper-preset-btn.exchanges:hover {
      background: #5a32a3;
    }
    .surebet-helper-high-stake {
      background-color: rgba(255, 215, 0, 0.15) !important;
      border-left: 4px solid #FFD700 !important;
    }
    .surebet-helper-high-stake:hover {
      background-color: rgba(255, 215, 0, 0.25) !important;
    }
    .surebet-helper-hide-lay-btn {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: #6f42c1;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.2s;
    }
    .surebet-helper-hide-lay-btn:hover {
      background: #5a32a3;
      transform: scale(1.05);
    }
    .surebet-helper-hide-lay-btn.active {
      background: #dc3545;
    }
    .surebet-helper-hide-lay-btn.active:hover {
      background: #c82333;
    }
    .surebet-helper-hidden-row {
      display: none !important;
    }
    .surebet-helper-stake-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 260px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(4px);
      border: 1px solid #ced4da;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #222;
      z-index: 2147483647 !important;
      padding: 12px 14px 14px;
    }
    .surebet-helper-stake-panel.collapsed {
      width: auto;
      padding: 8px 10px;
      cursor: pointer;
    }
    .surebet-helper-stake-panel.collapsed .surebet-helper-stake-form,
    .surebet-helper-stake-panel.collapsed .surebet-helper-stake-summary {
      display: none;
    }
    .surebet-helper-stake-panel.collapsed h3 {
      margin-bottom: 0;
    }
    .surebet-helper-stake-panel h3 {
      margin: 0 0 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #0c5460;
    }
    .surebet-helper-stake-header button {
      border: none;
      background: transparent;
      color: #0d6efd;
      font-size: 14px;
      cursor: pointer;
      padding: 0 2px;
    }
    .surebet-helper-stake-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }
    .surebet-helper-stake-form label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      color: #6c757d;
    }
    .surebet-helper-stake-form input {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 12px;
    }
    .surebet-helper-stake-actions {
      grid-column: span 2;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    .surebet-helper-stake-actions button {
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .surebet-helper-stake-save {
      background: #28a745;
      color: #fff;
    }
    .surebet-helper-stake-reset {
      background: #6c757d;
      color: #fff;
    }
    .surebet-helper-stake-summary {
      font-size: 11px;
      color: #495057;
      background: #f8f9fa;
      border: 1px dashed #ced4da;
      border-radius: 6px;
      padding: 8px;
      line-height: 1.4;
    }
    .surebet-helper-stake-summary strong {
      color: #0c5460 !important;
      font-weight: 700 !important;
      font-size: 12px !important;
    }
    .surebet-helper-stake-collapsed-text {
      display: none;
      font-size: 12px;
      font-weight: 600;
      color: #0c5460;
    }
    .surebet-helper-stake-panel.collapsed .surebet-helper-stake-collapsed-text {
      display: block;
    }
    .surebet-helper-stake-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      padding: 3px 8px;
      border-radius: 999px;
      background: #0d6efd;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .surebet-helper-stake-indicator span {
      font-weight: 400;
      font-size: 10px;
      opacity: 0.85;
    }
    .surebet-helper-stake-indicator.muted {
      background: #6c757d;
    }
    .surebet-helper-commission-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      font-size: 13px;
    }
    .surebet-helper-commission-toggle input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
    .surebet-helper-commission-toggle label {
      cursor: pointer;
      margin: 0;
    }
    .surebet-helper-stake-indicator[title] {
      cursor: help;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      max-width: 250px;
    }
    .surebet-helper-stake-indicator.kelly-full {
      background: #d4edda !important;
      color: #155724 !important;
    }
    .surebet-helper-stake-indicator.kelly-maxcap {
      background: #fff3cd !important;
      color: #856404 !important;
    }
    .surebet-helper-stake-indicator.kelly-liquidity {
      background: #ffe6a0 !important;
      color: #8b5900 !important;
    }
    .surebet-helper-stake-indicator.kelly-pending {
      background: #cfe2ff !important;
      color: #084298 !important;
    }
    .surebet-helper-stake-indicator.kelly-combined {
      background: #ffc9c9 !important;
      color: #921113 !important;
    }
  `;

  function injectStyles() {
    if (document.getElementById('surebet-helper-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'surebet-helper-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function sanitizeBankroll(value, fallback = DEFAULT_STAKING_SETTINGS.bankroll) {
    const parsed = parseFloat(value);
    if (!isFinite(parsed)) {
      return fallback;
    }
    if (parsed <= 0) {
      return Math.max(0, fallback);
    }
    return Math.min(parsed, 1000000);
  }

  function sanitizeFraction(value) {
    const parsed = parseFloat(value);
    if (!isFinite(parsed) || parsed <= 0) {
      return DEFAULT_STAKING_SETTINGS.fraction;
    }
    return Math.min(parsed, 1);
  }

  function recalculateEffectiveBankroll() {
    chrome.storage.local.get({ bets: [], stakingSettings: DEFAULT_STAKING_SETTINGS }, (res) => {
      const settings = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
      if (!settings.adjustForPending) {
        return;
      }
      
      const bets = res.bets || [];
      const pendingBets = bets.filter(b => !b.status || b.status === 'pending');
      const totalPendingStakes = pendingBets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
      const effectiveBankroll = Math.max(0, (settings.bankroll || 0) - totalPendingStakes);
      
      const updatedSettings = {
        ...settings,
        effectiveBankroll: effectiveBankroll
      };
      
      chrome.storage.local.set({ stakingSettings: updatedSettings }, () => {
        console.log('📊 [EffectiveBankroll] Recalculated:', {
          bankroll: settings.bankroll,
          pendingStakes: totalPendingStakes,
          effectiveBankroll: effectiveBankroll,
          pendingBets: pendingBets.length
        });
        stakingSettings = updatedSettings;
      });
    });
  }

  function debouncedRecalculateEffectiveBankroll() {
    if (recalculateDebounceTimer) {
      clearTimeout(recalculateDebounceTimer);
    }
    recalculateDebounceTimer = setTimeout(() => {
      recalculateEffectiveBankroll();
      recalculateDebounceTimer = null;
    }, 250);
  }

  function loadRoundingSettings() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        console.warn('⚠️ [Rounding] chrome.storage.local not available, using defaults');
        roundingSettings = { ...DEFAULT_ROUNDING_SETTINGS };
        console.log('📏 [Rounding] Loaded settings:', roundingSettings);
        resolve(roundingSettings);
        return;
      }
      chrome.storage.local.get({ 
        roundingSettings: DEFAULT_ROUNDING_SETTINGS
      }, (res) => {
        roundingSettings = { ...res.roundingSettings };
        console.log('📏 [Rounding] Loaded settings:', roundingSettings);
        resolve(roundingSettings);
      });
    });
  }

  function applyStakeRounding(stake, settings) {
    if (!settings || !settings.enabled || !settings.increment) {
      return stake;
    }
    const increment = parseFloat(settings.increment);
    if (!isFinite(increment) || increment <= 0) {
      return stake;
    }
    return Math.round(stake / increment) * increment;
  }

  function loadStakingSettings() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        console.warn('⚠️ [StakePanel] chrome.storage.local not available, using defaults');
        stakingSettings = { ...DEFAULT_STAKING_SETTINGS };
        console.log('📊 [StakePanel] Loaded settings:', stakingSettings);
        resolve(stakingSettings);
        return;
      }
      chrome.storage.local.get({ 
        stakingSettings: DEFAULT_STAKING_SETTINGS,
        commission: {},
        roundingSettings: DEFAULT_ROUNDING_SETTINGS,
        autoFillSettings: DEFAULT_AUTOFILL_SETTINGS,
        defaultActionsSettings: DEFAULT_ACTIONS_SETTINGS
      }, (res) => {
        const stored = res.stakingSettings || DEFAULT_STAKING_SETTINGS;
        const commissionData = res.commission || {};
        roundingSettings = res.roundingSettings || DEFAULT_ROUNDING_SETTINGS;
        autoFillSettings = res.autoFillSettings || DEFAULT_AUTOFILL_SETTINGS;
        defaultActionsSettings = res.defaultActionsSettings || DEFAULT_ACTIONS_SETTINGS;
        const sanitizedBankroll = sanitizeBankroll(stored.bankroll ?? DEFAULT_STAKING_SETTINGS.bankroll, 0);
        const sanitizedBase = sanitizeBankroll(
          stored.baseBankroll ?? stored.bankroll ?? DEFAULT_STAKING_SETTINGS.baseBankroll,
          DEFAULT_STAKING_SETTINGS.baseBankroll
        ) || DEFAULT_STAKING_SETTINGS.baseBankroll;
        const sanitized = {
          bankroll: sanitizedBankroll,
          baseBankroll: sanitizedBase,
          fraction: sanitizeFraction(stored.fraction ?? DEFAULT_STAKING_SETTINGS.fraction),
          useCommission: stored.useCommission !== false,
          customCommissionRates: commissionData
        };
        stakingSettings = sanitized;
        console.log('📊 [StakePanel] Loaded settings from storage:', stakingSettings);
        console.log('💰 [StakePanel] Loaded commission rates (raw):', commissionData);
        console.log('💰 [StakePanel] Commission keys:', Object.keys(commissionData));
        console.log('💰 [StakePanel] Commission values:', Object.entries(commissionData).map(([k, v]) => `${k}=${v}%`).join(', '));
        if (
          sanitized.bankroll !== stored.bankroll ||
          sanitized.baseBankroll !== stored.baseBankroll ||
          sanitized.fraction !== stored.fraction
        ) {
          console.log('📊 [StakePanel] Sanitized values, saving back to storage');
          chrome.storage.local.set({ stakingSettings: sanitized });
        }
        resolve(stakingSettings);
      });
    });
  }

  function applyStakingSettings(partial = {}, options = {}) {
    const merged = {
      ...DEFAULT_STAKING_SETTINGS,
      ...stakingSettings,
      ...partial
    };
    const sanitized = {
      bankroll: sanitizeBankroll(merged.bankroll, 0),
      baseBankroll: sanitizeBankroll(merged.baseBankroll ?? merged.bankroll, DEFAULT_STAKING_SETTINGS.baseBankroll),
      fraction: sanitizeFraction(merged.fraction),
      useCommission: merged.useCommission !== false,
      customCommissionRates: merged.customCommissionRates || {}
    };
    stakingSettings = sanitized;
    const afterSave = () => {
      updateStakePanelDisplay();
      updateStakeIndicators();
      if (!options.silent) {
        showToast(options.toastMessage || 'Kelly staking updated');
      }
    };
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ stakingSettings: sanitized }, afterSave);
    } else {
      afterSave();
    }
  }

  function getCurrencySymbol(currency = 'GBP') {
    switch ((currency || 'GBP').toUpperCase()) {
      case 'EUR':
        return '€';
      case 'USD':
        return '$';
      case 'AUD':
        return 'A$';
      case 'CAD':
        return 'C$';
      case 'NZD':
        return 'NZ$';
      default:
        return '£';
    }
  }

  function formatStakeAmount(amount, currency = 'GBP') {
    const numeric = Number(amount);
    if (!isFinite(numeric) || numeric <= 0) {
      return `${getCurrencySymbol(currency)}0.00`;
    }
    return `${getCurrencySymbol(currency)}${numeric.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  async function copyTextToClipboard(text) {
    if (!text) {
      return false;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('Surebet Helper: navigator clipboard write failed', err);
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const result = document.execCommand('copy');
      textarea.remove();
      return result;
    } catch (err) {
      console.warn('Surebet Helper: execCommand copy failed', err);
      return false;
    }
  }

  function getCommissionRate(betData) {
    if (!betData || !betData.bookmaker) {
      return 0;
    }
    
    const bookmaker = betData.bookmaker.toLowerCase();
    
    // Check for custom rate first (stored as percentages from popup, convert to decimals)
    if (stakingSettings.customCommissionRates && stakingSettings.customCommissionRates[bookmaker]) {
      const ratePercent = parseFloat(stakingSettings.customCommissionRates[bookmaker]) || 0;
      const rateDecimal = ratePercent / 100;  // Convert percentage to decimal for Kelly calculation
      console.log(`💰 [Commission] Using custom rate for ${bookmaker}: ${ratePercent}% = ${rateDecimal}`);
      return rateDecimal;
    }
    
    // Use commission from bet data if available
    if (betData.commission && parseFloat(betData.commission) > 0) {
      return parseFloat(betData.commission);
    }
    
    // Fall back to default rates
    console.log(`💰 [Commission] Using default rate for ${bookmaker}: ${DEFAULT_COMMISSION_RATES[bookmaker] || 0}`);
    return DEFAULT_COMMISSION_RATES[bookmaker] || 0;
  }

  function calculateKellyStake(betData) {
    if (!betData) {
      return 0;
    }
    
    let odds = parseFloat(betData.odds);
    const probabilityPercent = parseFloat(betData.probability);
    
    if (!isFinite(odds) || odds <= 1 || !isFinite(probabilityPercent)) {
      return 0;
    }
    
    // Apply commission adjustment if enabled
    if (stakingSettings.useCommission !== false) {
      const commission = getCommissionRate(betData);
      if (commission > 0) {
        const originalOdds = odds;
        odds = (odds - 1) * (1 - commission) + 1;
        console.log('📊 [StakePanel] Commission adjusted odds:', {
          original: originalOdds.toFixed(4),
          commission: Math.round(commission * 100) + '%',
          adjusted: odds.toFixed(4),
          bookmaker: betData.bookmaker
        });
      }
    }
    
    const p = probabilityPercent / 100;
    if (p <= 0 || p >= 1) {
      return 0;
    }
    
    const b = odds - 1;
    const q = 1 - p;
    if (b <= 0) {
      return 0;
    }
    
    let kellyPortion = ((b * p) - q) / b;
    if (!isFinite(kellyPortion)) {
      return 0;
    }
    
    kellyPortion = Math.max(0, kellyPortion);
    const userFraction = Math.max(0, Math.min(1, stakingSettings.fraction || DEFAULT_STAKING_SETTINGS.fraction));
    const bankroll = Math.max(0, stakingSettings.bankroll || DEFAULT_STAKING_SETTINGS.bankroll);
    
    // Use effective bankroll if pending adjustment is enabled
    const activeBankroll = (stakingSettings.adjustForPending && stakingSettings.effectiveBankroll != null) 
      ? stakingSettings.effectiveBankroll 
      : bankroll;
    
    let stake = activeBankroll * kellyPortion * userFraction;
    
    // Apply max bet cap after Kelly calculation (before liquidity limit)
    if (stakingSettings.maxBetPercent && stakingSettings.maxBetPercent > 0) {
      stake = Math.min(stake, bankroll * stakingSettings.maxBetPercent);
    }
    
    if (betData.limit && betData.limit > 0) {
      stake = Math.min(stake, betData.limit);
    }
    
    // Round to 2 decimal places first
    stake = Math.max(0, Math.round(stake * 100) / 100);
    
    // Apply stake rounding if enabled
    stake = applyStakeRounding(stake, roundingSettings);
    
    return stake;
  }

  function calculateKellyStakeWithMetadata(betData) {
    if (!betData) {
      return { stake: 0, cappedReason: 'none', fullKelly: 0, maxCapValue: 0, liquidityLimit: 0, pendingReduction: 0 };
    }
    
    let odds = parseFloat(betData.odds);
    const probabilityPercent = parseFloat(betData.probability);
    
    if (!isFinite(odds) || odds <= 1 || !isFinite(probabilityPercent)) {
      return { stake: 0, cappedReason: 'none', fullKelly: 0, maxCapValue: 0, liquidityLimit: 0, pendingReduction: 0 };
    }
    
    // Apply commission adjustment if enabled
    if (stakingSettings.useCommission !== false) {
      const commission = getCommissionRate(betData);
      if (commission > 0) {
        odds = (odds - 1) * (1 - commission) + 1;
      }
    }
    
    const p = probabilityPercent / 100;
    if (p <= 0 || p >= 1) {
      return { stake: 0, cappedReason: 'none', fullKelly: 0, maxCapValue: 0, liquidityLimit: 0, pendingReduction: 0 };
    }
    
    const b = odds - 1;
    const q = 1 - p;
    if (b <= 0) {
      return { stake: 0, cappedReason: 'none', fullKelly: 0, maxCapValue: 0, liquidityLimit: 0, pendingReduction: 0 };
    }
    
    let kellyPortion = ((b * p) - q) / b;
    if (!isFinite(kellyPortion)) {
      return { stake: 0, cappedReason: 'none', fullKelly: 0, maxCapValue: 0, liquidityLimit: 0, pendingReduction: 0 };
    }
    
    kellyPortion = Math.max(0, kellyPortion);
    const userFraction = Math.max(0, Math.min(1, stakingSettings.fraction || DEFAULT_STAKING_SETTINGS.fraction));
    const bankroll = Math.max(0, stakingSettings.bankroll || DEFAULT_STAKING_SETTINGS.bankroll);
    
    // Use effective bankroll if pending adjustment is enabled
    const activeBankroll = (stakingSettings.adjustForPending && stakingSettings.effectiveBankroll != null) 
      ? stakingSettings.effectiveBankroll 
      : bankroll;
    const pendingReduction = bankroll - activeBankroll;
    
    // Full Kelly stake (before any caps)
    let fullKellyStake = activeBankroll * kellyPortion * userFraction;
    let stake = fullKellyStake;
    let cappedReason = 'none';
    let maxCapValue = 0;
    let liquidityLimit = 0;
    
    // Apply max bet cap
    if (stakingSettings.maxBetPercent && stakingSettings.maxBetPercent > 0) {
      maxCapValue = bankroll * stakingSettings.maxBetPercent;
      if (stake > maxCapValue) {
        stake = maxCapValue;
        cappedReason = cappedReason === 'none' ? 'maxBet' : 'combined';
      }
    }
    
    // Apply liquidity limit
    if (betData.limit && betData.limit > 0) {
      liquidityLimit = betData.limit;
      if (stake > liquidityLimit) {
        stake = liquidityLimit;
        cappedReason = cappedReason === 'none' ? 'liquidity' : 'combined';
      }
    }
    
    // If adjusted by pending and final stake differs
    if (pendingReduction > 0 && stake < fullKellyStake) {
      if (cappedReason === 'none') {
        cappedReason = 'pendingAdjustment';
      }
    }
    
    // Round to 2 decimal places
    stake = Math.max(0, Math.round(stake * 100) / 100);
    
    // Apply stake rounding if enabled
    stake = applyStakeRounding(stake, roundingSettings);
    
    return {
      stake: stake,
      cappedReason: cappedReason,
      fullKelly: Math.max(0, Math.round(fullKellyStake * 100) / 100),
      maxCapValue: maxCapValue,
      liquidityLimit: liquidityLimit,
      pendingReduction: pendingReduction
    };
  }

  function ensureStakeIndicator(row, parentEl) {
    if (!parentEl) {
      return null;
    }
    let indicator = row.querySelector('.surebet-helper-stake-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'surebet-helper-stake-indicator muted';
      parentEl.appendChild(indicator);
      indicator.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const value = parseFloat(indicator.dataset.stakeValue);
        if (!isFinite(value) || value <= 0) {
          showToast('Stake not available for this bet', false);
          return;
        }
        const plain = value.toFixed(2);
        const copied = await copyTextToClipboard(plain);
        
        if (copied) {
          // Find the odds link in this bet row
          const betRow = indicator.closest('tbody.valuebet_record');
          if (betRow) {
            const oddsLink = betRow.querySelector('a[href*="/nav/valuebet/prong/"]');
            if (oddsLink && oddsLink.href) {
              // Parse bet data and store it
              const betData = parseSurebetLinkData(oddsLink.href);
              if (betData) {
                // Send to background broker so the bookmaker page can retrieve it cross-origin
                try {
                  const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Broker timeout')), 5000);
                    chrome.runtime.sendMessage(
                      { action: 'savePendingBet', betData },
                      (resp) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                          reject(chrome.runtime.lastError);
                        } else {
                          resolve(resp);
                        }
                      }
                    );
                  });
                  if (response && response.success) {
                    console.log('Surebet Helper: ✓ Broker confirmed pendingBet saved (from stake indicator):', betData);
                  } else {
                    console.warn('Surebet Helper: ⚠ Broker save failed from stake indicator, falling back to local storage');
                    chrome.storage.local.set({ pendingBet: betData }, () => {
                      console.log('Surebet Helper: Bet data stored for bookmaker page (fallback):', betData);
                    });
                  }
                } catch (err) {
                  console.warn('Surebet Helper: ⚠ Broker communication error from stake indicator:', err.message);
                  chrome.storage.local.set({ pendingBet: betData }, () => {
                    console.log('Surebet Helper: Bet data stored for bookmaker page (fallback):', betData);
                  });
                }
              }
              // Open the betting link in new tab immediately
              window.open(oddsLink.href, '_blank');
              showToast(`Stake ${formatStakeAmount(value)} copied, opening bookmaker...`);
            } else {
              showToast(`Stake ${formatStakeAmount(value)} copied`);
              showToast('No betting link found for this row', false);
            }
          } else {
            showToast(`Stake ${formatStakeAmount(value)} copied`);
            showToast('Unable to locate bet row', false);
          }
        } else {
          showToast('Unable to copy stake', false);
        }
      });
    }
    return indicator;
  }

  function updateRowStakeIndicator(row, betData, stakeValue) {
    if (!row || !betData) {
      return;
    }
    const parentEl = row.querySelector('td .d-flex');
    if (!parentEl) {
      return;
    }
    const indicator = ensureStakeIndicator(row, parentEl);
    if (!indicator) {
      return;
    }
    if (stakeValue && stakeValue > 0) {
      indicator.classList.remove('muted');
      indicator.dataset.stakeValue = String(stakeValue);
      
      // Get metadata for tooltip
      const metadata = calculateKellyStakeWithMetadata(betData);
      
      // Build tooltip text
      let tooltipParts = [`Stake: £${stakeValue.toFixed(2)}`];
      if (metadata.fullKelly > 0) {
        tooltipParts.push(`Kelly: £${metadata.fullKelly.toFixed(2)}`);
      }
      if (metadata.maxCapValue > 0) {
        tooltipParts.push(`Cap: ${(stakingSettings.maxBetPercent * 100).toFixed(0)}%`);
      }
      if (metadata.liquidityLimit > 0) {
        tooltipParts.push(`Liq: £${metadata.liquidityLimit.toFixed(2)}`);
      }
      if (metadata.pendingReduction > 0) {
        tooltipParts.push(`Pending: -£${metadata.pendingReduction.toFixed(2)}`);
      }
      
      const tooltipText = tooltipParts.join(' | ');
      indicator.title = tooltipText;
      
      // Apply color class based on capped reason
      indicator.classList.remove('kelly-full', 'kelly-maxcap', 'kelly-liquidity', 'kelly-pending', 'kelly-combined');
      if (metadata.cappedReason !== 'none') {
        indicator.classList.add(`kelly-${metadata.cappedReason}`);
      } else {
        indicator.classList.add('kelly-full');
      }
      
      indicator.textContent = 'Stake ' + formatStakeAmount(stakeValue, betData.currency || 'GBP');
      const span = document.createElement('span');
      span.textContent = Math.round((stakingSettings.fraction || DEFAULT_STAKING_SETTINGS.fraction) * 100) + '% Kelly';
      indicator.appendChild(span);
    } else {
      indicator.classList.add('muted');
      indicator.dataset.stakeValue = '';
      indicator.title = '';
      indicator.textContent = 'Stake n/a';
    }
  }

  function updateStakeIndicators() {
    const rows = document.querySelectorAll('tbody.valuebet_record');
    rows.forEach((row) => {
      if (row.__surebetHelperBetData) {
        const stakeValue = calculateKellyStake(row.__surebetHelperBetData);
        row.__surebetHelperRecommendedStake = stakeValue;
        updateRowStakeIndicator(row, row.__surebetHelperBetData, stakeValue);
      }
    });
  }

  function toggleStakePanelCollapsed(forceValue) {
    if (!stakePanel) {
      return;
    }
    const shouldCollapse = typeof forceValue === 'boolean'
      ? forceValue
      : !stakePanel.classList.contains('collapsed');
    stakePanel.classList.toggle('collapsed', shouldCollapse);
  }

  function updateStakePanelDisplay() {
    if (!stakePanel) {
      console.warn('⚠️ [StakePanel] updateStakePanelDisplay called but stakePanel is null/undefined');
      return;
    }
    const bankrollInput = stakePanel.querySelector('#surebet-helper-bankroll');
    const fractionInput = stakePanel.querySelector('#surebet-helper-fraction');
    const useCommissionCheckbox = stakePanel.querySelector('#surebet-helper-use-commission');
    const summary = stakePanel.querySelector('.surebet-helper-stake-summary');
    const collapsedText = stakePanel.querySelector('.surebet-helper-stake-collapsed-text');
    
    const bankroll = stakingSettings.bankroll || DEFAULT_STAKING_SETTINGS.bankroll;
    const baseBankroll = stakingSettings.baseBankroll || bankroll;
    const fractionPercent = Math.round((stakingSettings.fraction || DEFAULT_STAKING_SETTINGS.fraction) * 100);
    const useCommission = stakingSettings.useCommission !== false;
    
    console.log('📊 [StakePanel] Updating display:', {
      bankroll,
      baseBankroll,
      fractionPercent,
      useCommission,
      bankrollInput: !!bankrollInput,
      fractionInput: !!fractionInput,
      useCommissionCheckbox: !!useCommissionCheckbox,
      summary: !!summary,
      collapsedText: !!collapsedText
    });
    
    if (bankrollInput) {
      bankrollInput.value = baseBankroll;
    }
    if (fractionInput) {
      fractionInput.value = fractionPercent;
    }
    if (useCommissionCheckbox) {
      useCommissionCheckbox.checked = useCommission;
    }
    const commissionStatus = useCommission ? '✓' : '✗';
    if (summary) {
      summary.innerHTML = '';
      const lines = [
        { label: 'Current bank', value: formatStakeAmount(bankroll) },
        { label: 'Starting bank', value: formatStakeAmount(baseBankroll) },
        { label: 'Fractional Kelly', value: fractionPercent + '%' },
        { label: 'Commission accounting', value: commissionStatus }
      ];
      lines.forEach((line, index) => {
        if (index > 0) summary.appendChild(document.createElement('br'));
        summary.appendChild(document.createTextNode(line.label + ' '));
        const strong = document.createElement('strong');
        strong.textContent = line.value;
        summary.appendChild(strong);
      });
    }
    if (collapsedText) {
      collapsedText.textContent = `Kelly ${fractionPercent}% | Bank ${formatStakeAmount(bankroll)} | Comm ${commissionStatus}`;
    }
  }

  function injectStakePanel() {
    console.log('🎯 [StakePanel] injectStakePanel called | stakePanel exists:', !!stakePanel, '| body exists:', !!document.body);
    
    if (stakePanel || !document.body) {
      console.log('⚠️ [StakePanel] Panel already exists or body missing, updating display only');
      updateStakePanelDisplay();
      return;
    }
    
    stakePanel = document.createElement('div');
    stakePanel.className = 'surebet-helper-stake-panel';
    stakePanel.innerHTML = `
      <h3 class="surebet-helper-stake-header">
        <span>Kelly Stake Helper</span>
        <button type="button" class="surebet-helper-stake-toggle" aria-label="Toggle staking panel">-</button>
      </h3>
      <div class="surebet-helper-stake-collapsed-text"></div>
      <form class="surebet-helper-stake-form">
        <div>
          <label for="surebet-helper-bankroll">Starting Bank</label>
          <input type="number" id="surebet-helper-bankroll" min="50" step="10" />
        </div>
        <div>
          <label for="surebet-helper-fraction">Kelly %</label>
          <input type="number" id="surebet-helper-fraction" min="5" max="100" step="1" />
        </div>
        <div class="surebet-helper-commission-toggle">
          <input type="checkbox" id="surebet-helper-use-commission" />
          <label for="surebet-helper-use-commission">Account for Exchange Commission</label>
        </div>
        <div class="surebet-helper-stake-actions">
          <button type="button" class="surebet-helper-stake-reset">Reset</button>
          <button type="submit" class="surebet-helper-stake-save">Save</button>
        </div>
      </form>
      <div class="surebet-helper-stake-summary"></div>
    `;
    document.body.appendChild(stakePanel);
    console.log('✅ [StakePanel] Panel injected successfully:', stakePanel);
    console.log('✅ [StakePanel] Panel in DOM:', document.contains(stakePanel));
    console.log('✅ [StakePanel] Panel computed style z-index:', window.getComputedStyle(stakePanel).zIndex);
    console.log('📊 [StakePanel] Current stakingSettings:', stakingSettings);
    
    const form = stakePanel.querySelector('.surebet-helper-stake-form');
    const resetBtn = stakePanel.querySelector('.surebet-helper-stake-reset');
    const toggleBtn = stakePanel.querySelector('.surebet-helper-stake-toggle');
    
    console.log('✅ [StakePanel] Elements found - form:', !!form, 'resetBtn:', !!resetBtn, 'toggleBtn:', !!toggleBtn);
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const bankrollValue = stakePanel.querySelector('#surebet-helper-bankroll')?.value;
        const fractionValue = stakePanel.querySelector('#surebet-helper-fraction')?.value;
        const useCommissionCheckbox = stakePanel.querySelector('#surebet-helper-use-commission');
        const bankroll = sanitizeBankroll(bankrollValue, DEFAULT_STAKING_SETTINGS.bankroll);
        const fractionPercent = parseFloat(fractionValue) || (DEFAULT_STAKING_SETTINGS.fraction * 100);
        const fraction = sanitizeFraction(fractionPercent / 100);
        const useCommission = useCommissionCheckbox ? useCommissionCheckbox.checked : true;
        applyStakingSettings({ bankroll, baseBankroll: bankroll, fraction, useCommission });
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyStakingSettings({ ...DEFAULT_STAKING_SETTINGS });
      });
    }
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleStakePanelCollapsed();
      });
    }
    stakePanel.addEventListener('click', (e) => {
      if (stakePanel.classList.contains('collapsed') && !e.target.closest('button')) {
        toggleStakePanelCollapsed(false);
      }
    });
    updateStakePanelDisplay();
    console.log('✅ [StakePanel] Display updated, checking values in DOM...');
    const bankrollInputCheck = stakePanel.querySelector('#surebet-helper-bankroll');
    const fractionInputCheck = stakePanel.querySelector('#surebet-helper-fraction');
    const summaryCheck = stakePanel.querySelector('.surebet-helper-stake-summary');
    console.log('📊 [StakePanel] Input values after update:', {
      bankroll: bankrollInputCheck?.value,
      fraction: fractionInputCheck?.value,
      summaryHTML: summaryCheck?.innerHTML
    });
    
    // Ensure panel is not in collapsed state on initial creation
    if (stakePanel.classList.contains('collapsed')) {
      console.log('⚠️ [StakePanel] Panel was in collapsed state, expanding it');
      stakePanel.classList.remove('collapsed');
    }
  }

  function ensureStakePanelExists() {
    const panelInDOM = document.querySelector('.surebet-helper-stake-panel');
    if (!panelInDOM) {
      console.warn('⚠️ [StakePanel] Panel missing from DOM, re-injecting');
      stakePanel = null;
      injectStakePanel();
    }
  }

  function startStakePanelMonitoring() {
    // Check every 3 seconds if panel still exists in DOM
    const monitorInterval = setInterval(() => {
      if (!document.body) {
        clearInterval(monitorInterval);
        return;
      }
      ensureStakePanelExists();
    }, 3000);
    
    console.log('✅ [StakePanel] DOM monitoring started (checks every 3s)');
  }

  function getOrCreateToastContainer() {
    let container = document.getElementById('surebet-helper-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'surebet-helper-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(text, typeOrSuccess = true, duration = 2500) {
    if (isDisabled) {
      return;
    }
    const container = getOrCreateToastContainer();
    const toast = document.createElement('div');
    // Support both boolean (backward compat) and string type
    let typeClass = '';
    if (typeof typeOrSuccess === 'string') {
      if (typeOrSuccess === 'error' || typeOrSuccess === 'warning') {
        typeClass = ' ' + typeOrSuccess;
      }
    } else if (typeOrSuccess === false) {
      typeClass = ' error';
    }
    toast.className = 'surebet-helper-toast' + typeClass;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'surebetToastSlideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function parseRowData(row) {
    try {
      // Get data from row attributes
      let overvalueRaw = parseFloat(row.dataset.overvalue) || 0;
      // Convert ratio format (e.g., 1.06) to percentage (e.g., 6) if needed
      const overvalueAsPercentage = overvalueRaw < 2 ? parseFloat(((overvalueRaw - 1) * 100).toFixed(2)) : overvalueRaw;
      const data = {
        id: row.dataset.id,
        odds: parseFloat(row.dataset.value) || 0,
        probability: parseFloat(row.dataset.probability) || 0,
        overvalue: overvalueAsPercentage,
        timestamp: new Date().toISOString(),
        url: location.href
      };

      // Extract bookmaker
      const bookmakerCell = row.querySelector('.booker a');
      if (bookmakerCell) {
        data.bookmaker = bookmakerCell.textContent.trim();
      }

      // Extract sport
      const sportSpan = row.querySelector('.booker .minor');
      if (sportSpan) {
        data.sport = sportSpan.textContent.trim();
      }

      // Extract event name
      const eventCell = row.querySelector('.event a');
      if (eventCell) {
        data.event = eventCell.textContent.trim();
      }

      // Extract tournament
      const tournamentSpan = row.querySelector('.event .minor');
      if (tournamentSpan) {
        data.tournament = tournamentSpan.textContent.trim();
      }

      // Extract market from the coefficient cell (includes "- lay" suffix if applicable)
      const coeffCell = row.querySelector('.coeff abbr');
      if (coeffCell) {
        // Get the full text content which includes any "- lay" suffix
        data.market = coeffCell.textContent.trim();
      } else {
        // Fallback: try JSON data in dropdown menu
        const dropdown = row.querySelector('[data-comb-json]');
        if (dropdown) {
          try {
            const json = JSON.parse(dropdown.dataset.combJson);
            if (json.prongs && json.prongs[0]) {
              const prong = JSON.parse(json.prongs[0]);
              if (prong.tr_terse) {
                // Remove HTML tags from market description
                data.market = prong.tr_terse.replace(/<[^>]*>/g, '');
              } else if (prong.tr_expanded) {
                data.market = prong.tr_expanded;
              }
            }
          } catch (e) {
            console.warn('Failed to parse JSON data:', e);
          }
        }
      }

      // Detect Lay bets
      if (data.market && /lay/i.test(data.market)) {
        data.isLay = true;
      }

      // Extract time
      const timeCell = row.querySelector('.time abbr');
      if (timeCell && timeCell.dataset.utc) {
        const utcMs = parseInt(timeCell.dataset.utc);
        data.eventTime = new Date(utcMs).toISOString();
      }

      return data;
    } catch (err) {
      console.error('Surebet Helper: Error parsing row data', err);
      return null;
    }
  }

  // Trigger dustbin (trash icon) menu action after saving a bet
  async function triggerDustbinAction(row, action) {
    if (!row || action === 'none') {
      return; // No action or not applicable
    }

    console.log('Surebet Helper: Attempting dustbin action:', action);

    const dustbinBtn = row.querySelector('.btn-group.drop-trash > button');
    if (!dustbinBtn) {
      console.warn('Surebet Helper: Dustbin button not found in row');
      showToast('⚠ Dustbin button not found', false, 3000);
      return;
    }

    // Click the dustbin button to open the menu
    dustbinBtn.click();
    console.log('Surebet Helper: Clicked dustbin button');

    // Wait for the menu to appear - try multiple strategies
    let menuFound = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      // Try multiple selectors for the dropdown menu
      let menu = row.querySelector('.dropdown-menu');
      if (!menu) {
        menu = row.querySelector('.hidden-records-menu');
      }
      if (!menu) {
        menu = row.querySelector('[class*="dropdown"]');
      }
      if (!menu) {
        // Also check within the btn-group
        const btnGroup = row.querySelector('.btn-group.drop-trash');
        if (btnGroup) {
          menu = btnGroup.querySelector('.dropdown-menu, ul, [role="menu"]');
        }
      }
      
      // Menu is visible if it exists and is displayed
      const isVisible = menu && (
        !menu.classList.contains('hidden') || 
        menu.classList.contains('show') ||
        window.getComputedStyle(menu).display !== 'none'
      );
      
      if (isVisible) {
        menuFound = true;
        console.log('Surebet Helper: Menu found and visible, class:', menu.className);
        
        // Determine which keywords to look for based on action
        let keywords = [];
        if (action === 'hide-valuebet') {
          // Match variations: "Hide this valuebet", "this valuebet", "Hide valuebet", etc.
          keywords = ['this valuebet', 'hide valuebet', 'valuebet'];
        } else if (action === 'hide-event') {
          // Match variations: "Hide entire event", "entire event", "hide event", etc.
          keywords = ['entire event', 'hide event', 'event'];
        }

        // Find the menu item - try multiple selector strategies
        // Note: surebet.com uses <button class="dropdown-item"> elements
        const menuItems = menu.querySelectorAll('button.dropdown-item, .dropdown-item, li a, a.dropdown-item, [role="menuitem"], button, a, li');
        console.log('Surebet Helper: Found', menuItems.length, 'menu items. Looking for keywords:', keywords.join(', '));
        
        let clicked = false;
        // Try each keyword in order (most specific first)
        for (const keyword of keywords) {
          if (clicked) break;
          for (const item of menuItems) {
            const itemText = item.textContent.trim().toLowerCase();
            console.log('Surebet Helper: Checking menu item:', item.textContent.trim());
            if (itemText.includes(keyword.toLowerCase())) {
              item.click();
              clicked = true;
              console.log('Surebet Helper: ✓ Dustbin action triggered:', action, '- matched keyword:', keyword);
              break;
            }
          }
        }

        if (!clicked) {
          // Log all menu items for debugging
          const allTexts = Array.from(menuItems).map(i => i.textContent.trim()).filter(t => t);
          console.warn('Surebet Helper: Menu item not found. Available items:', allTexts.join(' | '));
          showToast('⚠ Dustbin menu item not found', false, 3000);
          // Close the menu by clicking elsewhere
          dustbinBtn.click();
        }
        return;
      }

      // Wait before next attempt (increasing delay)
      if (attempt < 7) {
        await new Promise(resolve => setTimeout(resolve, 150 + (attempt * 50)));
      }
    }

    if (!menuFound) {
      console.warn('Surebet Helper: Dustbin menu did not appear after 8 attempts');
      showToast('⚠ Dustbin menu did not open', false, 3000);
    }
  }

  async function saveBet(betData) {
    console.log('Surebet Helper: saveBet called with data:', betData);
    console.log('Surebet Helper: Odds check - value:', betData.odds, 'type:', typeof betData.odds, 'check result:', (!betData.odds || betData.odds === 0));
    
    // If odds not found, prompt for it (or skip if default action enabled)
    if (!betData.odds || betData.odds === 0) {
      if (defaultActionsSettings.skipOddsPrompt) {
        console.log('Surebet Helper: Odds missing and skipOddsPrompt enabled, cancelling save');
        return false;
      }
      console.log('Surebet Helper: Odds missing, prompting user');
      const oddsStr = prompt('Enter the odds (decimal format, e.g., 2.5):', '');
      if (oddsStr === null) return false; // User cancelled
      
      const odds = parseFloat(oddsStr.replace(/[^\d.]/g, ''));
      if (isNaN(odds) || odds <= 1) {
        alert('Invalid odds');
        return false;
      }
      betData.odds = odds;
    } else {
      console.log('Surebet Helper: Odds already present:', betData.odds);
    }

    // If market not found, prompt for it (or use default if enabled)
    if (!betData.market) {
      if (defaultActionsSettings.skipMarketPrompt) {
        betData.market = 'Unknown';
        console.log('Surebet Helper: Market missing and skipMarketPrompt enabled, using "Unknown"');
      } else {
        const market = prompt('Enter the market/selection (e.g., "Player 1 to win", "Over 2.5 goals"):', '');
        if (market === null) return false; // User cancelled
        if (market.trim()) {
          betData.market = market.trim();
        }
      }
    }

    const recommendedStake = (typeof betData.suggestedStake === 'number' ? betData.suggestedStake : calculateKellyStake(betData)) || 0;
    if (recommendedStake > 0) {
      betData.recommendedStake = recommendedStake;
    }

    // Handle stake entry based on default actions settings
    let stake;
    if (defaultActionsSettings.skipStakePrompt && recommendedStake > 0) {
      // Auto-save with recommended Kelly stake
      stake = recommendedStake;
      console.log('Surebet Helper: skipStakePrompt enabled, using Kelly stake:', stake);
    } else {
      // Prompt user for stake
      const stakeStr = prompt('Enter your stake amount:', recommendedStake > 0 ? recommendedStake.toFixed(2) : '');
      if (stakeStr === null) return false; // User cancelled
      stake = parseFloat(stakeStr.replace(/[^\d.]/g, ''));
    }

    if (isNaN(stake) || stake <= 0) {
      alert('Invalid stake amount');
      return false;
    }
    
    // Apply stake rounding if enabled
    const roundedStake = applyStakeRounding(stake, roundingSettings);
    betData.stake = roundedStake;

    // Use overvalue as EV
    if (betData.odds && betData.probability) {
      const impliedProb = (1 / betData.odds) * 100;
      if (!betData.overvalue) {
        betData.overvalue = betData.probability - impliedProb;
      }
      // Expected value is stake scaled by the edge percentage
      const edgeFraction = betData.overvalue / 100;
      betData.expectedValue = parseFloat((roundedStake * edgeFraction).toFixed(2));
    }

    if (!betData.timestamp) {
      betData.timestamp = new Date().toISOString();
    }

    if (!betData.uid) {
      betData.uid = generateBetUid();
    }
    
    // Initialize status as pending
    betData.status = 'pending';
    
    // Initialize API retry tracking
    betData.apiRetryCount = 0;
    betData.lastApiCheck = null;

    console.log('Surebet Helper: Final bet data to save:', betData);

    // Save to storage
    return new Promise((resolve) => {
      chrome.storage.local.get({ bets: [] }, (res) => {
        const bets = res.bets || [];
        bets.push(betData);
        chrome.storage.local.set({ bets }, () => {
          // Show toast notification if auto-saved with Kelly stake
          if (defaultActionsSettings.skipStakePrompt && recommendedStake > 0) {
            showToast(`✅ Bet saved with £${roundedStake.toFixed(2)} stake`);
          }
          resolve(true);
        });
      });
    });
  }

  function applyBookmakerPreset(presetName) {
    console.log('Surebet Helper: Applying preset:', presetName);
    if (isDisabled) {
      return;
    }
    const bookmakers = BOOKMAKER_PRESETS[presetName];
    if (!bookmakers) {
      showToast('Unknown preset: ' + presetName, false);
      return;
    }

    // Find all bookmaker checkboxes - look in the visible popup first
    let checkboxes = [];
    
    // Strategy 1: Find checkboxes in the visible popup
    const popup = document.querySelector('.popup:not(.hidden)') || 
                  document.querySelector('[role="dialog"]') ||
                  document.querySelector('.modal:not(.hidden)');
    
    if (popup) {
      checkboxes = Array.from(popup.querySelectorAll('input[type="checkbox"]'));
      console.log('Surebet Helper: Found', checkboxes.length, 'checkboxes in popup');
    }
    
    // Strategy 2: Fall back to looking anywhere for visible checkboxes
    if (checkboxes.length === 0) {
      checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => {
        const style = window.getComputedStyle(cb);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      console.log('Surebet Helper: Found', checkboxes.length, 'visible checkboxes on page');
    }

    if (checkboxes.length === 0) {
      showToast('Could not find bookmaker checkboxes', false);
      return;
    }

    let checkedCount = 0;
    let uncheckedCount = 0;

    // Uncheck all first
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));
        uncheckedCount++;
      }
    });

    // Check only the ones in our preset
    checkboxes.forEach(checkbox => {
      // Find the label text for this checkbox
      const label = checkbox.closest('label') || 
                   checkbox.parentElement?.querySelector('label') ||
                   checkbox.nextElementSibling;
      
      const labelText = label ? label.textContent.trim() : '';
      
      // Check if this bookmaker is in our preset
      const shouldCheck = bookmakers.some(bookie => {
        const bookieLower = bookie.toLowerCase();
        const labelLower = labelText.toLowerCase();
        
        // Remove percentage and whitespace for comparison
        const labelClean = labelLower.replace(/\s*\d+%\s*$/, '').trim();
        
        // EXACT MATCH ONLY:
        // "Betfair" should match "Betfair 5%" but NOT "Betfair SB 5%" or "Betfair (AU) 5%"
        
        // If the bookie name has country code, do exact match
        if (bookieLower.includes('(')) {
          return labelClean === bookieLower;
        }
        
        // For plain names without country codes:
        // Must be exact match or followed by percentage/space+percentage only
        // Extract bookmaker name from label (everything before percentage or country code)
        const labelBookmaker = labelClean
          .replace(/\s*\([A-Z]{2,3}\).*$/, '')  // Remove country codes
          .trim();
        
        // Must match exactly, no extra letters
        if (labelBookmaker === bookieLower) {
          // Exclude if there's a country code or additional text after bookmaker name
          if (/\([A-Z]{2,3}\)/i.test(labelText)) {
            return false;  // Has country code like "(AU)"
          }
          // Check if there are extra letters/words after the bookmaker name (like "SB", "MBR")
          const afterBookmaker = labelClean.substring(bookieLower.length).trim();
          if (afterBookmaker && /^[a-z]/i.test(afterBookmaker)) {
            // There's text after bookmaker name that's not just a percentage
            return false;
          }
          return true;
        }
        
        return false;
      });

      if (shouldCheck && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));
        checkedCount++;
      }
    });

    const presetLabel = presetName === 'normal' ? 'Normal List' : 'Exchanges Only';
    showToast(`✓ Applied ${presetLabel} preset: ${checkedCount} bookmakers selected`);
  }

  function injectPresetButtons() {
    console.log('Surebet Helper: === Attempting to inject preset buttons ===');
    if (isDisabled) {
      return;
    }
    
    // Skip if already injected anywhere on the page
    if (document.querySelector('.surebet-helper-preset-container')) {
      console.log('Surebet Helper: Preset buttons already injected, skipping');
      return;
    }
    
    // Debug: Log all visible checkboxes
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => {
      const style = window.getComputedStyle(cb);
      const parent = cb.closest('div');
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      return style.display !== 'none' && style.visibility !== 'hidden' &&
             (!parentStyle || (parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden'));
    });
    console.log('Surebet Helper: Total checkboxes:', allCheckboxes.length, 'Visible:', visibleCheckboxes.length);
    
    // Log some visible checkbox labels for debugging
    if (visibleCheckboxes.length > 0) {
      const labels = visibleCheckboxes.slice(0, 5).map(cb => {
        const label = cb.closest('label') || cb.nextElementSibling || cb.parentElement;
        return label ? label.textContent.trim().substring(0, 30) : 'no label';
      });
      console.log('Surebet Helper: Sample checkbox labels:', labels);
    }

    // Try multiple strategies to find the bookmaker filter popup/modal
    let container = null;
    
    // Strategy 1: Look for modal/popup/dropdown containers first
    const modalSelectors = [
      '.modal:not(.hidden)',
      '.popup:not(.hidden)', 
      '.dropdown-menu:not(.hidden)',
      '[role="dialog"]',
      '[class*="Modal"]',
      '[class*="Popup"]',
      '[class*="Dropdown"]',
      '.filter-popup',
      '.booker-filter-popup'
    ];
    
    for (const selector of modalSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.querySelector('input[type="checkbox"]')) {
        // Make sure it's visible
        const style = window.getComputedStyle(elem);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          container = elem;
          console.log('Surebet Helper: Found modal/popup filter container with selector:', selector);
          break;
        }
      }
    }
    
    // Strategy 2: Look for visible containers with bookmaker checkboxes
    if (!container) {
      const allDivs = Array.from(document.querySelectorAll('div'));
      container = allDivs.find(div => {
        const style = window.getComputedStyle(div);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        
        const checkboxes = div.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length >= 5) { // At least 5 checkboxes
          const text = div.textContent.toLowerCase();
          // Check if it contains bookmaker names
          return text.includes('betfair') || text.includes('bet365') || 
                 text.includes('ladbrokes') || text.includes('betway');
        }
        return false;
      });
      
      if (container) {
        console.log('Surebet Helper: Found visible container with bookmaker checkboxes');
      }
    }
    
    // Strategy 3: Find the container with the most visible checkboxes
    if (!container) {
      const visibleCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const style = window.getComputedStyle(cb);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      
      if (visibleCheckboxes.length > 0) {
        console.log('Surebet Helper: Found', visibleCheckboxes.length, 'visible checkboxes');
        
        // Find the common parent that contains the most checkboxes
        const parents = visibleCheckboxes.map(cb => {
          // Go up to find a meaningful container (not just a label)
          let parent = cb.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!parent || parent === document.body) break;
            const checkCount = parent.querySelectorAll('input[type="checkbox"]').length;
            if (checkCount >= 5) {
              return { parent, count: checkCount };
            }
            parent = parent.parentElement;
          }
          return null;
        }).filter(Boolean);
        
        if (parents.length > 0) {
          // Sort by checkbox count and take the one with the most
          parents.sort((a, b) => b.count - a.count);
          container = parents[0].parent;
          console.log('Surebet Helper: Found container with', parents[0].count, 'checkboxes');
        }
      }
    }
    
    if (!container) {
      console.log('Surebet Helper: ❌ Could not find bookmaker filter container');
      console.log('Surebet Helper: Available visible checkboxes:', 
        Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter(cb => window.getComputedStyle(cb).display !== 'none').length);
      
      // Debug: List all divs with multiple checkboxes
      const divsWithCheckboxes = Array.from(document.querySelectorAll('div'))
        .map(div => ({ div, count: div.querySelectorAll('input[type="checkbox"]').length }))
        .filter(item => item.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      console.log('Surebet Helper: Top 5 divs with checkboxes:', divsWithCheckboxes.map(i => ({
        count: i.count,
        classes: i.div.className,
        visible: window.getComputedStyle(i.div).display !== 'none'
      })));
      return;
    }

    console.log('Surebet Helper: ✓ Found container, injecting preset buttons');
    console.log('Surebet Helper: Container classes:', container.className);
    console.log('Surebet Helper: Container checkboxes:', container.querySelectorAll('input[type="checkbox"]').length);

    // Create preset button container
    const presetContainer = document.createElement('div');
    presetContainer.className = 'surebet-helper-preset-container';

    // Create "Normal List" button
    const normalBtn = document.createElement('button');
    normalBtn.className = 'surebet-helper-preset-btn normal';
    normalBtn.textContent = '⭐ My Normal List';
    normalBtn.title = 'Apply your standard bookmaker selection';
    normalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBookmakerPreset('normal');
    });

    // Create "Exchanges" button
    const exchangesBtn = document.createElement('button');
    exchangesBtn.className = 'surebet-helper-preset-btn exchanges';
    exchangesBtn.textContent = '🔄 Exchanges Only';
    exchangesBtn.title = 'Show only betting exchanges';
    exchangesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBookmakerPreset('exchanges');
    });

    presetContainer.appendChild(normalBtn);
    presetContainer.appendChild(exchangesBtn);

    // Insert at the top of the filter container (before the first child)
    if (container.firstChild) {
      container.insertBefore(presetContainer, container.firstChild);
    } else {
      container.appendChild(presetContainer);
    }
    console.log('Surebet Helper: Preset buttons injected successfully at the top!');
  }

  function toggleLayBets() {
    if (isDisabled) {
      return;
    }
    const mainTable = document.querySelector('table');
    if (!mainTable) return;
    
    const rows = mainTable.querySelectorAll('tbody.valuebet_record');
    const hideLayBtn = document.querySelector('.surebet-helper-hide-lay-btn');
    const isHiding = hideLayBtn && hideLayBtn.classList.contains('active');
    
    let hiddenCount = 0;
    rows.forEach(row => {
      // Check if this is a lay bet by looking at the market text
      const coeffCell = row.querySelector('.coeff abbr');
      let isLayBet = false;
      
      if (coeffCell) {
        const marketText = coeffCell.textContent.toLowerCase();
        isLayBet = marketText.includes('- lay') || marketText.endsWith('lay');
      }
      
      // Also check the link data
      if (!isLayBet) {
        const link = row.querySelector('a[href*="/nav/valuebet/prong/"]');
        if (link && link.href) {
          const linkData = parseSurebetLinkData(link.href);
          if (linkData && linkData.isLay) {
            isLayBet = true;
          }
        }
      }
      
      if (isLayBet) {
        if (isHiding) {
          row.classList.add('surebet-helper-hidden-row');
          hiddenCount++;
        } else {
          row.classList.remove('surebet-helper-hidden-row');
        }
      }
    });
    
    if (hideLayBtn) {
      if (isHiding) {
        hideLayBtn.textContent = `👁️ Show Lay Bets (${hiddenCount} hidden)`;
      } else {
        hideLayBtn.textContent = '🚫 Hide Lay Bets';
      }
    }
  }

  function injectHideLayButton() {
    if (isDisabled) {
      return;
    }
    // Skip if button already exists
    if (document.querySelector('.surebet-helper-hide-lay-btn')) {
      return;
    }
    
    const btn = document.createElement('button');
    btn.className = 'surebet-helper-hide-lay-btn';
    btn.textContent = '🚫 Hide Lay Bets';
    btn.title = 'Toggle visibility of lay bets';
    
    // Initialize button state from storage
    const api = typeof chrome !== 'undefined' ? chrome : browser;
    api.storage.local.get({ uiPreferences: DEFAULT_UI_PREFERENCES }, (res) => {
      const hideLayBets = res.uiPreferences?.hideLayBets || false;
      if (hideLayBets) {
        btn.classList.add('active');
        // Apply the hide effect
        setTimeout(() => {
          const hideLayBtn = document.querySelector('.surebet-helper-hide-lay-btn');
          if (hideLayBtn && hideLayBtn.classList.contains('active')) {
            toggleLayBets();
          }
        }, 100);
      }
    });
    
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const hideLayBets = btn.classList.contains('active');
      
      // Save preference to storage
      const api = typeof chrome !== 'undefined' ? chrome : browser;
      api.storage.local.set({ uiPreferences: { hideLayBets } }, () => {
        console.log('Surebet Helper: Hide lay bets preference saved:', hideLayBets);
      });
      
      toggleLayBets();
    });
    
    document.body.appendChild(btn);
    console.log('Surebet Helper: Hide Lay Bets button injected');
  }

  function injectSaveButtons() {
    if (isDisabled) {
      return;
    }
    // Find the main valuebets table only
    const mainTable = document.querySelector('table');
    if (!mainTable) {
      console.log('Surebet Helper: Main table not found');
      return;
    }
    
    // Find all valuebet rows in the main table only
    const rows = mainTable.querySelectorAll('tbody.valuebet_record');
    console.log('Surebet Helper: Found', rows.length, 'valuebet rows in main table');
    
    let hasHighStake = false;
    
    rows.forEach(row => {
      // Skip if button already injected
      if (row.querySelector('.surebet-helper-save-btn')) return;

      // Try to find a link to the valuebet details
      const link = row.querySelector('a[href*="/nav/valuebet/prong/"]');
      let linkUrl = link ? link.href : null;
      let linkData = null;

      // Parse stake limit from the link data
      if (link && link.href) {
        try {
          console.log('Surebet Helper: Parsing link for stake limit:', link.href.substring(0, 100));
          linkData = parseSurebetLinkData(link.href);
          console.log('Surebet Helper: Parsed link data:', linkData ? `id: ${linkData.id}, limit: ${linkData.limit}` : 'null');
          
          if (linkData && typeof linkData.limit !== 'undefined') {
            const stakeLimit = linkData.limit;
            console.log('Surebet Helper: Found stake limit from link:', stakeLimit);
            
            // Highlight rows with stake >= £100
            if (stakeLimit >= 100) {
              row.classList.add('surebet-helper-high-stake');
              hasHighStake = true;
              console.log('Surebet Helper: ✓ Highlighted row with stake limit:', stakeLimit);
            }
          } else {
            console.log('Surebet Helper: No limit found in link data');
          }
        } catch (e) {
          console.log('Surebet Helper: Error parsing stake limit:', e.message);
        }
      } else {
        console.log('Surebet Helper: No link found in row');
      }

      if (linkData) {
        row.__surebetHelperBetData = linkData;
        row.__surebetHelperRecommendedStake = calculateKellyStake(linkData);
      } else {
        row.__surebetHelperBetData = null;
        row.__surebetHelperRecommendedStake = 0;
      }

      // Find the first cell with buttons
      const firstCell = row.querySelector('td .d-flex');
      if (!firstCell) return;

      // Create save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'surebet-helper-save-btn';
      saveBtn.textContent = '💾 Save';
      saveBtn.title = 'Save this bet to your log';

      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        saveBtn.disabled = true;
        saveBtn.textContent = '...';

        let betData = null;
        
        // Parse from link only
        if (linkUrl) {
          console.log('Surebet Helper: Parsing from link:', linkUrl);
          betData = parseSurebetLinkData(linkUrl);
        }
        
        if (!betData) {
          showToast('Failed to extract bet data from link', false);
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save';
          return;
        }

        if (row.__surebetHelperRecommendedStake && row.__surebetHelperRecommendedStake > 0) {
          betData.suggestedStake = row.__surebetHelperRecommendedStake;
        }

        const saved = await saveBet(betData);
        if (saved) {
          showToast('✓ Bet saved successfully!');
          saveBtn.textContent = '✓';
          
          // Trigger dustbin action if configured
          console.log('Surebet Helper: Dustbin setting value:', defaultActionsSettings.dustbinActionAfterSave);
          if (defaultActionsSettings.dustbinActionAfterSave && defaultActionsSettings.dustbinActionAfterSave !== 'none') {
            await triggerDustbinAction(row, defaultActionsSettings.dustbinActionAfterSave);
          }
          
          setTimeout(() => {
            saveBtn.textContent = '💾 Save';
            saveBtn.disabled = false;
          }, 2000);
        } else {
          saveBtn.textContent = '💾 Save';
          saveBtn.disabled = false;
        }
      });

      // Insert button into the cell
      firstCell.appendChild(saveBtn);

      if (row.__surebetHelperBetData) {
        updateRowStakeIndicator(row, row.__surebetHelperBetData, row.__surebetHelperRecommendedStake);
      }
    });
    
    // Play notification sound if any high stake bets were found
    if (hasHighStake) {
      playNotificationSound();
    }

    updateStakeIndicators();
  }

  function playNotificationSound() {
    try {
      // Create audio context and play a notification beep
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set frequency (800 Hz for a pleasant notification tone)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      // Set volume (0.3 = 30% volume)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      // Play the sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      console.log('Surebet Helper: ♪ Notification sound played for high stake bet(s)');
    } catch (e) {
      console.log('Surebet Helper: Could not play notification sound:', e.message);
    }
  }

  function parseSurebetLinkData(url) {
    try {
      console.log('Surebet Helper: Parsing Surebet link data from URL');
      
      // Extract the JSON data from the URL parameter
      const urlObj = new URL(url);
      const jsonBody = urlObj.searchParams.get('json_body[prongs][]');
      
      if (!jsonBody) {
        console.log('Surebet Helper: No JSON data found in URL');
        return null;
      }
      
      // Decode and parse the JSON
      const jsonData = JSON.parse(decodeURIComponent(jsonBody));
      console.log('Surebet Helper: Parsed JSON from link:', jsonData);
      console.log('Surebet Helper: Raw odds value:', jsonData.value, 'Type:', typeof jsonData.value);
      console.log('Surebet Helper: Is lay bet?', jsonData.type?.back === false);
      console.log('Surebet Helper: Probability:', jsonData.probability);
      console.log('Surebet Helper: Overvalue:', jsonData.overvalue);
      
      const parsedOdds = parseFloat(jsonData.value);
      console.log('Surebet Helper: Parsed odds:', parsedOdds, 'isNaN:', isNaN(parsedOdds), 'Final:', parsedOdds || 0);
      
      const isLayBet = jsonData.type?.back === false || false;
      
      const data = {
        timestamp: new Date().toISOString(),
        url: url,
        id: jsonData.id,
        odds: parsedOdds || 0,
        originalLayOdds: isLayBet && jsonData.original_value ? parseFloat(jsonData.original_value) : null,
        probability: parseFloat((jsonData.probability * 100).toFixed(2)) || 0,
        overvalue: parseFloat(((jsonData.overvalue - 1) * 100).toFixed(2)) || 0,
        bookmaker: jsonData.bk || '',
        sport: jsonData.sport_id === 22 ? 'Tennis' : (jsonData.sport_id === 15 ? 'Football' : 'Other'),
        tournament: jsonData.tournament || '',
        teams: jsonData.teams || [],
        event: jsonData.teams ? jsonData.teams.join(' vs ') : '',
        market: jsonData.tr_expanded || jsonData.tr_terse || '',
        eventTime: jsonData.time || null,
        commission: parseFloat(jsonData.commission) || 0,
        bk_probability: parseFloat(jsonData.bk_probability) || 0,
        bk_margin: parseFloat(jsonData.bk_margin) || 0,
        limit: parseFloat(jsonData.limit) || 0,
        currency: jsonData.currency || 'GBP',
        isLay: isLayBet,
        debugLogs: []
      };
      
      // Clean up market text (remove HTML tags)
      if (data.market) {
        data.market = data.market.replace(/<[^>]*>/g, '');
      }
      
      // Check market text for lay bet indicators (various formats)
      if (data.market) {
        const marketLower = data.market.toLowerCase();
        if (marketLower.includes('- lay') || 
            marketLower.includes('lay odds') || 
            marketLower.includes('- lay odds') ||
            marketLower.endsWith('lay')) {
          data.isLay = true;
        }
      }
      
      console.log('Surebet Helper: Extracted data from link:', data);
      console.log('Surebet Helper: Final odds value:', data.odds, 'Type:', typeof data.odds);
      return data;
    } catch (err) {
      console.error('Surebet Helper: Error parsing Surebet link data', err);
      return null;
    }
  }

  function parseSmarketsPageData() {
    try {
      console.log('Surebet Helper: Parsing bookmaker page data');
      
      // Try to detect bookmaker from hostname
      const hostname = location.hostname.toLowerCase();
      let bookmaker = 'Unknown';
      if (hostname.includes('smarkets')) bookmaker = 'Smarkets';
      else if (hostname.includes('betfair')) bookmaker = 'Betfair';
      else if (hostname.includes('betdaq')) bookmaker = 'Betdaq';
      else if (hostname.includes('matchbook')) bookmaker = 'Matchbook';
      else if (hostname.includes('bet365')) bookmaker = 'Bet365';
      else if (hostname.includes('betway')) bookmaker = 'Betway';
      else if (hostname.includes('paddypower')) bookmaker = 'Paddy Power';
      else if (hostname.includes('ladbrokes')) bookmaker = 'Ladbrokes';
      else bookmaker = hostname.split('.')[0];
      
      const data = {
        timestamp: new Date().toISOString(),
        url: location.href,
        bookmaker: bookmaker
      };

      // Extract event name from page title or h1
      const titleElement = document.querySelector('h1, title');
      if (titleElement) {
        const titleText = titleElement.textContent.trim();
        // Format: "Whitney Osuigwe vs Priska Madelyn Nugroho | Tennis odds | Smarkets..."
        const eventMatch = titleText.match(/^([^|]+)/);
        if (eventMatch) {
          data.event = eventMatch[1].trim();
        }
      }

      // Extract sport from URL or page
      const urlMatch = location.pathname.match(/\/sport\/([^\/]+)/);
      if (urlMatch) {
        data.sport = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Extract tournament from URL
      const tournamentMatch = location.pathname.match(/\/sport\/[^\/]+\/([^\/]+)/);
      if (tournamentMatch) {
        data.tournament = tournamentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Extract event time from URL
      const timeMatch = location.pathname.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})-(\d{2})\//);
      if (timeMatch) {
        data.eventTime = `${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]}T${timeMatch[4]}:${timeMatch[5]}:00Z`;
      }

      // Try to find odds buttons on the page (look for back/lay odds)
      // Smarkets typically shows odds in buttons or clickable elements
      const oddsButtons = document.querySelectorAll('[class*="odd"], [class*="price"], button[class*="back"], button[class*="lay"]');
      console.log('Surebet Helper: Found', oddsButtons.length, 'potential odds elements');
      
      // Log some samples for debugging
      if (oddsButtons.length > 0) {
        const samples = Array.from(oddsButtons).slice(0, 5).map(btn => ({
          text: btn.textContent.trim(),
          classes: btn.className,
          dataAttrs: Object.keys(btn.dataset)
        }));
        console.log('Surebet Helper: Sample odds elements:', samples);
      }

      // Add a note that user should manually select market and odds
      data.note = 'Manual odds entry - please specify market and odds';

      console.log('Surebet Helper: Parsed Smarkets data:', data);
      return data;
    } catch (err) {
      console.error('Surebet Helper: Error parsing Smarkets data', err);
      return null;
    }
  }

  function parseBetPopupData(popup) {
    try {
      console.log('Surebet Helper: Parsing bet popup data');
      const data = {
        timestamp: new Date().toISOString(),
        url: location.href
      };

      // Extract event name from popup (usually in header)
      const eventHeader = popup.querySelector('h2, h3, .event-title, [class*="event"], [class*="match"]');
      if (eventHeader) {
        data.event = eventHeader.textContent.trim();
      }

      // Extract odds from popup
      const oddsElement = popup.querySelector('[class*="odd"], [class*="coef"], .value, [data-value]');
      if (oddsElement) {
        const oddsText = oddsElement.textContent || oddsElement.dataset.value || '';
        data.odds = parseFloat(oddsText.replace(/[^\d.]/g, ''));
      }

      // Extract bookmaker
      const bookmakerElement = popup.querySelector('[class*="bookmaker"], [class*="booker"], .bookie');
      if (bookmakerElement) {
        data.bookmaker = bookmakerElement.textContent.trim();
      }

      // Extract market/bet type
      const marketElement = popup.querySelector('[class*="market"], [class*="bet-type"], .selection');
      if (marketElement) {
        data.market = marketElement.textContent.trim();
      }

      // Extract sport if available
      const sportElement = popup.querySelector('[class*="sport"]');
      if (sportElement) {
        data.sport = sportElement.textContent.trim();
      }

      // Try to get additional info from the popup text
      const allText = popup.textContent;
      
      // Look for percentage/probability patterns
      const probabilityMatch = allText.match(/(\d+\.?\d*)%/);
      if (probabilityMatch) {
        data.probability = parseFloat(probabilityMatch[1]);
      }

      // Look for overvalue patterns
      const overvalueMatch = allText.match(/overvalue[:\s]+(\d+\.?\d*)%/i) || 
                            allText.match(/edge[:\s]+(\d+\.?\d*)%/i);
      if (overvalueMatch) {
        data.overvalue = parseFloat(overvalueMatch[1]);
      }

      console.log('Surebet Helper: Parsed popup data:', data);
      return data;
    } catch (err) {
      console.error('Surebet Helper: Error parsing popup data', err);
      return null;
    }
  }

  // Auto-fill stake helper functions
  // NOTE: To add a new betting site:
  // 1. Add entry to BETTING_SLIP_SELECTORS above with bettingSlip, stakeInput, odds, selection selectors
  // 2. Add hostname pattern to SUPPORTED_SITES below
  // 3. Add to DEFAULT_AUTOFILL_SETTINGS.bookmakers above
  // 4. Add commission rate to DEFAULT_COMMISSION_RATES above
  // 5. Update settings.html with new checkbox
  // 6. Update settings.js DEFAULT_AUTOFILL_SETTINGS and load/save handlers
  
  const SUPPORTED_SITES = {
    betfair: { hostnames: ['betfair'], displayName: 'Betfair' },
    smarkets: { hostnames: ['smarkets'], displayName: 'Smarkets' },
    matchbook: { hostnames: ['matchbook'], displayName: 'Matchbook' },
    betdaq: { hostnames: ['betdaq'], displayName: 'Betdaq', asyncLoading: true }
  };

  function getExchangeFromHostname() {
    const hostname = location.hostname.toLowerCase();
    for (const [key, config] of Object.entries(SUPPORTED_SITES)) {
      if (config.hostnames.some(h => hostname.includes(h))) {
        return key;
      }
    }
    return null;
  }

  function findElement(selectors) {
    if (typeof selectors === 'string') {
      selectors = [selectors];
    }
    let selectorsTried = [];
    for (const selector of selectors) {
      try {
        selectorsTried.push(selector);
        const element = document.querySelector(selector);
        if (element) {
          // Never return elements from the extension's own UI
          try {
            if (element.closest && element.closest('.surebet-helper-stake-panel')) {
              console.log('Surebet Helper: Found element but it belongs to extension panel, skipping:', selector);
              continue;
            }
          } catch (e) {
            // ignore
          }
          if (element.id && element.id.includes('surebet-helper')) {
            console.log('Surebet Helper: Found element but it has surebet-helper id, skipping:', selector);
            continue;
          }
          if (element.className && String(element.className).includes('surebet-helper')) {
            console.log('Surebet Helper: Found element but it has surebet-helper class, skipping:', selector);
            continue;
          }
          console.log('Surebet Helper: Found element with selector:', selector);
          debugLogger.log('selector', 'Element found', { selector, total: selectors.length, attempt: selectorsTried.length });
          return element;
        }
      } catch (e) {
        console.warn('Surebet Helper: Invalid selector:', selector, e);
        debugLogger.log('selector', 'Invalid selector', { selector, error: e.message }, 'warn');
      }
    }
    debugLogger.log('selector', 'No matching selector found', { totalTried: selectorsTried.length, selectors: selectorsTried.slice(0, 3) }, 'warn');
    return null;
  }

  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetHeight > 0 && 
           element.offsetWidth > 0;
  }

  function isBettingSlipPopulated(bettingSlipElement, exchange) {
    if (!bettingSlipElement) return false;
    
    // Check if betting slip has content (odds visible, selection name present)
    const selectors = BETTING_SLIP_SELECTORS[exchange];
    if (!selectors) return false;

    const oddsElement = findElement(selectors.odds);
    const selectionElement = findElement(selectors.selection);
    
    // Check odds - could be input element (Betdaq) or text element
    let oddsValue = '';
    if (oddsElement) {
      oddsValue = oddsElement.tagName === 'INPUT' ? oddsElement.value : oddsElement.textContent;
    }
    const hasOdds = oddsElement && oddsValue.trim() && !oddsValue.includes('---');
    const hasSelection = selectionElement && selectionElement.textContent.trim();
    
    console.log('Surebet Helper: Betting slip population check - odds:', hasOdds, '(value:', oddsValue, ') selection:', hasSelection);
    return hasOdds || hasSelection || bettingSlipElement.textContent.trim().length > 50;
  }

  function findStakeInput(exchange, isLay = false) {
    const selectors = BETTING_SLIP_SELECTORS[exchange];
    if (!selectors) {
      console.warn('Surebet Helper: No selectors defined for exchange:', exchange);
      debugLogger.log('findStakeInput', 'No selectors defined', { exchange }, 'warn');
      return null;
    }

    debugLogger.log('findStakeInput', 'Looking for stake input', { exchange, isLay });

    // For exchanges with separate back/lay inputs, try to find the correct one
    if (isLay && selectors.layBet) {
      const layContainer = document.querySelector(selectors.layBet);
      if (layContainer) {
        debugLogger.log('findStakeInput', 'Lay bet container found');
        const input = findElement(selectors.stakeInput);
        if (input && input.closest(selectors.layBet)) {
          debugLogger.log('findStakeInput', 'Lay stake input matched');
          return input;
        }
      }
    }

    if (!isLay && selectors.backBet) {
      const backContainer = document.querySelector(selectors.backBet);
      if (backContainer) {
        debugLogger.log('findStakeInput', 'Back bet container found');
        const input = findElement(selectors.stakeInput);
        if (input && input.closest(selectors.backBet)) {
          debugLogger.log('findStakeInput', 'Back stake input matched');
          return input;
        }
      }
    }

    // Fallback: just find any stake input
    const stakeInput = findElement(selectors.stakeInput);
    debugLogger.log('findStakeInput', 'Fallback search result', { exchange, found: !!stakeInput });
    console.log('Surebet Helper: findStakeInput result:', stakeInput, 'for exchange:', exchange);
    return stakeInput;
  }

  async function waitForBettingSlip(exchange, maxAttempts = 20, pollDelay = 500) {
    const selectors = BETTING_SLIP_SELECTORS[exchange];
    if (!selectors) {
      console.error('Surebet Helper: Unknown exchange:', exchange);
      debugLogger.log('waitForBettingSlip', 'Unknown exchange', { exchange }, 'error');
      return null;
    }

    console.log('Surebet Helper: Waiting for betting slip on', exchange);
    const startTime = Date.now();
    debugLogger.log('waitForBettingSlip', 'Waiting for betting slip', { exchange, maxAttempts, pollDelay });
    
    return new Promise((resolve) => {
      let attempts = 0;

      const checkBettingSlip = () => {
        attempts++;
        const elapsed = Date.now() - startTime;
        console.log(`Surebet Helper: Betting slip check attempt ${attempts}/${maxAttempts} (${elapsed}ms)`);

        // Try to find the betting slip container
        const bettingSlip = findElement(selectors.bettingSlip);
        
        if (bettingSlip && isElementVisible(bettingSlip) && isBettingSlipPopulated(bettingSlip, exchange)) {
          console.log('Surebet Helper: ✓ Betting slip found and populated');
          debugLogger.log('waitForBettingSlip', 'Betting slip found', { attempt: attempts, elapsed });
          
          // Debug: Try direct querySelector for Betdaq
          if (exchange === 'betdaq') {
            const directStake = document.querySelector('input.input.stake');
            const directOdds = document.querySelector('input.input.odds');
            console.log('Surebet Helper: [Betdaq Debug] Direct stake input:', directStake);
            console.log('Surebet Helper: [Betdaq Debug] Direct odds input:', directOdds);
            if (directOdds) console.log('Surebet Helper: [Betdaq Debug] Odds value:', directOdds.value);
          }
          
          // Find stake input within betting slip
          const stakeInput = findStakeInput(exchange);
          if (stakeInput && isElementVisible(stakeInput)) {
            console.log('Surebet Helper: ✓ Stake input found and visible');
            debugLogger.log('waitForBettingSlip', 'Stake input found and visible', { attempt: attempts, elapsed });
            resolve({ bettingSlip, stakeInput });
            return;
          } else {
            console.log('Surebet Helper: Stake input not yet ready, stakeInput=', stakeInput);
            debugLogger.log('waitForBettingSlip', 'Stake input not ready', { attempt: attempts, stakeInputFound: !!stakeInput });
          }
        } else {
          console.log('Surebet Helper: Betting slip not yet populated');
        }

        if (attempts >= maxAttempts) {
          console.warn('Surebet Helper: Betting slip detection timeout after', maxAttempts * pollDelay, 'ms');
          debugLogger.log('waitForBettingSlip', 'Timeout reached', { maxAttempts, totalElapsed: elapsed }, 'warn');
          resolve(null);
          return;
        }

        // Schedule next attempt
        setTimeout(checkBettingSlip, pollDelay);
      };

      checkBettingSlip();
    });
  }

  function fillStakeInputValue(input, stakeValue) {
    if (!input) return false;
    
    const stake = String(stakeValue).trim();
    console.log('Surebet Helper: Filling stake input with value:', stake);
    debugLogger.log('fillStakeInput', 'Filling stake input', { stake }, 'info');

    // Set the value
    input.value = stake;

    // Dispatch events to trigger React/Vue/Angular change detection
    const events = [
      new Event('input', { bubbles: true }),
      new Event('change', { bubbles: true }),
      new Event('blur', { bubbles: true })
    ];

    let eventCount = 0;
    events.forEach(event => {
      try {
        input.dispatchEvent(event);
        eventCount++;
      } catch (e) {
        console.warn('Surebet Helper: Error dispatching event:', e);
        debugLogger.log('fillStakeInput', 'Error dispatching event', { event: event.type, error: e.message }, 'warn');
      }
    });

    console.log('Surebet Helper: ✓ Stake value filled and events dispatched');
    debugLogger.log('fillStakeInput', 'Stake filled and events dispatched', { stake, eventsDispatched: eventCount });
    return true;
  }

  function updateBetWithDebugLogs(betData) {
    if (!betData || !betData.id) return;
    chrome.storage.local.get({ bets: [] }, (res) => {
      const bets = res.bets || [];
      const betIndex = bets.findIndex(b => b.id === betData.id);
      if (betIndex >= 0) {
        const existingBet = bets[betIndex];
        // Merge debug logs and filter to last 24 hours
        if (!existingBet.debugLogs) existingBet.debugLogs = [];
        existingBet.debugLogs = existingBet.debugLogs.concat(betData.debugLogs || []);
        existingBet.debugLogs = filterLogsLast24Hours(existingBet.debugLogs);
        bets[betIndex] = existingBet;
        chrome.storage.local.set({ bets }, () => {
          console.log('Surebet Helper: Bet updated with debug logs');
        });
      }
    });
  }

  async function autoFillBetSlip(betData) {
    if (!autoFillSettings.enabled) {
      console.log('Surebet Helper: Auto-fill is disabled');
      debugLogger.log('autoFill', 'Auto-fill is disabled', {}, 'warn');
      return false;
    }

    if (!betData || !betData.stake) {
      console.warn('Surebet Helper: No bet data or stake available');
      debugLogger.log('autoFill', 'No bet data or stake available', { betData: !!betData, stake: betData?.stake }, 'error');
      return false;
    }

    const exchange = getExchangeFromHostname();
    if (!exchange) {
      console.warn('Surebet Helper: Could not detect exchange');
      debugLogger.log('autoFill', 'Could not detect exchange', { hostname: location.hostname }, 'error');
      return false;
    }

    // Check if auto-fill is enabled for this exchange (default to true for new exchanges)
    const exchangeEnabled = autoFillSettings.bookmakers?.[exchange] !== false;
    if (!exchangeEnabled) {
      console.log('Surebet Helper: Auto-fill disabled for', exchange);
      debugLogger.log('autoFill', 'Auto-fill disabled for exchange', { exchange }, 'warn');
      return false;
    }

    console.log('Surebet Helper: Starting auto-fill for', exchange, 'stake:', betData.stake);
    debugLogger.log('autoFill', 'Starting auto-fill', {
      exchange,
      stake: betData.stake,
      event: betData.event,
      betId: betData.id,
      timeout: autoFillSettings.timeout
    });

    // Start MutationObserver to detect betting slip
    return new Promise(async (resolve) => {
      let detected = false;
      const timeout = setTimeout(async () => {
        if (detected) return;
        console.warn('Surebet Helper: Auto-fill timeout reached');
        debugLogger.log('autoFill', 'Auto-fill timeout reached', { exchange }, 'warn');
        if (bettingSlipDetector) {
          bettingSlipDetector.disconnect();
          bettingSlipDetector = null;
        }
        // Attach logs to bet before returning
        debugLogger.attachToBet(betData);
        resolve(false);
      }, autoFillSettings.timeout);

      async function performAutoFill() {
        clearTimeout(timeout);
        if (bettingSlipDetectorPolling) clearInterval(bettingSlipDetectorPolling);
        if (bettingSlipDetector) {
          bettingSlipDetector.disconnect();
          bettingSlipDetector = null;
        }

        try {
          // Use more attempts for sites with async loading (configured in SUPPORTED_SITES)
          const siteConfig = SUPPORTED_SITES[exchange] || {};
          const maxAttempts = siteConfig.asyncLoading ? 30 : 10;
          const pollDelay = siteConfig.asyncLoading ? 300 : 200;
          debugLogger.log('autoFill', 'Waiting for betting slip', { exchange, maxAttempts, pollDelay });
          const result = await waitForBettingSlip(exchange, maxAttempts, pollDelay);
          if (result && result.bettingSlip && result.stakeInput) {
            // Validate odds haven't changed (Smarkets)
            if (exchange === 'smarkets' && betData.odds) {
              const oddsInputs = result.bettingSlip.querySelectorAll('input.box-input.numeric-value.input-value:not(.with-prefix):not([disabled])');
              if (oddsInputs.length > 0) {
                const currentOdds = parseFloat(oddsInputs[0].value);
                const expectedOdds = parseFloat(betData.odds);
                if (Math.abs(currentOdds - expectedOdds) > 0.01) {
                  console.warn(`Surebet Helper: ⚠️ Odds changed! Expected ${expectedOdds.toFixed(2)}, found ${currentOdds.toFixed(2)}`);
                  debugLogger.log('autoFill', 'Odds changed', { expected: expectedOdds, current: currentOdds }, 'warn');
                  showToast(`⚠️ Odds changed! Expected ${expectedOdds.toFixed(2)}, now ${currentOdds.toFixed(2)}`, 'warning');
                }
              }
            }
          }
          if (result && result.stakeInput) {
            debugLogger.log('autoFill', 'Filling stake input', { stake: betData.stake, inputFound: true });
            const success = fillStakeInputValue(result.stakeInput, betData.stake);
            if (success) {
              debugLogger.log('autoFill', 'Stake auto-filled successfully', { stake: betData.stake, currency: betData.currency });
              showToast(`✓ Stake auto-filled: ${betData.currency || '£'}${betData.stake}`, true, 2000);
              // Attach logs and save bet
              debugLogger.attachToBet(betData);
              updateBetWithDebugLogs(betData);
              resolve(true);
            } else {
              console.warn('Surebet Helper: Failed to fill stake input');
              debugLogger.log('autoFill', 'Failed to fill stake input', { stake: betData.stake }, 'error');
              debugLogger.attachToBet(betData);
              resolve(false);
            }
          } else {
            console.warn('Surebet Helper: Could not find stake input for auto-fill');
            debugLogger.log('autoFill', 'Could not find stake input', { resultExists: !!result }, 'error');
            debugLogger.attachToBet(betData);
            resolve(false);
          }
        } catch (err) {
          console.error('Surebet Helper: Auto-fill error:', err);
          debugLogger.log('autoFill', 'Auto-fill error', { error: err.message }, 'error');
          debugLogger.attachToBet(betData);
          resolve(false);
        }
      }

      // Immediately check if betting slip already exists (not dynamically loaded)
      const immediateResult = await waitForBettingSlip(exchange, 1, 0);
      if (immediateResult && immediateResult.stakeInput) {
        console.log('Surebet Helper: Betting slip already present on page');
        debugLogger.log('autoFill', 'Betting slip already present on page', {});
        detected = true;
        await performAutoFill();
        return;
      }

      // Set up MutationObserver for dynamically loaded betting slips
      const observer = new MutationObserver(async (mutations) => {
        if (detected) return;

        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if the added node is or contains the betting slip
              const selectors = BETTING_SLIP_SELECTORS[exchange];
              for (const slipSelector of selectors.bettingSlip) {
                if (node.matches?.(slipSelector) || node.querySelector?.(slipSelector)) {
                  console.log('Surebet Helper: Betting slip detected via MutationObserver');
                  debugLogger.log('autoFill', 'Betting slip detected via MutationObserver', { selector: slipSelector });
                  detected = true;
                  performAutoFill();
                  return;
                }
              }
            }
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      bettingSlipDetector = observer;

      // Polling fallback for SPAs
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        if (detected || pollCount >= 20) {
          clearInterval(pollInterval);
          return;
        }
        pollCount++;
        
        const result = await waitForBettingSlip(exchange, 1, 0);
        if (result && result.stakeInput) {
          console.log('Surebet Helper: Betting slip detected via polling');
          debugLogger.log('autoFill', 'Betting slip detected via polling', { pollCount });
          detected = true;
          performAutoFill();
        }
      }, 500);

      bettingSlipDetectorPolling = pollInterval;
    });
  }

  async function getSurebetDataFromReferrer() {
    const retrievalTimestamp = new Date().toISOString();
    console.log(`Surebet Helper: [${retrievalTimestamp}] Starting Smarkets retrieval - querying broker for pendingBet`);
    debugLogger.log('betRetrieval', 'Starting bet data retrieval from broker', { timestamp: retrievalTimestamp });
    
    // Use cached promise if already in flight (prevents multiple consumers from consuming twice)
    if (cachedPendingBetPromise) {
      console.log('Surebet Helper: ℹ Reusing in-flight broker query');
      debugLogger.log('betRetrieval', 'Reusing in-flight broker query', {});
      return cachedPendingBetPromise;
    }
    
    // If already cached, return immediately
    if (cachedPendingBet !== null) {
      console.log(`Surebet Helper: ℹ Returning cached pendingBet (ID: ${cachedPendingBet ? cachedPendingBet.id : 'none'})`);
      debugLogger.log('betRetrieval', 'Returning cached bet', { betId: cachedPendingBet?.id });
      return cachedPendingBet;
    }
    
    // Create and cache the retrieval promise
    cachedPendingBetPromise = (async () => {
      try {
        // 1. BROKER: Query background context for pendingBet (cross-origin safe)
        debugLogger.log('betRetrieval', 'Querying broker for pending bet', {});
        const brokerResult = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Broker timeout'));
          }, 3000);
          
          chrome.runtime.sendMessage(
            { action: 'consumePendingBet' },
            (response) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        });
        
        if (brokerResult && brokerResult.betData) {
          cachedPendingBet = brokerResult.betData;
          console.log(`Surebet Helper: ✓ Broker returned pendingBet (ID: ${cachedPendingBet.id})`);
          console.log('Surebet Helper: Retrieved bet data from broker:', cachedPendingBet);
          debugLogger.log('betRetrieval', 'Broker returned pending bet', { betId: cachedPendingBet.id, success: true });
          return cachedPendingBet;
        } else {
          console.log('Surebet Helper: Broker found no pendingBet, trying fallbacks');
          debugLogger.log('betRetrieval', 'Broker found no pending bet, trying fallbacks', {}, 'warn');
        }
      } catch (err) {
        console.warn(`Surebet Helper: ⚠ Broker query failed (${err.message}), trying fallbacks`);
        debugLogger.log('betRetrieval', 'Broker query failed', { error: err.message }, 'warn');
      }
      
      // 2. FALLBACK: Try chrome.storage.local (async)
      try {
        debugLogger.log('betRetrieval', 'Trying storage fallback', {});
        const result = await new Promise((resolve) => {
          setTimeout(() => {
            chrome.storage.local.get(['pendingBet'], (storageResult) => {
              if (storageResult && storageResult.pendingBet && storageResult.pendingBet.id) {
                resolve(storageResult.pendingBet);
              } else {
                resolve(null);
              }
            });
          }, 100);
        });
        
        if (result) {
          cachedPendingBet = result;
          console.log(`Surebet Helper: ✓ Found pendingBet in chrome.storage.local (ID: ${result.id})`);
          console.log('Surebet Helper: Retrieved bet data from storage:', result);
          debugLogger.log('betRetrieval', 'Found bet in storage', { betId: result.id }, 'info');
          
          // Clear after retrieval
          chrome.storage.local.remove('pendingBet', () => {
            console.log('Surebet Helper: ✓ Cleared pendingBet from chrome.storage.local');
          });
          
          return result;
        }
      } catch (err) {
        console.warn(`Surebet Helper: ⚠ Storage fallback failed (${err.message})`);
        debugLogger.log('betRetrieval', 'Storage fallback failed', { error: err.message }, 'warn');
      }
      
      // 3. FALLBACK: Try document.referrer
      if (document.referrer && document.referrer.includes('/nav/valuebet/prong/')) {
        console.log('Surebet Helper: Referrer detected from surebet.com');
        debugLogger.log('betRetrieval', 'Using referrer fallback', { referrer: document.referrer.substring(0, 50) + '...' });
        const betData = parseSurebetLinkData(document.referrer);
        if (betData) {
          cachedPendingBet = betData;
          console.log(`Surebet Helper: ✓ Parsed data from referrer (ID: ${betData.id})`);
          return betData;
        } else {
          console.warn('Surebet Helper: ⚠ Failed to parse referrer data (may be truncated by browser)');
        }
      }
      
      // 4. FALLBACK: Try parent window frame
      try {
        if (window !== window.top && window.top.location.href.includes('/nav/valuebet/prong/')) {
          const betData = parseSurebetLinkData(window.top.location.href);
          if (betData) {
            cachedPendingBet = betData;
            console.log(`Surebet Helper: ✓ Found bet data from parent frame (ID: ${betData.id})`);
            return betData;
          }
        }
      } catch (e) {
        console.log('Surebet Helper: Cannot access parent frame (cross-origin):', e.message);
      }
      
      // No data found anywhere
      console.log('Surebet Helper: ⚠ No pending bet data found - user will need to manually enter stakes');
      cachedPendingBet = null;
      return null;
    })();
    
    try {
      const result = await cachedPendingBetPromise;
      return result;
    } finally {
      // Clear the in-flight promise after resolution
      cachedPendingBetPromise = null;
    }
  }

  async function injectSaveButtonOnSmarkets() {
    if (isDisabled) {
      return;
    }
    // Skip if button already injected
    if (document.querySelector('.surebet-helper-save-btn-smarkets')) {
      console.log('Surebet Helper: Save button already on Smarkets page');
      return;
    }

    console.log('Surebet Helper: Injecting save button on Smarkets page');

    // Try to get data from Surebet click
    const surebetData = await getSurebetDataFromReferrer();

    // Create a floating save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'surebet-helper-save-btn-smarkets';
    saveBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 16px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;
    saveBtn.textContent = surebetData ? '💾 Save Bet (From Surebet)' : '💾 Save Bet';
    saveBtn.title = surebetData ? 'Save the bet you clicked from Surebet' : 'Click to save the current bet to your log';

    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#218838';
      saveBtn.style.transform = 'scale(1.05)';
    });

    saveBtn.addEventListener('mouseleave', () => {
      if (!saveBtn.disabled) {
        saveBtn.style.background = '#28a745';
        saveBtn.style.transform = 'scale(1)';
      }
    });

    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      saveBtn.disabled = true;
      saveBtn.style.background = '#6c757d';
      saveBtn.textContent = 'Saving...';

      let betData = surebetData || parseSmarketsPageData();
      
      if (!betData) {
        showToast('Failed to extract bet data from page', false);
        saveBtn.disabled = false;
        saveBtn.style.background = '#28a745';
        saveBtn.textContent = '💾 Save Bet';
        return;
      }

      const saved = await saveBet(betData);
      if (saved) {
        showToast('✓ Bet saved successfully!');
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save Bet';
          saveBtn.style.background = '#28a745';
          saveBtn.disabled = false;
        }, 2000);
      } else {
        saveBtn.textContent = '💾 Save Bet';
        saveBtn.style.background = '#28a745';
        saveBtn.disabled = false;
      }
    });

    document.body.appendChild(saveBtn);
    console.log('Surebet Helper: Floating save button added to Smarkets page');
  }

  function injectSaveButtonInPopup(popup) {
    if (isDisabled) {
      return;
    }
    // Skip if button already injected
    if (popup.querySelector('.surebet-helper-save-btn-popup')) {
      console.log('Surebet Helper: Save button already in popup');
      return;
    }

    console.log('Surebet Helper: Injecting save button into bet popup');

    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'surebet-helper-save-btn surebet-helper-save-btn-popup';
    saveBtn.style.cssText = `
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      margin: 10px 0;
      display: block;
      width: 100%;
      font-weight: bold;
      transition: background 0.2s;
    `;
    saveBtn.textContent = '💾 Save This Bet';
    saveBtn.title = 'Save this bet to your log';

    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#218838';
    });

    saveBtn.addEventListener('mouseleave', () => {
      if (!saveBtn.disabled) {
        saveBtn.style.background = '#28a745';
      }
    });

    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      saveBtn.disabled = true;
      saveBtn.style.background = '#6c757d';
      saveBtn.textContent = 'Saving...';

      const betData = parseBetPopupData(popup);
      if (!betData) {
        showToast('Failed to extract bet data from popup', false);
        saveBtn.disabled = false;
        saveBtn.style.background = '#28a745';
        saveBtn.textContent = '💾 Save This Bet';
        return;
      }

      const saved = await saveBet(betData);
      if (saved) {
        showToast('✓ Bet saved successfully!');
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save This Bet';
          saveBtn.disabled = false;
        }, 2000);
      } else {
        saveBtn.textContent = '💾 Save This Bet';
        saveBtn.style.background = '#28a745';
        saveBtn.disabled = false;
      }
    });

    // Find the best place to insert the button
    // Try to find a button container or footer area
    let insertTarget = popup.querySelector('[class*="footer"], [class*="actions"], [class*="buttons"], .modal-footer');
    
    if (insertTarget) {
      // Insert at the beginning of the container
      insertTarget.insertBefore(saveBtn, insertTarget.firstChild);
    } else {
      // Try to find the main content area
      insertTarget = popup.querySelector('[class*="content"], [class*="body"], .modal-body');
      if (insertTarget) {
        // Append to the end
        insertTarget.appendChild(saveBtn);
      } else {
        // Last resort: just append to the popup itself
        popup.appendChild(saveBtn);
      }
    }

    console.log('Surebet Helper: Save button injected into popup successfully');
  }

  function detectAndInjectIntoPopup() {
    if (isDisabled) {
      return;
    }
    // Only run on Smarkets or other bookmaker sites, NOT on Surebet
    if (location.hostname.includes('surebet.com')) {
      console.log('Surebet Helper: On Surebet page, skipping popup detection');
      return;
    }
    
    console.log('Surebet Helper: === Detecting bet popup ===');
    
    // Look for various types of popup/modal containers that might contain bet details
    const popupSelectors = [
      '.popup:not(.hidden)',
      '.modal:not(.hidden)',
      '[role="dialog"]',
      '[class*="Modal"]:not([style*="display: none"])',
      '[class*="Popup"]:not([style*="display: none"])',
      '[class*="overlay"]:not([style*="display: none"])',
      '.bet-details',
      '[class*="bet-detail"]'
    ];

    // Also try to find any absolutely positioned elements that might be popups
    const allDivs = document.querySelectorAll('div');
    const candidates = [];
    
    for (const selector of popupSelectors) {
      const popups = document.querySelectorAll(selector);
      console.log(`Surebet Helper: Found ${popups.length} elements matching "${selector}"`);
      
      popups.forEach(popup => {
        const style = window.getComputedStyle(popup);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        
        if (isVisible) {
          const text = popup.textContent.toLowerCase();
          console.log(`Surebet Helper: Checking visible popup:`, {
            selector,
            classes: popup.className,
            hasOdd: text.includes('odd'),
            hasBet: text.includes('bet'),
            hasMatch: text.includes('match'),
            hasEvent: text.includes('event'),
            textSample: text.substring(0, 100)
          });
          
          // Check if it contains bet-related content (odds, events, etc.)
          if (text.includes('odd') || text.includes('bet') || text.includes('match') || 
              text.includes('event') || text.includes('coef') || text.includes('value') ||
              popup.querySelector('[class*="odd"], [class*="coef"], [data-value]')) {
            console.log('Surebet Helper: ✓ Found bet popup with selector:', selector);
            candidates.push(popup);
          }
        }
      });
    }
    
    // Also check for any fixed/absolute positioned divs that appeared recently and are visible
    allDivs.forEach(div => {
      const style = window.getComputedStyle(div);
      if ((style.position === 'fixed' || style.position === 'absolute') &&
          style.display !== 'none' && 
          style.visibility !== 'hidden' &&
          parseInt(style.zIndex) > 100) {
        const text = div.textContent.toLowerCase();
        if ((text.includes('odd') || text.includes('coef') || text.includes('value')) && 
            text.length > 20 && text.length < 5000) {
          console.log('Surebet Helper: Found positioned div that might be popup:', {
            position: style.position,
            zIndex: style.zIndex,
            classes: div.className
          });
          if (!candidates.includes(div)) {
            candidates.push(div);
          }
        }
      }
    });
    
    console.log(`Surebet Helper: Total popup candidates found: ${candidates.length}`);
    
    // Inject into all candidates
    candidates.forEach(popup => {
      injectSaveButtonInPopup(popup);
    });
  }

  function cleanupExtension() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (clickHandlers.surebetLink) {
      document.removeEventListener('click', clickHandlers.surebetLink, true);
      clickHandlers.surebetLink = null;
    }

    if (clickHandlers.global) {
      document.removeEventListener('click', clickHandlers.global, true);
      clickHandlers.global = null;
    }

    document.querySelectorAll('.surebet-helper-save-btn, .surebet-helper-save-btn-smarkets, .surebet-helper-preset-container, .surebet-helper-hide-lay-btn, .surebet-helper-toast, #surebet-helper-toast-container').forEach((node) => {
      node.remove();
    });
    document.querySelectorAll('.surebet-helper-stake-indicator').forEach((node) => node.remove());

    document.querySelectorAll('.surebet-helper-high-stake').forEach((row) => {
      row.classList.remove('surebet-helper-high-stake');
    });

    document.querySelectorAll('.surebet-helper-hidden-row').forEach((row) => {
      row.classList.remove('surebet-helper-hidden-row');
    });

    const styleEl = document.getElementById('surebet-helper-style');
    if (styleEl) {
      styleEl.remove();
    }

    if (stakePanel) {
      stakePanel.remove();
      stakePanel = null;
    }

    isInitialized = false;
  }

  async function init() {
    if (isDisabled) {
      console.log('Surebet Helper: Disabled, initialization skipped');
      return;
    }
    if (isInitialized) {
      return;
    }
    isInitialized = true;
    console.log('Surebet Helper: ===== INITIALIZING =====');
    console.log('Surebet Helper: URL:', location.href);
    injectStyles();
    console.log('✅ Surebet Helper: Styles injected');
    await loadStakingSettings();
    console.log('✅ Surebet Helper: Staking settings loaded');
    // Panel removed - Kelly staking now in settings tab
    // injectStakePanel();
    // startStakePanelMonitoring();
    
    // If on any bookmaker site, inject floating button and start auto-fill
    if (onBookmakerSite) {
      const exchange = getExchangeFromHostname();
      console.log('Surebet Helper: On bookmaker site:', location.hostname, '(exchange:', exchange || 'unknown', ')');
      console.log('Surebet Helper: Auto-fill settings:', JSON.stringify(autoFillSettings));
      
      // Debug: Test selectors immediately
      if (exchange) {
        const selectors = BETTING_SLIP_SELECTORS[exchange];
        if (selectors) {
          console.log('Surebet Helper: Testing selectors for', exchange);
          console.log('  - bettingSlip selectors:', selectors.bettingSlip);
          console.log('  - stakeInput selectors:', selectors.stakeInput);
          
          const bettingSlip = findElement(selectors.bettingSlip);
          console.log('  - bettingSlip found:', !!bettingSlip, bettingSlip);
          
          const stakeInput = findElement(selectors.stakeInput);
          console.log('  - stakeInput found:', !!stakeInput, stakeInput);
          
          if (stakeInput) {
            console.log('  - stakeInput visible:', isElementVisible(stakeInput));
            console.log('  - stakeInput value:', stakeInput.value);
          }
        }
      }
      
      // Try auto-fill if enabled
      setTimeout(async () => {
        const betData = await getSurebetDataFromReferrer();
        if (betData) {
          console.log('Surebet Helper: Bet data available, attempting auto-fill');
          betData.stake = calculateKellyStake(betData);
          console.log(`Surebet Helper: Calculated Kelly stake: ${betData.stake}`);
          const success = await autoFillBetSlip(betData);
          if (success) {
            console.log('Surebet Helper: ✓ Auto-fill completed successfully');
          } else {
            console.log('Surebet Helper: Auto-fill did not complete, clipboard fallback available');
          }
        } else {
          console.log('Surebet Helper: No bet data available from referrer/broker');
        }
      }, 500);
      
      setTimeout(injectSaveButtonOnSmarkets, 1000);
      // Don't do the table row injection on bookmaker sites
      return;
    }
    
    // Inject hide lay bets button on Surebet page
    setTimeout(injectHideLayButton, 500);
    
    // On Surebet: intercept clicks on valuebet links and send to background broker
    clickHandlers.surebetLink = async (e) => {
      if (isDisabled) {
        return;
      }
      const link = e.target.closest('a[href*="/nav/valuebet/prong/"]');
      if (link && link.href) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Surebet Helper: Surebet link clicked, sending bet data to broker');
        const betData = parseSurebetLinkData(link.href);
        if (betData) {
          // Log bet save initiation
          debugLogger.log('betSave', 'Bet data parsed from link', {
            id: betData.id,
            event: betData.event,
            bookmaker: betData.bookmaker,
            odds: betData.odds,
            exchange: debugLogger.exchange
          });
          
          const timestamp = new Date().toISOString();
          console.log(`Surebet Helper: [${timestamp}] Broker saving pendingBet with ID: ${betData.id}`);
          
          // Send to background broker (cross-origin safe)
          try {
            const response = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Broker timeout'));
              }, 5000);
              
              chrome.runtime.sendMessage(
                { action: 'savePendingBet', betData },
                (response) => {
                  clearTimeout(timeout);
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            
            if (response && response.success) {
              console.log(`Surebet Helper: ✓ Broker confirmed pendingBet saved (ID: ${betData.id})`);
              console.log('Surebet Helper: Bet data stored for bookmaker page:', betData);
              debugLogger.log('betSave', 'Broker confirmed pendingBet saved', { id: betData.id });
              // Navigate to bookmaker
              window.location.href = link.href;
            } else {
              console.warn('Surebet Helper: ⚠ Broker save failed, navigating anyway');
              debugLogger.log('betSave', 'Broker save failed', { id: betData.id }, 'warn');
              window.location.href = link.href;
            }
          } catch (err) {
            console.error('Surebet Helper: ⚠ Broker communication error:', err.message);
            debugLogger.log('betSave', 'Broker communication error', { error: err.message }, 'error');
            // Navigate anyway to not block user
            window.location.href = link.href;
          }
        }
      }
    };
    document.addEventListener('click', clickHandlers.surebetLink, true);
    
    // Initial injection with multiple retry attempts (for Surebet)
    setTimeout(injectSaveButtons, 500);
    
    // Try injecting preset buttons multiple times with increasing delays
    setTimeout(injectPresetButtons, 800);
    setTimeout(injectPresetButtons, 1500);
    setTimeout(injectPresetButtons, 3000);
    setTimeout(injectPresetButtons, 5000);
    
    // Also watch for clicks on filter buttons that might open the popup
    clickHandlers.global = (e) => {
      if (isDisabled) {
        return;
      }
      console.log('Surebet Helper: Click detected on:', e.target.tagName, e.target.className, e.target);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('Surebet Helper: Post-click injection attempt (200ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 200);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('Surebet Helper: Post-click injection attempt (500ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 500);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('Surebet Helper: Post-click injection attempt (1000ms)');
        injectPresetButtons();
        detectAndInjectIntoPopup();
      }, 1000);
      setTimeout(() => {
        if (isDisabled) return;
        console.log('Surebet Helper: Post-click injection attempt (1500ms)');
        detectAndInjectIntoPopup();
      }, 1500);
    };
    document.addEventListener('click', clickHandlers.global, true);

    // Watch for new rows being added (auto-update feature)
    mutationObserver = new MutationObserver((mutations) => {
      if (isDisabled) {
        return;
      }
      let shouldInject = false;
      let shouldInjectPresets = false;
      let shouldCheckPopup = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.classList?.contains('valuebet_record') || 
                node.querySelector?.('.valuebet_record')) {
              shouldInject = true;
            }
            // Check if filter UI was added
            if (node.querySelector?.('input[type="checkbox"]') ||
                node.classList?.contains('filter') ||
                node.classList?.contains('filters')) {
              shouldInjectPresets = true;
            }
            // Check if a popup/modal was added
            if (node.classList?.contains('popup') || 
                node.classList?.contains('modal') ||
                node.getAttribute?.('role') === 'dialog' ||
                node.className?.includes?.('Modal') ||
                node.className?.includes?.('Popup') ||
                node.className?.includes?.('overlay')) {
              shouldCheckPopup = true;
            }
          }
        });
      });
      
      if (shouldInject && !isDisabled) {
        setTimeout(injectSaveButtons, 100);
        // Reapply hide lay filter if active
        setTimeout(() => {
          if (isDisabled) return;
          const hideLayBtn = document.querySelector('.surebet-helper-hide-lay-btn');
          if (hideLayBtn && hideLayBtn.classList.contains('active')) {
            toggleLayBets();
          }
        }, 150);
      }
      if (shouldInjectPresets && !isDisabled) {
        setTimeout(injectPresetButtons, 300);
      }
      if (shouldCheckPopup && !isDisabled) {
        setTimeout(detectAndInjectIntoPopup, 200);
      }
    });

    // Observe the main content area
    const mainContent = document.querySelector('main') || document.querySelector('.page-container') || document.body;
    mutationObserver.observe(mainContent, { childList: true, subtree: true });
    
    console.log('Surebet Helper: Initialization complete, observers active');
  }

  function scheduleInit() {
    if (isDisabled) {
      return;
    }
    const startInit = () => {
      init().catch((err) => console.error('Surebet Helper: Initialization failed', err));
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startInit, { once: true });
    } else {
      startInit();
    }
  }

  function updateDisabledState(disabled) {
    const wasDisabled = isDisabled;
    isDisabled = disabled;

    if (disabled) {
      if (!wasDisabled) {
        console.log('Surebet Helper: Disabled via action menu');
      }
      cleanupExtension();
      return;
    }

    if (wasDisabled) {
      console.log('Surebet Helper: Re-enabled via action menu');
    }
    scheduleInit();
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'extension-disabled-changed') {
        updateDisabledState(Boolean(message.disabled));
      }
    });
  }

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      
      // Handle stakingSettings changes
      if (changes.stakingSettings?.newValue) {
        const next = changes.stakingSettings.newValue;
        stakingSettings = {
          bankroll: sanitizeBankroll(next.bankroll ?? stakingSettings.bankroll ?? DEFAULT_STAKING_SETTINGS.bankroll, 0),
          baseBankroll: sanitizeBankroll(
            next.baseBankroll ?? next.bankroll ?? stakingSettings.baseBankroll ?? DEFAULT_STAKING_SETTINGS.baseBankroll,
            DEFAULT_STAKING_SETTINGS.baseBankroll
          ),
          fraction: sanitizeFraction(next.fraction ?? stakingSettings.fraction ?? DEFAULT_STAKING_SETTINGS.fraction),
          useCommission: next.useCommission !== false,
          customCommissionRates: stakingSettings.customCommissionRates || {}
        };
        updateStakePanelDisplay();
        updateStakeIndicators();
      }
      
      // Handle commission changes from popup
      if (changes.commission?.newValue) {
        const newRates = changes.commission.newValue;
        console.log('💰 [StakePanel] Commission rates updated from popup (raw):', newRates);
        console.log('💰 [StakePanel] Updated commission keys:', Object.keys(newRates));
        console.log('💰 [StakePanel] Updated commission values:', Object.entries(newRates).map(([k, v]) => `${k}=${v}%`).join(', '));
        stakingSettings.customCommissionRates = newRates;
        updateStakeIndicators();
        showToast('Commission rates updated', true, 2000);
      }

      // Handle rounding settings changes from popup
      if (changes.roundingSettings?.newValue) {
        const newSettings = changes.roundingSettings.newValue;
        roundingSettings = {
          enabled: newSettings.enabled !== false,
          increment: newSettings.increment || null
        };
        console.log('📏 [StakePanel] Rounding settings updated from popup:', roundingSettings);
        updateStakeIndicators();
        showToast('Rounding settings updated', true, 2000);
      }

      // Handle auto-fill settings changes from popup
      if (changes.autoFillSettings?.newValue) {
        const newSettings = changes.autoFillSettings.newValue;
        autoFillSettings = {
          enabled: newSettings.enabled !== false,
          bookmakers: newSettings.bookmakers || { betfair: true, matchbook: true, smarkets: true },
          timeout: newSettings.timeout || 10000,
          requireConfirmation: newSettings.requireConfirmation || false
        };
        console.log('⚙️ [AutoFill] Auto-fill settings updated from popup:', autoFillSettings);
        showToast('Auto-fill settings updated', true, 2000);
      }
    });
  }

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ [DISABLE_STORAGE_KEY]: false }, (result) => {
      const disabled = Boolean(result[DISABLE_STORAGE_KEY]);
      if (disabled) {
        updateDisabledState(true);
      } else {
        scheduleInit();
      }
    });
  } else {
    scheduleInit();
  }
})();








