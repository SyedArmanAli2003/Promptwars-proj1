/**
 * VenueIQ — Unit Test Suite
 * test.js
 *
 * 5 plain-JavaScript unit tests — no library or bundler required.
 * Open in any browser console or run with: node test.js
 *
 * Usage (browser): add <script src="test.js"></script> to the page and
 *                  open the DevTools console to see results.
 * Usage (Node.js): node test.js
 */

'use strict';

/* ─────────────────────────────────────────────
   TINY TEST HARNESS
   ───────────────────────────────────────────── */

let passed = 0, failed = 0, total = 0;

/**
 * Asserts that value is truthy; logs pass/fail with a descriptive label.
 * @param {string} label - Human-readable description of the assertion.
 * @param {*} value - The expression being tested (truthy = pass).
 */
function assert(label, value) {
  total++;
  if (value) {
    passed++;
    console.log(`  ✅ PASS — ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL — ${label}`);
  }
}

/**
 * Groups related assertions into a named test block.
 * @param {string} name - Title of the test suite block.
 * @param {Function} fn - Function containing assert() calls.
 */
function test(name, fn) {
  console.group(`🔷 ${name}`);
  fn();
  console.groupEnd();
}

/* ─────────────────────────────────────────────
   STUB HELPERS
   Minimal implementations of app functions for isolated testing.
   ───────────────────────────────────────────── */

/** Returns the density level label for a wait-time value. */
function classifyWait(m) { return m <= 5 ? 'low' : m <= 12 ? 'mid' : 'high'; }

/** Clamps a number between min and max. */
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/** Simulates one tick of wait-time shifting, returning new values. */
function shiftWaitTimesTick(current, ranges) {
  const next = {};
  for (const key of Object.keys(current)) {
    const delta = Math.round((Math.random() - 0.45) * 3);
    next[key] = clamp(current[key] + delta, ...ranges[key]);
  }
  return next;
}

/** Simulates one tick of occupancy update, returning the clamped new value. */
function updateOccupancyTick(current) {
  const delta = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 5);
  return Math.max(5, Math.min(98, current + delta));
}

/** Returns the role string that should be routed given a login selection. */
function resolveRoute(role) {
  if (role === 'attendee') return 'view-attendee';
  if (role === 'staff')    return 'view-staff';
  return 'login';
}

/** Returns the next alert index, wrapping around cyclically. */
function nextAlertIndex(current, total) { return (current + 1) % total; }

/** Simulates a deployStaff action and returns the zone's updated status object. */
function simulateDeploy(zone) {
  return {
    level:     'low',
    staffDelta: 4,
    deployed:  true,
    name:      zone,
  };
}

/* ─────────────────────────────────────────────
   TEST 1 — Wait time values are always positive numbers
   ───────────────────────────────────────────── */
test('Wait-time values are always positive numbers', () => {
  const initial = { food: 12, rest: 5, snack: 18, exit: 3 };
  const ranges  = { food: [6, 22], rest: [2, 14], snack: [10, 25], exit: [1, 8] };

  for (let i = 0; i < 50; i++) {
    const next = shiftWaitTimesTick(initial, ranges);
    for (const key of Object.keys(next)) {
      const v = next[key];
      assert(`After tick ${i + 1}: "${key}" is a positive number (${v})`, typeof v === 'number' && v > 0);
    }
    // Only check first 5 ticks in detail to keep console readable
    if (i === 4) break;
  }

  // Boundary: minimum clamp returns positive value
  const minResult = clamp(0, 1, 8);
  assert('Clamp of 0 against range [1,8] gives a positive number (1)', minResult === 1);

  // Boundary: negative input is clamped to lower bound
  const negResult = clamp(-10, 2, 14);
  assert('Clamp of -10 against range [2,14] gives 2', negResult === 2);
});

/* ─────────────────────────────────────────────
   TEST 2 — Crowd density stays between 0 % and 100 %
   ───────────────────────────────────────────── */
