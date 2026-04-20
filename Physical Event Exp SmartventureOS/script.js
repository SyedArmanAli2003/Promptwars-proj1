/* =============================================
   VenueIQ — Smart Stadium Experience
   script.js — Google Services Integrated
   ============================================= */

'use strict';

/* ─────────────────────────────────────────────
   1. CONSTANTS & CONFIGURATION
   ───────────────────────────────────────────── */

const WEMBLEY_COORDS = { lat: 51.5560, lng: -0.2795 };

const ZONES = [
  { id: 'NorthStand', label: 'North Stand', coords: [
    {lat: 51.5569, lng: -0.2805}, {lat: 51.5569, lng: -0.2785}, {lat: 51.5565, lng: -0.2785}, {lat: 51.5565, lng: -0.2805}
  ]},
  { id: 'SouthStand', label: 'South Stand', coords: [
    {lat: 51.5555, lng: -0.2805}, {lat: 51.5555, lng: -0.2785}, {lat: 51.5551, lng: -0.2785}, {lat: 51.5551, lng: -0.2805}
  ]},
  { id: 'EastWing', label: 'East Wing', coords: [
    {lat: 51.5564, lng: -0.2783}, {lat: 51.5564, lng: -0.2770}, {lat: 51.5556, lng: -0.2770}, {lat: 51.5556, lng: -0.2783}
  ]},
  { id: 'WestWing', label: 'West Wing', coords: [
    {lat: 51.5564, lng: -0.2820}, {lat: 51.5564, lng: -0.2807}, {lat: 51.5556, lng: -0.2807}, {lat: 51.5556, lng: -0.2820}
  ]},
  { id: 'FoodA', label: 'Concourse A', coords: [
    {lat: 51.5572, lng: -0.2795}, {lat: 51.5570, lng: -0.2780}, {lat: 51.5569, lng: -0.2795}
  ]},
  { id: 'FoodB', label: 'Concourse B', coords: [
    {lat: 51.5548, lng: -0.2810}, {lat: 51.5548, lng: -0.2800}, {lat: 51.5550, lng: -0.2800}
  ]}
];

const MARKERS = [
  { lat: 51.5571, lng: -0.2790, title: 'Food Court A', icon: 'http://maps.google.com/mapfiles/ms/icons/restaurant.png' },
  { lat: 51.5550, lng: -0.2805, title: 'Restrooms', icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
  { lat: 51.5560, lng: -0.2775, title: 'First Aid', icon: 'http://maps.google.com/mapfiles/ms/icons/hospitals.png' },
  { lat: 51.5560, lng: -0.2815, title: 'Exit C', icon: 'http://maps.google.com/mapfiles/ms/icons/red-pushpin.png' }
];

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBkI7ryr8dXujHjOs9Q1O1ALq_gDIpwVlI',
  authDomain:        'promptwars-proj1.firebaseapp.com',
  databaseURL:       'https://promptwars-proj1-default-rtdb.firebaseio.com',
  projectId:         'promptwars-proj1',
  storageBucket:     'promptwars-proj1.appspot.com',
  messagingSenderId: '000000000000',
  appId:             'REPLACE'
};
const ADMIN_WHITELIST = ['admin@venueiq.com'];

const VENUEBOT_INTENTS = [
  { keywords: ['food', 'eat', 'hungry', 'snack', 'restaurant', 'concession', 'drink'], reply: '🍔 The shortest food queue right now is at <strong>Gate A Food Court</strong> — only <strong>4 min</strong> wait. Gate C has 12 min. I recommend Gate A!' },
  { keywords: ['toilet', 'restroom', 'bathroom', 'wc', 'loo', 'washroom'], reply: '🚻 Nearest restrooms with under 2 min wait: <strong>Level 2 near Section 115</strong>, and <strong>Level 3 near Section 128</strong>.' },
  { keywords: ['exit', 'leave', 'go home', 'out', 'leaving', 'home', 'outside', 'gate'], reply: '🚪 Best exit right now: <strong>South Exit (Gate 8)</strong> — 3 min walk, 2 min queue. Avoid North Exit — 18 min queue currently.' },
  { keywords: ['seat', 'lost', 'where', 'find', 'section', 'location', 'directions', 'row'], reply: '📍 Your seat is in <strong>Section 118, Row G</strong>. From Gate 4: walk straight 50m, then turn left at the <span style="color:#4db8ff">blue signs</span>.' },
];
const VB_FALLBACK = '💬 I can help with <strong>food queues</strong>, <strong>restrooms</strong>, <strong>exits</strong>, and <strong>finding your seat</strong>. What do you need?';

