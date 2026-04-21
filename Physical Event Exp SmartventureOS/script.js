/* =============================================
  VenueIQ — Smart Stadium Experience
  script.js — Firebase Auth + Realtime Database
  ============================================= */

'use strict';

/* ─────────────────────────────────────────────
   1. CONSTANTS & CONFIGURATION
   ───────────────────────────────────────────── */

const WEMBLEY_COORDS = { lat: 51.5560, lng: -0.2795 };
const STAFF_PIN = '2024';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ZONES = [
  { id: 'NorthStand', label: 'North Stand', coords: [
    {lat: 51.5569, lng: -0.2805}, {lat: 51.5569, lng: -0.2785},
    {lat: 51.5565, lng: -0.2785}, {lat: 51.5565, lng: -0.2805}
  ]},
  { id: 'SouthStand', label: 'South Stand', coords: [
    {lat: 51.5555, lng: -0.2805}, {lat: 51.5555, lng: -0.2785},
    {lat: 51.5551, lng: -0.2785}, {lat: 51.5551, lng: -0.2805}
  ]},
  { id: 'EastWing', label: 'East Wing', coords: [
    {lat: 51.5564, lng: -0.2783}, {lat: 51.5564, lng: -0.2770},
    {lat: 51.5556, lng: -0.2770}, {lat: 51.5556, lng: -0.2783}
  ]},
  { id: 'WestWing', label: 'West Wing', coords: [
    {lat: 51.5564, lng: -0.2820}, {lat: 51.5564, lng: -0.2807},
    {lat: 51.5556, lng: -0.2807}, {lat: 51.5556, lng: -0.2820}
  ]},
  { id: 'ConcourseA', label: 'Concourse A', coords: [
    {lat: 51.5572, lng: -0.2800}, {lat: 51.5570, lng: -0.2780},
    {lat: 51.5569, lng: -0.2800}
  ]},
  { id: 'ConcourseB', label: 'Concourse B', coords: [
    {lat: 51.5548, lng: -0.2810}, {lat: 51.5548, lng: -0.2800},
    {lat: 51.5550, lng: -0.2800}
  ]}
];

