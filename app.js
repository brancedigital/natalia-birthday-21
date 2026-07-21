'use strict';

/* ============================================================
   Felices 21, Natalia 💜
   Un caminito de sorpresas — hecho con amor por Jesús
   ============================================================ */

/* ---------------- CONFIG (edita aquí los textos clave) ---------------- */
const CONFIG = {
  herName: 'Natalia',
  // Cumpleaños: 20 de julio de 2026. Los cupones expiran 3 meses después:
  couponExpiryISO: '2026-10-20T23:59:59',

  // ⏱️ TIEMPO DE ESPERA ENTRE CUPONES
  // MODO PRUEBA: 1 minuto. Para el día real, cambia a 7 días:
  // cooldownMs: 7 * 24 * 60 * 60 * 1000,
  cooldownMs: 7 * 24 * 60 * 60 * 1000,

  restaurant: 'SushiClub',
  lunchTime: '14:00',
  movieTime: '8:00 PM',
};

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function fmtStamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function fmtDur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}
function humanCooldown(ms) {
  if (ms >= 86400000) return `${Math.round(ms / 86400000)} día${ms >= 172800000 ? 's' : ''}`;
  if (ms >= 3600000) return `${Math.round(ms / 3600000)} hora(s)`;
  if (ms >= 60000) return `${Math.round(ms / 60000)} minuto${ms >= 120000 ? 's' : ''}`;
  return `${Math.round(ms / 1000)} segundos`;
}

/* ---------------- storage ---------------- */
const LS_IT = 'nb21_itinerary_v1';
const LS_CP = 'nb21_coupons_v1';
const LS_MUTE = 'nb21_muted';

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

let state = loadJSON(LS_IT, { step: 0, phase: {}, introSeen: false });
if (typeof state.step !== 'number') state = { step: 0, phase: {}, introSeen: false };
state.phase = state.phase || {};
let coupons = loadJSON(LS_CP, { claims: [null, null, null, null, null] });
if (!Array.isArray(coupons.claims) || coupons.claims.length !== 5) coupons = { claims: [null, null, null, null, null] };

const saveState = () => saveJSON(LS_IT, state);
const saveCoupons = () => saveJSON(LS_CP, coupons);

/* ---------------- sound (WebAudio, sin archivos) ---------------- */
const Snd = {
  muted: (() => { try { return localStorage.getItem(LS_MUTE) === '1'; } catch (e) { return false; } })(),
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur = 0.18, type = 'sine', vol = 0.16, when = 0, slide = 0) {
    if (this.muted) return;
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur = 0.7, vol = 0.22) {
    if (this.muted) return;
    const c = this.ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  },
  click()   { this.tone(880, 0.05, 'triangle', 0.06); },
  locked()  { this.tone(220, 0.16, 'sine', 0.12, 0, 140); },
  wrong()   { this.tone(190, 0.28, 'sawtooth', 0.1, 0, 120); },
  success() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.15, i * 0.09)); },
  fanfare() {
    [[392, 0], [523.25, .12], [659.25, .24], [783.99, .36], [1046.5, .52], [783.99, .74], [1046.5, .88]]
      .forEach(([f, w]) => this.tone(f, 0.24, 'triangle', 0.17, w));
    [130.81, 196].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, i * 0.26));
  },
  epic()    { [196, 261.63, 329.63, 392].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.06, i * 0.15)); this.tone(523.25, 0.9, 'triangle', 0.14, 0.65); },
  clink()   { this.tone(1568, 0.3, 'sine', 0.13); this.tone(2093, 0.42, 'sine', 0.09, 0.09); },
  blow()    { this.noise(0.85, 0.3); },
  firework(){ this.tone(70, 0.35, 'sine', 0.18, 0, 260); this.noise(0.45, 0.1); },
  /* --- recreativos / casino --- */
  coin()    { [988, 1319].forEach((f, i) => this.tone(f, 0.08, 'square', 0.11, i * 0.07)); },
  snip()    { this.tone(2200, 0.04, 'square', 0.09); this.tone(1700, 0.05, 'square', 0.08, 0.05); },
  buzz()    { this.tone(170, 0.32, 'sawtooth', 0.11, 0, 110); },
  slot()    { for (let i = 0; i < 12; i++) this.tone(520 + ((i * 7) % 5) * 60, 0.045, 'square', 0.05, i * 0.055); },
  jackpot() { for (let i = 0; i < 10; i++) this.tone(660 + i * 90, 0.07, 'square', 0.09, i * 0.05); this.noise(0.5, 0.12); },
  /* fanfarria tipo "objeto conseguido" */
  treasure() {
    [[523.25, 0], [659.25, .13], [783.99, .26], [1046.5, .39]]
      .forEach(([f, w]) => this.tone(f, 0.2, 'triangle', 0.16, w));
    this.tone(1046.5, 0.95, 'triangle', 0.17, 0.56);
    this.tone(1567.98, 0.95, 'sine', 0.07, 0.56);
    [261.63, 392].forEach(f => this.tone(f, 0.8, 'sine', 0.085, 0.56));
  },
};

/* ---------------- layout del mundo ---------------- */
const W = 430;
const NODE_XY = [
  [110, 430], [320, 870], [105, 1310], [325, 1750], [110, 2190],
  [320, 2630], [115, 3070], [315, 3510], [215, 3960],
];
const START = [215, 150];
const WORLD_H = 4280;
const PTS = [START, ...NODE_XY].map(([x, y]) => ({ x, y }));

const STEPS = [
  { id: 'desayuno', mystIcon: '🍳', doneIcon: '🍳', mystName: 'Desayuno',    doneName: 'Desayuno',     time: '🌅 buenos días' },
  { id: 'flores',   mystIcon: '🔮', doneIcon: '💐', mystName: 'Misterio #1', doneName: 'Flores',       time: '⚽ una pista…' },
  { id: 'regalo',   mystIcon: '🎁', doneIcon: '🎁', mystName: 'Un regalo',   doneName: 'Cupones de oro', time: '✨ para ti' },
  { id: 'matcha',   mystIcon: '📜', doneIcon: '🍵', mystName: 'Plan secreto', doneName: 'Matcha Mia',   time: '☀️ la tarde' },
  { id: 'japon',    mystIcon: '⛩️', doneIcon: '🎂', mystName: 'Pueblito japonés', doneName: 'SushiClub + 🎂', time: '🍣 14:00' },
  { id: 'paseo',    mystIcon: '📜', doneIcon: '🕹️', mystName: 'Plan secreto', doneName: 'El paseo',    time: '🌆 caminito' },
  { id: 'arena',    mystIcon: '🏛️', doneIcon: '🎬', mystName: 'La guerra',   doneName: 'The Odyssey',  time: '⚔️ prepárate' },
  { id: 'bar',      mystIcon: '🍸', doneIcon: '🍸', mystName: 'Chill',       doneName: 'Cóctel + Catan', time: '🌙 11 PM' },
  { id: 'casa',     mystIcon: '🏠', doneIcon: '🤍', mystName: 'A casa',      doneName: 'A casa',       time: '⭐ el final' },
];

const RECAPS = [
  'Desayuno en la cama, como se debe. ✅',
  'La sala tenía flores para ti. 💐',
  '', // regalo → siempre abre los cupones
  'Amor + sol + Matcha Mia. Tarde perfecta. 🍵',
  'SushiClub: ceviche, sushi… y un pastel sorpresa. 🎂',
  'Sol Mall, recreativos y el centro. 🕹️',
  'Sobrevivimos a la guerra de Nolan. 🎬',
  'Cóctel, Catan y nosotros. 🥂',
  '',
];