/* ─────────────────────────────────────────────
   2. APPLICATION STATE
   ───────────────────────────────────────────── */

const state = {
  uid: null,
  userRole: null, 
  currentView: 'attendee',
  db: null,
  map: null,
  polygons: {},
  zonesData: {}, // Holds density, waitTime, staffCount
  historyCounter: 0,
  densityHistory: [['Time', 'Average Density']],
  waitTimesChart: null,
  densityLineChart: null,
  gaugeChart: null,
  chartsReady: false
};

const DOM = {};
function cacheDOMElements() {
  DOM.splash        = document.getElementById('splash-screen');
  DOM.loginScreen   = document.getElementById('login-screen');
  DOM.mainApp       = document.getElementById('main-app');
  DOM.btnGoogleLogin = document.getElementById('btn-google-login');
  DOM.btnSignOut    = document.getElementById('btn-sign-out');
  DOM.navUserProfile = document.getElementById('user-profile-nav');
  DOM.navUserPhoto   = document.getElementById('nav-user-photo');
  DOM.navUserName    = document.getElementById('nav-user-name');
  DOM.navClock      = document.getElementById('nav-clock');
  DOM.viewAttendee  = document.getElementById('view-attendee');
  DOM.viewStaff     = document.getElementById('view-staff');
  DOM.tabAttendee   = document.getElementById('tab-attendee');
  DOM.tabStaff      = document.getElementById('tab-staff');
  DOM.reqStaffBtn   = document.getElementById('btn-request-staff');
  DOM.dashTimestamp = document.getElementById('dash-timestamp');
  DOM.zoneTableBody = document.getElementById('zone-tbody');
  
  DOM.venuebotBtn   = document.getElementById('venuebot-btn');
  DOM.venuebotPanel = document.getElementById('venuebot-panel');
  DOM.venuebotMsgs  = document.getElementById('venuebot-messages');
  DOM.venuebotInput = document.getElementById('venuebot-input');
  DOM.venuebotSend  = document.getElementById('venuebot-send-btn');
  DOM.venuebotClose = document.getElementById('venuebot-close-btn');

  // DOM elements required for simple sync mappings
  DOM.wb = {
    food:  { time: document.getElementById('wt-food'),  fill: document.getElementById('wf-food'),  badge: document.getElementById('wb-food') },
    rest:  { time: document.getElementById('wt-rest'),  fill: document.getElementById('wf-rest'),  badge: document.getElementById('wb-rest') },
    snack: { time: document.getElementById('wt-snack'), fill: document.getElementById('wf-snack'), badge: document.getElementById('wb-snack') },
    exit:  { time: document.getElementById('wt-exit'),  fill: document.getElementById('wf-exit'),  badge: document.getElementById('wb-exit') },
  };
}

/* ─────────────────────────────────────────────
   3. FIREBASE INTEGRATION (AUTH + DB)
   ───────────────────────────────────────────── */

function initFirebase() {
  if (typeof firebase === 'undefined') return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  state.db = firebase.database();

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      handleAuthSuccess(user);
    } else {
      handleAuthSignOut();
    }
  });

  // Simulator: Write mock data to Firebase every 5s acting as the backend
  setInterval(pushSimulationData, 5000);

  // Listeners
  state.db.ref('/venueiq/zones').on('value', snap => {
    const data = snap.val();
    if(data) {
      state.zonesData = data;
      updateUIWithFirebaseData();
      updateCharts();
      updateMapPolygons();
    }
  });
}