const MAP_MARKERS = [
  { lat: 51.5571, lng: -0.2790, title: 'Food Court A — ~4 min wait',     icon: 'http://maps.google.com/mapfiles/ms/icons/restaurant.png' },
  { lat: 51.5550, lng: -0.2805, title: 'Restrooms — ~2 min wait',        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'   },
  { lat: 51.5560, lng: -0.2775, title: 'First Aid Station',              icon: 'http://maps.google.com/mapfiles/ms/icons/hospitals.png'  },
  { lat: 51.5560, lng: -0.2815, title: 'Exit C — South Gate',           icon: 'http://maps.google.com/mapfiles/ms/icons/red-pushpin.png'}
];

const VENUEBOT_INTENTS = [
  { keywords: ['food', 'eat', 'hungry', 'snack', 'restaurant', 'concession'],
    reply: '🍔 The shortest food queue is at <strong>Gate A Food Court</strong> — only <strong>4 min</strong> wait. Gate C has 12 min. Recommend Gate A!' },
  { keywords: ['toilet', 'restroom', 'bathroom', 'wc', 'loo', 'washroom'],
    reply: '🚻 Nearest restrooms under 2 min: <strong>Level 2 near Section 115</strong>, and <strong>Level 3 near Section 128</strong>.' },
  { keywords: ['exit', 'leave', 'home', 'out', 'gate', 'leaving'],
    reply: '🚪 Best exit: <strong>South Exit (Gate 8)</strong> — 3 min walk, 2 min queue. Avoid North Exit — 18 min queue.' },
  { keywords: ['seat', 'lost', 'where', 'find', 'section', 'directions', 'row'],
    reply: '📍 Your seat is in <strong>Section 118, Row G</strong>. From Gate 4: walk straight 50m, left at the <span style="color:#4db8ff">blue signs</span>.' },
];
const VB_FALLBACK  = '💬 I can help with <strong>food queues</strong>, <strong>restrooms</strong>, <strong>exits</strong>, and <strong>finding your seat</strong>. What do you need?';

/* ─────────────────────────────────────────────
   2. APPLICATION STATE
   ───────────────────────────────────────────── */

const state = {
  db: null,
  map: null,
  polygons: {},
  zonesData: {},
  historyCounter: 0,
  densityHistory: [['Time', 'Average Density %']],
  waitTimesChart: null,
  densityLineChart: null,
  gaugeChart: null,
  chartsReady: false,
  sessionTimer: null,
  vbSeeded: false,
};

const DOM = {};

function cacheDOMElements() {
  DOM.splash           = document.getElementById('splash-screen');
  DOM.loginScreen      = document.getElementById('login-screen');
  DOM.roleModal        = document.getElementById('role-select-modal');
  DOM.mainApp          = document.getElementById('main-app');
  DOM.btnGoogleSignin  = document.getElementById('btn-google-signin');
  DOM.btnAttendee      = document.getElementById('btn-role-attendee');
  DOM.btnStaff         = document.getElementById('btn-role-staff');
  DOM.btnThemeToggle   = document.getElementById('btn-theme-toggle');
  DOM.themeIcon        = document.getElementById('theme-icon');
  
  DOM.sessionExpired   = document.getElementById('session-expired-modal');
  DOM.btnSessionOk     = document.getElementById('btn-session-ok');
  DOM.btnSwitchRole    = document.getElementById('btn-switch-role');
  DOM.navClock         = document.getElementById('nav-clock');
  DOM.tabAttendee      = document.getElementById('tab-attendee');
  DOM.tabStaff         = document.getElementById('tab-staff');
  DOM.viewAttendee     = document.getElementById('view-attendee');
  DOM.viewStaff        = document.getElementById('view-staff');
  DOM.dashTimestamp    = document.getElementById('dash-timestamp');
  DOM.zoneTableBody    = document.getElementById('zone-tbody');
  DOM.reqStaffBtn      = document.getElementById('btn-request-staff');
  DOM.venuebotBtn      = document.getElementById('venuebot-btn');
  DOM.venuebotPanel    = document.getElementById('venuebot-panel');
  DOM.venuebotMsgs     = document.getElementById('venuebot-messages');
  DOM.venuebotInput    = document.getElementById('venuebot-input');
  DOM.venuebotSend     = document.getElementById('venuebot-send-btn');
  DOM.venuebotClose    = document.getElementById('venuebot-close-btn');
  DOM.vbInputError     = document.getElementById('vb-input-error');
  DOM.wb = {
    food:  { time: document.getElementById('wt-food'),  fill: document.getElementById('wf-food'),  badge: document.getElementById('wb-food') },
    rest:  { time: document.getElementById('wt-rest'),  fill: document.getElementById('wf-rest'),  badge: document.getElementById('wb-rest') },
    snack: { time: document.getElementById('wt-snack'), fill: document.getElementById('wf-snack'), badge: document.getElementById('wb-snack') },
    exit:  { time: document.getElementById('wt-exit'),  fill: document.getElementById('wf-exit'),  badge: document.getElementById('wb-exit') },
  };
}

/* ─────────────────────────────────────────────
   3. SESSION & ROLE MANAGEMENT (No Firebase Auth)
   ───────────────────────────────────────────── */

function getRole() {
  return sessionStorage.getItem('venueiq_role');
}

function setRole(role) {
  sessionStorage.setItem('venueiq_role', role);
  resetSessionTimer();
}

function clearRole() {
  sessionStorage.removeItem('venueiq_role');
  if (state.sessionTimer) clearTimeout(state.sessionTimer);
}

function resetSessionTimer() {
  if (state.sessionTimer) clearTimeout(state.sessionTimer);
  state.sessionTimer = setTimeout(() => {
    clearRole();
    DOM.mainApp.classList.add('hidden');
    DOM.sessionExpired.classList.remove('hidden');
  }, SESSION_TIMEOUT_MS);
}

// Reset timer on any user interaction
['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => {
  document.addEventListener(ev, () => { if (getRole()) resetSessionTimer(); }, { passive: true });
});

function handleAttendeeLogin() {
  setRole('attendee');
  enterApp('attendee');
}