/* ---------------- SVG decor builders ---------------- */
function svgMachiya(x, w) {
  // casita japonesa antigua: madera oscura, shoji y techo con alero
  const beams = [x + 6, x + Math.round(w / 2) - 2, x + w - 10]
    .map(bx => `<rect x="${bx}" y="58" width="4" height="82" fill="#4a3626"/>`).join('');
  const shoji = (sx) => `<rect x="${sx}" y="66" width="22" height="20" fill="#fff6e0" stroke="#4a3626" stroke-width="2.5"/>
    <line x1="${sx + 11}" y1="66" x2="${sx + 11}" y2="86" stroke="#4a3626" stroke-width="1.5"/>
    <line x1="${sx}" y1="76" x2="${sx + 22}" y2="76" stroke="#4a3626" stroke-width="1.5"/>`;
  return `<polygon points="${x - 12},58 ${x + w + 12},58 ${x + w + 4},40 ${x + w - 6},34 ${x + 6},34 ${x - 4},40" fill="#3b4252"/>
    <rect x="${x + 4}" y="30" width="${w - 8}" height="6" rx="3" fill="#2e3440"/>
    <rect x="${x}" y="58" width="${w}" height="82" fill="#f2ead8"/>
    ${beams}
    ${shoji(x + 14)}${shoji(x + w - 38)}
    <rect x="${x + Math.round(w / 2) - 12}" y="96" width="24" height="44" rx="2" fill="#4a3626"/>
    <line x1="${x + Math.round(w / 2)}" y1="96" x2="${x + Math.round(w / 2)}" y2="140" stroke="#f2ead8" stroke-width="2"/>`;
}
function svgTorii(x) {
  return `<rect x="${x - 14}" y="40" width="96" height="10" rx="4" fill="#c0392b"/>
    <rect x="${x - 4}" y="54" width="76" height="7" fill="#c0392b"/>
    <rect x="${x}" y="50" width="9" height="90" fill="#a93226"/>
    <rect x="${x + 59}" y="50" width="9" height="90" fill="#a93226"/>`;
}
function svgJapan() {
  return `<svg class="svg-decor" viewBox="0 0 430 150" width="100%" preserveAspectRatio="xMidYMax meet">
    <polygon points="20,150 200,16 380,150" fill="#8fa3c8" opacity=".55"/>
    <polygon points="152,52 200,16 248,52" fill="#ffffff" opacity=".9"/>
    ${svgMachiya(16, 100)}${svgMachiya(136, 100)}${svgMachiya(256, 100)}
    ${svgTorii(372)}
  </svg>`;
}
function svgColumn(x) {
  let flutes = '';
  for (let i = 0; i < 4; i++) flutes += `<line x1="${x + 11 + i * 8}" y1="38" x2="${x + 11 + i * 8}" y2="108" stroke="#d3ccb6" stroke-width="2"/>`;
  return `<rect x="${x}" y="20" width="46" height="9" rx="2" fill="#efe9d8"/>
    <rect x="${x + 3}" y="29" width="40" height="6" fill="#ddd6c2"/>
    <rect x="${x + 7}" y="35" width="32" height="75" fill="#efe9d8"/>${flutes}
    <rect x="${x + 3}" y="110" width="40" height="7" fill="#ddd6c2"/>
    <rect x="${x}" y="117" width="46" height="9" rx="2" fill="#efe9d8"/>`;
}
function svgArena() {
  return `<svg class="svg-decor" viewBox="0 0 430 130" width="100%" preserveAspectRatio="xMidYMax meet">
    <polygon points="60,22 215,-6 370,22" fill="#e8e2d0"/>
    ${svgColumn(80)}${svgColumn(192)}${svgColumn(304)}
    <rect x="60" y="126" width="310" height="6" fill="#cfc8b2"/>
  </svg>`;
}
function svgHome() {
  return `<svg class="svg-decor" viewBox="0 0 200 120" width="150" preserveAspectRatio="xMidYMax meet">
    <polygon points="30,55 100,10 170,55" fill="#8a4a3a"/>
    <rect x="42" y="55" width="116" height="60" rx="4" fill="#f2e6d2"/>
    <rect x="88" y="78" width="26" height="37" rx="3" fill="#7a4b2a"/>
    <rect x="56" y="68" width="20" height="18" fill="#ffe9a3"><animate attributeName="opacity" values="1;.55;1" dur="3s" repeatCount="indefinite"/></rect>
    <rect x="126" y="68" width="20" height="18" fill="#ffe9a3"><animate attributeName="opacity" values=".6;1;.6" dur="3.6s" repeatCount="indefinite"/></rect>
    <rect x="128" y="18" width="12" height="24" fill="#6e4a3a"/>
  </svg>`;
}

/* ---------------- el Osito Limón (peluche dibujado, no emoji) ----------------
   Osito de peluche marrón claro: mucho más alto que ancho (tipo palito),
   con un limoncito en la cabeza. Se dibuja en SVG para poder escalarlo. */
function svgPlush(w = 60) {
  return `<svg class="plush-svg" viewBox="0 0 60 190" width="${w}" role="img" aria-label="Osito Limón">
    <!-- piernas y pies (finitos y largos) -->
    <rect x="21.5" y="140" width="8" height="42" rx="4" fill="#c0925c"/>
    <rect x="30.5" y="140" width="8" height="42" rx="4" fill="#b5854f"/>
    <ellipse cx="25.5" cy="182" rx="5" ry="3.8" fill="#cda06b"/>
    <ellipse cx="34.5" cy="182" rx="5" ry="3.8" fill="#c0925c"/>
    <!-- brazos larguísimos pegados al cuerpo -->
    <rect x="12" y="54" width="7" height="58" rx="3.5" fill="#c0925c"/>
    <rect x="41" y="54" width="7" height="58" rx="3.5" fill="#b5854f"/>
    <!-- cuerpo tipo palito -->
    <rect x="21" y="45" width="18" height="106" rx="9" fill="#cda06b"/>
    <ellipse cx="30" cy="104" rx="6" ry="33" fill="#eddcc0"/>
    <!-- orejas -->
    <circle cx="20.5" cy="23.5" r="5.8" fill="#cda06b"/>
    <circle cx="39.5" cy="23.5" r="5.8" fill="#cda06b"/>
    <circle cx="20.5" cy="23.5" r="3" fill="#e8c8a8"/>
    <circle cx="39.5" cy="23.5" r="3" fill="#e8c8a8"/>
    <!-- cabeza -->
    <ellipse cx="30" cy="34" rx="13.5" ry="12.5" fill="#cda06b"/>
    <ellipse cx="21" cy="37.5" rx="2.7" ry="1.8" fill="#f0a9a0" opacity=".5"/>
    <ellipse cx="39" cy="37.5" rx="2.7" ry="1.8" fill="#f0a9a0" opacity=".5"/>
    <!-- hocico -->
    <ellipse cx="30" cy="39.5" rx="6.5" ry="4.8" fill="#eddcc0"/>
    <ellipse cx="30" cy="37.4" rx="2.3" ry="1.7" fill="#4a3524"/>
    <path d="M30 39.2 v2.1 M30 41.3 q-2.1 1.7 -3.8 .1 M30 41.3 q2.1 1.7 3.8 .1"
      stroke="#4a3524" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <!-- ojitos -->
    <circle cx="24.4" cy="31.4" r="2.1" fill="#4a3524"/>
    <circle cx="35.6" cy="31.4" r="2.1" fill="#4a3524"/>
    <circle cx="25.1" cy="30.6" r=".8" fill="#fff"/>
    <circle cx="36.3" cy="30.6" r=".8" fill="#fff"/>
    <!-- limoncito en la cabeza -->
    <ellipse cx="30" cy="15.5" rx="6.5" ry="5" fill="#ffe04a"/>
    <ellipse cx="28" cy="14.2" rx="2.4" ry="1.6" fill="#fff5a8" opacity=".85"/>
    <path d="M36.2 14.6 q2.1 -.5 2.8 -1.7" stroke="#f2c518" stroke-width="1.7" fill="none" stroke-linecap="round"/>
    <path d="M30 10.4 q3.1 -3 6.5 -1.9 q-1.4 3.2 -4.9 3 z" fill="#5fbf5a"/>
  </svg>`;
}

/* ---------------- zones ---------------- */
function lanternsHTML() {
  return `<div style="display:flex; gap:16px;">${[0, 1, 2, 3]
    .map(i => `<span class="sway" style="animation-delay:${i * .3}s; font-size:24px;">🏮</span>`).join('')}</div>`;
}
function zoneDecorHTML(i) {
  switch (i) {
    case 0: return `
      <div class="decor sun" style="left:6%; top:26px;"></div>
      <div class="decor cloud" style="left:30%; top:36px;"></div>
      <div class="decor cloud slow" style="left:55%; top:120px;"></div>
      <div class="decor floaty" style="right:10%; top:150px; font-size:32px;">🎈</div>
      <div class="decor floaty2" style="right:24%; top:190px; font-size:24px;">🎈</div>
      <div class="decor floaty2" style="left:14%; top:240px; font-size:22px;">🕊️</div>`;
    case 1: return `
      <div class="decor butterfly" style="left:16%; top:130px; font-size:24px;">🦋</div>
      <div class="decor" style="left:4%; bottom:14px; font-size:27px;">
        <span class="sway">🌷</span><span class="sway" style="animation-delay:.4s">🌼</span><span class="sway" style="animation-delay:.8s">🌻</span>
      </div>
      <div class="decor" style="right:4%; bottom:18px; font-size:27px;">
        <span class="sway" style="animation-delay:.2s">🌸</span><span class="sway" style="animation-delay:.6s">🌺</span><span class="sway" style="animation-delay:1s">🌷</span>
      </div>
      <div class="decor cloud slow" style="left:8%; top:30px;"></div>`;
    case 2: return `
      <div class="decor sparkle" style="left:16%; top:120px; font-size:24px;">✨</div>
      <div class="decor sparkle" style="right:14%; top:200px; font-size:20px; animation-delay:.6s">✨</div>
      <div class="decor sparkle" style="left:34%; top:300px; font-size:26px; animation-delay:1.1s">✨</div>
      <div class="decor floaty" style="right:22%; top:110px; font-size:26px;">💛</div>`;
    case 3: return `
      <div class="decor" style="left:8%; top:110px;"><div class="shop-sign">🍵 MATCHA MIA</div></div>
      <div class="decor steam-cup" style="left:14%; top:170px;">🍵
        <span class="steam"></span><span class="steam s2"></span><span class="steam s3"></span>
      </div>
      <div class="decor floaty2" style="right:12%; top:120px; font-size:26px;">☕</div>
      <div class="decor sun" style="right:-4%; top:280px; width:60px; height:60px; opacity:.9;"></div>`;
    case 4: return `
      <div class="decor" style="left:6%; top:60px;">${lanternsHTML()}</div>
      <div class="decor" style="left:0; right:0; bottom:6px;">${svgJapan()}</div>
      <div class="decor floaty" style="right:8%; top:110px; font-size:24px;">🌸</div>
      <div class="decor floaty2" style="left:42%; top:96px; font-size:22px;">🌸</div>`;
    case 5: return `
      <div class="decor city" style="left:4%; bottom:12px;">
        <i style="height:70px"></i><i style="height:100px"></i><i style="height:56px"></i><i style="height:86px"></i>
      </div>
      <div class="decor" style="right:6%; top:100px;"><div class="neon">SOL MALL</div></div>
      <div class="decor floaty" style="right:14%; top:190px; font-size:26px;">🕹️</div>
      <div class="decor floaty2" style="left:16%; top:130px; font-size:24px;">🛍️</div>`;
    case 6: return `
      <div class="decor" style="left:0; right:0; bottom:8px;">${svgArena()}</div>
      <div class="decor torch" style="left:12%; top:110px;"></div>
      <div class="decor torch" style="right:12%; top:110px;"></div>
      <div class="decor floaty" style="right:22%; top:60px; font-size:26px;">⚔️</div>
      <div class="decor floaty2" style="left:22%; top:70px; font-size:24px;">🛡️</div>`;
    case 7: return `
      <div class="decor" style="left:8%; top:90px;"><div class="neon" style="color:#7ef3ff; border-color:#7ef3ff; text-shadow:0 0 8px #19c8e8, 0 0 20px #19c8e8; box-shadow:0 0 12px rgba(25,200,232,.7), inset 0 0 10px rgba(25,200,232,.4);">🍸 CHILL BAR</div></div>
      <div class="decor floaty" style="right:12%; top:150px; font-size:26px;">🎲</div>
      <div class="decor floaty2" style="right:26%; top:80px; font-size:22px;">🌙</div>
      <div class="decor sparkle" style="left:20%; top:210px; font-size:18px;">✨</div>`;
    case 8: return `
      <div class="decor" style="left:50%; transform:translateX(-50%); bottom:40px;">${svgHome()}</div>
      <div class="decor floaty2" style="right:14%; top:60px; font-size:30px;">🌙</div>
      <div class="decor hearts-rise" style="left:50%; bottom:150px; width:10px; height:10px;">
        <span style="left:-40px; animation-delay:0s">💜</span>
        <span style="left:10px; animation-delay:1.2s">💗</span>
        <span style="left:-15px; animation-delay:2.4s">💜</span>
        <span style="left:30px; animation-delay:3.4s">💛</span>
      </div>`;
  }
  return '';
}