function handleAuthSuccess(user) {
  state.uid = user.uid;
  DOM.navUserProfile.style.display = 'flex';
  DOM.navUserPhoto.src = user.photoURL || '';
  DOM.navUserName.textContent = user.displayName || 'User';

  state.db.ref(`/venueiq/users/${user.uid}/role`).once('value').then(snap => {
    const role = snap.val();
    const isStaffByEmail = (user.email && user.email.endsWith('@staff.venueiq.com')) || ADMIN_WHITELIST.includes(user.email);
    state.userRole = role || (isStaffByEmail ? 'staff' : 'attendee');
    
    // Save evaluated role safely
    state.db.ref(`/venueiq/users/${user.uid}/role`).set(state.userRole);

    DOM.tabStaff.classList.toggle('hidden', state.userRole !== 'staff');
    
    DOM.loginScreen.classList.add('fade-out');
    setTimeout(() => {
      DOM.loginScreen.classList.add('hidden');
      DOM.mainApp.classList.remove('hidden');
      switchView(state.userRole === 'staff' ? 'staff' : 'attendee');
      if (!state.map) initGoogleMaps();
      if (!state.chartsReady) initGoogleCharts();
    }, 400);
  });
}

function handleAuthSignOut() {
  state.uid = null;
  state.userRole = null;
  DOM.mainApp.classList.add('hidden');
  DOM.loginScreen.classList.remove('hidden', 'fade-out');
  DOM.navUserProfile.style.display = 'none';
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(e => alert(e.message));
}
function signOut() {
  firebase.auth().signOut().catch(e => console.error(e));
}
function requestStaffAccess() {
  if (!state.uid) return;
  state.db.ref(`/venueiq/accessRequests/${state.uid}`).set({ status: 'pending', timestamp: Date.now() });
  alert("Staff access requested.");
}

function pushSimulationData() {
  if (!state.db) return;
  ZONES.forEach(z => {
    const d = Math.floor(Math.random() * 80) + 20; // 20-100 density
    const w = Math.floor(Math.random() * 20);      // 0-20 waitTime
    const s = Math.floor(Math.random() * 15);      // 0-15 staffCount
    state.db.ref(`/venueiq/zones/${z.id}`).update({ density: d, waitTime: w, staffCount: s });
  });
}

function deployStaffLog(zoneId) {
  const ts = Date.now();
  state.db.ref(`/venueiq/events/${ts}`).set({ action: 'Deploy Staff', zone: zoneId });
  // local increment
  if (state.zonesData[zoneId]) {
    state.db.ref(`/venueiq/zones/${zoneId}/staffCount`).set(state.zonesData[zoneId].staffCount + 3);
  }
}

/* ─────────────────────────────────────────────
   4. GOOGLE MAPS
   ───────────────────────────────────────────── */

function initGoogleMaps() {
  if (typeof google === 'undefined' || !google.maps) return;
  const mapElement = document.getElementById('google-map');
  if(!mapElement) return;

  state.map = new google.maps.Map(mapElement, {
    zoom: 17,
    center: WEMBLEY_COORDS,
    mapTypeId: 'satellite',
    disableDefaultUI: true
  });

  ZONES.forEach(z => {
    const polygon = new google.maps.Polygon({
      paths: z.coords,
      strokeColor: '#FFFFFF', strokeOpacity: 0.8, strokeWeight: 2,
      fillColor: '#22c55e', fillOpacity: 0.35
    });
    polygon.setMap(state.map);
    state.polygons[z.id] = polygon;
  });

  MARKERS.forEach(m => {
    const marker = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map: state.map, title: m.title, icon: m.icon
    });
    const info = new google.maps.InfoWindow({ content: `<strong>${m.title}</strong><br/>Live updates active` });
    marker.addListener('click', () => info.open(state.map, marker));
  });
}

function updateMapPolygons() {
  if (!state.map) return;
  ZONES.forEach(z => {
    if (state.zonesData[z.id]) {
      const d = state.zonesData[z.id].density;
      const color = d > 70 ? '#ef4444' : d > 40 ? '#f59e0b' : '#22c55e';
      state.polygons[z.id].setOptions({ fillColor: color });
    }
  });
}

/* ─────────────────────────────────────────────
   5. GOOGLE CHARTS
   ───────────────────────────────────────────── */

function initGoogleCharts() {
  google.charts.load('current', {'packages':['corechart', 'gauge', 'bar', 'line']});
  google.charts.setOnLoadCallback(() => {
    state.chartsReady = true;
    state.waitTimesChart = new google.visualization.BarChart(document.getElementById('wait-times-chart'));
    state.densityLineChart = new google.visualization.LineChart(document.getElementById('density-line-chart'));
    state.gaugeChart = new google.visualization.Gauge(document.getElementById('gauge-chart'));
    updateCharts();
  });
}

