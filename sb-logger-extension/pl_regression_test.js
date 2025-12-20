const fs = require('fs');
const path = require('path');

// Mock browser API
global.chrome = {
    storage: {
        local: {
            get: (keys, cb) => cb({ commission: { smarkets: 2.0, betfair: 5.0 } })
        }
    }
};

// Load analysis.js content
const analysisPath = path.join(__dirname, 'sb-logger-extension', 'analysis.js');
const analysisContent = fs.readFileSync(analysisPath, 'utf8');

// Extract relevant functions using eval (safe in this controlled environment)
// We need to mock document and window for analysis.js to load without errors if it accesses DOM
global.document = {
    getElementById: () => null,
    addEventListener: () => { }
};
global.window = {
    location: { hash: '' }
};

// We need to wrap the content in a way that exposes the functions we want to test
// Since analysis.js is not a module, we can just eval it in the global scope or a context
// But it has some top-level execution code. Let's try to extract the functions we need.

// Helper to extract function body
function extractFunction(name) {
    const regex = new RegExp(`function ${name}\\s*\\(([^)]*)\\)\\s*{([\\s\\S]*?)^}`, 'm');
    const match = analysisContent.match(regex);
    if (match) {
        return new Function(match[1].split(','), match[2]);
    }
    return null;
}

// We can also just copy the calculateBetPL function and dependencies for testing logic
// ensuring it matches what's in the file.
// However, to test the ACTUAL file content, we should try to load it.

// Let's define the functions we want to test by extracting them from the file content
// This is a bit hacky but works for a quick harness without modifying the source to be a module.

// 1. Extract getCommission
const getCommissionMatch = analysisContent.match(/function getCommission[\s\S]*?^}/m);
eval(getCommissionMatch[0]);

// 2. Extract calculateBetPL
const calculateBetPLMatch = analysisContent.match(/function calculateBetPL[\s\S]*?^}/m);
if (!calculateBetPLMatch) {
    console.error('❌ calculateBetPL function not found in analysis.js');
    process.exit(1);
}
eval(calculateBetPLMatch[0]);

// Test Cases
const testCases = [
    {
        name: 'Imported bet with actualPL (Win)',
        bet: {
            status: 'won',
            actualPL: 10.50,
            stake: 10,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: false
        },
        expected: 10.50
    },
    {
        name: 'Imported bet with actualPL (Loss)',
        bet: {
            status: 'lost',
            actualPL: -10.00,
            stake: 10,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: false
        },
        expected: -10.00
    },
    {
        name: 'Calculated bet (Win, Back, Smarkets 2%)',
        bet: {
            status: 'won',
            stake: 100,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: false
            // No actualPL
        },
        // Gross profit: 100 * (2.0 - 1) = 100
        // Commission: 100 * 2% = 2
        // Net: 98
        expected: 98.00
    },
    {
        name: 'Calculated bet (Win, Lay, Smarkets 2%)',
        bet: {
            status: 'won',
            stake: 100,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: true
            // No actualPL
        },
        // Gross profit (stake kept): 100
        // Commission: 100 * 2% = 2
        // Net: 98
        expected: 98.00
    },
    {
        name: 'Calculated bet (Loss, Back)',
        bet: {
            status: 'lost',
            stake: 100,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: false
        },
        expected: -100.00
    },
    {
        name: 'Calculated bet (Loss, Lay)',
        bet: {
            status: 'lost',
            stake: 100,
            odds: 2.0,
            bookmaker: 'smarkets',
            isLay: true
        },
        // Liability: 100 * (2.0 - 1) = 100
        expected: -100.00
    },
    {
        name: 'Void bet',
        bet: {
            status: 'void',
            stake: 100,
            odds: 2.0
        },
        expected: 0
    }
];

console.log('🧪 Running P/L Calculation Regression Tests...\n');

let passed = 0;
let failed = 0;

// Setup commission rates for the test
global.commissionRates = { smarkets: 2.0, betfair: 5.0 };

testCases.forEach(test => {
    try {
        const result = calculateBetPL(test.bet);
        if (Math.abs(result - test.expected) < 0.01) {
            console.log(`✅ ${test.name}: Passed (Got ${result})`);
            passed++;
        } else {
            console.error(`❌ ${test.name}: Failed`);
            console.error(`   Expected: ${test.expected}`);
            console.error(`   Got:      ${result}`);
            failed++;
        }
    } catch (e) {
        console.error(`❌ ${test.name}: Error - ${e.message}`);
        failed++;
    }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log('\n✨ All regression tests passed!');
}
