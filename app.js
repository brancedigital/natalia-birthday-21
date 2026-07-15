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
  cooldownMs: 60 * 1000,

  restaurant: 'nuestro restaurante colombiano favorito',
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
  { id: 'matcha',   mystIcon: '📜', doneIcon: '🍵', mystName: 'Plan secreto', doneName: 'Matcha Mien',  time: '☀️ la tarde' },
  { id: 'colombia', mystIcon: '🏘️', doneIcon: '🎂', mystName: 'Pueblito',    doneName: 'Cena + 🎂',    time: '🇨🇴 sabor' },
  { id: 'paseo',    mystIcon: '📜', doneIcon: '🕹️', mystName: 'Plan secreto', doneName: 'El paseo',    time: '🌆 caminito' },
  { id: 'arena',    mystIcon: '🏛️', doneIcon: '🎬', mystName: 'La guerra',   doneName: 'The Odyssey',  time: '⚔️ prepárate' },
  { id: 'bar',      mystIcon: '🍸', doneIcon: '🍸', mystName: 'Chill',       doneName: 'Cóctel + Catan', time: '🌙 11 PM' },
  { id: 'casa',     mystIcon: '🏠', doneIcon: '💜', mystName: 'A casa',      doneName: 'A casa',       time: '⭐ el final' },
];

const RECAPS = [
  'Desayuno en la cama, como se debe. ✅',
  'La sala tenía flores para ti. 💐',
  '', // regalo → siempre abre los cupones
  'Amor + sol + Matcha Mien. Tarde perfecta. 🍵',
  'Cena colombiana… y un pastel que ya nos esperaba. 🎂',
  'Sol Mall, recreativos y el centro. 🕹️',
  'Sobrevivimos a la guerra de Nolan. 🎬',
  'Cóctel, Catan y nosotros. 🥂',
  '',
];