function updateCharts() {
  if (!state.chartsReady) return;
  
  const zKeys = Object.keys(state.zonesData);
  if (zKeys.length === 0) return;

  // 1. Gauge Chart (Overall Capacity Avg)
  let totalD = 0;
  zKeys.forEach(k => totalD += state.zonesData[k].density);
  const avgDensity = Math.round(totalD / zKeys.length);
  
  const gData = google.visualization.arrayToDataTable([ ['Label', 'Value'], ['Capacity', avgDensity] ]);
  const gOpts = { width: 180, height: 180, redFrom: 90, redTo: 100, yellowFrom:75, yellowTo: 90, minorTicks: 5 };
  if(document.getElementById('gauge-chart')) state.gaugeChart.draw(gData, gOpts);

  // 2. Bar Chart (Wait Times)
  const bRows = [['Zone', 'Wait Time (m)']];
  zKeys.forEach(k => bRows.push([k, state.zonesData[k].waitTime]));
  const bData = google.visualization.arrayToDataTable(bRows);
  const bOpts = {
    backgroundColor: 'transparent', titleTextStyle: {color: '#8bafd4'}, 
    legend: {position: 'none'}, hAxis: {textStyle: {color: '#8bafd4'}, gridlines: {color: '#1e3a5f'}},
    vAxis: {textStyle: {color: '#8bafd4'}}
  };
  if(document.getElementById('wait-times-chart')) state.waitTimesChart.draw(bData, bOpts);

  // 3. Line Chart (Density Trend)
  state.historyCounter++;
  state.densityHistory.push([state.historyCounter.toString(), avgDensity]);
  if(state.densityHistory.length > 11) state.densityHistory.splice(1, 1);
  const lData = google.visualization.arrayToDataTable(state.densityHistory);
  if(document.getElementById('density-line-chart')) state.densityLineChart.draw(lData, bOpts);
}

/* ─────────────────────────────────────────────
   6. UI SYNCHRONIZATION
   ───────────────────────────────────────────── */

function updateUIWithFirebaseData() {
  const d = state.zonesData;
  // Update Wait Cards if mapping aligns
  if(DOM.wb.food && d['FoodA']) setWaitCard('food', d['FoodA'].waitTime);
  if(DOM.wb.rest && d['SouthStand']) setWaitCard('rest', d['SouthStand'].waitTime);
  if(DOM.wb.exit && d['NorthStand']) setWaitCard('exit', d['NorthStand'].waitTime);
  
  renderZoneTable(d);
}

function setWaitCard(key, mins) {
  const c = DOM.wb[key];
  if(!c) return;
  c.time.textContent = mins;
  const levelClass = mins > 12 ? 'high' : mins > 5 ? 'mid' : 'low';
  const labelText  = mins > 12 ? 'HIGH' : mins > 5 ? 'MED' : 'LOW';
  c.fill.className = `wait-card__fill ${levelClass}`;
  c.fill.style.height = `${Math.min(100, (mins / 20) * 100)}%`;
  c.badge.className = `wait-card__badge ${levelClass}`;
  c.badge.textContent = labelText;
}

function renderZoneTable(data) {
  if (!DOM.zoneTableBody) return;
  DOM.zoneTableBody.innerHTML = '';
  ZONES.forEach((z) => {
    const zd = data[z.id];
    if (!zd) return;
    const l = zd.density > 70 ? 'high' : zd.density > 40 ? 'mid' : 'low';
    const lText = l.toUpperCase();
    
    const tr = document.createElement('tr');
    tr.className = 'zone-row';
    tr.innerHTML = `
      <td><span class="zone-badge">${z.label}</span></td>
      <td><span class="level-pill ${l}">${lText}</span></td>
      <td><span class="wait-number">${zd.waitTime} min</span></td>
      <td><span class="staff-count">${zd.staffCount}</span></td>
      <td><button class="deploy-btn" data-zone="${z.id}"><span class="material-icons" style="font-size:16px;vertical-align:middle;">security</span> Deploy</button></td>
    `;
    DOM.zoneTableBody.appendChild(tr);
  });
}

