// Simple regression harness for calculateBetPL logic.
// Run with: node pl_regression_test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const analysisPath = path.join(__dirname, 'analysis.js');
const source = fs.readFileSync(analysisPath, 'utf8');

// Extract only the commission helpers and calculateBetPL to avoid DOM/browser dependencies.
const helperMatch = source.match(/const DEFAULT_COMMISSION_RATES[\s\S]*?function calculateExpectedValueAmount/);
if (!helperMatch) {
  throw new Error('Unable to locate calculateBetPL block in analysis.js');
}

const helperCode = helperMatch[0].replace(/function calculateExpectedValueAmount[\s\S]*/, '');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(helperCode, sandbox);

const { calculateBetPL } = sandbox;

if (typeof calculateBetPL !== 'function') {
  throw new Error('calculateBetPL not initialized for testing');
}

const approxEqual = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

const tests = [
  {
    name: 'Imported win uses actualPL',
    bet: { status: 'won', actualPL: 12.34 },
    expected: 12.34
  },
  {
    name: 'Imported loss uses actualPL',
    bet: { status: 'lost', actualPL: -5 },
    expected: -5
  },
  {
    name: 'Calculated back win with commission',
    bet: { status: 'won', stake: 10, odds: 3, bookmaker: 'Betfair', isLay: false },
    expected: 19 // (10*3-10) = 20 minus 5% commission = 19
  },
  {
    name: 'Calculated back loss',
    bet: { status: 'lost', stake: 10, odds: 3, bookmaker: 'Betfair', isLay: false },
    expected: -10
  },
  {
    name: 'Calculated lay win with commission',
    bet: { status: 'won', stake: 10, odds: 3, bookmaker: 'Betfair', isLay: true, originalLayOdds: 3 },
    expected: 9.5 // stake 10 minus 5% commission
  },
  {
    name: 'Calculated lay loss',
    bet: { status: 'lost', stake: 10, odds: 3, bookmaker: 'Betfair', isLay: true, originalLayOdds: 3 },
    expected: -20 // liability on lay loss
  },
  {
    name: 'Void returns zero',
    bet: { status: 'void', stake: 10, odds: 3, bookmaker: 'Betfair', isLay: false },
    expected: 0
  }
];

let passed = 0;

for (const t of tests) {
  const result = calculateBetPL(t.bet);
  if (!approxEqual(result, t.expected)) {
    console.error(`FAIL: ${t.name} — expected ${t.expected}, got ${result}`);
    process.exitCode = 1;
    continue;
  }
  passed += 1;
}

if (process.exitCode) {
  console.error(`\n${passed}/${tests.length} tests passed`);
} else {
  console.log(`All tests passed: ${passed}/${tests.length}`);
}