/* ---------------- build world ---------------- */
const app = $('#app'), world = $('#world'), fx = $('#fx');
const overlay = $('#overlay'), card = $('#card');
let basePathEl, progressPathEl, totalLen = 0, lenAt = [];
let walkerEl, whoEl, walkerLen = 0;
let pendingWalk = false;
let overlayClosable = true;

function catmullD(pts) {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    segs.push(` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`);
  }
  return segs;
}

function buildWorld() {
  world.style.height = WORLD_H + 'px';
  let html = '';

  // estrellas en la parte nocturna
  for (let i = 0; i < 48; i++) {
    const y = rnd(2500, WORLD_H - 60), x = rnd(2, 98);
    html += `<div class="star" style="left:${x}%; top:${y}px; animation-delay:${rnd(0, 3).toFixed(1)}s; opacity:${(clamp((y - 2500) / 1200, .15, 1)).toFixed(2)}"></div>`;
  }

  // zonas
  for (let i = 0; i < 9; i++) {
    const top = NODE_XY[i][1] - 250;
    html += `<div class="zone" id="zone${i}" style="top:${top}px; height:470px;">${zoneDecorHTML(i)}${i > 0 ? '<div class="fog" data-fog></div>' : ''}</div>`;
  }

  // camino
  const segs = catmullD(PTS);
  const d = `M ${PTS[0].x} ${PTS[0].y}` + segs.join('');
  html += `<svg id="pathSvg" viewBox="0 0 ${W} ${WORLD_H}" preserveAspectRatio="none">
    <path id="basePath" d="${d}"/><path id="progressPath" d="${d}"/></svg>`;

  // salida
  html += `<div class="start-flag" style="left:${START[0] / W * 100}%; top:${START[1] - 46}px;">🎂</div>
    <div class="start-label" style="left:${START[0] / W * 100}%; top:${START[1] - 20}px;">Aquí empieza tu día ✨</div>`;

  // nodos + etiquetas
  for (let i = 0; i < 9; i++) {
    const [x, y] = NODE_XY[i];
    html += `<button class="node" id="node${i}" data-i="${i}" style="left:${x / W * 100}%; top:${y}px;"></button>
      <div class="node-label" style="left:${x / W * 100}%; top:${y + 38}px;">
        <span class="nl-name" id="nlname${i}"></span><span class="nl-time">${STEPS[i].time}</span>
      </div>`;
  }

  // caminantes: ella y él, de la mano 🤍
  html += `<div id="walker" class="idle"><span class="aura"></span><span class="who">👫</span></div>`;

  // personajes para revivir recuerdos (aparecen al completar su paso)
  html += `<button class="revive-char" id="reviveMerce" type="button" hidden
      style="left:72%; top:${NODE_XY[0][1]}px;">
      <span class="rc-scene"><span class="rc-main">👩🏻</span><span class="rc-prop">🍳</span></span>
      <span class="rc-tip">Revive el desayuno 💛</span>
    </button>
    <button class="revive-char" id="reviveJavier" type="button" hidden
      style="left:72%; top:${NODE_XY[4][1]}px;">
      <span class="rc-scene"><span class="rc-main">🧔🏻</span><span class="rc-prop">🎸</span></span>
      <span class="rc-tip">Carta + canción 🤍</span>
    </button>
    <button class="revive-char" id="revivePeluche" type="button" hidden
      style="left:26%; top:${NODE_XY[5][1]}px;">
      <span class="rc-scene rc-svg">${svgPlush(18)}</span>
      <span class="rc-tip">El ${PLUSH_NAME} 🍋</span>
    </button>`;

  world.innerHTML = html;
  basePathEl = $('#basePath'); progressPathEl = $('#progressPath');
  walkerEl = $('#walker'); whoEl = $('.who', walkerEl);

  // longitudes acumuladas del camino en cada punto
  const tmp = document.createElementNS(NS, 'path');
  $('#pathSvg').appendChild(tmp);
  tmp.setAttribute('visibility', 'hidden');
  lenAt = [0];
  for (let k = 1; k < PTS.length; k++) {
    tmp.setAttribute('d', `M ${PTS[0].x} ${PTS[0].y}` + segs.slice(0, k).join(''));
    lenAt.push(tmp.getTotalLength());
  }
  tmp.remove();
  totalLen = lenAt[lenAt.length - 1];
  progressPathEl.style.strokeDasharray = `${totalLen}`;

  for (let i = 0; i < 9; i++) {
    $('#node' + i).addEventListener('click', () => openStep(i));
  }

  $('#reviveMerce').addEventListener('click', () => { Snd.click(); thanksStage(THANKS.merce, null); });
  $('#reviveJavier').addEventListener('click', () => { Snd.click(); letterStage(LETTERS.javier, null); });
  $('#revivePeluche').addEventListener('click', () => { Snd.click(); arcadeMemory(); });
}

function setWalkerPos(x, y) {
  walkerEl.style.left = (x / W * 100) + '%';
  walkerEl.style.top = y + 'px';
}
function walkerTargetIdx() { return Math.min(state.step, 8) + 1; }

function placeWalkerInstant() {
  walkerLen = lenAt[walkerTargetIdx()];
  const p = basePathEl.getPointAtLength(walkerLen);
  setWalkerPos(p.x, p.y);
  progressPathEl.style.strokeDashoffset = totalLen - walkerLen;
}

function scrollFollow(y, smooth = false) {
  const target = clamp(y - app.clientHeight * 0.45, 0, WORLD_H);
  if (smooth) app.scrollTo({ top: target, behavior: 'smooth' });
  else app.scrollTop = target;
}

function walkTo(ptIdx, done) {
  const to = lenAt[ptIdx], from = walkerLen;
  const dist = Math.abs(to - from);
  if (dist < 2) { done && done(); return; }
  const dur = clamp(dist * 3.4, 1400, 3000);
  walkerEl.classList.remove('idle');
  const t0 = performance.now();
  const frame = now => {
    const t = clamp((now - t0) / dur, 0, 1);
    const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const len = from + (to - from) * e;
    const p = basePathEl.getPointAtLength(len);
    const p2 = basePathEl.getPointAtLength(clamp(len + 3, 0, totalLen));
    walkerEl.classList.toggle('flip', p2.x < p.x);
    const bob = Math.abs(Math.sin(t * Math.PI * 9)) * 5;
    setWalkerPos(p.x, p.y - bob);
    progressPathEl.style.strokeDashoffset = totalLen - len;
    scrollFollow(p.y);
    if (t < 1) requestAnimationFrame(frame);
    else {
      walkerLen = to;
      walkerEl.classList.add('idle');
      done && done();
    }
  };
  requestAnimationFrame(frame);
}

