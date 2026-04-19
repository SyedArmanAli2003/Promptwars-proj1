/* =============================================
   VenueIQ — Smart Stadium Experience
   script.js  — complete, structured, documented
   ============================================= */

'use strict';

/* ─────────────────────────────────────────────
   1. CONSTANTS & CONFIGURATION
   ───────────────────────────────────────────── */

/** Heatmap geometry — all sizes are in SVG user-units. */
const HEATMAP_CONFIG = {
  cx: 400, cy: 265,
  innerRx: 198, innerRy: 125,
  outerRx: 381, outerRy: 242,
  startAngle: 40,
  span: 280,
  totalSections: 40,
  sections: [],
};

/** Pre-programmed VenueBot keyword intents. */
const VENUEBOT_INTENTS = [
  {
    keywords: ['food', 'eat', 'hungry', 'snack', 'restaurant', 'concession', 'drink'],
    reply: '🍔 The shortest food queue right now is at <strong>Gate A Food Court</strong> — only <strong>4 min</strong> wait. Gate C has 12 min. I recommend Gate A!',
  },
  {
    keywords: ['toilet', 'restroom', 'bathroom', 'wc', 'loo', 'washroom'],
    reply: '🚻 Nearest restrooms with under 2 min wait: <strong>Level 2 near Section 115</strong>, and <strong>Level 3 near Section 128</strong>.',
  },
  {
    keywords: ['exit', 'leave', 'go home', 'out', 'leaving', 'home', 'outside', 'gate'],
    reply: '🚪 Best exit right now: <strong>South Exit (Gate 8)</strong> — 3 min walk, 2 min queue. Avoid North Exit — 18 min queue currently.',
  },
  {
    keywords: ['seat', 'lost', 'where', 'find', 'section', 'location', 'directions', 'row'],
    reply: '📍 Your seat is in <strong>Section 118, Row G</strong>. From Gate 4: walk straight 50m, then turn left at the <span style="color:#4db8ff">blue signs</span>.',
  },
];

const VB_FALLBACK = '💬 I can help with <strong>food queues</strong>, <strong>restrooms</strong>, <strong>exits</strong>, and <strong>finding your seat</strong>. What do you need?';
const VB_WELCOME  = '👋 Hi! I\'m <strong>VenueBot</strong>, your smart stadium assistant.<br>Ask me about food, restrooms, exits, or your seat!';
const VB_CHIPS    = ['🍔 Food', '🚻 Restrooms', '🚪 Exit', '📍 My Seat'];

/** Rotating alert messages. */
const ALERTS = [
  { text: 'Gate 4 is congested — use Gate 6 instead' },
  { text: 'Snack Bar (Gate C) wait exceeds 18 min — try Gate A concessions' },
  { text: 'North Concourse at capacity — South exits recommended' },
];

/** Live activity feed messages, cycled automatically. */
const FEED_EVENTS = [
  { msg: 'Gate 2: Crowd surge detected — deploying support staff',       type: 'alert'  },
  { msg: 'Concession B: Queue exceeded 15 min threshold',                type: 'alert'  },
  { msg: 'Zone A: 3 additional staff dispatched successfully',           type: 'deploy' },
  { msg: 'Sensor 14: Occupancy at 98% — Section 109 flagged',           type: 'info'   },
  { msg: 'Medical team alerted — Section 127, Row 22',                  type: 'alert'  },
  { msg: 'Gate 6: Traffic rerouted from Gate 4 — flow nominal',          type: 'deploy' },
  { msg: 'Food Court A: Restocking in progress — 8 min delay expected',  type: 'info'   },
  { msg: 'Exit Queue South: Wait time dropped to 3 min',                 type: 'deploy' },
  { msg: 'Zone E: Crowd level rising — monitoring closely',              type: 'alert'  },
  { msg: 'West corridor opened for mobility-access guests',              type: 'info'   },
  { msg: 'Concession C: 2 additional service points opened',             type: 'deploy' },
  { msg: 'Gate 1 North: Peak ingress — 4,200 scans/min',                type: 'info'   },
];

/**
 * Firebase configuration.
 * Replace these placeholder values with your own project credentials
 * from https://console.firebase.google.com
 */
const FIREBASE_CONFIG = {
  apiKey:            'REPLACE_WITH_YOUR_API_KEY',
  authDomain:        'REPLACE.firebaseapp.com',
  databaseURL:       'https://REPLACE-default-rtdb.firebaseio.com',
  projectId:         'REPLACE',
  storageBucket:     'REPLACE.appspot.com',
  messagingSenderId: '000000000000',
  appId:             'REPLACE',
};

const ADMIN_WHITELIST = ['admin@venueiq.com'];

/* ─────────────────────────────────────────────
   2. APPLICATION STATE
   ───────────────────────────────────────────── */

const state = {
  userRole:       null,          // 'attendee' | 'staff'
  currentView:    'attendee',
  routeActive:    false,
  alertIndex:     0,
  waitTimes:      { food: 12, rest: 5, snack: 18, exit: 3 },
  metricsAnimated: false,
  vbOpen:          false,
  vbSeeded:        false,
  vbTyping:        false,
  feedEventIndex: 0,
  useFirebase:    false,         // true if Firebase connected successfully
  googleChartsReady: false,
};

/* ─────────────────────────────────────────────
   3. DOM ELEMENT CACHE
   Queried once on init to avoid repeated lookups.
   ───────────────────────────────────────────── */

const DOM = {};