function switchView(view) {
  if (view === 'staff' && state.userRole !== 'staff') {
    alert("Access Denied: Staff only.");
    return;
  }
  state.currentView = view;
  const isA = view === 'attendee';
  DOM.tabAttendee.classList.toggle('active', isA);
  DOM.tabStaff.classList.toggle('active', !isA);
  DOM.tabAttendee.setAttribute('aria-selected', isA);
  DOM.tabStaff.setAttribute('aria-selected', !isA);
  DOM.viewAttendee.classList.toggle('hidden', !isA);
  DOM.viewStaff.classList.toggle('hidden', isA);
}

/* ─────────────────────────────────────────────
   7. CHATBOT AND EVENT LISTENERS
   ───────────────────────────────────────────── */

function sendVenueBotMessage() {
  const text = DOM.venuebotInput.value.trim();
  if (!text) return;
  DOM.venuebotInput.value = '';
  vbAppend('user', text);
  vbShowTyping();

  // Log chat to Firebase
  if (state.db) state.db.ref(`/venueiq/chats/${Date.now()}`).set({ uid: state.uid, msg: text, role: state.userRole });

  setTimeout(() => {
    vbHideTyping();
    const lText = text.toLowerCase();
    const match = VENUEBOT_INTENTS.find(i => i.keywords.some(k => lText.includes(k)));
    vbAppend('bot', match ? match.reply : VB_FALLBACK);
  }, 1000);
}

function vbAppend(sender, html) {
  const div = document.createElement('div');
  div.className = `vb-msg vb-${sender}`;
  const p = document.createElement('div');
  p.className = 'vb-bubble';
  p.innerHTML = html;
  const t = document.createElement('div');
  t.className = 'vb-time';
  t.textContent = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  div.appendChild(p); div.appendChild(t);
  DOM.venuebotMsgs.appendChild(div);
  DOM.venuebotMsgs.scrollTop = DOM.venuebotMsgs.scrollHeight;
}
function vbShowTyping() {
  state.vbTyping = true;
  const d = document.createElement('div'); d.id='vb-typing-dots'; d.className='vb-typing';
  d.innerHTML='<span></span><span></span><span></span>';
  DOM.venuebotMsgs.appendChild(d);
  DOM.venuebotMsgs.scrollTop = DOM.venuebotMsgs.scrollHeight;
}
function vbHideTyping() {
  const d = document.getElementById('vb-typing-dots');
  if (d) d.remove();
  state.vbTyping = false;
}

function bindEventListeners() {
  if (DOM.btnGoogleLogin) DOM.btnGoogleLogin.addEventListener('click', signInWithGoogle);
  if (DOM.btnSignOut) DOM.btnSignOut.addEventListener('click', signOut);
  if (DOM.tabAttendee) DOM.tabAttendee.addEventListener('click', () => switchView('attendee'));
  if (DOM.tabStaff) DOM.tabStaff.addEventListener('click', () => switchView('staff'));
  if (DOM.reqStaffBtn) DOM.reqStaffBtn.addEventListener('click', requestStaffAccess);

  if (DOM.venuebotBtn) DOM.venuebotBtn.addEventListener('click', () => DOM.venuebotPanel.classList.toggle('open'));
  if (DOM.venuebotClose) DOM.venuebotClose.addEventListener('click', () => DOM.venuebotPanel.classList.remove('open'));
  if (DOM.venuebotSend) DOM.venuebotSend.addEventListener('click', sendVenueBotMessage);
  if (DOM.venuebotInput) DOM.venuebotInput.addEventListener('keypress', e => e.key === 'Enter' && sendVenueBotMessage());

  document.body.addEventListener('click', e => {
    const btn = e.target.closest('.deploy-btn');
    if (btn) deployStaffLog(btn.dataset.zone);
  });
}

function initClock() {
  setInterval(() => {
    const d = new Date();
    if(DOM.navClock) DOM.navClock.textContent = d.toLocaleTimeString('en-US', {hour12: false});
    if(DOM.dashTimestamp) DOM.dashTimestamp.textContent = `Last sync: ${d.toLocaleTimeString()}`;
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  bindEventListeners();
  initClock();
  initFirebase();
  
  if (DOM.splash) {
    setTimeout(() => {
      DOM.splash.classList.add('hidden');
      if (!state.uid && DOM.loginScreen) {
        DOM.loginScreen.classList.remove('hidden');
      }
    }, 2000);
  }
});