/* ---------------- render de estado ---------------- */
function refresh() {
  for (let i = 0; i < 9; i++) {
    const node = $('#node' + i), name = $('#nlname' + i);
    const st = STEPS[i];
    node.classList.remove('locked', 'current', 'done');
    if (i < state.step) {
      node.classList.add('done');
      node.textContent = st.doneIcon;
      name.textContent = st.doneName;
    } else if (i === state.step) {
      node.classList.add('current');
      node.textContent = st.mystIcon;
      name.textContent = st.mystName;
    } else {
      node.classList.add('locked');
      node.textContent = '?';
      name.textContent = '· · ·';
    }
    const fog = $('#zone' + i + ' [data-fog]');
    if (fog && i <= state.step) {
      fog.classList.add('lift');
      setTimeout(() => fog.remove(), 1600);
    }
  }
  $('#progressBadge').textContent = `${Math.min(state.step, 9)}/9`;

  // personajes revivibles: aparecen tras completar su paso
  const rMerce = $('#reviveMerce'), rJavier = $('#reviveJavier'), rPeluche = $('#revivePeluche');
  if (rMerce) rMerce.hidden = state.step < 1;     // tras el desayuno
  if (rJavier) rJavier.hidden = state.step < 5;   // tras la comida (paso japón)
  if (rPeluche) rPeluche.hidden = state.step < 6; // tras el Sol Mall (peluche ganado)
}

/* ---------------- overlay / cards ---------------- */
function showCard(html, opts = {}) {
  overlayClosable = opts.closable !== false;
  card.className = opts.papyrus ? 'papyrus' : '';
  card.innerHTML = (overlayClosable ? '<button class="close-x" type="button">✕</button>' : '') + html;
  overlay.hidden = false;
  overlay.classList.remove('show-anim'); void overlay.offsetWidth;
  overlay.classList.add('show-anim');
  const x = $('.close-x', card);
  if (x) x.addEventListener('click', () => { Snd.click(); hideCard(); });
}
function hideCard() { overlay.hidden = true; card.innerHTML = ''; }
overlay.addEventListener('click', e => { if (e.target === overlay && overlayClosable) hideCard(); });

/* ---------------- fx ---------------- */
function confettiBurst(n = 70, colors = ['#ffd23f', '#ff5fa2', '#7c4dff', '#4dd0e1', '#2ecc71']) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.setProperty('--x', rnd(0, 100) + '%');
    el.style.setProperty('--c', pick(colors));
    el.style.setProperty('--d', rnd(1.6, 3.2) + 's');
    el.style.setProperty('--r', rnd(0, 360) + 'deg');
    el.addEventListener('animationend', () => el.remove());
    fx.appendChild(el);
  }
}
function petalRain(petals = ['🌸', '🌷', '🌹', '💐', '🌼', '🌺']) {
  for (let i = 0; i < 34; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'petal';
      el.style.setProperty('--x', rnd(0, 96) + '%');
      el.style.setProperty('--d', rnd(3, 5.4) + 's');
      el.style.setProperty('--s', rnd(18, 32) + 'px');
      el.innerHTML = `<span class="in">${pick(petals)}</span>`;
      el.addEventListener('animationend', () => el.remove());
      fx.appendChild(el);
    }, i * 90);
  }
}
function fireworks(duration = 4000) {
  const colors = ['#ffd23f', '#ff5fa2', '#7c4dff', '#7ef3ff', '#aaff7e', '#ff8f5f'];
  const iv = setInterval(() => {
    const burst = document.createElement('div');
    burst.className = 'fw';
    burst.style.setProperty('--x', rnd(12, 88) + '%');
    burst.style.setProperty('--y', rnd(12, 55) + '%');
    const c = pick(colors);
    let inner = '';
    const parts = 22;
    for (let i = 0; i < parts; i++) {
      inner += `<i style="--a:${(360 / parts * i).toFixed(0)}deg; --dist:${rnd(55, 130).toFixed(0)}px; --c:${c}; --d:${rnd(.8, 1.3).toFixed(2)}s"></i>`;
    }
    burst.innerHTML = inner;
    fx.appendChild(burst);
    Snd.firework();
    setTimeout(() => burst.remove(), 1600);
  }, 380);
  setTimeout(() => clearInterval(iv), duration);
}

/* etapa a pantalla completa (regalo / pastel) */
function makeStage(html) {
  const st = document.createElement('div');
  st.className = 'stage';
  st.innerHTML = html;
  $('#phone').appendChild(st);
  return st;
}

function giftStage() {
  const st = makeStage(`
    <div class="giftwrap">
      <div class="giftbox bounce" id="giftbox">
        <div class="gift-burst">💛✨💆‍♀️</div>
        <div class="gift-lid"></div>
        <div class="gift-bow">🎀</div>
        <div class="gift-body"></div>
      </div>
    </div>
    <div class="stage-msg">Tienes un regalo 🎁</div>
    <div class="stage-sub">Tócalo para abrirlo…</div>`);
  const box = $('#giftbox', st);
  let opened = false;
  box.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    box.classList.remove('bounce');
    box.classList.add('open');
    Snd.fanfare();
    confettiBurst(50, ['#ffd23f', '#ffe9a3', '#f2a71b', '#ffffff']);
    $('.stage-msg', st).textContent = '¡¿Qué seráaa?! ✨';
    $('.stage-sub', st).textContent = '';
    setTimeout(() => {
      st.remove();
      completeStep(2, { deferWalk: true, silent: true, confetti: false });
      openCoupons();
    }, 1400);
  });
}

function cakeStage(onDone) {
  const st = makeStage(`
    <div class="cake" id="cake">
      <div class="candle c2">2<div class="flame"></div><div class="smoke"></div></div>
      <div class="candle c1">1<div class="flame"></div><div class="smoke"></div></div>
      <div class="layer l3"><div class="drip"></div></div>
      <div class="layer l2"><div class="drip"></div></div>
      <div class="layer l1"><div class="drip"></div></div>
      <div class="plate"></div>
    </div>
    <div class="stage-msg">¿Pensabas que no habría pastel? 🎂</div>
    <div class="stage-sub">Pide un deseo y toca la pantalla para soplar…</div>`);
  let blown = false;
  st.addEventListener('click', () => {
    if (blown) return;
    blown = true;
    $('#cake', st).classList.add('blown');
    Snd.blow();
    setTimeout(() => {
      Snd.fanfare();
      confettiBurst(90);
      $('.stage-msg', st).textContent = '¡Feliz cumpleaños, mi amor! 💜';
      $('.stage-sub', st).textContent = 'La sorpresa ya estaba lista desde antes 😏';
      const btn = document.createElement('button');
      btn.className = 'btn gold';
      btn.textContent = 'Continuar 💜';
      btn.addEventListener('click', () => { st.remove(); onDone && onDone(); });
      st.appendChild(btn);
    }, 900);
  });
}

/* notita secreta de agradecimiento (mamá / papá) */
const THANKS = {
  merce: {
    seal: '💛', noteEmoji: '🥐💛',
    title: '<b>Merce</b> también pensó en ti 💛',
    lines: 'Ella puso su granito de ayuda, te quiere, le importas y que quería que tu día empezara así de bien.',
    hearts: ['💛', '🤍', '💜', '🥐', '✨'],
  },
  javier: {
    seal: '🤍', noteEmoji: '🍣🤍',
    title: 'Tu papá también fue parte de esto 🤍',
    lines: 'Nos ha invitado a la comida… y además te escribió una carta y te preparó una canción 🎶🤍.',
    hearts: ['🤍', '💜', '💗', '🍣', '✨'],
    cta: 'Leer su carta 🤍',
  },
};

function thanksStage(t, onDone) {
  const st = makeStage(`
    <div class="envwrap">
      <div class="envelope bounce" id="env">
        <div class="env-back"></div>
        <div class="env-note">${t.noteEmoji}</div>
        <div class="env-front"></div>
        <div class="env-flap"></div>
        <div class="env-seal">${t.seal}</div>
      </div>
    </div>
    <div class="stage-msg">Espera… hay una notita secreta para ti 💌</div>
    <div class="stage-sub">Tócala para abrirla</div>`);
  const env = $('#env', st);
  let opened = false;
  env.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    env.classList.remove('bounce');
    env.classList.add('open');
    Snd.success();
    setTimeout(() => {
      Snd.clink();
      petalRain(t.hearts);
      $('.stage-msg', st).innerHTML = t.title;
      $('.stage-sub', st).innerHTML = t.lines;
      const btn = document.createElement('button');
      btn.className = 'btn gold';
      btn.textContent = t.cta || 'Qué bonito 💜';
      btn.addEventListener('click', () => { Snd.click(); st.remove(); onDone && onDone(); });
      st.appendChild(btn);
    }, 1000);
  });
}

/* ============================================================
   CARTAS + REPRODUCTOR (papá / mamá) — recuerdos revivibles
   ------------------------------------------------------------
   ✏️  PARA EDITAR EL CONTENIDO REAL:
   - Cambia el texto de `pages` abajo. Cada elemento del array
     es UNA PÁGINA del pergamino. Usa \n\n para separar párrafos
     dentro de la misma página, y \n para un salto de línea simple.
   - La canción de Javier vive en:  ./media/javier-song.mp3
     (para reemplazarla, deja el mismo nombre de archivo).
   ============================================================ */