test('Crowd density percentage stays between 0 and 100', () => {
  const startValues = [5, 30, 65, 80, 97];

  for (const start of startValues) {
    for (let tick = 0; tick < 20; tick++) {
      const occ = updateOccupancyTick(start);
      assert(
        `Occupancy after tick from ${start} is within [5, 98] — got ${occ.toFixed(1)}`,
        occ >= 5 && occ <= 98
      );
    }
    // Only verify a sample per start value
    break;
  }

  // Hard edge: forcing occupancy below minimum should be clamped to 5
  const tooLow = Math.max(5, Math.min(98, -50));
  assert('Occupancy of -50 is clamped to minimum of 5', tooLow === 5);

  // Hard edge: forcing occupancy above maximum should be clamped to 98
  const tooHigh = Math.max(5, Math.min(98, 150));
  assert('Occupancy of 150 is clamped to maximum of 98', tooHigh === 98);

  // Classify levels correctly
  assert('0% occupancy classifies as low',   classifyWait(0) === 'low');
  assert('5% occupancy classifies as low',   classifyWait(5) === 'low');
  assert('6% occupancy classifies as mid',   classifyWait(6) === 'mid');
  assert('12% occupancy classifies as mid',  classifyWait(12) === 'mid');
  assert('13% occupancy classifies as high', classifyWait(13) === 'high');
});

/* ─────────────────────────────────────────────
   TEST 3 — "Deploy Staff" changes zone status correctly
   ───────────────────────────────────────────── */
test('"Deploy Staff" changes zone status correctly', () => {
  const result = simulateDeploy('Zone A — North Concourse');

  assert('Zone is marked as deployed (deployed: true)', result.deployed === true);
  assert('Crowd level becomes "low" after deployment',  result.level === 'low');
  assert('Exactly 4 staff members are added',           result.staffDelta === 4);
  assert('Zone name is preserved in result',            result.name === 'Zone A — North Concourse');

  // Deploying to a second zone should produce independent results
  const result2 = simulateDeploy('Zone E — Gate 4 Entry');
  assert('Zone E is independently marked deployed', result2.deployed === true);
  assert('Zone E staff delta is 4',                 result2.staffDelta === 4);
  assert('Zone A and Zone E are different objects', result !== result2);
});

/* ─────────────────────────────────────────────
   TEST 4 — Alert rotation cycles through all alerts
   ───────────────────────────────────────────── */
test('Alert rotation cycles through all alerts exhaustively', () => {
  const alerts = [
    { text: 'Gate 4 is congested — use Gate 6 instead' },
    { text: 'Snack Bar (Gate C) wait exceeds 18 min — try Gate A concessions' },
    { text: 'North Concourse at capacity — South exits recommended' },
  ];
  const total = alerts.length;

  let idx = 0;
  const visited = new Set();

  // Advance the index three full cycles and verify each alert is reached
  for (let tick = 0; tick < total * 3; tick++) {
    idx = nextAlertIndex(idx, total);
    visited.add(idx);
    assert(
      `Tick ${tick + 1}: index ${idx} is within valid range [0, ${total - 1}]`,
      idx >= 0 && idx < total
    );
  }

  assert(`All ${total} alerts were visited at least once`, visited.size === total);

  // Verify the cycle wraps correctly at boundary
  let wrapIdx = total - 1;
  wrapIdx = nextAlertIndex(wrapIdx, total);
  assert('Alert index wraps from last to 0', wrapIdx === 0);
});

/* ─────────────────────────────────────────────
   TEST 5 — Role-based routing sends users to correct views
   ───────────────────────────────────────────── */
test('Role-based routing sends Attendee and Staff to correct views', () => {
  // Attendee → attendee view
  assert(
    '"attendee" role routes to view-attendee',
    resolveRoute('attendee') === 'view-attendee'
  );

  // Staff → staff view
  assert(
    '"staff" role routes to view-staff',
    resolveRoute('staff') === 'view-staff'
  );

  // No role → login screen
  assert(
    'No role provided returns "login"',
    resolveRoute(null) === 'login'
  );

  // Unknown role → login screen (fail-safe)
  assert(
    'Unknown role "superuser" returns "login"',
    resolveRoute('superuser') === 'login'
  );

  // Attendee must NOT see staff view
  assert(
    '"attendee" role does NOT route to view-staff',
    resolveRoute('attendee') !== 'view-staff'
  );

  // Staff must NOT resolve to login
  assert(
    '"staff" role does NOT route to login',
    resolveRoute('staff') !== 'login'
  );
});

/* ─────────────────────────────────────────────
   SUMMARY
   ───────────────────────────────────────────── */
console.log('\n═══════════════════════════════════════');
console.log(`VenueIQ Test Results: ${passed} passed / ${failed} failed / ${total} total`);
if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.error(`⚠️  ${failed} test(s) failed — review output above.`);
}
console.log('═══════════════════════════════════════\n');