function handleStaffRequest() {
  // Hackathon Debug Bypass: Instant Entry
  setRole('staff');
  enterApp('staff');
}

function verifyPin() {
  // PIN system disabled for Hackathon
}

function initTheme() {
  const savedTheme = localStorage.getItem('venueiq_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (DOM.themeIcon) DOM.themeIcon.textContent = savedTheme === 'light' ? 'dark_mode' : 'light_mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('venueiq_theme', next);
  if (DOM.themeIcon) DOM.themeIcon.textContent = next === 'light' ? 'dark_mode' : 'light_mode';
}

function enterApp(role) {
  DOM.roleModal.classList.add('hidden');
  DOM.loginScreen.classList.add('hidden');
  DOM.mainApp.classList.remove('hidden');
  DOM.tabStaff.classList.toggle('hidden', role !== 'staff');
  switchView(role === 'staff' ? 'staff' : 'attendee');
  if (!state.map) initGoogleMaps();
  if (!state.chartsReady) initGoogleCharts();
}

function switchRole() {
  clearRole();
  DOM.mainApp.classList.add('hidden');
  if (firebase.auth().currentUser) {
    DOM.roleModal.classList.remove('hidden');
  } else {
    DOM.loginScreen.classList.remove('hidden', 'fade-out');
  }
}

function getFriendlyAuthErrorMessage(err) {
  const code = err && err.code ? err.code : 'auth/unknown';

  if (code === 'auth/unauthorized-domain') {
    return 'This website domain is not authorized in Firebase Auth. Add this host under Firebase Console -> Authentication -> Settings -> Authorized domains.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked by the browser. We will try redirect sign-in instead.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completing login.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled in Firebase. Enable Google provider in Firebase Console -> Authentication -> Sign-in method.';
  }

  return `Google Sign-In failed (${code}). Please verify Firebase Auth settings and browser popup/cookie permissions.`;
}

async function startGoogleSignIn() {
  if (!firebase || !firebase.auth) {
    alert('Firebase Auth SDK is not available. Please refresh and try again.');
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (DOM.btnGoogleSignin) DOM.btnGoogleSignin.disabled = true;

  try {
    await firebase.auth().signInWithPopup(provider);
  } catch (err) {
    console.error('Google popup sign-in failed:', err);

    const popupFallbackCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/internal-error'
    ];

    if (popupFallbackCodes.includes(err && err.code)) {
      try {
        await firebase.auth().signInWithRedirect(provider);
        return;
      } catch (redirectErr) {
        console.error('Google redirect sign-in failed:', redirectErr);
        alert(getFriendlyAuthErrorMessage(redirectErr));
        return;
      }
    }

    alert(getFriendlyAuthErrorMessage(err));
  } finally {
    if (DOM.btnGoogleSignin) DOM.btnGoogleSignin.disabled = false;
  }
}

/* ─────────────────────────────────────────────
   4. FIREBASE REALTIME DATABASE (No Auth)
   ───────────────────────────────────────────── */

function initFirebase() {
  if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
    console.warn('VenueIQ: Firebase config not loaded.');
    startLocalSimulation();
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    state.db = firebase.database();
    console.info('VenueIQ: Firebase Realtime Database connected.');

    // Resolve redirect-based sign-in flows (used as popup fallback).
    firebase.auth().getRedirectResult().catch(err => {
      console.error('Google redirect result failed:', err);
      alert(getFriendlyAuthErrorMessage(err));
    });

    // Auth State
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        state.currentUser = user;
        DOM.loginScreen.classList.add('hidden');
        DOM.roleModal.classList.remove('hidden'); 
      } else {
        clearRole();
        state.currentUser = null;
        DOM.loginScreen.classList.remove('hidden', 'fade-out');
        DOM.roleModal.classList.add('hidden');
        DOM.mainApp.classList.add('hidden');
      }
    });

    // Realtime listener
    state.db.ref('/venueiq/zones').on('value', snap => {
      const data = snap.val();
      if (data) {
        state.zonesData = data;
        updateUIWithFirebaseData();
        updateCharts();
        updateMapPolygons();
      }
    });

    // Push simulated data every 5s (acts as our backend)
    setInterval(pushSimulationData, 5000);
    pushSimulationData(); // immediate first push

  } catch (err) {
    console.warn('VenueIQ: Firebase unavailable — using local simulation.', err.message);
    startLocalSimulation();
  }
}