const LETTERS = {
  javier: {
    emoji: '🎸',
    title: 'Una carta de tu papá',
    sub: 'La escribió él mismo — tómate tu tiempo 🤍',
    song: './media/javier-song.mp3',
    songTitle: 'Canción para ti 🎶',
    notes: ['🎵', '🎶', '🤍', '💜', '✨'],
    // Teléfono de papá: el botón "Llamarle" abre la app de llamadas del móvil
    phone: '+573134367392',
    // Foto que preparó Javier (última página, con pantalla completa + descarga)
    photo: './media/javi-photo.jpeg',
    photoDownloadName: 'natalia-cumple-21.jpeg',
    // 👇👇  CARTA REAL DE JAVIER  👇👇
    pages: [
      `Feliz cumpleaños 21, Natalia 🎉\n\nDeseamos que Dios bendiga tu vida, te acompañe en cada paso y haga realidad todos tus sueños.`,
      `Nunca olvides cuánto te amamos y lo orgullosos que estamos de la mujer en la que te has convertido.\n\n¡Feliz cumpleaños, hija querida!\n\nCon todo nuestro amor,\nPapá y toda tu familia ❤️`,
    ],
    // 👆👆  FIN DEL TEXTO EDITABLE  👆👆
  },
  // Merce no escribió carta: su recuerdo revivible es la notita del desayuno
  // (ver THANKS.merce). No agregues una carta inventada aquí.
};

function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/* notas musicales flotando mientras suena la canción */
let noteTimer = null;
function spawnNote(emoji) {
  const el = document.createElement('div');
  el.className = 'mnote';
  el.textContent = emoji;
  el.style.setProperty('--x', rnd(8, 92) + '%');
  el.style.setProperty('--dx', rnd(-40, 40) + 'px');
  el.style.setProperty('--d', rnd(2.6, 4.2) + 's');
  el.style.fontSize = rnd(16, 30) + 'px';
  el.addEventListener('animationend', () => el.remove());
  fx.appendChild(el);
}
function startNotes(notes) {
  if (noteTimer) return;
  spawnNote(pick(notes));
  noteTimer = setInterval(() => spawnNote(pick(notes)), 520);
}
function stopNotes() { clearInterval(noteTimer); noteTimer = null; }

/* descargar la foto (mismo origen → el atributo download funciona) */
function downloadPhoto(src, name) {
  const a = document.createElement('a');
  a.href = src;
  a.download = name || 'foto.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* visor de foto a pantalla completa, con descargar + cerrar */
function photoViewer(src, name) {
  const v = document.createElement('div');
  v.className = 'photo-viewer';
  v.innerHTML = `
    <button class="pv-close" id="pvClose" type="button" aria-label="cerrar">✕</button>
    <div class="pv-stage"><img src="${src}" alt="Foto de tu papá para ti"></div>
    <button class="btn gold pv-dl" id="pvDl" type="button">⬇️ Descargar foto</button>`;
  $('#phone').appendChild(v);
  const close = () => { v.classList.add('out'); setTimeout(() => v.remove(), 220); };
  $('#pvClose', v).addEventListener('click', () => { Snd.click(); close(); });
  $('#pvDl', v).addEventListener('click', () => { Snd.click(); downloadPhoto(src, name); });
  v.addEventListener('click', e => { if (e.target === v) close(); });
}

/* elegir cómo llamar: teléfono normal o WhatsApp */
function callChooser(phone) {
  const waNum = String(phone).replace(/[^0-9]/g, ''); // wa.me sin + ni símbolos
  const sheet = document.createElement('div');
  sheet.className = 'call-sheet';
  sheet.innerHTML = `
    <div class="cs-panel">
      <div class="cs-title">¿Cómo quieres llamar a papá? 🤍</div>
      <a class="btn cs-tel" href="tel:${phone}">📞 Llamada normal</a>
      <a class="btn cs-wa" href="https://wa.me/${waNum}" target="_blank" rel="noopener">💬 WhatsApp</a>
      <button class="btn ghost cs-cancel" type="button">Cancelar</button>
    </div>`;
  $('#phone').appendChild(sheet);
  const close = () => { sheet.classList.add('out'); setTimeout(() => sheet.remove(), 200); };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  $('.cs-cancel', sheet).addEventListener('click', () => { Snd.click(); close(); });
  $('.cs-tel', sheet).addEventListener('click', () => { Snd.click(); setTimeout(close, 60); });
  $('.cs-wa', sheet).addEventListener('click', () => { Snd.click(); setTimeout(close, 60); });
}

/* experiencia carta + canción a pantalla completa */
function letterStage(cfg, onDone) {
  const hasSong = !!cfg.song;
  const st = document.createElement('div');
  st.className = 'letter-stage';
  st.innerHTML = `
    <div class="ls-head">
      <span class="ls-emoji">${cfg.emoji}</span>
      <h2>${cfg.title}</h2>
      <p class="ls-sub">${cfg.sub}</p>
    </div>
    <div class="papiro">
      <div class="papiro-inner" id="lsPage"></div>
    </div>
    <div class="ls-nav">
      <button class="ls-arrow" id="lsPrev" type="button" aria-label="anterior">‹</button>
      <div class="ls-dots" id="lsDots"></div>
      <button class="ls-arrow" id="lsNext" type="button" aria-label="siguiente">›</button>
    </div>
    ${hasSong ? `
    <div class="player">
      <button class="pl-play" id="plPlay" type="button" aria-label="reproducir">▶</button>
      <div class="pl-mid">
        <div class="pl-title">${cfg.songTitle || 'Canción 🎶'}</div>
        <div class="pl-bar" id="plBar"><div class="pl-fill" id="plFill"></div><div class="pl-knob" id="plKnob"></div></div>
        <div class="pl-time"><span id="plCur">0:00</span><span id="plDur">0:00</span></div>
      </div>
    </div>` : ''}
    <div class="ls-actions">
      <button class="btn gold ls-done" id="lsDone" type="button">Qué bonito 💜</button>
      ${cfg.phone ? `<button class="btn ls-call" id="lsCall" type="button">📞 Llamarle</button>` : ''}
    </div>`;
  $('#phone').appendChild(st);
  if (cfg.phone) $('#lsCall', st).addEventListener('click', () => { Snd.click(); callChooser(cfg.phone); });

  /* paginación del pergamino (+ página final con foto, si la hay) */
  const pages = (cfg.pages && cfg.pages.length) ? cfg.pages : [''];
  const photoIdx = cfg.photo ? pages.length : -1;   // índice de la página de foto
  const total = pages.length + (cfg.photo ? 1 : 0);
  let pi = 0;
  const pageEl = $('#lsPage', st), dotsEl = $('#lsDots', st);
  const prevBtn = $('#lsPrev', st), nextBtn = $('#lsNext', st);
  dotsEl.innerHTML = Array.from({ length: total }, (_, i) => `<span class="ls-dot" data-p="${i}"></span>`).join('');
  const renderPage = () => {
    pageEl.classList.remove('turn'); void pageEl.offsetWidth; pageEl.classList.add('turn');
    if (pi === photoIdx) {
      pageEl.classList.add('photo-mode');
      pageEl.innerHTML = `
        <figure class="ls-photo">
          <button class="ls-photo-btn" id="lsPhotoOpen" type="button">
            <img id="lsPhotoImg" src="${cfg.photo}" alt="Foto de tu papá para ti">
            <span class="ls-photo-hint">🔍 Toca para verla completa</span>
          </button>
        </figure>`;
      const img = $('#lsPhotoImg', pageEl);
      img.addEventListener('error', () => {
        img.replaceWith(Object.assign(document.createElement('div'),
          { className: 'ls-photo-missing', textContent: '✨ Foto próximamente ✨' }));
      });
      $('#lsPhotoOpen', pageEl).addEventListener('click', () => { Snd.click(); photoViewer(cfg.photo, cfg.photoDownloadName); });
    } else {
      pageEl.classList.remove('photo-mode');
      pageEl.innerHTML = pages[pi].split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }
    pageEl.scrollTop = 0;
    dotsEl.querySelectorAll('.ls-dot').forEach((d, i) => d.classList.toggle('on', i === pi));
    prevBtn.disabled = pi === 0;
    nextBtn.disabled = pi === total - 1;
  };
  renderPage();
  prevBtn.addEventListener('click', () => { if (pi > 0) { pi--; Snd.click(); renderPage(); } });
  nextBtn.addEventListener('click', () => { if (pi < total - 1) { pi++; Snd.click(); renderPage(); } });
  dotsEl.querySelectorAll('.ls-dot').forEach(d =>
    d.addEventListener('click', () => { pi = Number(d.dataset.p); Snd.click(); renderPage(); }));

  /* reproductor de la canción */
  let audio = null;
  if (hasSong) {
    audio = new Audio(cfg.song);
    audio.preload = 'auto';
    const playBtn = $('#plPlay', st), fill = $('#plFill', st), knob = $('#plKnob', st),
      curEl = $('#plCur', st), durEl = $('#plDur', st), bar = $('#plBar', st);
    let dragging = false;
    const paint = () => {
      const d = audio.duration || 0, c = audio.currentTime || 0;
      const r = d ? clamp(c / d, 0, 1) : 0;
      fill.style.width = (r * 100) + '%';
      knob.style.left = (r * 100) + '%';
      curEl.textContent = fmtTime(c);
      durEl.textContent = fmtTime(d);
    };
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('timeupdate', () => { if (!dragging) paint(); });
    audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; startNotes(cfg.notes); });
    audio.addEventListener('pause', () => { playBtn.textContent = '▶'; stopNotes(); });
    audio.addEventListener('ended', () => { playBtn.textContent = '▶'; stopNotes(); });
    playBtn.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    const seek = clientX => {
      const rect = bar.getBoundingClientRect();
      const r = clamp((clientX - rect.left) / rect.width, 0, 1);
      if (audio.duration) { audio.currentTime = r * audio.duration; paint(); }
    };
    bar.addEventListener('pointerdown', e => { dragging = true; try { bar.setPointerCapture(e.pointerId); } catch (x) {} seek(e.clientX); });
    bar.addEventListener('pointermove', e => { if (dragging) seek(e.clientX); });
    bar.addEventListener('pointerup', () => { dragging = false; });
    bar.addEventListener('pointercancel', () => { dragging = false; });
    // autoplay: se invoca dentro del gesto de toque, así que iOS lo permite
    audio.play().catch(() => {});
  }

  const close = () => {
    if (audio) { audio.pause(); audio.src = ''; }
    stopNotes();
    st.classList.add('out');
    setTimeout(() => st.remove(), 260);
    if (onDone) onDone();
  };
  $('#lsDone', st).addEventListener('click', () => { Snd.click(); close(); });
}