/** Queries and caches all frequently accessed DOM elements. */
function cacheDOMElements() {
  DOM.splash        = document.getElementById('splash-screen');
  DOM.loginScreen   = document.getElementById('login-screen');
  DOM.mainApp       = document.getElementById('main-app');
  DOM.btnAttendee   = document.getElementById('btn-role-attendee');
  DOM.btnStaff      = document.getElementById('btn-role-staff');
  DOM.navClock      = document.getElementById('nav-clock');
  DOM.alertBanner   = document.getElementById('alert-banner');
  DOM.alertText     = document.getElementById('alert-text');
  DOM.alertDots     = document.querySelectorAll('#alert-dots .dot');
  DOM.stadiumSvg    = document.getElementById('stadium-svg');
  DOM.sectionTip    = document.getElementById('section-tooltip');
  DOM.smartRoute    = document.getElementById('smart-route');
  DOM.routeInfo     = document.getElementById('route-info');
  DOM.smartRouteBtn = document.getElementById('smart-route-btn');
  DOM.resetRouteBtn = document.getElementById('reset-route-btn');
  DOM.viewAttendee  = document.getElementById('view-attendee');
  DOM.viewStaff     = document.getElementById('view-staff');
  DOM.tabAttendee   = document.getElementById('tab-attendee');
  DOM.tabStaff      = document.getElementById('tab-staff');
  DOM.dashTimestamp = document.getElementById('dash-timestamp');
  DOM.feedList      = document.getElementById('feed-list');
  DOM.zoneTable     = document.getElementById('zone-table');
  DOM.venuebotBtn   = document.getElementById('venuebot-btn');
  DOM.venuebotPanel = document.getElementById('venuebot-panel');
  DOM.venuebotMsgs  = document.getElementById('venuebot-messages');
  DOM.venuebotInput = document.getElementById('venuebot-input');
  DOM.venuebotBadge = document.getElementById('venuebot-badge');
  DOM.venuebotClose = document.getElementById('venuebot-close-btn');
  DOM.venuebotSend  = document.getElementById('venuebot-send-btn');
  DOM.vbIconChat    = DOM.venuebotBtn ? DOM.venuebotBtn.querySelector('.venuebot-icon-chat')  : null;
  DOM.vbIconClose   = DOM.venuebotBtn ? DOM.venuebotBtn.querySelector('.venuebot-icon-close') : null;
  // Wait-card sub-elements keyed by id suffix
  DOM.wt = {
    food:  { time: document.getElementById('wt-food'),  fill: document.getElementById('wf-food'),  badge: document.getElementById('wb-food') },
    rest:  { time: document.getElementById('wt-rest'),  fill: document.getElementById('wf-rest'),  badge: document.getElementById('wb-rest') },
    snack: { time: document.getElementById('wt-snack'), fill: document.getElementById('wf-snack'), badge: document.getElementById('wb-snack') },
    exit:  { time: document.getElementById('wt-exit'),  fill: document.getElementById('wf-exit'),  badge: document.getElementById('wb-exit') },
  };
}

/* ─────────────────────────────────────────────
   4. FIREBASE INTEGRATION
   ───────────────────────────────────────────── */

/** Initialises Firebase and attaches Realtime Database listeners.
 *  Falls back gracefully to setInterval simulation on failure. */
function initFirebase() {
  if (typeof firebase === 'undefined') return;

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();

    // Write initial data snapshot to Firebase
    writeSimulatedDataToFirebase(db);

    // Listen for wait-time changes pushed to Firebase
    db.ref('/venueiq/waitTimes').on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      Object.assign(state.waitTimes, data);
      Object.keys(state.waitTimes).forEach(k => updateWaitCard(k, state.waitTimes[k]));
      if (state.googleChartsReady) drawWaitTimesChart();
    });

    // Listen for section-occupancy changes
    db.ref('/venueiq/sections').on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data || !HEATMAP_CONFIG.sections.length) return;
      HEATMAP_CONFIG.sections.forEach(sec => {
        if (data[sec.num] !== undefined) {
          sec.occupancy = data[sec.num];
          sec.el.style.fill = occupancyColor(sec.occupancy);
          sec.el.setAttribute('data-occupancy', sec.occupancy.toFixed(1));
        }
      });
    });

    state.useFirebase = true;
    console.info('VenueIQ: Firebase Realtime Database connected.');
  } catch (err) {
    console.warn('VenueIQ: Firebase unavailable, using local simulation.', err.message);
    state.useFirebase = false;
  }
}

/** Pushes a simulated data snapshot to Firebase (used for demo purposes). */
function writeSimulatedDataToFirebase(db) {
  db.ref('/venueiq/waitTimes').set(state.waitTimes).catch(() => {});
}

/** Pushes updated wait times to Firebase (no-op if not connected). */
function firebaseUpdateWaitTimes() {
  if (!state.useFirebase || typeof firebase === 'undefined') return;
  try {
    firebase.database().ref('/venueiq/waitTimes').set(state.waitTimes).catch(() => {});
  } catch (_) { /* silent */ }
}

/** Pushes updated section occupancy to Firebase (no-op if not connected). */
function firebaseUpdateSection(num, occupancy) {
  if (!state.useFirebase || typeof firebase === 'undefined') return;
  try {
    firebase.database().ref(`/venueiq/sections/${num}`).set(occupancy).catch(() => {});
  } catch (_) { /* silent */ }
}

/* ─────────────────────────────────────────────
   5. GOOGLE CHARTS
   ───────────────────────────────────────────── */

let waitTimesChart = null;
let sectionDensityChart = null;

/** Loads the Google Charts package and registers the ready callback. */
function initGoogleCharts() {
  if (typeof google === 'undefined' || !google.charts) return;
  google.charts.load('current', { packages: ['corechart', 'bar'] });
  google.charts.setOnLoadCallback(() => {
    state.googleChartsReady = true;
    waitTimesChart        = new google.visualization.ColumnChart(document.getElementById('wait-times-chart'));
    sectionDensityChart   = new google.visualization.BarChart(document.getElementById('section-density-chart'));
    drawWaitTimesChart();
    drawSectionDensityChart();
  });
}

/** Shared dark-navy chart options used by both charts. */
function chartOptions(title) {
  return {
    title,
    backgroundColor:    'transparent',
    titleTextStyle:     { color: '#8bafd4', fontSize: 12, bold: false },
    legend:             { position: 'none' },
    chartArea:          { width: '78%', height: '68%', top: 28, left: 60 },
    hAxis: {
      textStyle:    { color: '#8bafd4', fontSize: 11 },
      gridlines:    { color: '#1e3a5f' },
      baselineColor:'#1e3a5f',
    },
    vAxis: {
      textStyle:    { color: '#8bafd4', fontSize: 11 },
      gridlines:    { color: '#1e3a5f' },
      baselineColor:'#2d4a6f',
      minValue: 0,
    },
    animation: { startup: true, duration: 700, easing: 'out' },
    tooltip: { textStyle: { color: '#e8f0fe' }, showColorCode: true },
  };
}