function pushSimulationData() {
  if (!state.db) return;
  ZONES.forEach(z => {
    const density    = Math.floor(Math.random() * 80) + 20;
    const waitTime   = Math.floor(Math.random() * 20);
    const staffCount = Math.floor(Math.random() * 15) + 2;
    state.db.ref(`/venueiq/zones/${z.id}`).update({ density, waitTime, staffCount });
  });
}

function startLocalSimulation() {
  // Fallback: generate local data if Firebase is unreachable
  function simulate() {
    ZONES.forEach(z => {
      if (!state.zonesData[z.id]) state.zonesData[z.id] = {};
      state.zonesData[z.id].density    = Math.floor(Math.random() * 80) + 20;
      state.zonesData[z.id].waitTime   = Math.floor(Math.random() * 20);
      state.zonesData[z.id].staffCount = Math.floor(Math.random() * 15) + 2;
    });
    updateUIWithFirebaseData();
    updateCharts();
    updateMapPolygons();
  }
  simulate();
  setInterval(simulate, 5000);
}

function logEventToFirebase(action, data) {
  if (!state.db) return;
  state.db.ref(`/venueiq/events/${Date.now()}`).set({ action, ...data }).catch(() => {});
}

/* ─────────────────────────────────────────────
   5. GOOGLE MAPS
   ───────────────────────────────────────────── */