/* ============================================================
   MÁQUINA DE RECREATIVOS — el Osito Limón 🍋
   Pagas por intento, la tijera oscila sobre el hilo y hay que
   cortarlo. 5 intentos, ~20% por intento… pero el último SIEMPRE
   corta (el recuerdo real: lo conseguimos 💜).
   ============================================================ */
const PLUSH_NAME = 'Osito Limón';
const PLUSH_STORY = 'En los recreativos del Sol Mall había una máquina de esas de cortar el hilo con una tijera. Pagamos, apunté bien… y el hilo se cortó. El osito cayó y desde ese día se vino a casa con nosotros. 💜';

function treasureReveal(host, onOk, opts = {}) {
  const tr = document.createElement('div');
  tr.className = 'treasure';
  tr.innerHTML = `
    <div class="tr-rays"></div>
    <div class="tr-item">${svgPlush(76)}</div>
    <div class="tr-caption">
      <div class="tr-get">${opts.title || `¡Conseguiste el <b>${PLUSH_NAME}</b>! 🍋`}</div>
      <p class="tr-text">${opts.text || PLUSH_STORY}</p>
    </div>
    <button class="btn gold" id="trOk" type="button">${opts.cta || '¡Qué recuerdo! 💜'}</button>`;
  host.appendChild(tr);
  Snd.treasure();
  fireworks(2200);
  $('#trOk', tr).addEventListener('click', () => { Snd.click(); onOk && onOk(); });
}