/* ---------------- SVG decor builders ---------------- */
function svgHouse(x, w, body, trim, roof) {
  const doorW = Math.round(w * 0.26), doorX = x + Math.round(w * 0.37);
  return `<polygon points="${x - 6},52 ${x + w + 6},52 ${x + w - 9},28 ${x + 9},28" fill="${roof}"/>
    <rect x="${x}" y="52" width="${w}" height="88" fill="${body}"/>
    <rect x="${x}" y="114" width="${w}" height="26" fill="${trim}"/>
    <rect x="${doorX}" y="88" width="${doorW}" height="52" rx="3" fill="${trim}" stroke="#fffdf5" stroke-width="2"/>
    <rect x="${x + 8}" y="64" width="17" height="17" fill="#bfe6ff" stroke="${trim}" stroke-width="3"/>
    <rect x="${x + w - 25}" y="64" width="17" height="17" fill="#bfe6ff" stroke="${trim}" stroke-width="3"/>
    <rect x="${x + 4}" y="84" width="${w - 8}" height="4" rx="2" fill="${trim}"/>`;
}
function svgPueblo() {
  return `<svg class="svg-decor" viewBox="0 0 430 150" width="100%" preserveAspectRatio="xMidYMax meet">
    <polygon points="-10,150 90,54 190,150" fill="#5f8f5a" opacity=".65"/>
    <polygon points="140,150 260,38 380,150" fill="#4c7a49" opacity=".6"/>
    <polygon points="300,150 400,64 470,150" fill="#5f8f5a" opacity=".55"/>
    ${svgHouse(14, 92, '#fdf6ec', '#e2574c', '#a9442f')}
    ${svgHouse(118, 92, '#fdf6ec', '#2e86c1', '#8f6b3e')}
    ${svgHouse(222, 92, '#fff9e8', '#e6a817', '#a9442f')}
    ${svgHouse(326, 92, '#fdf6ec', '#27ae60', '#8f6b3e')}
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

/* ---------------- zones ---------------- */
function buntingHTML() {
  const cols = ['#ffd23f', '#2e5fb7', '#e2574c', '#ffd23f', '#2e5fb7', '#e2574c', '#ffd23f', '#2e5fb7'];
  return `<div class="bunting">${cols.map((c, i) => `<i style="--c:${c}; animation-delay:${i * .15}s"></i>`).join('')}</div>`;
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
      <div class="decor" style="left:8%; top:110px;"><div class="shop-sign">🍵 MATCHA MIEN</div></div>
      <div class="decor steam-cup" style="left:14%; top:170px;">🍵
        <span class="steam"></span><span class="steam s2"></span><span class="steam s3"></span>
      </div>
      <div class="decor floaty2" style="right:12%; top:120px; font-size:26px;">☕</div>
      <div class="decor sun" style="right:-4%; top:280px; width:60px; height:60px; opacity:.9;"></div>`;
    case 4: return `
      <div class="decor" style="left:6%; top:64px;">${buntingHTML()}</div>
      <div class="decor" style="left:0; right:0; bottom:6px;">${svgPueblo()}</div>
      <div class="decor floaty" style="right:8%; top:110px; font-size:24px;">☕</div>
      <div class="decor floaty2" style="left:40%; top:96px; font-size:22px;">🌴</div>`;
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
    <div class="start-label" style="left:${START[0] / W * 100}%; top:${START[1] - 20}px;">aquí empieza tu día ✨</div>`;

  // nodos + etiquetas
  for (let i = 0; i < 9; i++) {
    const [x, y] = NODE_XY[i];
    html += `<button class="node" id="node${i}" data-i="${i}" style="left:${x / W * 100}%; top:${y}px;"></button>
      <div class="node-label" style="left:${x / W * 100}%; top:${y + 38}px;">
        <span class="nl-name" id="nlname${i}"></span><span class="nl-time">${STEPS[i].time}</span>
      </div>`;
  }

  // caminante
  html += `<div id="walker" class="idle"><span class="aura"></span><span class="who">🚶‍♀️</span></div>`;

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
  whoEl.textContent = '🏃‍♀️';
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
      whoEl.textContent = '🚶‍♀️';
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
function petalRain() {
  const petals = ['🌸', '🌷', '🌹', '💐', '🌼', '🌺'];
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
    <div class="stage-sub">tócalo para abrirlo…</div>`);
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
    <div class="stage-sub">pide un deseo y toca la pantalla para soplar…</div>`);
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
      $('.stage-sub', st).textContent = 'la sorpresa ya estaba lista desde antes 😏';
      const btn = document.createElement('button');
      btn.className = 'btn gold';
      btn.textContent = 'Continuar 💜';
      btn.addEventListener('click', () => { st.remove(); onDone && onDone(); });
      st.appendChild(btn);
    }, 900);
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
    <p class="hint">responde bien para desbloquear la sorpresa 😉</p>`);
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
      <h2>¡Buenos días, cumpleañera! 🌅</h2>
      <p>Hoy cumples <b>21</b> y este caminito es todo tuyo. Cada parada esconde una sorpresa, en orden, durante todo el día.</p>
      <p>Primera misión (la más importante): <b>desayuno en la cama</b> 🥐🍓</p>
      <button class="btn" id="go">¡Listo, desayunamos! ✨</button>`);
    $('#go', card).addEventListener('click', () => completeStep(0));
  },

  // 1 — flores (quiz dropdown)
  () => {
    const phase = state.phase.flores || 'quiz';
    const showGo = () => showCard(`
      <span class="big-emoji">🎉</span>
      <h2>¡Correcta!</h2>
      <p>Exacto: <b>la sala</b>. Y justo ahora, en la sala…</p>
      <div class="reveal-box"><div class="rv-big">hay algo esperándote 👀</div>
      <div class="rv-small">ve a verlo y luego vuelve aquí</div></div>
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
        <li>🍵 Ir a <b>Matcha Mien</b> por un matcha y un café</li>
        <li>🛋️ Quedarnos un buen rato, sin prisa, disfrutando</li>
      </ul>
      <button class="btn gold" id="go">Ya hicimos todo esto ✅</button>`, { papyrus: true });
    $('#go', card).addEventListener('click', () => completeStep(3, { colors: ['#7bd389', '#ffd23f', '#fff', '#4dd0a1'] }));
  },

  // 4 — colombia: quiz → cena → pastel
  () => {
    const showReveal = () => {
      showCard(`
        <span class="big-emoji">🇨🇴</span>
        <h2>¡Tenemos reserva!</h2>
        <p>Esta noche la cena es en <b>${CONFIG.restaurant}</b> 🍽️</p>
        <div class="reveal-box">
          <div class="rv-big">Pide TODO lo que quieras 😌</div>
          <div class="rv-small">hoy invita el amor de tu vida · bandeja, arepas, jugos… lo que sea</div>
        </div>
        <button class="btn" id="ate">Ya cenamos, ¡qué delicia! ✅</button>`);
      $('#ate', card).addEventListener('click', () => {
        hideCard();
        cakeStage(() => completeStep(4, { silent: true, confetti: false }));
      });
    };
    if ((state.phase.colombia || 'quiz') === 'reveal') { showReveal(); return; }
    quizCard({
      emoji: '📖', title: 'Sabor a Colombia',
      question: '¿Quién escribió <b>«Cien años de soledad»</b>?',
      options: ['Pablo Neruda', 'Mario Vargas Llosa', 'Gabriel García Márquez', 'Isabel Allende'],
      answer: 'Gabriel García Márquez',
      onCorrect: () => {
        state.phase.colombia = 'reveal'; saveState();
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
        <li>🛍️ Caminar por el <b>Sol Mall</b> y la Galería</li>
        <li>🕹️ Jugar en los recreativos</li>
        <li>🌆 Pasear y disfrutar el centro</li>
      </ul>
      <p class="plan-warn">Disfruta todo lo que puedas… porque se acerca una guerra ⚔️🔥</p>
      <button class="btn gold" id="go">Ya lo hicimos ✅</button>`, { papyrus: true });
    $('#go', card).addEventListener('click', () => completeStep(5, { sound: 'epic', colors: ['#e8e2d0', '#ffd23f', '#c0392b', '#fff'] }));
  },

  // 6 — arena: quiz → cine
  () => {
    const showReveal = () => {
      showCard(`
        <span class="big-emoji">🎬</span>
        <h2>¡A la guerra!</h2>
        <p>Tenemos entradas para la función <b>PREMIER</b> de esta noche:</p>
        <div class="reveal-box">
          <div class="rv-big">«The Odyssey»<br>de Christopher Nolan 🌊⚔️</div>
          <div class="rv-small">🕗 ${CONFIG.movieTime} · kit de batalla incluido:<br>🍿 palomitas · 🧀 nachos · 🥤 Pepsi Zero</div>
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
      <p>A casa, a la cama, a darnos <b>todo el amor del mundo</b> 💜</p>
      <p class="hint">fin del recorrido… pero apenas el comienzo de tus 21</p>
      <button class="btn" id="go">💜 Fin</button>`);
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
    <p>21 años y cada día más increíble. Gracias por existir, por tu risa y por cada momento juntos.</p>
    <p><b>Te amo. — Jesús 💜</b></p>
    <button class="btn" id="resetIt">🔄 Empezar el camino de nuevo</button>
    <p class="hint">los cupones de oro no se reinician: siguen tal cual los dejaste 😌</p>`);
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
  { icon: '🦶', title: 'Masaje de pies',           sub: 'vale por 1 sesión de gloria para tus pies' },
  { icon: '💆‍♀️', title: 'Masaje de cuerpo entero', sub: 'full body, full amor, cero prisa' },
  { icon: '🦶', title: 'Masaje de pies',           sub: 'segunda ronda: mismos pies, más felices' },
  { icon: '💆‍♀️', title: 'Masaje de cuerpo entero', sub: 'el regreso del masajista estrella' },
  { icon: '🦶', title: 'Masaje de pies',           sub: 'el gran final 👣✨' },
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
    chip.textContent = '💛 misión cumplida';
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
      statusHTML = `<div class="stamp gray">EXPIRADO</div><div class="cstatus">se nos pasó el tiempo 🥲</div>`;
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
    `Se canjean en orden, del Nº 1 al Nº 5 · entre cupón y cupón hay que esperar <b>${humanCooldown(CONFIG.cooldownMs)}</b><br>todos expiran el ${expDate} 💛`;

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
          <div class="rv-small">${fmtStamp(coupons.claims[k])}<br>presenta este ticket… o simplemente acuéstate y relájate 😌</div>
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
      <p class="hint">solo para el organizador del evento 😏</p>
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
