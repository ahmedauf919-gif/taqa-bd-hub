/* TAQA Arabia — Global Footprint
   A dependency-free orthographic globe: rotate it, drop into a country,
   pick a sector, and see every site on the map.
   Geometry: Natural Earth via world-atlas, delta-encoded (see world.js).
   Data: the same client portfolio that drives the TAQA Analytics dashboard. */
(function () {
'use strict';

/* ------------------------------------------------------------------ utils */
/* The hub gates itself behind a session flag; honour the same flag here so the
   globe is not a way around it. Same origin, so the iframe shares the value. */
try {
  if (sessionStorage.getItem('wind_model_unlocked') !== '1') {
    (window.top === window ? window : window.top).location.replace('/taqa-bd-hub/');
    return;
  }
} catch (_) { /* storage blocked — fall through rather than trapping the user */ }

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const RAD = Math.PI / 180;
const fmt = (n) => n.toLocaleString('en-US');
const AR = /[؀-ۿ]/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dirOf = (s) => AR.test(s) ? ' dir="rtl" class="rtl"' : '';
const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ----------------------------------------------------------- geometry load */
function decodeRing(str, q) {
  const out = [];
  let i = 0, x = 0, y = 0;
  while (i < str.length) {
    let r = 0, sh = 0, b;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
    x += (r & 1) ? ~(r >> 1) : (r >> 1);
    r = 0; sh = 0;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
    y += (r & 1) ? ~(r >> 1) : (r >> 1);
    out.push(x / q, y / q);
  }
  return Float64Array.from(out);
}

const WORLD = window.WORLD, DETAIL = window.WORLD_DETAIL, TAQA = window.TAQA;

const countries = WORLD.countries.map((c) => {
  const bw = c.b[2] - c.b[0], bh = c.b[3] - c.b[1];
  return {
    name: c.n,
    rings: c.r.map((r) => decodeRing(r, WORLD.q)),
    detail: null,
    centroid: c.c,
    bbox: c.b,
    wraps: bw > 180,
    // angular radius of the bounding box, in degrees
    radius: Math.hypot(bh, bw * Math.cos(((c.b[1] + c.b[3]) / 2) * RAD)) / 2,
  };
});
const byName = new Map(countries.map((c) => [c.name, c]));
for (const [name, rings] of Object.entries(DETAIL.rings)) {
  const c = byName.get(name);
  if (c) c.detail = rings.map((r) => decodeRing(r, DETAIL.q));
}

/* Attach TAQA's footprint onto the geometry. */
const taqaByGeo = new Map();
TAQA.countries.forEach((t) => {
  const c = byName.get(t.geo);
  if (!c) { console.warn('no geometry for', t.geo); return; }
  c.taqa = t;
  t.geom = c;
  taqaByGeo.set(t.key, t);
});
const presence = TAQA.countries.filter((c) => c.status !== 'studying');
const studying = TAQA.countries.filter((c) => c.status === 'studying');

/* All sectors that appear anywhere, for the world-level filter. */
const SECTOR_ORDER = ['gas', 'power', 'master', 'petro', 'water'];
const sectorFilters = SECTOR_ORDER.filter((id) =>
  TAQA.countries.some((c) => c.sectors.some((s) => s.id === id)))
  .map((id) => ({ id, ...TAQA.meta[id] }));

/* --------------------------------------------------------------- palette */
const SKIN = {
  ocean0: '#071a33', ocean1: '#03102a', oceanEdge: '#020a1c',
  land: '#182c49', landStroke: 'rgba(130,175,230,.24)',
  landDim: '#13243c',
  core: '#FFC10E', presence: '#2fbf6a', studying: '#e8a020',
  grat: 'rgba(120,170,235,.10)',
  arc: 'rgba(255,193,14,.55)',
};

/* ------------------------------------------------------------------ state */
const S = {
  level: 'world',      // world | country | sector
  country: null,       // TAQA country object
  sector: null,        // sector object
  site: null,          // site (governorate) object
  filter: null,        // sector id filter at world level
  spin: true,
  panel: true,
  hover: null,         // {kind:'country'|'site', ref}
};

const view = { lon: 26, lat: 20, R: 300 };
let anim = null;

const cv = $('globe'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;

/* The panel covers part of the stage, so the globe is centred in what is left:
   a column on desktop, the top half on a phone. */
function mapBox() {
  const wide = W > 900;
  if (!S.panel) return { x: 0, y: 0, w: W, h: H };
  return wide ? { x: 404, y: 0, w: Math.max(W - 404, 200), h: H }
              : { x: 0, y: 0, w: W, h: Math.max(H * 0.46, 180) };
}
function centreX() { const b = mapBox(); return b.x + b.w / 2; }
function centreY() { const b = mapBox(); return b.y + b.h / 2; }
function worldR() { const b = mapBox(); return Math.min(b.w, b.h) * 0.40; }

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S.level === 'world' && !anim) view.R = worldR();
}

/* ------------------------------------------------------------- projection */
let sinP0 = 0, cosP0 = 1, lon0 = 0, CX = 0, CY = 0, R = 300;
function syncProjection() {
  lon0 = view.lon * RAD;
  const p0 = view.lat * RAD;
  sinP0 = Math.sin(p0); cosP0 = Math.cos(p0);
  CX = centreX(); CY = centreY(); R = view.R;
}
const P = { x: 0, y: 0, vis: false };
function project(lon, lat) {
  const l = lon * RAD - lon0, p = lat * RAD;
  const cp = Math.cos(p), sp = Math.sin(p), cl = Math.cos(l);
  const cosc = sinP0 * sp + cosP0 * cp * cl;
  let x = cp * Math.sin(l);
  let y = cosP0 * sp - sinP0 * cp * cl;
  if (cosc <= 0) {                       // behind the horizon — clamp to the limb
    const m = Math.hypot(x, y);
    if (m < 1e-9) { x = 1; y = 0; } else { x /= m; y /= m; }
    P.vis = false;
  } else P.vis = true;
  P.x = CX + R * x; P.y = CY - R * y;
  return P;
}
function invert(px, py) {
  const x = (px - CX) / R, y = -(py - CY) / R;
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;
  const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
  if (rho < 1e-9) return [view.lon, view.lat];
  const lat = Math.asin(cc * sinP0 + y * sc * cosP0 / rho);
  const lon = lon0 + Math.atan2(x * sc, rho * cc * cosP0 - y * sc * sinP0);
  return [((lon / RAD + 540) % 360) - 180, lat / RAD];
}
/* angular distance between two lon/lat points, in degrees */
function angDist(lo1, la1, lo2, la2) {
  const p1 = la1 * RAD, p2 = la2 * RAD, dl = (lo2 - lo1) * RAD;
  return Math.acos(clamp(Math.sin(p1) * Math.sin(p2) +
    Math.cos(p1) * Math.cos(p2) * Math.cos(dl), -1, 1)) / RAD;
}
/* how far from the view centre we can still see, in degrees */
function visibleRadius() {
  const half = Math.hypot(Math.max(CX, W - CX), Math.max(CY, H - CY)) / R;
  return half >= 1 ? 90 : Math.asin(half) / RAD;
}

/* ------------------------------------------------------------------ paths */
function tracePolys(polys) {
  ctx.beginPath();
  for (const pts of polys) {
    for (let i = 0; i < pts.length; i += 2) {
      const p = project(pts[i], pts[i + 1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
}
function polysFor(c) {
  // Use the finer outline once the country fills a decent part of the screen.
  return (c.detail && R > 900) ? c.detail : c.rings;
}

/* ------------------------------------------------------------------ frame */
function drawGraticule(alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = SKIN.grat; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = project(lon, lat);
      if (lon === -180) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let lon = -180; lon < 180; lon += 30) {
    ctx.beginPath();
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = project(lon, lat);
      if (lat === -90) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function sphere() {
  // Ocean. Once we are zoomed past the viewport the disc covers everything.
  const g = ctx.createRadialGradient(CX - R * .35, CY - R * .4, R * .05, CX, CY, R * 1.02);
  g.addColorStop(0, SKIN.ocean0);
  g.addColorStop(.62, SKIN.ocean1);
  g.addColorStop(1, SKIN.oceanEdge);
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, 6.2832); ctx.fillStyle = g; ctx.fill();

  // atmosphere
  if (R < Math.max(W, H) * 1.6) {
    const a = ctx.createRadialGradient(CX, CY, R * .96, CX, CY, R * 1.10);
    a.addColorStop(0, 'rgba(90,160,255,.20)');
    a.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.10, 0, 6.2832); ctx.fillStyle = a; ctx.fill();
  }
}

function statusColour(t) {
  return t.status === 'core' ? SKIN.core : t.status === 'presence' ? SKIN.presence : SKIN.studying;
}
function matchesFilter(t) {
  if (!S.filter) return true;
  return t.sectors.some((s) => s.id === S.filter);
}

function drawCountries() {
  const vr = visibleRadius() + 2;
  const zoomed = S.level !== 'world';
  const focus = S.country ? S.country.geom : null;

  for (const c of countries) {
    if (angDist(view.lon, view.lat, c.centroid[0], c.centroid[1]) > vr + c.radius) continue;
    const t = c.taqa;
    const isFocus = focus === c;
    const dimmed = zoomed && !isFocus;
    const lit = t && matchesFilter(t);

    tracePolys(polysFor(c));

    if (t && lit) {
      const col = statusColour(t);
      ctx.fillStyle = col;
      ctx.globalAlpha = dimmed ? .14 : (t.status === 'studying' ? .46 : .70);
      ctx.fill();
      ctx.globalAlpha = dimmed ? .26 : 1;
      ctx.strokeStyle = col; ctx.lineWidth = isFocus ? 1.8 : 1.1;
      ctx.stroke();
    } else {
      ctx.globalAlpha = dimmed ? .45 : 1;
      ctx.fillStyle = t ? SKIN.landDim : SKIN.land;
      ctx.fill();
      ctx.strokeStyle = SKIN.landStroke; ctx.lineWidth = .8;
      ctx.stroke();
    }

    if (S.hover && S.hover.kind === 'country' && S.hover.ref === c) {
      ctx.globalAlpha = .22; ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* Great-circle links from Cairo to every international operation. */
function slerp(a, b, f) {
  const p1 = a[1] * RAD, l1 = a[0] * RAD, p2 = b[1] * RAD, l2 = b[0] * RAD;
  const d = Math.acos(clamp(Math.sin(p1) * Math.sin(p2) +
    Math.cos(p1) * Math.cos(p2) * Math.cos(l2 - l1), -1, 1));
  if (d < 1e-9) return a;
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}
let dash = 0;
function drawArcs() {
  if (S.level !== 'world') return;
  ctx.save();
  ctx.lineWidth = 1.3; ctx.strokeStyle = SKIN.arc;
  ctx.setLineDash([5, 7]); ctx.lineDashOffset = -dash;
  for (const t of presence) {
    if (t.key === 'egypt' || !matchesFilter(t)) continue;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 40; i++) {
      const ll = slerp(TAQA.hq, t.geom.centroid, i / 40);
      const p = project(ll[0], ll[1]);
      if (!P.vis) { pen = false; continue; }
      if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabels() {
  if (S.level === 'sector') return;
  ctx.save();
  ctx.font = '600 12px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Rank first, then place greedily so the important labels win a collision.
  const rank = (t) => (S.country === t ? 0 : t.status === 'core' ? 1 : t.status === 'presence' ? 2 : 3);
  const queue = TAQA.countries
    .filter((t) => matchesFilter(t) && S.country !== t)
    .map((t) => ({ t, r: rank(t), px: t.geom.radius * RAD * R }))
    .sort((a, b) => a.r - b.r || b.px - a.px);

  const placed = [];
  for (const { t, px } of queue) {
    const hovered = S.hover && S.hover.kind === 'country' && S.hover.ref === t.geom;
    if (px < 11 && !hovered) continue;                     // too small to label
    if (S.level !== 'world') { ctx.globalAlpha = .5; } else ctx.globalAlpha = 1;
    const p = project(t.geom.centroid[0], t.geom.centroid[1]);
    if (!P.vis) continue;
    if (p.x < -60 || p.x > W + 60 || p.y < -30 || p.y > H + 30) continue;
    const w = ctx.measureText(t.name).width + 10, h = 17;
    const box = [p.x - w / 2, p.y - 1 - h / 2, p.x + w / 2, p.y - 1 + h / 2];
    if (!hovered && placed.some((b) =>
        box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    placed.push(box);
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,6,16,.82)';
    ctx.strokeText(t.name, p.x, p.y - 1);
    ctx.fillStyle = t.status === 'studying' ? '#f3cc84' : '#ffffff';
    ctx.fillText(t.name, p.x, p.y - 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function countryMarkers(t) {
  if (t._agg) return t._agg;
  const m = new Map();
  t.sectors.forEach((sec) => sec.sites.forEach((site) => {
    let e = m.get(site.gov);
    if (!e) { e = { agg: true, gov: site.gov, ll: site.ll, count: 0, parts: [], approx: site.approx }; m.set(site.gov, e); }
    e.count += site.count;
    e.parts.push({ sec, site });
  }));
  const out = [...m.values()];
  out.forEach((e) => {
    e.parts.sort((a, b) => b.site.count - a.site.count);
    e.top = e.parts[0];
    e.activities = e.parts.map((p) => ({ name: p.sec.short, count: p.site.count }));
  });
  out.sort((a, b) => b.count - a.count);
  t._agg = out;
  return out;
}
function activeSites() {
  if (!S.country) return [];
  if (S.level === 'sector' && S.sector) {
    return S.sector.sites.map((s) => ({ site: s, sector: S.sector }));
  }
  if (S.level === 'country') {
    return countryMarkers(S.country).map((e) => ({ site: e, sector: e.top.sec }));
  }
  return [];
}
function markerRadius(count) {
  const b = mapBox();
  const k = clamp(Math.min(b.w, b.h) / 760, 0.62, 1);
  return clamp(6 + Math.sqrt(count) * 1.75, 7, 34) * k;
}

/* Markers are laid out once per frame: project, then push overlapping discs
   apart in screen space so a dense cluster (Cairo/Giza/Qalyubia) stays legible.
   A leader line ties a displaced disc back to its true position. */
let markerLayout = [];
function layoutMarkers() {
  const list = activeSites();
  const sectorLevel = S.level === 'sector';
  const out = [];
  for (const { site, sector } of list) {
    const p = project(site.ll[0], site.ll[1]);
    if (!P.vis) continue;
    if (p.x < -200 || p.x > W + 200 || p.y < -200 || p.y > H + 200) continue;
    const rr = markerRadius(site.count) * (sectorLevel ? 1 : 0.86);
    out.push({ site, sector, x: p.x, y: p.y, x0: p.x, y0: p.y, rr, w: 1 / (rr * rr) });
  }
  out.sort((a, b) => b.rr - a.rr);
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.rr + b.rr + 3;
        if (d >= min) continue;
        if (d < 0.01) { dx = (j % 2 ? 1 : -1); dy = (j % 3 ? 1 : -1); d = Math.hypot(dx, dy); }
        const push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        const wa = a.w / (a.w + b.w), wb = 1 - wa;
        a.x -= ux * push * wa; a.y -= uy * push * wa;
        b.x += ux * push * wb; b.y += uy * push * wb;
        moved = true;
      }
    }
    if (!moved) break;
  }
  markerLayout = out;
  return out;
}

function drawMarkers(now) {
  const drawn = markerLayout;
  if (!drawn.length) return;
  const pulse = 0.5 + 0.5 * Math.sin(now / 620);
  const sectorLevel = S.level === 'sector';

  // leader lines back to the true position for anything we nudged
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
  for (const d of drawn) {
    if (Math.hypot(d.x - d.x0, d.y - d.y0) < 3) continue;
    ctx.beginPath(); ctx.moveTo(d.x0, d.y0); ctx.lineTo(d.x, d.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(d.x0, d.y0, 1.8, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
  }
  ctx.restore();

  for (const d of drawn) {
    const { site, sector, x, y, rr } = d;
    const on = S.site === site;
    const hov = S.hover && S.hover.kind === 'site' && S.hover.ref === site;
    d.on = on; d.hov = hov;

    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.1);
    g.addColorStop(0, sector.color + '59'); g.addColorStop(1, sector.color + '00');
    ctx.beginPath(); ctx.arc(x, y, rr * 2.1, 0, 6.2832); ctx.fillStyle = g; ctx.fill();

    if (on) {
      ctx.beginPath(); ctx.arc(x, y, rr + 6 + pulse * 8, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,193,14,' + (0.6 - pulse * 0.45) + ')';
      ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832);
    ctx.fillStyle = sector.color; ctx.globalAlpha = hov || on ? .97 : .84; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = on ? 2.4 : 1.6;
    ctx.strokeStyle = on ? SKIN.core : 'rgba(255,255,255,.85)';
    ctx.stroke();

    if (rr >= 13) {
      ctx.font = '700 ' + Math.round(clamp(rr * .7, 9, 15)) + 'px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(6,14,28,.95)';
      ctx.fillText(String(site.count), x, y + .5);
    }
  }

  // Labels last: try below / above / right / left, drop the ones that never fit.
  ctx.font = '600 11.5px "Space Grotesk", sans-serif';
  ctx.textBaseline = 'top';
  const boxes = drawn.map((d) => [d.x - d.rr, d.y - d.rr, d.x + d.rr, d.y + d.rr]);
  const hits = (b) => boxes.some((o) =>
    b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);

  for (const d of drawn) {
    if (!sectorLevel && !d.on && !d.hov && d.rr < 10) continue;
    const tw = ctx.measureText(d.site.gov).width, h = 14;
    const cands = [
      { x: d.x, y: d.y + d.rr + 3, align: 'center' },
      { x: d.x, y: d.y - d.rr - h - 3, align: 'center' },
      { x: d.x + d.rr + 6, y: d.y - h / 2, align: 'left' },
      { x: d.x - d.rr - 6, y: d.y - h / 2, align: 'right' },
    ];
    let pick = null;
    for (const c of cands) {
      const x0 = c.align === 'center' ? c.x - tw / 2 - 3 : c.align === 'left' ? c.x - 2 : c.x - tw - 4;
      const box = [x0, c.y, x0 + tw + 6, c.y + h];
      if (d.on || d.hov || !hits(box)) { pick = { c, box }; break; }
    }
    if (!pick) continue;
    boxes.push(pick.box);
    ctx.textAlign = pick.c.align;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,6,16,.9)';
    ctx.strokeText(d.site.gov, pick.c.x, pick.c.y);
    ctx.fillStyle = d.on ? SKIN.core : '#dce6f7';
    ctx.fillText(d.site.gov, pick.c.x, pick.c.y);
  }
  ctx.textAlign = 'left';
}

function shade() {
  if (R > Math.max(W, H) * 1.4) return;         // no limb on screen
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, 6.2832); ctx.clip();
  const g = ctx.createRadialGradient(CX - R * .38, CY - R * .44, R * .12, CX, CY, R * 1.28);
  g.addColorStop(0, 'rgba(255,255,255,.05)');
  g.addColorStop(.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,2,10,.72)');
  ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  ctx.restore();
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(now - last, 60) || 16; last = now;

  if (anim) {
    const t = clamp((now - anim.t0) / anim.dur, 0, 1);
    const e = easeInOut(t);
    let dl = anim.to.lon - anim.from.lon;
    while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    view.lon = anim.from.lon + dl * e;
    view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
    view.R = Math.exp(Math.log(anim.from.R) + (Math.log(anim.to.R) - Math.log(anim.from.R)) * e);
    if (t >= 1) { anim.done && anim.done(); anim = null; }
  } else if (S.spin && S.level === 'world' && !drag.active) {
    view.lon = ((view.lon + 0.0032 * dt + 180) % 360) - 180;
  }
  dash = (dash + dt * 0.03) % 12;

  syncProjection();
  ctx.clearRect(0, 0, W, H);
  sphere();
  drawGraticule(clamp(1 - (R - worldR()) / (worldR() * 2.5), 0, 1) * .9);
  drawCountries();
  drawArcs();
  shade();
  layoutMarkers();
  drawMarkers(now);
  drawLabels();
}

/* ------------------------------------------------------------- hit testing */
function pointInRing(pts, lon, lat) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > lat) !== (yj > lat) &&
        lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function countryAt(px, py) {
  const ll = invert(px, py);
  if (!ll) return null;
  const [lon, lat] = ll;
  let fallback = null;
  for (const c of countries) {
    if (c.wraps) continue;
    const b = c.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (c.rings.some((r) => pointInRing(r, lon, lat))) {
      if (c.taqa) return c;
      fallback = fallback || c;
    }
  }
  return fallback;
}
function siteAt(px, py) {
  let best = null, bestD = Infinity;
  for (const d of markerLayout) {
    const dist = Math.hypot(d.x - px, d.y - py);
    if (dist <= d.rr + 4 && dist < bestD) { best = { site: d.site, sector: d.sector }; bestD = dist; }
  }
  return best;
}

/* ------------------------------------------------------------- navigation */
function fitTo(geom, pad) {
  const halfDeg = Math.max(geom.radius * (pad || 1.5), 2.2);
  const b = mapBox();
  const halfPx = Math.min(b.w, b.h) * 0.42;
  const s = Math.sin(clamp(halfDeg, 1, 88) * RAD);
  return clamp(halfPx / s, worldR(), 26000);
}
function animateTo(to, dur, done) {
  anim = { from: { lon: view.lon, lat: view.lat, R: view.R }, to, t0: performance.now(),
           dur: dur == null ? 900 : dur, done };
}

function goWorld(skipAnim) {
  S.level = 'world'; S.country = null; S.sector = null; S.site = null;
  if (!skipAnim) animateTo({ lon: 26, lat: 18, R: worldR() }, 950);
  else { view.lon = 26; view.lat = 18; view.R = worldR(); }
  sync();
}
function goCountry(t, skipAnim) {
  if (!t) return;
  S.level = 'country'; S.country = t; S.sector = null; S.site = null; S.spin = false;
  const c = t.geom;
  const target = { lon: c.centroid[0], lat: c.centroid[1], R: fitTo(c, 1.7) };
  if (skipAnim) Object.assign(view, target); else animateTo(target, 1000);
  sync();
}
function goSector(sec, skipAnim) {
  if (!sec) return;
  S.level = 'sector'; S.sector = sec; S.site = null; S.spin = false;
  const c = S.country.geom;
  const target = { lon: c.centroid[0], lat: c.centroid[1], R: fitTo(c, 1.42) };
  if (skipAnim) Object.assign(view, target); else animateTo(target, 750);
  sync();
}
function goSite(site, sector) {
  if (sector && sector !== S.sector) { S.sector = sector; S.level = 'sector'; }
  S.site = site; S.spin = false;
  animateTo({ lon: site.ll[0], lat: site.ll[1], R: Math.max(view.R, fitTo(S.country.geom, 0.85)) }, 700);
  sync();
}
function back() {
  if (S.level === 'sector') { S.sector = null; S.site = null; goCountry(S.country); }
  else if (S.level === 'country') goWorld();
}

/* --------------------------------------------------------------- controls */
const drag = { active: false, moved: 0, x: 0, y: 0 };
cv.addEventListener('pointerdown', (e) => {
  drag.active = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY;
  cv.setPointerCapture(e.pointerId); cv.classList.add('dragging'); anim = null;
});
cv.addEventListener('pointermove', (e) => {
  const rect = cv.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  if (drag.active) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const k = 180 / (view.R * Math.PI) * 1.15;
    view.lon = ((view.lon - dx * k + 540) % 360) - 180;
    view.lat = clamp(view.lat + dy * k, -89, 89);
    drag.x = e.clientX; drag.y = e.clientY;
    hideTip();
    return;
  }
  const site = siteAt(px, py);
  if (site) { S.hover = { kind: 'site', ref: site.site }; showSiteTip(site, px, py); cv.classList.add('pickable'); return; }
  const c = countryAt(px, py);
  S.hover = c ? { kind: 'country', ref: c } : null;
  if (c && c.taqa) { showCountryTip(c.taqa, px, py); cv.classList.add('pickable'); }
  else { hideTip(); cv.classList.remove('pickable'); }
});
function endDrag(e) {
  if (!drag.active) return;
  drag.active = false; cv.classList.remove('dragging');
  try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
  if (drag.moved > 6) return;
  const rect = cv.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const hit = siteAt(px, py);
  if (hit) {
    if (hit.site.agg) { goSector(hit.site.top.sec, true); goSite(hit.site.top.site, hit.site.top.sec); }
    else goSite(hit.site, hit.sector);
    return;
  }
  const c = countryAt(px, py);
  if (c && c.taqa && c.taqa !== S.country) goCountry(c.taqa);
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { hideTip(); S.hover = null; });

cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  anim = null;
  const rect = cv.getBoundingClientRect();
  const before = invert(e.clientX - rect.left, e.clientY - rect.top);
  const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.0016));
  view.R = clamp(view.R * f, worldR() * 0.72, 26000);
  if (before) {                          // ease the view toward the cursor
    const w = clamp(Math.abs(1 - f) * 3.2, 0, .38);
    let dl = before[0] - view.lon;
    while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    view.lon += dl * w;
    view.lat = clamp(view.lat + (before[1] - view.lat) * w, -89, 89);
  }
  syncProjection();
}, { passive: false });

$('ctl-in').onclick = () => { anim = null; view.R = clamp(view.R * 1.45, worldR() * .72, 26000); };
$('ctl-out').onclick = () => { anim = null; view.R = clamp(view.R / 1.45, worldR() * .72, 26000); };
$('ctl-spin').onclick = () => { S.spin = !S.spin; $('ctl-spin').classList.toggle('on', S.spin); };
$('ctl-home').onclick = () => { S.filter = null; S.spin = true; goWorld(); };
$('ctl-full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
};
$('btn-panel').onclick = () => {
  S.panel = !S.panel;
  $('panel').classList.toggle('collapsed', !S.panel);
  if (S.level === 'world' && !anim) view.R = worldR();
  setTimeout(resize, 340);
};

window.addEventListener('resize', resize);
document.addEventListener('keydown', (e) => {
  if (searchOpen) return;
  if (e.key === 'Escape') { back(); }
  else if (e.key === '/' ) { e.preventDefault(); openSearch(); }
  else if (e.key === 'ArrowLeft') { anim = null; view.lon -= 4; }
  else if (e.key === 'ArrowRight') { anim = null; view.lon += 4; }
  else if (e.key === 'ArrowUp') { anim = null; view.lat = clamp(view.lat + 4, -89, 89); }
  else if (e.key === 'ArrowDown') { anim = null; view.lat = clamp(view.lat - 4, -89, 89); }
});

/* ------------------------------------------------------------------ tooltip */
const tipEl = $('tip');
function placeTip(px, py) {
  tipEl.classList.add('show');
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = clamp(px + 16, 8, W - r.width - 8) + 'px';
  tipEl.style.top = clamp(py - r.height - 12, 8, H - r.height - 8) + 'px';
}
function hideTip() { tipEl.classList.remove('show'); }
function showCountryTip(t, px, py) {
  const label = t.status === 'core' ? 'Home market' : t.status === 'presence' ? 'Operating' : 'Under study';
  tipEl.innerHTML =
    '<div class="tn">' + t.flag + ' ' + esc(t.name) + '</div>' +
    '<div class="tm">' + esc(t.tagline) + '</div>' +
    '<div class="tsec">' + t.sectors.map((s) =>
      '<span style="color:' + s.color + '">' + esc(s.short) + '</span>').join('') +
      '<span>' + label + '</span></div>';
  placeTip(px, py);
}
function showSiteTip(item, px, py) {
  const { site, sector } = item;
  const unit = sector.countLabel ? ' ' + sector.countLabel.toLowerCase()
    : ' record' + (site.count === 1 ? '' : 's');
  tipEl.innerHTML =
    '<div class="tn"><span style="width:9px;height:9px;border-radius:9px;background:' + sector.color + '"></span>' +
      esc(site.gov) + '</div>' +
    '<div class="tm">' + fmt(site.count) + unit +
      (site.agg ? ' across ' + site.parts.length + (site.parts.length === 1 ? ' division' : ' divisions')
                : ' · ' + esc(sector.label)) + '</div>' +
    '<div class="tsec">' + (site.agg
      ? site.parts.map((pt) => '<span style="color:' + pt.sec.color + '">' + esc(pt.sec.short) +
          ' ' + fmt(pt.site.count) + '</span>').join('')
      : site.activities.slice(0, 3).map((a) =>
          '<span>' + esc(a.name) + ' ' + a.count + '</span>').join('')) + '</div>';
  placeTip(px, py);
}

/* ------------------------------------------------------------------ panels */
const head = $('panel-head'), body = $('panel-body'), foot = $('panel-foot'), crumbs = $('crumbs');

function statusPill(t) {
  const label = t.status === 'core' ? 'Home market' : t.status === 'presence' ? 'Operating' : 'Under study';
  const cls = t.status === 'core' ? 'core' : t.status === 'presence' ? 'presence' : 'studying';
  return '<span class="pill ' + cls + '"><span class="dot"></span>' + label + '</span>';
}
const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

function bars(items, colour, max) {
  const top = Math.max(1, items[0] ? items[0].count : 1);
  return items.slice(0, max || 8).map((a) =>
    '<div class="bar-row"><div class="lab">' + esc(a.name) + '</div>' +
    '<div class="val">' + fmt(a.count) + '</div>' +
    '<div class="track"><div class="fill" style="width:' +
      (a.count / top * 100).toFixed(1) + '%;background:' + colour + '"></div></div></div>').join('');
}

function renderCrumbs() {
  let h = '<button data-go="world">World</button>';
  if (S.country) {
    h += '<span class="sep">/</span>';
    h += S.level === 'country'
      ? '<span class="cur">' + esc(S.country.name) + '</span>'
      : '<button data-go="country">' + esc(S.country.name) + '</button>';
  }
  if (S.sector) h += '<span class="sep">/</span><span class="cur">' + esc(S.sector.label) + '</span>';
  crumbs.innerHTML = h;
  crumbs.querySelectorAll('button').forEach((b) => {
    b.onclick = () => b.dataset.go === 'world' ? goWorld() : goCountry(S.country);
  });
}

function renderWorld() {
  const totalRecords = TAQA.countries.reduce((t, c) =>
    t + c.sectors.reduce((x, s) => x + s.records, 0), 0);
  head.innerHTML =
    '<div class="eyebrow"><span class="rule"></span>TAQA Arabia</div>' +
    '<h1>Global Footprint</h1>' +
    '<p class="sub">Spin the globe, or pick a country to see what we run there. ' +
    'Green is an operating market, amber is a market under study.</p>';

  let h = '<div class="kpis">' +
    kpi(String(presence.length), 'Operating markets') +
    kpi(String(studying.length), 'Markets under study') +
    kpi(fmt(1538), 'Service records in Egypt') +
    kpi('23', 'Egyptian governorates') +
    '</div>';

  h += '<div class="section-label">Filter by sector</div><div class="chips">';
  h += '<button class="chip' + (S.filter ? '' : ' on') + '" data-f="" ' +
       (S.filter ? '' : 'style="background:#FFC10E"') + '>All sectors</button>';
  sectorFilters.forEach((s) => {
    const on = S.filter === s.id;
    h += '<button class="chip' + (on ? ' on' : '') + '" data-f="' + s.id + '"' +
         (on ? ' style="background:' + s.color + '"' : '') +
         '><span class="dot" style="background:' + s.color + '"></span>' + esc(s.short) + '</button>';
  });
  h += '</div>';

  const shown = presence.filter(matchesFilter);
  h += '<div class="section-label">Where we operate<span class="count">' + shown.length + '</span></div>';
  h += shown.map(countryRow).join('') || '<div class="empty">No operating market runs this sector yet.</div>';

  const shownStudy = studying.filter(matchesFilter);
  if (shownStudy.length) {
    h += '<div class="section-label">Markets under study<span class="count">' + shownStudy.length + '</span></div>';
    h += shownStudy.map(countryRow).join('');
  }
  body.innerHTML = h;

  body.querySelectorAll('[data-f]').forEach((b) => {
    b.onclick = () => { S.filter = b.dataset.f || null; renderWorld(); };
  });
  wireRows();
  foot.innerHTML = 'Sources: the TAQA Analytics client portfolio (1,538 service records) and the group regional footprint map. ' +
    'International figures are portfolio-level; markers sit on the city named in the source.';
}
function kpi(v, l) { return '<div class="kpi"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }

function countryRow(t) {
  const secs = t.sectors.map((s) => s.short).join(' · ') || 'Market development';
  const records = t.sectors.reduce((x, s) => x + s.records, 0);
  return '<button class="row" data-country="' + t.key + '">' +
    '<span class="flag">' + t.flag + '</span>' +
    '<span class="grow"><span class="name">' + esc(t.name) + '</span>' +
    '<span class="meta">' + esc(secs) + '</span></span>' +
    (records ? '<span class="num">' + fmt(records) + '</span>' : '') + CHEV + '</button>';
}

function renderCountry() {
  const t = S.country;
  head.innerHTML =
    '<div class="eyebrow"><span class="rule"></span>Country</div>' +
    '<h1><span class="flag">' + t.flag + '</span>' + esc(t.name) + '</h1>' +
    '<div style="margin-top:9px">' + statusPill(t) + '</div>' +
    '<p class="sub">' + esc(t.summary) + '</p>';

  let h = '';
  if (t.stats && t.stats.length) {
    h += '<div class="kpis">' + t.stats.map((s) => kpi(s.v, s.l)).join('') + '</div>';
  }
  if (t.sectors.length) {
    h += '<div class="section-label">What we do here<span class="count">' + t.sectors.length +
         (t.sectors.length === 1 ? ' sector' : ' sectors') + '</span></div>';
    h += t.sectors.map((s) =>
      '<button class="row" data-sector="' + s.id + '">' +
      '<span class="swatch" style="background:' + s.color + '"></span>' +
      '<span class="grow"><span class="name">' + esc(s.label) + '</span>' +
      '<span class="meta">' + esc(s.blurb) + '</span></span>' +
      '<span class="num">' + fmt(s.records) + '</span>' + CHEV + '</button>').join('');
  } else {
    h += '<div class="empty">No operating sectors mapped here yet — this market is at MoU or study stage.</div>';
  }
  if (t.facts && t.facts.length) {
    h += '<div class="section-label">Key facts</div><ul class="facts">' +
      t.facts.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
  }
  if (t.crossSell) h += crossSellBlock(t);
  body.innerHTML = h;

  body.querySelectorAll('[data-sector]').forEach((b) => {
    b.onclick = () => goSector(t.sectors.find((s) => s.id === b.dataset.sector));
  });
  wireRows();
  foot.innerHTML = t.sectors.length
    ? 'Pick a sector to put every site on the map. Markers are sized by the number of records.'
    : 'Press Esc or click “World” to go back to the globe.';
}

function crossSellBlock(t) {
  const gaps = t.crossSell.filter((g) => g.missing.length && g.present.length).slice(0, 8);
  if (!gaps.length) return '';
  let h = '<div class="section-label">Cross-sell openings<span class="count">' + gaps.length + '</span></div>';
  h += '<div class="note" style="margin-top:0;margin-bottom:9px">Governorates where TAQA already holds a relationship in one ' +
       'division but has never sold the others. Ordered by how much we already have on the ground.</div>';
  h += gaps.map((g) =>
    '<button class="row" data-gap="' + esc(g.gov) + '">' +
    '<span class="grow"><span class="name">' + esc(g.gov) + '</span>' +
    '<span class="meta wrap">Has ' + g.present.map((p) => TAQA.meta[p].short).join(', ') +
    ' — missing ' + g.missing.map((p) => TAQA.meta[p].short).join(', ') + '</span></span>' +
    '<span class="num">' + fmt(g.total) + '</span>' + CHEV + '</button>').join('');
  return h;
}

function renderSector() {
  const t = S.country, sec = S.sector;
  head.innerHTML =
    '<div class="eyebrow"><span class="rule"></span>' + esc(t.name) + '</div>' +
    '<h1><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' +
      sec.color + ';margin-right:9px"></span>' + esc(sec.label) + '</h1>' +
    '<p class="sub">' + esc(sec.blurb) + '</p>';

  let h = '<div class="kpis">' +
    kpi(fmt(sec.records), sec.countLabel || (t.key === 'egypt' ? 'Service records' : 'Sites & contracts')) +
    kpi(String(sec.sites.length), t.key === 'egypt' ? 'Governorates' : 'Locations') +
    '</div>';

  if (sec.services && sec.services.length) {
    h += '<div class="section-label">Services delivered</div>' + bars(sec.services, sec.color, 6);
  }
  if (sec.activities && sec.activities.length > 1) {
    h += '<div class="section-label">Client activities</div>' + bars(sec.activities, sec.color, 8);
  }

  h += '<div class="section-label">Where they are<span class="count">' + sec.sites.length + '</span></div>';
  h += sec.sites.map((s) =>
    '<button class="row' + (S.site === s ? ' on' : '') + '" data-site="' + esc(s.gov) + '">' +
    '<span class="swatch" style="background:' + sec.color + ';height:26px"></span>' +
    '<span class="grow"><span class="name">' + esc(s.gov) + '</span>' +
    '<span class="meta">' + s.activities.slice(0, 3).map((a) => esc(a.name)).join(' · ') + '</span></span>' +
    '<span class="num">' + fmt(s.count) + '</span></button>').join('');

  if (S.site) h += siteDetail(S.site, sec);
  body.innerHTML = h;

  body.querySelectorAll('[data-site]').forEach((b) => {
    b.onclick = () => {
      const s = sec.sites.find((x) => x.gov === b.dataset.site);
      if (S.site === s) { S.site = null; sync(); } else goSite(s, sec);
    };
  });
  wireClientSearch();
  foot.innerHTML = t.key === 'egypt'
    ? 'Markers sit on each governorate’s centre — they show where a relationship is, not the exact plant address.'
    : 'International markers sit on the city named in the group footprint map.';
}

function siteDetail(site, sec) {
  let h = '<div class="section-label">' + esc(site.gov) + ' — detail<span class="count">' + fmt(site.count) + '</span></div>';
  if (site.services && site.services.length > 1) h += bars(site.services, sec.color, 5);
  if (site.clients && site.clients.length) {
    h += '<div class="mini-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#5f739a" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/>' +
      '<path d="m21 21-4.3-4.3"/></svg><input id="client-q" placeholder="Filter ' +
      fmt(site.clients.length) + ' clients…" /></div><div id="client-list">' +
      clientList(site.clients, '') + '</div>';
  } else {
    h += '<div class="empty">Client-level detail is not published for this market.</div>';
  }
  return h;
}
function clientList(clients, q) {
  const list = q ? clients.filter((c) => (c.n + ' ' + c.a).toLowerCase().includes(q)) : clients;
  if (!list.length) return '<div class="empty">Nothing matches “' + esc(q) + '”.</div>';
  return list.slice(0, 200).map((c, i) =>
    '<div class="client"><span class="idx">' + (i + 1) + '</span><span style="flex:1;min-width:0">' +
    '<span class="cn"' + dirOf(c.n) + '>' + esc(c.n) + '</span>' +
    '<span class="ca">' + esc(c.a) + (c.s ? ' · ' + esc(c.s) : '') + '</span></span></div>').join('') +
    (list.length > 200 ? '<div class="empty">+ ' + fmt(list.length - 200) +
      ' more — narrow the filter to see them.</div>' : '');
}
function wireClientSearch() {
  const q = $('client-q');
  if (!q) return;
  q.addEventListener('input', () => {
    $('client-list').innerHTML = clientList(S.site.clients, q.value.trim().toLowerCase());
  });
}

function wireRows() {
  body.querySelectorAll('[data-country]').forEach((b) => {
    b.onclick = () => goCountry(taqaByGeo.get(b.dataset.country));
  });
  body.querySelectorAll('[data-gap]').forEach((b) => {
    b.onclick = () => {
      const gov = b.dataset.gap;
      const sec = S.country.sectors.find((s) => s.sites.some((x) => x.gov === gov));
      if (sec) goSite(sec.sites.find((x) => x.gov === gov), sec);
    };
  });
}

/* -------------------------------------------------------------- hash sync */
let applyingHash = false;
function sync() {
  renderCrumbs();
  if (S.level === 'world') renderWorld();
  else if (S.level === 'country') renderCountry();
  else renderSector();
  body.scrollTop = 0;
  $('ctl-spin').classList.toggle('on', S.spin);
  if (!applyingHash) {
    const parts = ['#'];
    if (S.country) parts.push(S.country.key);
    if (S.sector) parts.push(S.sector.id);
    if (S.site) parts.push(encodeURIComponent(S.site.gov));
    const h = parts.length > 1 ? parts.join('/') : '#';
    if (location.hash !== h) history.replaceState(null, '', h);
  }
}
function applyHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw ? raw.split('/').filter(Boolean) : [];
  applyingHash = true;
  if (!parts.length) { goWorld(true); }
  else {
    const t = taqaByGeo.get(parts[0]);
    if (!t) { goWorld(true); }
    else {
      goCountry(t, true);
      const sec = parts[1] && t.sectors.find((s) => s.id === parts[1]);
      if (sec) {
        goSector(sec, true);
        const gov = parts[2] && decodeURIComponent(parts[2]);
        const site = gov && sec.sites.find((s) => s.gov === gov);
        if (site) { S.site = site; view.lon = site.ll[0]; view.lat = site.ll[1]; }
      }
    }
  }
  applyingHash = false;
  sync();
}
window.addEventListener('hashchange', applyHash);

/* ------------------------------------------------------------------ search */
let searchOpen = false, searchIndex = null, cursor = 0, results = [];
function buildIndex() {
  const idx = [];
  TAQA.countries.forEach((t) => {
    idx.push({ kind: 'Country', label: t.name, sub: t.tagline, colour: statusColour(t),
               go: () => goCountry(t) });
    t.sectors.forEach((sec) => {
      idx.push({ kind: 'Sector', label: sec.label + ' — ' + t.name, sub: fmt(sec.records) + ' records',
                 colour: sec.color, size: sec.records,
                 go: () => { goCountry(t, true); goSector(sec); } });
      sec.sites.forEach((site) => {
        idx.push({ kind: 'Location', label: site.gov + ' — ' + sec.short,
                   sub: t.name + ' · ' + fmt(site.count) + ' records', colour: sec.color,
                   size: site.count,
                   go: () => { goCountry(t, true); goSector(sec, true); goSite(site, sec); } });
        site.clients.forEach((c) => {
          idx.push({ kind: 'Client', label: c.n, sub: c.a + ' · ' + site.gov + ' · ' + sec.short,
                     colour: sec.color, hay: (c.n + ' ' + c.a + ' ' + site.gov).toLowerCase(),
                     go: () => { goCountry(t, true); goSector(sec, true); goSite(site, sec); } });
        });
      });
    });
  });
  idx.forEach((r) => { if (!r.hay) r.hay = (r.label + ' ' + r.sub).toLowerCase(); });
  return idx;
}
function openSearch() {
  searchOpen = true;
  searchIndex = searchIndex || buildIndex();
  $('search-wrap').classList.add('open');
  const inp = $('search-input');
  inp.value = ''; inp.focus();
  runSearch('');
}
function closeSearch() { searchOpen = false; $('search-wrap').classList.remove('open'); }
function runSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    results = searchIndex.filter((r) => r.kind === 'Country').slice(0, 12);
  } else {
    const hits = [];
    for (const r of searchIndex) {
      const i = r.hay.indexOf(q);
      if (i < 0) continue;
      const w = (r.kind === 'Country' ? 0 : r.kind === 'Sector' ? 1 : r.kind === 'Location' ? 2 : 3);
      hits.push({ r, score: w * 100000 + i * 100 - Math.min(r.size || 0, 99) });
      if (hits.length > 600) break;
    }
    hits.sort((a, b) => a.score - b.score);
    results = hits.slice(0, 40).map((h) => h.r);
  }
  cursor = 0;
  paintResults();
}
function paintResults() {
  const box = $('search-results');
  if (!results.length) { box.innerHTML = '<div class="empty" style="padding:22px 14px">No matches.</div>'; return; }
  let html = '', group = null;
  results.forEach((r, i) => {
    if (r.kind !== group) { group = r.kind; html += '<div class="res-group">' + group + 's</div>'; }
    html += '<button class="res' + (i === cursor ? ' cursor' : '') + '" data-i="' + i + '">' +
      '<span class="sw" style="background:' + r.colour + '"></span>' +
      '<span class="rn"><span' + dirOf(r.label) + ' style="display:block">' + esc(r.label) + '</span>' +
      '<span style="display:block;font-size:11px;color:#5f739a">' + esc(r.sub) + '</span></span>' +
      '<span class="rt">' + r.kind + '</span></button>';
  });
  box.innerHTML = html;
  box.querySelectorAll('.res').forEach((b) => {
    b.onclick = () => { closeSearch(); results[+b.dataset.i].go(); };
  });
  const cur = box.querySelector('.cursor');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}
$('btn-search').onclick = openSearch;
$('search-input').addEventListener('input', (e) => runSearch(e.target.value));
$('search-wrap').addEventListener('click', (e) => { if (e.target === $('search-wrap')) closeSearch(); });
document.addEventListener('keydown', (e) => {
  if (!searchOpen) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, results.length - 1); paintResults(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); paintResults(); }
  else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); closeSearch(); results[cursor].go(); }
});

/* -------------------------------------------------------------------- boot */
resize();
view.R = worldR();
applyHash();
requestAnimationFrame(frame);
setTimeout(() => $('boot').classList.add('gone'), 320);

})();