/** Redraws the Wait Times bar chart using current state.waitTimes. */
function drawWaitTimesChart() {
  if (!state.googleChartsReady || !waitTimesChart) return;
  const { food, rest, snack, exit } = state.waitTimes;
  const data = google.visualization.arrayToDataTable([
    ['Facility',      'Wait (min)', { role: 'style' }, { role: 'annotation' }],
    ['Food Court',    food,  colorForMinutes(food),  `${food}m`  ],
    ['Restrooms',     rest,  colorForMinutes(rest),  `${rest}m`  ],
    ['Snack Bar',     snack, colorForMinutes(snack), `${snack}m` ],
    ['Exit Queue',    exit,  colorForMinutes(exit),  `${exit}m`  ],
  ]);
  const opts = chartOptions('');
  opts.annotations = {
    textStyle: { color: '#e8f0fe', fontSize: 11, bold: true },
    alwaysOutside: false,
  };
  waitTimesChart.draw(data, opts);
}

/** Redraws the Section Density horizontal bar chart with top-10 densest sections. */
function drawSectionDensityChart() {
  if (!state.googleChartsReady || !sectionDensityChart || !HEATMAP_CONFIG.sections.length) return;
  const top10 = [...HEATMAP_CONFIG.sections]
    .sort((a, b) => b.occupancy - a.occupancy)
    .slice(0, 10);
  const rows = top10.map(s => [
    `Sec ${s.num}`,
    Math.round(s.occupancy),
    colorForOccupancy(s.occupancy),
    `${Math.round(s.occupancy)}%`,
  ]);
  const data = google.visualization.arrayToDataTable([
    ['Section', 'Occupancy (%)', { role: 'style' }, { role: 'annotation' }],
    ...rows,
  ]);
  const opts = chartOptions('');
  opts.hAxis.maxValue = 100;
  opts.annotations = {
    textStyle: { color: '#e8f0fe', fontSize: 10, bold: true },
    alwaysOutside: false,
  };
  sectionDensityChart.draw(data, opts);
}

/** Returns a CSS hexadecimal colour for a wait-time value (matches badge levels). */
function colorForMinutes(m) {
  return m <= 5 ? '#22c55e' : m <= 12 ? '#f59e0b' : '#ef4444';
}

/** Returns a CSS hexadecimal colour for an occupancy percentage (matches heatmap). */
function colorForOccupancy(pct) {
  return pct < 40 ? '#22c55e' : pct < 70 ? '#f59e0b' : '#ef4444';
}

/* ─────────────────────────────────────────────
   6. SVG HEATMAP — HELPERS
   ───────────────────────────────────────────── */

/** Creates an SVG element in the SVG namespace with the given attribute map. */
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Returns the (x, y) point on an ellipse at angleDeg degrees clockwise from top. */
function ellipsePoint(cx, cy, rx, ry, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + rx * Math.sin(rad), y: cy - ry * Math.cos(rad) };
}

/** Builds the SVG path string for a single donut-arc section. */
function buildArcPath(cx, cy, iRx, iRy, oRx, oRy, a1, a2) {
  const f  = n => n.toFixed(2);
  const o1 = ellipsePoint(cx, cy, oRx, oRy, a1);
  const o2 = ellipsePoint(cx, cy, oRx, oRy, a2);
  const i1 = ellipsePoint(cx, cy, iRx, iRy, a1);
  const i2 = ellipsePoint(cx, cy, iRx, iRy, a2);
  return [
    `M ${f(o1.x)} ${f(o1.y)}`,
    `A ${oRx} ${oRy} 0 0 1 ${f(o2.x)} ${f(o2.y)}`,
    `L ${f(i2.x)} ${f(i2.y)}`,
    `A ${iRx} ${iRy} 0 0 0 ${f(i1.x)} ${f(i1.y)}`,
    'Z',
  ].join(' ');
}