function arcadeStage(onWin) {
  const st = document.createElement('div');
  st.className = 'arcade-stage';
  st.innerHTML = `
    <div class="arc-head">
      <h2>🕹️ Peluches Míticos</h2>
      <p class="arc-sub">Corta el hilo y llévate el ${PLUSH_NAME} 🍋</p>
    </div>
    <div class="cabinet">
      <div class="cab-marquee"><span>★ PELUCHES MÍTICOS ★</span></div>
      <div class="cab-glass">
        <div class="cab-bar"></div>
        <div class="string" id="arcString"></div>
        <div class="hang" id="arcHang">${svgPlush(44)}</div>
        <div class="scissors" id="arcScissors">✂️</div>
        <div class="cab-floor"></div>
        <div class="cab-door" id="arcDoor"><span>PREMIOS</span></div>
      </div>
      <div class="cab-panel">
        <div class="cab-tries">Intentos <b id="arcTries">5</b></div>
        <button class="cab-btn" id="arcCut" type="button">✂️ ¡CORTAR!</button>
      </div>
    </div>
    <div class="arc-msg" id="arcMsg">Dale a <b>¡CORTAR!</b> cuando la tijera esté sobre el hilo…</div>`;
  $('#phone').appendChild(st);
  Snd.slot();

  const sc = $('#arcScissors', st), msg = $('#arcMsg', st),
    triesEl = $('#arcTries', st), cutBtn = $('#arcCut', st);
  let tries = 5, curPct = 50, running = true, won = false, rafId = 0, t0 = performance.now();

  const loop = now => {
    if (!running) return;
    curPct = 50 + Math.sin((now - t0) / 1000 * 3.4) * 34;
    sc.style.left = curPct + '%';
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  const win = () => {
    won = true;
    cutBtn.disabled = true;
    Snd.jackpot();
    $('#arcString', st).classList.add('cut');
    $('#arcHang', st).classList.add('drop');
    $('#arcDoor', st).classList.add('open');
    msg.innerHTML = '¡EL HILO SE CORTÓ! 🎉';
    confettiBurst(70, ['#ffd23f', '#ff5fa2', '#7ef3ff', '#ffffff']);
    setTimeout(() => treasureReveal(st, () => {
      st.classList.add('out');
      setTimeout(() => st.remove(), 260);
      onWin && onWin();
    }), 1600);
  };

  const cut = () => {
    if (!running || won) return;
    running = false;
    cancelAnimationFrame(rafId);
    tries--;
    triesEl.textContent = tries;
    Snd.coin();                       // se paga cada intento 😅
    const aligned = Math.abs(curPct - 50) <= 7;
    const success = tries === 0 || (aligned && Math.random() < 0.2);
    if (success && !aligned) {         // último intento: la tijera se va al hilo
      sc.style.transition = 'left .25s ease';
      sc.style.left = '50%';
    }
    setTimeout(() => {
      Snd.snip();
      sc.classList.add('snip');
      setTimeout(() => {
        sc.classList.remove('snip');
        sc.style.transition = '';
        if (success) { win(); return; }
        Snd.buzz();
        msg.innerHTML = aligned
          ? pick(['¡Casi! El hilo se escapó 😤', 'Uff… la rozó 😅', 'Estas máquinas están trucadas 😾'])
          : pick(['La tijera pasó de largo 🙈', 'Ni cerca 😜', 'Falló el hilo… otra vez 😅']);
        t0 = performance.now();
        running = true;
        rafId = requestAnimationFrame(loop);
      }, 300);
    }, success && !aligned ? 260 : 0);
  };
  cutBtn.addEventListener('click', cut);
}

/* recuerdo del peluche (personaje del camino) */
function arcadeMemory() {
  const st = document.createElement('div');
  st.className = 'arcade-stage memory';
  st.innerHTML = `
    <div class="tr-rays soft"></div>
    <div class="tr-item">${svgPlush(76)}</div>
    <div class="tr-caption">
      <div class="tr-get">El <b>${PLUSH_NAME}</b> 🍋</div>
      <p class="tr-text">${PLUSH_STORY}</p>
    </div>
    <div class="ls-actions">
      <button class="btn gold" id="memClose" type="button">Qué recuerdo 💜</button>
      <button class="btn" id="memPlay" type="button">🕹️ Jugar otra vez</button>
    </div>`;
  $('#phone').appendChild(st);
  const close = () => { st.classList.add('out'); setTimeout(() => st.remove(), 260); };
  $('#memClose', st).addEventListener('click', () => { Snd.click(); close(); });
  $('#memPlay', st).addEventListener('click', () => {
    Snd.click(); close();
    arcadeStage(() => arcadeMemory());   // al ganar, vuelve al recuerdo
  });
}

/* ---------------- pasos ---------------- */
function completeStep(i, opts = {}) {
  hideCard();
  state.step = i + 1;
  delete state.phase[STEPS[i].id];
  saveState();
  refresh();
  if (!opts.silent) { opts.sound ? Snd[opts.sound]() : Snd.success(); }
  if (opts.confetti !== false) confettiBurst(opts.confettiN || 70, opts.colors);
  const doWalk = () => walkTo(walkerTargetIdx(), () => {
    if (state.step === 9) setTimeout(showFinale, 500);
  });
  if (opts.deferWalk) pendingWalk = true;
  else setTimeout(doWalk, opts.walkDelay || 800);
}

function runPendingWalk() {
  if (!pendingWalk) return;
  pendingWalk = false;
  setTimeout(() => walkTo(walkerTargetIdx(), () => {
    if (state.step === 9) setTimeout(showFinale, 500);
  }), 450);
}

function quizCard({ emoji, title, question, options, answer, dropdown, onCorrect }) {
  const opts = dropdown
    ? `<select class="quiz-select" id="quizSel">
        <option value="" selected disabled>Elige una opción…</option>
        ${options.map(o => `<option>${o}</option>`).join('')}
       </select>
       <div class="quiz-wrong" id="quizWrong"></div>
       <button class="btn" id="quizGo">Responder 🔎</button>`
    : `<div class="quiz-opts">${options.map(o => `<button class="quiz-opt" type="button">${o}</button>`).join('')}</div>
       <div class="quiz-wrong" id="quizWrong"></div>`;
  showCard(`
    <span class="big-emoji">${emoji}</span>
    <h2>${title}</h2>
    <p>${question}</p>
    ${opts}
    <p class="hint">Responde bien para desbloquear la sorpresa 😉</p>`);
  const wrongEl = $('#quizWrong', card);
  const fail = () => {
    Snd.wrong();
    card.classList.remove('shake-card'); void card.offsetWidth;
    card.classList.add('shake-card');
    wrongEl.textContent = pick(['Mmm… no 😅 intenta otra vez', 'Nop 🙈 piénsalo bien…', '¿Segura? Esa no es 😜']);
  };
  if (dropdown) {
    $('#quizGo', card).addEventListener('click', () => {
      const v = $('#quizSel', card).value;
      if (!v) { fail(); return; }
      v === answer ? onCorrect() : fail();
    });
  } else {
    card.querySelectorAll('.quiz-opt').forEach(b =>
      b.addEventListener('click', () => b.textContent === answer ? onCorrect() : fail()));
  }
}

const STEP_OPENERS = [
  // 0 — desayuno
  () => {
    showCard(`
      <span class="big-emoji">🍳</span>
      <h2>¡Buenos días, mi amor! 🌅</h2>
      <p>Hoy cumples <b>21</b> y este caminito es todo tuyo. Cada parada esconde una sorpresa, en orden, durante todo el día.</p>
      <p>Primera misión (la más importante): <b>desayuno en la cama</b> 🥐🍓</p>
      <button class="btn" id="go">¡Listo, desayunamos! ✨</button>`);
    $('#go', card).addEventListener('click', () => {
      hideCard();
      thanksStage(THANKS.merce, () => completeStep(0));
    });
  },

  // 1 — flores (quiz dropdown)
  () => {
    const phase = state.phase.flores || 'quiz';
    const showGo = () => showCard(`
      <span class="big-emoji">🎉</span>
      <h2>¡Correcta!</h2>
      <p>Exacto: <b>la sala</b>. Y justo ahora, en la sala…</p>
      <div class="reveal-box"><div class="rv-big">Hay algo esperándote 👀</div>
      <div class="rv-small">Ve a verlo y luego vuelve aquí</div></div>
      <button class="btn" id="saw">Ya vi lo que me esperaba 💝</button>`);
    const wire = () => $('#saw', card).addEventListener('click', () => {
      hideCard();
      Snd.success();
      petalRain();
      completeStep(1, { silent: true, confetti: false, walkDelay: 1600 });
    });
    if (phase === 'go') { showGo(); wire(); return; }
    quizCard({
      emoji: '🔮', title: 'Misterio #1',
      question: '⚽ ¿Dónde vimos el partido de <b>Francia vs España</b> del Mundial 2026?',
      options: ['El baño', 'La cocina', 'Un restaurante', 'La sala'],
      answer: 'La sala', dropdown: true,
      onCorrect: () => {
        state.phase.flores = 'go'; saveState();
        Snd.success();
        showGo(); wire();
      },
    });
  },

  // 2 — regalo → cupones
  () => giftStage(),

  // 3 — papiro: tarde de matcha
  () => {
    showCard(`
      <span class="big-emoji">📜</span>
      <h2>El plan de la tarde</h2>
      <ul class="plan-list">
        <li>💞 Darnos mucho amor</li>
        <li>🚶‍♀️🚶 Un paseo bajo el sol</li>
        <li>🍵 Matcha y café en <b>Matcha Mia</b></li>
        <li>🛋️ Quedarnos un rato, sin prisa</li>
      </ul>
      <button class="btn gold" id="go">Ya hicimos todo esto ✅</button>`, { papyrus: true });
    $('#go', card).addEventListener('click', () => completeStep(3, { colors: ['#7bd389', '#ffd23f', '#fff', '#4dd0a1'] }));
  },

  // 4 — japón: quiz → comida en SushiClub → pastel
  () => {
    const showReveal = () => {
      showCard(`
        <span class="big-emoji">🍣</span>
        <h2>¡Tenemos reserva!</h2>
        <p>Hoy comemos en <b>${CONFIG.restaurant}</b> a las <b>${CONFIG.lunchTime}</b></p>
        <div class="reveal-box">
          <div class="rv-big">Ceviche, sushi y cositas ricas 😋</div>
          <div class="rv-small">Pide todo lo que quieras · Hoy invita el amor de tu vida</div>
        </div>
        <button class="btn" id="ate">Ya comimos, ¡qué delicia! ✅</button>`);
      $('#ate', card).addEventListener('click', () => {
        hideCard();
        cakeStage(() =>
          thanksStage(THANKS.javier, () =>
            letterStage(LETTERS.javier, () =>
              completeStep(4, { silent: true, confetti: false }))));
      });
    };
    if ((state.phase.japon || 'quiz') === 'reveal') { showReveal(); return; }
    quizCard({
      emoji: '🏮', title: 'Sabor a Japón',
      question: '¿Cómo se dice <b>«gracias»</b> en japonés? 🇯🇵',
      options: ['Konnichiwa', 'Sayonara', 'Kanpai', 'Arigato'],
      answer: 'Arigato',
      onCorrect: () => {
        state.phase.japon = 'reveal'; saveState();
        Snd.success();
        showReveal();
      },
    });
  },

  // 5 — papiro: el paseo (pre-guerra)
  () => {
    showCard(`
      <span class="big-emoji">📜</span>
      <h2>Mientras esperamos…</h2>
      <ul class="plan-list">
        <li>🛍️ Pasear el <b>Sol Mall</b> y la Galería</li>
        <li>🕹️ Jugar en los recreativos</li>
        <li>🌆 Disfrutar el centro</li>
      </ul>
      <p class="plan-warn">Disfruta lo que puedas… se acerca una guerra ⚔️🔥</p>
      <button class="btn gold" id="go">Ya lo hicimos ✅</button>`, { papyrus: true });
    $('#go', card).addEventListener('click', () => {
      hideCard();
      arcadeStage(() => completeStep(5, { silent: true, confetti: false }));
    });
  },

  // 6 — arena: quiz → cine
  () => {
    const showReveal = () => {
      showCard(`
        <span class="big-emoji">🎬</span>
        <h2>¡A la guerra!</h2>
        <p>Tenemos entradas <b>PREMIERE</b> esta noche:</p>
        <div class="reveal-box">
          <div class="rv-big">«The Odyssey»<br>de Christopher Nolan 🌊⚔️</div>
          <div class="rv-small">🕗 ${CONFIG.movieTime} · Kit de batalla incluido:<br>🍿 palomitas · 🧀 nachos · 🥤 Pepsi Zero</div>
        </div>
        <button class="btn" id="saw">Ya vimos la película 🎬✅</button>`);
      $('#saw', card).addEventListener('click', () =>
        completeStep(6, { sound: 'fanfare', colors: ['#ffd23f', '#ffe9a3', '#f2a71b', '#fff'] }));
    };
    if ((state.phase.arena || 'quiz') === 'reveal') { showReveal(); return; }
    quizCard({
      emoji: '🏛️', title: 'La guerra te llama',
      question: '¿Cuál es la capital de <b>Grecia</b>?',
      options: ['Roma', 'Venecia', 'Esparta', 'Atenas'],
      answer: 'Atenas',
      onCorrect: () => {
        state.phase.arena = 'reveal'; saveState();
        Snd.epic();
        showReveal();
      },
    });
  },

  // 7 — bar chill
  () => {
    showCard(`
      <span class="big-emoji">🍸</span>
      <h2>Última parada de la noche</h2>
      <p>Un bar chill del <b>Sol Mall</b>, tipo 11 PM:</p>
      <p>🍹 un cóctel rico · 🎲 una partida de <b>Catan</b> · 💬 y nosotros dos hablando de la vida</p>
      <button class="btn" id="go">Hecho 🥂</button>`);
    $('#go', card).addEventListener('click', () => completeStep(7, { sound: 'clink' }));
  },

  // 8 — a casa
  () => {
    showCard(`
      <span class="big-emoji">🏠</span>
      <h2>El final del camino</h2>
      <p>Nuestra casa, camita, abrazos y <b>mucho amor</b> 🤍</p>
      <p class="hint">Fin del recorrido… pero apenas el comienzo de tus 21</p>
      <button class="btn" id="go">Fin 🤍</button>`);
    $('#go', card).addEventListener('click', () => {
      hideCard();
      Snd.fanfare();
      fireworks(4500);
      completeStep(8, { silent: true, confetti: false, walkDelay: 300 });
    });
  },
];

function showFinale() {
  fireworks(3500);
  showCard(`
    <span class="big-emoji">🎆</span>
    <h2 class="finale-title">¡Feliz cumpleaños, ${CONFIG.herName}!</h2>
    <p>21 años y cada día más increíble. Gracias por seguir conmigo siempre, por tu sonrisa y cada momento juntos.</p>
    <p><b>Te amo. — Jesús 🤍</b></p>
    <button class="btn" id="resetIt">🔄 Empezar el camino de nuevo</button>
    <p class="hint">Los cupones de oro no se reinician: siguen tal cual los dejaste 😌</p>`);
  $('#resetIt', card).addEventListener('click', () => {
    Snd.click();
    resetItinerary(false);
  });
}

function openRecap(i) {
  if (i === 2) { openCoupons(); return; }
  if (i === 8 && state.step === 9) { showFinale(); return; }
  showCard(`
    <span class="big-emoji">${STEPS[i].doneIcon}</span>
    <h2>${STEPS[i].doneName}</h2>
    <p>${RECAPS[i] || 'Completado.'}</p>
    <button class="btn ghost" id="cl">Completado ✅</button>`);
  $('#cl', card).addEventListener('click', hideCard);
}

function openStep(i) {
  if (i > state.step) {
    Snd.locked();
    const n = $('#node' + i);
    n.classList.remove('shake'); void n.offsetWidth;
    n.classList.add('shake');
    return;
  }
  Snd.click();
  if (i < state.step) { openRecap(i); return; }
  STEP_OPENERS[i]();
}

/* ---------------- cupones ---------------- */
const COUPON_DEFS = [
  { icon: '🦶', title: 'Masaje de pies',           sub: 'Vale por 1 sesión de gloria para tus pies' },
  { icon: '💆‍♀️', title: 'Masaje de cuerpo entero', sub: 'Full body, full amor, cero prisa' },
  { icon: '🦶', title: 'Masaje de pies',           sub: 'Segunda ronda: mismos pies, más felices' },
  { icon: '💆‍♀️', title: 'Masaje de cuerpo entero', sub: 'El regreso del masajista estrella' },
  { icon: '🦶', title: 'Masaje de pies',           sub: 'El gran final 👣✨' },
];
const couponsView = $('#couponsView');
const couponExpiry = new Date(CONFIG.couponExpiryISO).getTime();
let lastKinds = '';

function couponStatus(k, now) {
  if (coupons.claims[k]) return { kind: 'claimed' };
  if (now > couponExpiry) return { kind: 'expired' };
  if (k > 0 && !coupons.claims[k - 1]) return { kind: 'lockedprev' };
  if (k > 0) {
    const ready = coupons.claims[k - 1] + CONFIG.cooldownMs;
    if (now < ready) return { kind: 'waiting', until: ready };
  }
  return { kind: 'available' };
}

function renderCoupons(force = false) {
  const now = Date.now();
  const stats = COUPON_DEFS.map((_, k) => couponStatus(k, now));
  const kinds = stats.map(s => s.kind).join(',');
  const allClaimed = stats.every(s => s.kind === 'claimed');

  // chip de expiración
  const chip = $('#expiryChip');
  const expDate = new Date(couponExpiry).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  if (allClaimed) {
    chip.textContent = '💛 Misión cumplida';
    chip.classList.remove('expired');
  } else if (now > couponExpiry) {
    chip.textContent = `⛔ Expiraron el ${expDate}`;
    chip.classList.add('expired');
  } else {
    chip.textContent = `⏳ Válidos hasta el ${expDate} · quedan ${fmtDur(couponExpiry - now)}`;
    chip.classList.remove('expired');
  }

  if (!force && kinds === lastKinds) {
    // solo actualizar contadores en vivo
    couponsView.querySelectorAll('[data-count]').forEach(el => {
      const until = Number(el.dataset.count);
      el.textContent = `⏳ Disponible en ${fmtDur(until - now)}`;
    });
    return;
  }
  lastKinds = kinds;

  const list = $('#couponsList');
  let html = '';
  if (allClaimed) {
    html += `<div class="all-done-panel">
      <div class="adp-big">🏆</div>
      <h2>No quedan más cupones</h2>
      <p>Los canjeaste todos. El spa cierra sus puertas… por ahora 😌<br>Gracias por dejarte consentir. Esto se repite el próximo cumpleaños 💛</p>
    </div>`;
  }
  stats.forEach((s, k) => {
    const def = COUPON_DEFS[k];
    let statusHTML = '', cls = '';
    if (s.kind === 'claimed') {
      statusHTML = `<div class="stamp">CANJEADO</div>
        <div class="ticket-line">🎟️ Ticket confirmado · ${fmtStamp(coupons.claims[k])}</div>`;
    } else if (s.kind === 'available') {
      statusHTML = `<button class="redeem-btn" data-redeem="${k}" type="button">Canjear 💛</button>`;
    } else if (s.kind === 'waiting') {
      cls = 'waiting';
      statusHTML = `<div class="cstatus" data-count="${s.until}">⏳ Disponible en ${fmtDur(s.until - now)}</div>`;
    } else if (s.kind === 'lockedprev') {
      cls = 'lockedprev';
      statusHTML = `<div class="cstatus">🔒 Primero canjea el cupón #${k}</div>`;
    } else {
      cls = 'expired';
      statusHTML = `<div class="stamp gray">EXPIRADO</div><div class="cstatus">Se nos pasó el tiempo 🥲</div>`;
    }
    html += `<div class="coupon ${cls}" id="coupon${k}">
      <span class="shine"></span>
      <div class="stub"><span class="cn">Nº ${k + 1}</span><span class="ci">${def.icon}</span></div>
      <h3>${def.title}</h3>
      <div class="csub">${def.sub}</div>
      ${statusHTML}
    </div>`;
  });
  list.innerHTML = html;
  $('#couponsRules').innerHTML =
    `Se canjean en orden, del Nº 1 al Nº 5 · Espera <b>${humanCooldown(CONFIG.cooldownMs)}</b> entre cupón y cupón<br>Todos expiran el ${expDate} 💛`;

  list.querySelectorAll('[data-redeem]').forEach(b =>
    b.addEventListener('click', () => confirmRedeem(Number(b.dataset.redeem))));
}

function confirmRedeem(k) {
  Snd.click();
  const def = COUPON_DEFS[k];
  showCard(`
    <span class="big-emoji">🎟️</span>
    <h2>Cupón Nº ${k + 1}</h2>
    <p><b>${def.icon} ${def.title}</b></p>
    <p>¿Segura que quieres canjearlo <b>ahora</b>?<br>Esto activa al masajista de inmediato 😌</p>
    <button class="btn gold" id="yes">Sí, ¡canjear! 💛</button>
    <button class="btn ghost" id="no">Todavía no</button>`);
  $('#no', card).addEventListener('click', () => { Snd.click(); hideCard(); });
  $('#yes', card).addEventListener('click', () => {
    // re-verificar por si expiró o cambió algo entre medio
    const s = couponStatus(k, Date.now());
    if (s.kind !== 'available') { hideCard(); renderCoupons(true); return; }
    coupons.claims[k] = Date.now();
    saveCoupons();
    hideCard();
    renderCoupons(true);
    const stamp = $(`#coupon${k} .stamp`);
    if (stamp) stamp.classList.add('pop');
    Snd.fanfare();
    confettiBurst(70, ['#ffd23f', '#ffe9a3', '#f2a71b', '#ffffff']);
    setTimeout(() => {
      showCard(`
        <span class="big-emoji">✅</span>
        <h2>¡Canjeado!</h2>
        <p><b>Cupón Nº ${k + 1} · ${def.title}</b></p>
        <div class="reveal-box">
          <div class="rv-big">🎟️ Ticket de confirmación</div>
          <div class="rv-small">${fmtStamp(coupons.claims[k])}<br>Presenta este ticket… o simplemente acuéstate y relájate 😌</div>
        </div>
        <button class="btn gold" id="ok">Genial 💛</button>`);
      $('#ok', card).addEventListener('click', hideCard);
    }, 900);
  });
}

function openCoupons() {
  couponsView.hidden = false;
  renderCoupons(true);
}
$('#backBtn').addEventListener('click', () => {
  Snd.click();
  couponsView.hidden = true;
  runPendingWalk();
});
setInterval(() => { if (!couponsView.hidden) renderCoupons(); }, 1000);

/* ---------------- reset ---------------- */
function resetItinerary(alsoCoupons) {
  state = { step: 0, phase: {}, introSeen: true };
  saveState();
  if (alsoCoupons) {
    coupons = { claims: [null, null, null, null, null] };
    saveCoupons();
    lastKinds = '';
  }
  hideCard();
  couponsView.hidden = true;
  pendingWalk = false;
  buildWorld();
  refresh();
  placeWalkerInstant();
  scrollFollow(PTS[1].y);
  confettiBurst(40);
}

/* menú secreto de pruebas: mantener presionado el título ~1s */
let pressTimer = null;
const titleBtn = $('#titleBtn');
titleBtn.addEventListener('contextmenu', e => e.preventDefault());
['pointerdown'].forEach(ev => titleBtn.addEventListener(ev, () => {
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    Snd.pop && Snd.pop();
    showCard(`
      <span class="big-emoji">🛠️</span>
      <h2>Menú secreto</h2>
      <p class="hint">Solo para el organizador del evento 😏</p>
      <button class="btn" id="rIt">🔄 Reiniciar camino</button>
      <button class="btn ghost" id="rAll">🗑️ Reiniciar TODO (camino + cupones)</button>`);
    $('#rIt', card).addEventListener('click', () => resetItinerary(false));
    $('#rAll', card).addEventListener('click', () => resetItinerary(true));
  }, 950);
}));
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
  titleBtn.addEventListener(ev, () => clearTimeout(pressTimer)));