function initGoogleMaps() {
  if (typeof google === 'undefined' || !google.maps) return;
  const el = document.getElementById('google-map');
  if (!el) return;

  state.map = new google.maps.Map(el, {
    zoom: 16.5,
    center: WEMBLEY_COORDS,
    mapTypeId: 'satellite',
    disableDefaultUI: true, // simplified prototype look
    tilt: 0,
    styles: [
      { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } // No overlay labels
    ],
    backgroundColor: '#0a1628'
  });

  // Colored polygons for each zone
  ZONES.forEach(z => {
    const polygon = new google.maps.Polygon({
      paths:         z.coords,
      strokeColor:   '#FFFFFF',
      strokeOpacity: 0.8,
      strokeWeight:  2,
      fillColor:     '#22c55e',
      fillOpacity:   0.65
    });
    polygon.setMap(state.map);
    state.polygons[z.id] = polygon;
  });

  // Custom markers
  MAP_MARKERS.forEach(m => {
    const marker = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map:   state.map,
      title: m.title,
      icon:  m.icon
    });
    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="color:#111;padding:6px;"><strong>${m.title}</strong><br/><small>Live data: updating every 5s</small></div>`
    });
    marker.addListener('click', () => infoWindow.open(state.map, marker));
  });
}

function updateMapPolygons() {
  if (!state.map) return;
  ZONES.forEach(z => {
    const zd = state.zonesData[z.id];
    if (!zd || !state.polygons[z.id]) return;
    const d     = zd.density;
    const color = d > 70 ? '#ef4444' : d > 40 ? '#f59e0b' : '#22c55e';
    state.polygons[z.id].setOptions({ fillColor: color });
  });
}

/* ─────────────────────────────────────────────
   6. GOOGLE CHARTS (Gauge + Bar + Line)
   ───────────────────────────────────────────── */

function initGoogleCharts() {
  if (typeof google === 'undefined' || !google.charts) return;
  google.charts.load('current', { packages: ['corechart', 'gauge', 'bar', 'line'] });
  google.charts.setOnLoadCallback(() => {
    state.chartsReady = true;
    const gaugeEl = document.getElementById('gauge-chart');
    const barEl   = document.getElementById('wait-times-chart');
    const lineEl  = document.getElementById('density-line-chart');
    if (gaugeEl) state.gaugeChart       = new google.visualization.Gauge(gaugeEl);
    if (barEl)   state.waitTimesChart   = new google.visualization.BarChart(barEl);
    if (lineEl)  state.densityLineChart = new google.visualization.LineChart(lineEl);
    updateCharts();
  });
}

const DARK_OPTS = {
  backgroundColor:  'transparent',
  legend:           { position: 'none' },
  hAxis: { textStyle: { color: '#8bafd4' }, gridlines: { color: '#1e3a5f' }, baselineColor: '#1e3a5f' },
  vAxis: { textStyle: { color: '#8bafd4' }, gridlines: { color: '#1e3a5f' }, minValue: 0 },
  animation: { startup: true, duration: 700, easing: 'out' },
};

function updateCharts() {
  if (!state.chartsReady) return;
  const keys = Object.keys(state.zonesData);
  if (keys.length === 0) return;

  // 1. Gauge — overall average density
  const avgDensity = Math.round(keys.reduce((s, k) => s + (state.zonesData[k].density || 0), 0) / keys.length);
  if (state.gaugeChart) {
    const gData = google.visualization.arrayToDataTable([['Label', 'Value'], ['Capacity %', avgDensity]]);
    state.gaugeChart.draw(gData, {
      width: 180, height: 180,
      redFrom: 90, redTo: 100,
      yellowFrom: 70, yellowTo: 90,
      minorTicks: 5
    });
  }

  // 2. Bar — zone wait times
  if (state.waitTimesChart) {
    const bRows = [['Zone', 'Wait (min)', { role: 'style' }]];
    keys.forEach(k => {
      const w = state.zonesData[k].waitTime || 0;
      const c = w > 12 ? '#ef4444' : w > 5 ? '#f59e0b' : '#22c55e';
      bRows.push([state.zonesData[k] ? k : k, w, c]);
    });
    state.waitTimesChart.draw(google.visualization.arrayToDataTable(bRows), { ...DARK_OPTS });
  }

  // 3. Line — density trend history (last 10 ticks)
  if (state.densityLineChart) {
    state.historyCounter++;
    state.densityHistory.push([`T${state.historyCounter}`, avgDensity]);
    if (state.densityHistory.length > 11) state.densityHistory.splice(1, 1);
    const lData = google.visualization.arrayToDataTable(state.densityHistory);
    state.densityLineChart.draw(lData, { ...DARK_OPTS, colors: ['#00b8ff'] });
  }
}

/* ─────────────────────────────────────────────
   7. UI SYNC FROM FIREBASE DATA
   ───────────────────────────────────────────── */

function updateUIWithFirebaseData() {
  const d = state.zonesData;
  if (d['ConcourseA'] && DOM.wb.food)  setWaitCard('food',  d['ConcourseA'].waitTime);
  if (d['SouthStand'] && DOM.wb.rest)  setWaitCard('rest',  d['SouthStand'].waitTime);
  if (d['EastWing']   && DOM.wb.snack) setWaitCard('snack', d['EastWing'].waitTime);
  if (d['NorthStand'] && DOM.wb.exit)  setWaitCard('exit',  d['NorthStand'].waitTime);
  renderZoneTable(d);
}

function setWaitCard(key, mins) {
  const c = DOM.wb[key];
  if (!c || !c.time) return;
  c.time.textContent = mins;
  const level = mins > 12 ? 'high' : mins > 5 ? 'mid' : 'low';
  const label = mins > 12 ? 'HIGH' : mins > 5 ? 'MED' : 'LOW';
  c.fill.className       = `wait-card__fill ${level}`;
  c.fill.style.height    = `${Math.min(100, (mins / 20) * 100)}%`;
  c.badge.className      = `wait-card__badge ${level}`;
  c.badge.textContent    = label;
}

function renderZoneTable(data) {
  if (!DOM.zoneTableBody) return;
  DOM.zoneTableBody.innerHTML = '';
  ZONES.forEach(z => {
    const zd = data[z.id];
    if (!zd) return;
    const lvl   = zd.density > 70 ? 'high' : zd.density > 40 ? 'mid' : 'low';
    const lText = zd.density > 70 ? 'HIGH' : zd.density > 40 ? 'MED' : 'LOW';
    const tr = document.createElement('tr');
    tr.className = 'zone-row';
    tr.innerHTML = `
      <td><span class="zone-badge">${z.label}</span></td>
      <td><span class="level-pill ${lvl}">${lText} — ${zd.density}%</span></td>
      <td><span class="wait-number">${zd.waitTime} min</span></td>
      <td><span class="staff-count">${zd.staffCount}</span></td>
      <td><button class="deploy-btn" data-zone="${z.id}">
        <span class="material-icons" style="font-size:15px;vertical-align:middle;">security</span> Deploy
      </button></td>`;
    DOM.zoneTableBody.appendChild(tr);
  });
}

function switchView(view) {
  const role = getRole();
  if (view === 'staff' && role !== 'staff') { alert('Access Denied: Staff only.'); return; }
  DOM.tabAttendee.classList.toggle('active', view === 'attendee');
  DOM.tabStaff.classList.toggle('active', view === 'staff');
  DOM.tabAttendee.setAttribute('aria-selected', view === 'attendee');
  DOM.tabStaff.setAttribute('aria-selected', view === 'staff');
  DOM.viewAttendee.classList.toggle('hidden', view !== 'attendee');
  DOM.viewStaff.classList.toggle('hidden', view !== 'staff');
}

/* ─────────────────────────────────────────────
   8. VENUEBOT — Input Validation + Chat
   ───────────────────────────────────────────── */

const ALLOWED_CHARS = /^[a-zA-Z0-9 ?!.,'-]+$/;

/** Strips HTML tags and validates the input. */
function sanitizeInput(raw) {
  // Remove all HTML/script tags
  const stripped = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[<>&"'`]/g, '');
  return stripped.trim().substring(0, 200);
}