/** Returns an rgba fill colour for a section keyed on its occupancy percentage. */
function occupancyColor(pct) {
  let r, g, b;
  if      (pct < 40) { r = 34;  g = 197; b = 94;  }
  else if (pct < 70) { r = 245; g = 158; b = 11;  }
  else               { r = 239; g = 68;  b = 68;  }
  const opacity = (0.30 + (pct / 100) * 0.65).toFixed(2);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Returns estimated minutes-to-exit based on occupancy percentage. */
function exitWaitMin(pct) {
  if (pct < 40) return Math.max(1, Math.round(pct / 10));
  if (pct < 70) return Math.round(pct / 9 + 1);
  return Math.round(pct / 7 + 2);
}

/* ─────────────────────────────────────────────
   7. SECTION TOOLTIP
   ───────────────────────────────────────────── */

let tooltipVisible = false;

/** Populates and shows the floating tooltip for a hovered heatmap section. */
function showSectionTooltip(secNum, occupancy) {
  if (!DOM.sectionTip) return;
  const occ   = Math.round(occupancy);
  const wait  = exitWaitMin(occ);
  const level = occ < 40 ? 'Low' : occ < 70 ? 'Medium' : 'High';
  const c     = occ < 40 ? '#22c55e' : occ < 70 ? '#f59e0b' : '#ef4444';
  DOM.sectionTip.innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#e8f0fe">Section ${secNum}</div>
    <div style="color:${c};font-weight:600;">${level} — ${occ}% full</div>
    <div style="color:#8bafd4;font-size:12px;margin-top:2px;">
      Est. wait to exit: <strong style="color:#e8f0fe">${wait} min</strong>
    </div>`;
  DOM.sectionTip.style.display = 'block';
  tooltipVisible = true;
}

/** Repositions the tooltip to follow the mouse, preventing overflow. */
function moveSectionTooltip(svg, evt) {
  if (!DOM.sectionTip || !tooltipVisible) return;
  const cr = svg.parentElement.getBoundingClientRect();
  let x    = evt.clientX - cr.left + 16;
  let y    = evt.clientY - cr.top  - 12;
  const tw = DOM.sectionTip.offsetWidth  || 200;
  const th = DOM.sectionTip.offsetHeight || 80;
  if (x + tw > cr.width  - 8) x = evt.clientX - cr.left - tw - 16;
  if (y + th > cr.height - 8) y = evt.clientY - cr.top  - th - 16;
  DOM.sectionTip.style.left = `${x}px`;
  DOM.sectionTip.style.top  = `${y}px`;
}

/** Hides the floating tooltip. */
function hideSectionTooltip() {
  if (DOM.sectionTip) DOM.sectionTip.style.display = 'none';
  tooltipVisible = false;
}

/* ─────────────────────────────────────────────
   8. SVG HEATMAP — INITIALISATION
   ───────────────────────────────────────────── */

/** Generates the full SVG heatmap: 40 arc sections, pitch, gate labels,
 *  user-seat marker, and the hidden smart-route overlay. */
function initHeatmap() {
  const svg = DOM.stadiumSvg;
  if (!svg) return;
  svg.innerHTML = '';

  const { cx, cy, innerRx, innerRy, outerRx, outerRy, startAngle, span, totalSections } = HEATMAP_CONFIG;
  const secSpan = span / totalSections;

  // Background ellipse
  svg.appendChild(svgEl('ellipse', {
    cx, cy, rx: outerRx + 8, ry: outerRy + 8, fill: '#060f1e', stroke: '#1e3a5f', 'stroke-width': 2,
  }));

  HEATMAP_CONFIG.sections = [];

  for (let i = 0; i < totalSections; i++) {
    const a1        = startAngle + i * secSpan;
    const a2        = startAngle + (i + 1) * secSpan;
    const midAngle  = (a1 + a2) / 2;
    const num       = 101 + i;
    const occupancy = 15 + Math.random() * 78;
    const pathD     = buildArcPath(cx, cy, innerRx, innerRy, outerRx, outerRy, a1, a2);
    const pathEl    = svgEl('path', {
      d: pathD, class: 'stadium-section', id: `sec-${num}`,
      fill: occupancyColor(occupancy), stroke: '#0a1628', 'stroke-width': '1.2',
      'data-num': num, 'data-occupancy': occupancy.toFixed(1),
      tabindex: '0', role: 'button',
      'aria-label': `Section ${num} — ${Math.round(occupancy)}% capacity`,
    });

    // Hover tooltip events
    pathEl.addEventListener('mouseenter', function (e) {
      showSectionTooltip(this.getAttribute('data-num'), parseFloat(this.getAttribute('data-occupancy')));
      moveSectionTooltip(svg, e);
      this.style.filter = 'brightness(1.35) drop-shadow(0 0 4px rgba(0,229,255,0.4))';
    });
    pathEl.addEventListener('mousemove',  e => moveSectionTooltip(svg, e));
    pathEl.addEventListener('mouseleave', function () {
      hideSectionTooltip();
      this.style.filter = '';
    });
    pathEl.addEventListener('focus', function () {
      showSectionTooltip(this.getAttribute('data-num'), parseFloat(this.getAttribute('data-occupancy')));
    });
    pathEl.addEventListener('blur', hideSectionTooltip);
    svg.appendChild(pathEl);

    // Section number label
    const mRx = (innerRx + outerRx) / 2 + 8;
    const mRy = (innerRy + outerRy) / 2 + 5;
    const mp  = ellipsePoint(cx, cy, mRx, mRy, midAngle);
    const lbl = svgEl('text', {
      x: mp.x.toFixed(1), y: mp.y.toFixed(1),
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'rgba(255,255,255,0.82)', 'font-size': '7.5',
      'font-family': 'Inter, sans-serif', 'font-weight': '500', 'pointer-events': 'none',
    });
    lbl.textContent = String(num);
    svg.appendChild(lbl);

    HEATMAP_CONFIG.sections.push({ num, occupancy, el: pathEl, a1, a2, midAngle });
  }

  // Green pitch
  const pRx = innerRx - 14, pRy = innerRy - 14;
  svg.appendChild(svgEl('ellipse', { cx, cy, rx: pRx, ry: pRy, fill: '#0d3320', stroke: '#1e6b36', 'stroke-width': '1.2' }));
  svg.appendChild(svgEl('ellipse', { cx, cy, rx: pRx - 7, ry: pRy - 7, fill: 'none', stroke: '#1e6b36', 'stroke-width': '0.8', 'stroke-dasharray': '4 4' }));
  svg.appendChild(svgEl('ellipse', { cx, cy, rx: 44, ry: 29, fill: 'none', stroke: '#1e6b36', 'stroke-width': '1' }));
  svg.appendChild(svgEl('line',    { x1: cx - pRx + 8, y1: cy, x2: cx + pRx - 8, y2: cy, stroke: '#1e6b36', 'stroke-width': '1' }));
  const pitchLbl = svgEl('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#2d8040', 'font-size': '14', 'font-family': 'Inter, sans-serif', 'font-weight': '700', 'pointer-events': 'none' });
  pitchLbl.textContent = 'PITCH';
  svg.appendChild(pitchLbl);

  // Gate labels
  const addLabel = (txt, angleDeg, eRx, eRy) => {
    const pt = ellipsePoint(cx, cy, outerRx + eRx, outerRy + eRy, angleDeg);
    const t  = svgEl('text', { x: pt.x.toFixed(1), y: pt.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#4db8ff', 'font-size': '11', 'font-family': 'Inter, sans-serif', 'font-weight': '600', 'pointer-events': 'none' });
    t.textContent = txt;
    svg.appendChild(t);
  };
  const nTxt = svgEl('text', { x: cx, y: cy - outerRy - 24, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#4db8ff', 'font-size': '11', 'font-family': 'Inter, sans-serif', 'font-weight': '600', 'pointer-events': 'none' });
  nTxt.textContent = 'GATE 1  —  NORTH ENTRANCE';
  svg.appendChild(nTxt);
  addLabel('GATE 3  (SOUTH)', 180, 5, 22);
  addLabel('GATE 4 ▶',        90, 24, 6);
  addLabel('◀ GATE 6',       270, 24, 6);

  // User seat (section index 20 ≈ south lower)
  const uSec  = HEATMAP_CONFIG.sections[20];
  const uMRx  = (innerRx + outerRx) / 2 - 12;
  const uMRy  = (innerRy + outerRy) / 2 - 8;
  const uPt   = ellipsePoint(cx, cy, uMRx, uMRy, uSec.midAngle);
  const uDot  = svgEl('circle', { id: 'user-seat', cx: uPt.x.toFixed(1), cy: uPt.y.toFixed(1), r: '7', fill: '#ff6b35', stroke: 'white', 'stroke-width': '2', 'pointer-events': 'none' });
  uDot.appendChild(svgEl('animate', { attributeName: 'r', values: '7;9;7', dur: '2s', repeatCount: 'indefinite' }));
  svg.appendChild(uDot);
  const youLbl = svgEl('text', { x: (uPt.x + 12).toFixed(1), y: (uPt.y - 4).toFixed(1), fill: 'white', 'font-size': '10', 'font-family': 'Inter, sans-serif', 'font-weight': '700', 'pointer-events': 'none' });
  youLbl.textContent = 'YOU';
  svg.appendChild(youLbl);

  // Smart route overlay (hidden by default)
  const routeG = svgEl('g', { id: 'smart-route', class: 'route-group' });
  routeG.classList.add('hidden');
  const westPt = ellipsePoint(cx, cy, outerRx + 4, outerRy, 270);
  const ctrlX  = cx - outerRx * 0.50;
  const ctrlY  = cy + outerRy * 0.62;
  routeG.appendChild(svgEl('path', { d: `M ${uPt.x.toFixed(1)} ${uPt.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${westPt.x.toFixed(1)} ${cy}`, stroke: '#00e5ff', 'stroke-width': '3', fill: 'none', 'stroke-dasharray': '8 4', class: 'route-path' }));
  routeG.appendChild(svgEl('circle', { cx: westPt.x.toFixed(1), cy, r: '15', fill: 'none', stroke: '#00e5ff', 'stroke-width': '2.5', class: 'exit-indicator' }));
  const exitLbl = svgEl('text', { x: westPt.x.toFixed(1), y: (cy + 28).toFixed(1), fill: '#00e5ff', 'font-size': '11', 'font-family': 'Inter, sans-serif', 'font-weight': '700', 'text-anchor': 'middle', 'pointer-events': 'none' });
  exitLbl.textContent = 'BEST EXIT';
  routeG.appendChild(exitLbl);
  svg.appendChild(routeG);
}

/* ─────────────────────────────────────────────
   9. HEATMAP LIVE UPDATE — STAGGERED
   ───────────────────────────────────────────── */

/** Updates 2–3 randomly chosen sections every 4 seconds, staggering each
 *  individual colour transition 80ms apart to avoid simultaneous DOM writes. */
function updateHeatmapOccupancy() {
  const sections = HEATMAP_CONFIG.sections;
  if (!sections.length) return;
  const count   = 2 + Math.floor(Math.random() * 2);
  const indices = new Set();
  while (indices.size < count) indices.add(Math.floor(Math.random() * sections.length));
  let delay = 0;
  for (const idx of indices) {
    setTimeout(() => {
      const sec   = sections[idx];
      const delta = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 5);
      sec.occupancy = Math.max(5, Math.min(98, sec.occupancy + delta));
      // CSS transition (fill 0.8s ease) handles the smooth colour change
      sec.el.style.fill = occupancyColor(sec.occupancy);
      sec.el.setAttribute('data-occupancy', sec.occupancy.toFixed(1));
      sec.el.setAttribute('aria-label', `Section ${sec.num} — ${Math.round(sec.occupancy)}% capacity`);
      firebaseUpdateSection(sec.num, sec.occupancy);
    }, delay);
    delay += 80;
  }
  // Refresh section density chart after stagger completes
  setTimeout(() => { if (state.googleChartsReady) drawSectionDensityChart(); }, delay + 100);
}

/* ─────────────────────────────────────────────
   10. WAIT TIME CARDS
   ───────────────────────────────────────────── */

/** Clamps value between min and max (inclusive). */
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/** Returns the density label string for a wait-time value. */
function classifyWait(m) { return m <= 5 ? 'low' : m <= 12 ? 'mid' : 'high'; }

/** Updates a single wait-time card's number, fill bar, and badge. */
function updateWaitCard(id, minutes) {
  const card = DOM.wt[id];
  if (!card || !card.time) return;
  const level   = classifyWait(minutes);
  const labels  = { low: 'LOW', mid: 'MED', high: 'HIGH' };
  if (parseInt(card.time.textContent, 10) !== minutes) {
    card.time.textContent = minutes;
    card.time.classList.remove('num-updated');
    void card.time.offsetWidth;
    card.time.classList.add('num-updated');
  }
  card.fill.style.height = `${clamp(minutes * 4, 5, 95)}%`;
  card.fill.className    = `wait-card__fill ${level}`;
  card.badge.className   = `wait-card__badge ${level}`;
  card.badge.textContent = labels[level];
  card.badge.setAttribute('aria-label', `${labels[level]} wait time`);
}

/** Shifts wait times by a random delta every cycle; pushes to Firebase if connected. */
function shiftWaitTimes() {
  const ranges = { food: [6, 22], rest: [2, 14], snack: [10, 25], exit: [1, 8] };
  for (const key of Object.keys(state.waitTimes)) {
    const delta = Math.round((Math.random() - 0.45) * 3);
    state.waitTimes[key] = clamp(state.waitTimes[key] + delta, ...ranges[key]);
    updateWaitCard(key, state.waitTimes[key]);
  }
  firebaseUpdateWaitTimes();
  if (state.googleChartsReady) drawWaitTimesChart();
}

/* ─────────────────────────────────────────────
   11. ALERT BANNER
   ───────────────────────────────────────────── */

/** Advances the alert index and animates the banner with a slide-in + golden flash. */
function rotateAlerts() {
  state.alertIndex = (state.alertIndex + 1) % ALERTS.length;
  if (!DOM.alertText) return;
  DOM.alertText.style.opacity   = '0';
  DOM.alertText.style.transform = 'translateX(24px)';
  setTimeout(() => {
    DOM.alertText.textContent     = ALERTS[state.alertIndex].text;
    DOM.alertText.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    DOM.alertText.style.opacity   = '1';
    DOM.alertText.style.transform = 'translateX(0)';
    if (DOM.alertBanner) {
      DOM.alertBanner.classList.remove('alert-flash');
      void DOM.alertBanner.offsetWidth;
      DOM.alertBanner.classList.add('alert-flash');
    }
  }, 300);
  DOM.alertDots.forEach((d, i) => d.classList.toggle('active', i === state.alertIndex));
}

/* ─────────────────────────────────────────────
   12. SMART ROUTE
   ───────────────────────────────────────────── */

/** Shows the SVG route overlay and the info banner. */
function toggleSmartRoute() {
  state.routeActive = true;
  const routeEl = document.getElementById('smart-route');
  if (routeEl) routeEl.classList.remove('hidden');
  if (DOM.routeInfo)     DOM.routeInfo.classList.remove('hidden');
  if (DOM.smartRouteBtn) DOM.smartRouteBtn.classList.add('hidden');
  if (DOM.resetRouteBtn) DOM.resetRouteBtn.classList.remove('hidden');
}

/** Hides the SVG route overlay and returns the UI to default state. */
function resetRoute() {
  state.routeActive = false;
  const routeEl = document.getElementById('smart-route');
  if (routeEl) routeEl.classList.add('hidden');
  if (DOM.routeInfo)     DOM.routeInfo.classList.add('hidden');
  if (DOM.smartRouteBtn) DOM.smartRouteBtn.classList.remove('hidden');
  if (DOM.resetRouteBtn) DOM.resetRouteBtn.classList.add('hidden');
}

/* ─────────────────────────────────────────────
   13. DEPLOY STAFF
   ───────────────────────────────────────────── */

/** Simulates deploying 4 staff members to a zone.
 *  Updates the pill, wait time, and staff count in the table row. */
function deployStaff(btn, zoneName) {
  const row        = btn.closest('tr');
  const pill       = row.querySelector('.level-pill');
  const staffCount = row.querySelector('.staff-count');
  const waitNum    = row.querySelector('.wait-number');

  btn.disabled        = true;
  btn.textContent     = '✓ Deployed';
  btn.classList.add('deployed');

  pill.classList.remove('high', 'mid');
  pill.classList.add('low');
  pill.textContent = 'LOW';
  pill.setAttribute('aria-label', 'Low crowd level');

  staffCount.textContent = parseInt(staffCount.textContent, 10) + 4;

  const m = waitNum.textContent.match(/(\d+)/);
  if (m) waitNum.textContent = `${Math.max(2, parseInt(m[1], 10) - Math.floor(Math.random() * 6 + 4))} min`;

  row.classList.add('deployed');

  const alertVal = document.getElementById('mv-alerts');
  if (alertVal && parseInt(alertVal.textContent, 10) > 0) alertVal.textContent = String(parseInt(alertVal.textContent, 10) - 1);
  const staffVal = document.getElementById('mv-staff');
  if (staffVal) staffVal.textContent = String(parseInt(staffVal.textContent, 10) + 4);

  pushFeedEvent(`${zoneName}: 4 staff deployed — crowd level reduced to LOW`, 'deploy');
}

/* ─────────────────────────────────────────────
   14. ACTIVITY FEED
   ───────────────────────────────────────────── */

/** Formats a Date into a HH:MM:SS string. */
function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** Prepends a new event row to the activity feed, capped at 20 items. */
function pushFeedEvent(message, type = 'info') {
  if (!DOM.feedList) return;
  const item = document.createElement('div');
  item.className = `feed-item ${type}-event`;
  item.innerHTML = `
    <span class="feed-timestamp">${formatTime(new Date())}</span>
    <div class="feed-message"><span class="feed-indicator" aria-hidden="true"></span>${message}</div>`;
  DOM.feedList.insertBefore(item, DOM.feedList.firstChild);
  while (DOM.feedList.children.length > 20) DOM.feedList.removeChild(DOM.feedList.lastChild);
}

/** Adds the next pre-programmed feed event on each cycle. */
function autoFeed() {
  const ev = FEED_EVENTS[state.feedEventIndex % FEED_EVENTS.length];
  pushFeedEvent(ev.msg, ev.type);
  state.feedEventIndex++;
}

/* ─────────────────────────────────────────────
   15. VIEW SWITCHING
   ───────────────────────────────────────────── */

/** Switches between the attendee view and the staff dashboard. */
function switchView(view) {
  state.currentView = view;
  const isAttendee  = view === 'attendee';

  DOM.viewAttendee.classList.toggle('active', isAttendee);
  DOM.viewAttendee.classList.toggle('hidden', !isAttendee);
  DOM.viewStaff.classList.toggle('active', !isAttendee);
  DOM.viewStaff.classList.toggle('hidden', isAttendee);

  DOM.tabAttendee.classList.toggle('active', isAttendee);
  DOM.tabAttendee.setAttribute('aria-selected', String(isAttendee));
  DOM.tabStaff.classList.toggle('active', !isAttendee);
  DOM.tabStaff.setAttribute('aria-selected', String(!isAttendee));

  if (!isAttendee) setTimeout(animateMetrics, 200);
}

/* ─────────────────────────────────────────────
   16. LOGIN / ROLE SELECTION
   ───────────────────────────────────────────── */

/** Handles the role-selection button click.
 *  Configures tab visibility, stores the role in state, and reveals the main app. */
function handleLogin(role) {
  state.userRole = role;

  // Show or hide the Staff Dashboard tab based on role
  if (role === 'attendee') {
    DOM.tabStaff.classList.add('hidden');
  } else {
    DOM.tabStaff.classList.remove('hidden');
  }

  // Fade out the login screen
  DOM.loginScreen.classList.add('fade-out');
  setTimeout(() => {
    DOM.loginScreen.classList.add('hidden');
    DOM.mainApp.classList.remove('hidden');
    // Start with the appropriate view
    switchView(role === 'staff' ? 'staff' : 'attendee');
    // Draw charts now that the containers are visible
    if (state.googleChartsReady) {
      drawWaitTimesChart();
      drawSectionDensityChart();
    }
  }, 480);
}

/* ─────────────────────────────────────────────
   17. SPLASH SCREEN
   ───────────────────────────────────────────── */

/** Shows the splash for ~2 seconds, then reveals the login screen. */
function initSplash() {
  if (!DOM.splash) return;
  setTimeout(() => {
    DOM.splash.classList.add('fade-out');
    setTimeout(() => {
      DOM.splash.style.display = 'none';
      // Reveal the login screen
      if (DOM.loginScreen) DOM.loginScreen.classList.remove('hidden');
    }, 620);
  }, 2100);
}

/* ─────────────────────────────────────────────
   18. NAV CLOCK
   ───────────────────────────────────────────── */

/** Starts a 1-second interval that updates the nav-bar clock element. */
function initNavClock() {
  if (!DOM.navClock) return;
  const tick = () => {
    DOM.navClock.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────
   19. DASHBOARD TIMESTAMP
   ───────────────────────────────────────────── */

/** Updates the staff-dashboard timestamp line with the current date/time. */
function updateTimestamp() {
  if (!DOM.dashTimestamp) return;
  const now = new Date();
  DOM.dashTimestamp.textContent =
    `Last updated: ${formatTime(now)} — ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

/* ─────────────────────────────────────────────
   20. METRIC COUNT-UP ANIMATION
   ───────────────────────────────────────────── */

/** Animates a single numeric element from 0 to its target value.
 *  Handles comma-formatted integers (e.g. "42,817") and decimals (e.g. "9.4 min"). */
function countUp(el, targetStr, delay = 0) {
  const duration  = 1500;
  const cleanStr  = targetStr.replace(/,/g, '');
  const numMatch  = cleanStr.match(/[\d.]+/);
  if (!numMatch || !el) return;
  const target     = parseFloat(numMatch[0]);
  const suffix     = cleanStr.slice(numMatch.index + numMatch[0].length);
  const usesCommas = targetStr.includes(',');
  const hasDecimal = numMatch[0].includes('.');
  setTimeout(() => {
    const t0 = performance.now();
    el.textContent = usesCommas ? '0' : hasDecimal ? `0.0${suffix}` : `0${suffix}`;
    function tick(now) {
      const p     = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val   = target * eased;
      if      (usesCommas) el.textContent = Math.round(val).toLocaleString('en-US') + suffix;
      else if (hasDecimal) el.textContent = val.toFixed(1) + suffix;
      else                 el.textContent = Math.round(val) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else       el.textContent = targetStr;
    }
    requestAnimationFrame(tick);
  }, delay);
}

/** Triggers count-up on all four metric cards (runs only once). */
function animateMetrics() {
  if (state.metricsAnimated) return;
  state.metricsAnimated = true;
  countUp(document.getElementById('mv-attendees'), '42,817',  0);
  countUp(document.getElementById('mv-alerts'),    '7',       150);
  countUp(document.getElementById('mv-wait'),      '9.4 min', 300);
  countUp(document.getElementById('mv-staff'),     '184',     450);
}

/* ─────────────────────────────────────────────
   21. VENUEBOT CHAT ASSISTANT
   ───────────────────────────────────────────── */

/** Sanitises raw user text to prevent XSS before inserting into the DOM. */
function vbSanitize(text) {
  // Strip HTML tags entirely off using the browser's DOM parser
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.trim();
}

/** Toggles the VenueBot panel open or closed and swaps icons. */
function toggleVenueBot() {
  state.vbOpen = !state.vbOpen;
  DOM.venuebotPanel.classList.toggle('open', state.vbOpen);
  DOM.venuebotBtn.classList.toggle('open', state.vbOpen);

  if (DOM.vbIconChat)  DOM.vbIconChat.classList.toggle('hidden', state.vbOpen);
  if (DOM.vbIconClose) DOM.vbIconClose.classList.toggle('hidden', !state.vbOpen);
  if (DOM.venuebotBadge) DOM.venuebotBadge.classList.add('hidden');

  if (state.vbOpen) {
    if (!state.vbSeeded) {
      state.vbSeeded = true;
      vbAppendBot(VB_WELCOME, true);
    }
    setTimeout(() => { if (DOM.venuebotInput) DOM.venuebotInput.focus(); }, 330);
  }
}

/** Reads, sanitises, and dispatches the user's typed message. */
function sendVenueBotMessage() {
  if (state.vbTyping) return;
  const raw  = DOM.venuebotInput ? DOM.venuebotInput.value : '';
  const text = vbSanitize(raw);
  if (!text) return;
  DOM.venuebotInput.value = '';
  vbAppendUser(text);
  vbShowTyping();
  const reply = vbGetReply(text);
  setTimeout(() => {
    vbHideTyping();
    vbAppendBot(reply, true);
  }, 1000 + Math.random() * 200);
}

/** Matches user input against pre-programmed intents; returns the best reply. */
function vbGetReply(text) {
  const lc = text.toLowerCase();
  for (const intent of VENUEBOT_INTENTS) {
    if (intent.keywords.some(kw => lc.includes(kw))) return intent.reply;
  }
  return VB_FALLBACK;
}

/** Appends a user bubble to the chat log. */
function vbAppendUser(text) {
  const div = document.createElement('div');
  div.className = 'vb-msg user';
  div.innerHTML = `<div class="vb-bubble">${text}</div><span class="vb-time">${vbTime()}</span>`;
  vbScroll(div);
}

/** Appends a bot bubble to the chat log, optionally with quick-chip shortcuts. */
function vbAppendBot(html, chips = false) {
  const chipsHtml = chips
    ? `<div class="vb-chips">${VB_CHIPS.map(c => `<button class="vb-chip" data-chip="${c}">${c}</button>`).join('')}</div>`
    : '';
  const div = document.createElement('div');
  div.className = 'vb-msg bot';
  div.innerHTML = `<div class="vb-bubble">${html}</div><span class="vb-time">${vbTime()}</span>${chipsHtml}`;
  vbScroll(div);
}

/** Renders and displays the three-dot typing indicator. */
function vbShowTyping() {
  state.vbTyping = true;
  const el = document.createElement('div');
  el.id = 'vb-typing-dots'; el.className = 'vb-typing';
  el.setAttribute('aria-label', 'VenueBot is typing');
  el.innerHTML = '<span></span><span></span><span></span>';
  vbScroll(el);
}

/** Removes the typing indicator once the reply is ready. */
function vbHideTyping() {
  const el = document.getElementById('vb-typing-dots');
  if (el) el.remove();
  state.vbTyping = false;
}

/** Sends the message mapped to a quick-chip label. */
function vbChip(label) {
  const map = {
    '🍔 Food':      'food',
    '🚻 Restrooms': 'restroom',
    '🚪 Exit':      'exit',
    '📍 My Seat':   'where is my seat',
  };
  if (DOM.venuebotInput) DOM.venuebotInput.value = map[label] || label;
  sendVenueBotMessage();
}

/** Appends an element to the messages container and scrolls to the bottom. */
function vbScroll(el) {
  if (!DOM.venuebotMsgs) return;
  DOM.venuebotMsgs.appendChild(el);
  DOM.venuebotMsgs.scrollTop = DOM.venuebotMsgs.scrollHeight;
}

/** Returns the current time as HH:MM (24-hour). */
function vbTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ─────────────────────────────────────────────
   22. EVENT LISTENERS
   All element event bindings — no inline HTML handlers.
   ───────────────────────────────────────────── */

/** Attaches all event listeners to cached DOM elements. */
function bindEventListeners() {
  // Login role buttons
  if (DOM.btnAttendee) DOM.btnAttendee.addEventListener('click', () => handleLogin('attendee'));
  if (DOM.btnStaff)    DOM.btnStaff.addEventListener('click',    () => handleLogin('staff'));

  // Navbar tab buttons
  if (DOM.tabAttendee) DOM.tabAttendee.addEventListener('click', () => switchView('attendee'));
  if (DOM.tabStaff)    DOM.tabStaff.addEventListener('click',    () => switchView('staff'));

  // Smart route controls
  if (DOM.smartRouteBtn) DOM.smartRouteBtn.addEventListener('click', toggleSmartRoute);
  if (DOM.resetRouteBtn) DOM.resetRouteBtn.addEventListener('click', resetRoute);

  // Zone table — event delegation for all deploy buttons
  if (DOM.zoneTable) {
    DOM.zoneTable.addEventListener('click', e => {
      const btn = e.target.closest('.deploy-btn');
      if (btn && !btn.disabled) deployStaff(btn, btn.dataset.zone);
    });
  }

  // VenueBot toggle and close
  if (DOM.venuebotBtn)   DOM.venuebotBtn.addEventListener('click',   toggleVenueBot);
  if (DOM.venuebotClose) DOM.venuebotClose.addEventListener('click',  toggleVenueBot);

  // VenueBot send (button + Enter key)
  if (DOM.venuebotSend)  DOM.venuebotSend.addEventListener('click',  sendVenueBotMessage);
  if (DOM.venuebotInput) {
    DOM.venuebotInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendVenueBotMessage();
    });
  }

  // Quick-chip delegation — chips are dynamically created, so delegate on messages container
  if (DOM.venuebotMsgs) {
    DOM.venuebotMsgs.addEventListener('click', e => {
      const chip = e.target.closest('.vb-chip');
      if (chip && chip.dataset.chip) vbChip(chip.dataset.chip);
    });
  }
}

/* ─────────────────────────────────────────────
   23. INIT — APPLICATION BOOTSTRAP
   ───────────────────────────────────────────── */

/** Seeds the activity feed with a set of initial events in reverse order. */
function seedActivityFeed() {
  [
    { msg: 'System online — all sensors nominal',                         type: 'info'   },
    { msg: 'Gate 1 North: Peak ingress — 4,200 scans/min',              type: 'info'   },
    { msg: 'Concession C: 2 additional service points opened',           type: 'deploy' },
    { msg: 'Zone E: Crowd level rising — monitoring closely',            type: 'alert'  },
    { msg: 'Exit Queue South: Wait time dropped to 3 min',               type: 'deploy' },
  ].reverse().forEach(e => pushFeedEvent(e.msg, e.type));
}

/** Main application bootstrap: called once at DOMContentLoaded. */
function init() {
  cacheDOMElements();
  bindEventListeners();

  // Boot sequence: splash → login → app
  initSplash();
  initNavClock();

  // Build the SVG heatmap and initialise wait cards
  initHeatmap();
  Object.keys(state.waitTimes).forEach(k => updateWaitCard(k, state.waitTimes[k]));

  // Seed the activity feed with initial events
  seedActivityFeed();
  updateTimestamp();

  // Connect to Firebase (falls back to local simulation automatically)
  initFirebase();

  // Load Google Charts (rendered after login removes the hidden class)
  initGoogleCharts();

  // Interval-based simulation (used when Firebase is not connected)
  setInterval(updateHeatmapOccupancy, 4000);
  if (!state.useFirebase) {
    setInterval(shiftWaitTimes, 4000);
  }
  setInterval(rotateAlerts,  5000);
  setInterval(autoFeed,      6000);
  setInterval(updateTimestamp, 1000);
}

document.addEventListener('DOMContentLoaded', init);