/* mute */
const muteBtn = $('#muteBtn');
function paintMute() { muteBtn.textContent = Snd.muted ? '🔇' : '🔊'; }
muteBtn.addEventListener('click', () => {
  Snd.muted = !Snd.muted;
  try { localStorage.setItem(LS_MUTE, Snd.muted ? '1' : '0'); } catch (e) {}
  paintMute();
  Snd.click();
});
paintMute();

/* desbloquear audio en el primer toque (iOS) */
document.addEventListener('pointerdown', () => Snd.ensure(), { once: true });

/* ---------------- init ---------------- */
buildWorld();
refresh();
placeWalkerInstant();
requestAnimationFrame(() => scrollFollow(basePathEl.getPointAtLength(walkerLen).y));

if (!state.introSeen) {
  setTimeout(() => {
    showCard(`
      <span class="big-emoji">💜</span>
      <h2>Bienvenida a tu día, ${CONFIG.herName}</h2>
      <p>Hoy cumples <b>21</b> y preparé un caminito de sorpresas para ti.</p>
      <p>Se revelan <b>en orden</b>, una por una, durante todo el día. Nada de adelantarse 😜</p>
      <button class="btn" id="start">¡Empezar! 🎉</button>`);
    $('#start', card).addEventListener('click', () => {
      state.introSeen = true; saveState();
      Snd.success();
      hideCard();
    });
  }, 600);
}