function validateVbInput(value) {
  if (!value || value.length === 0) return false;
  if (value.length > 200) return false;
  if (/<|>|script|javascript|onerror|onload/i.test(value)) return false;
  return true;
}

function onVbInputChange() {
  const raw   = DOM.venuebotInput ? DOM.venuebotInput.value : '';
  const valid = validateVbInput(raw);
  const hasHtml = /<|>|script|javascript/i.test(raw);

  if (hasHtml || (!valid && raw.length > 0)) {
    DOM.vbInputError.classList.remove('hidden');
    DOM.venuebotSend.disabled = true;
  } else {
    DOM.vbInputError.classList.add('hidden');
    DOM.venuebotSend.disabled = false;
  }
}

function sendVenueBotMessage() {
  const raw = DOM.venuebotInput ? DOM.venuebotInput.value : '';
  const clean = sanitizeInput(raw);
  if (!clean) return;
  if (!validateVbInput(clean)) { DOM.vbInputError.classList.remove('hidden'); return; }

  DOM.venuebotInput.value = '';
  DOM.vbInputError.classList.add('hidden');
  DOM.venuebotSend.disabled = false;

  vbAppend('user', clean);
  vbShowTyping();

  // Log to Firebase (no auth needed since rules allow public write for demo)
  logEventToFirebase('chat', { msg: clean, ts: Date.now() });

  setTimeout(() => {
    vbHideTyping();
    const lText = clean.toLowerCase();
    const match = VENUEBOT_INTENTS.find(i => i.keywords.some(k => lText.includes(k)));
    vbAppend('bot', match ? match.reply : VB_FALLBACK);
  }, 1000);
}

function vbAppend(sender, html) {
  const wrap = document.createElement('div');
  wrap.className = `vb-msg vb-${sender}`;
  const bubble = document.createElement('div');
  bubble.className = 'vb-bubble';
  bubble.innerHTML = html; // intentionally safe: user content is sanitised before reaching here
  const time = document.createElement('div');
  time.className = 'vb-time';
  time.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  wrap.appendChild(bubble);
  wrap.appendChild(time);
  DOM.venuebotMsgs.appendChild(wrap);
  DOM.venuebotMsgs.scrollTop = DOM.venuebotMsgs.scrollHeight;
}

function vbShowTyping() {
  const d = document.createElement('div');
  d.id = 'vb-typing-dots';
  d.className = 'vb-typing';
  d.setAttribute('aria-label', 'VenueBot is typing');
  d.innerHTML = '<span></span><span></span><span></span>';
  DOM.venuebotMsgs.appendChild(d);
  DOM.venuebotMsgs.scrollTop = DOM.venuebotMsgs.scrollHeight;
}
function vbHideTyping() {
  const d = document.getElementById('vb-typing-dots');
  if (d) d.remove();
}

function seedVenueBot() {
  if (state.vbSeeded) return;
  state.vbSeeded = true;
  vbAppend('bot', '👋 Hi! I\'m <strong>VenueBot</strong>, your smart stadium assistant.<br>Ask me about food, restrooms, exits, or your seat!');
}

/* ─────────────────────────────────────────────
   9. CLOCK
   ───────────────────────────────────────────── */

function initClock() {
  const tick = () => {
    const now = new Date();
    if (DOM.navClock) DOM.navClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    if (DOM.dashTimestamp) DOM.dashTimestamp.textContent = `Last sync: ${now.toLocaleTimeString()}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────
   10. EVENT LISTENERS
   ───────────────────────────────────────────── */

function bindEventListeners() {
  // Auth
  if (DOM.btnGoogleSignin) {
    DOM.btnGoogleSignin.addEventListener('click', startGoogleSignIn);
  }

  // Theme
  if (DOM.btnThemeToggle) DOM.btnThemeToggle.addEventListener('click', toggleTheme);

  // Role selection
  if (DOM.btnAttendee) DOM.btnAttendee.addEventListener('click', handleAttendeeLogin);
  if (DOM.btnStaff)    DOM.btnStaff.addEventListener('click', handleStaffRequest);

  // Session expired modal
  if (DOM.btnSessionOk) DOM.btnSessionOk.addEventListener('click', () => {
    DOM.sessionExpired.classList.add('hidden');
    firebase.auth().signOut();
    DOM.loginScreen.classList.remove('hidden', 'fade-out');
  });

  // Switch role
  if (DOM.btnSwitchRole) DOM.btnSwitchRole.addEventListener('click', switchRole);

  // View tabs
  if (DOM.tabAttendee) DOM.tabAttendee.addEventListener('click', () => switchView('attendee'));
  if (DOM.tabStaff)    DOM.tabStaff.addEventListener('click',    () => switchView('staff'));

  // Request Staff Access (in attendee view)
  if (DOM.reqStaffBtn) DOM.reqStaffBtn.addEventListener('click', () => {
    logEventToFirebase('access_request', { ts: Date.now() });
    alert('Your request for Staff access has been submitted and logged.');
  });

  // VenueBot
  if (DOM.venuebotBtn) DOM.venuebotBtn.addEventListener('click', () => {
    DOM.venuebotPanel.classList.toggle('open');
    if (DOM.venuebotPanel.classList.contains('open')) seedVenueBot();
  });
  if (DOM.venuebotClose) DOM.venuebotClose.addEventListener('click', () => DOM.venuebotPanel.classList.remove('open'));
  if (DOM.venuebotSend)  DOM.venuebotSend.addEventListener('click', sendVenueBotMessage);
  if (DOM.venuebotInput) {
    DOM.venuebotInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendVenueBotMessage(); });
    DOM.venuebotInput.addEventListener('input', onVbInputChange);
  }

  // Deploy staff buttons (table delegation)
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('.deploy-btn');
    if (btn) {
      logEventToFirebase('deploy_staff', { zone: btn.dataset.zone, ts: Date.now() });
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons" style="font-size:15px;vertical-align:middle;">check_circle</span> Deployed';
      btn.classList.add('deployed');
    }
  });
}

/* ─────────────────────────────────────────────
   11. INIT
   ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  initTheme();
  bindEventListeners();
  initClock();
  initFirebase();

  // Restore session if already active (handled primarily by onAuthStateChanged now, but keep fallback)
  const savedRole = getRole();

  if (DOM.splash) {
    setTimeout(() => {
      DOM.splash.classList.add('hidden');
      if (savedRole && state.currentUser) {
        enterApp(savedRole);
      } else if (!state.currentUser) {
        // Only show login if Firebase Auth hasn't already verified them
        DOM.loginScreen.classList.remove('hidden');
      }
    }, 2000);
  }
});
