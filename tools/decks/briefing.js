/* "Portfolio Analytics Briefing" as an editable PowerPoint.
   Mirrors the /analytics/briefing deck. The satellite tiles on the website cannot be exported into a
   file, so each map is redrawn as an Egypt outline with one bubble per governorate (size = accounts),
   from the same governorate data that drives the dashboard. Run: node briefing.js <out.pptx> */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { THEME, newDeck, setTitle, chip, card, glass, node, link, shadow, egyptFrame, drawEgypt, finish, lines } = require('./common');

/* ---- data: globe/data.js is generated from the same portfolio files --------------- */
const ctxv = { window: {} }; vm.createContext(ctxv);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../globe/data.js'), 'utf8'), ctxv);
const EG = ctxv.window.TAQA.countries.find((c) => c.key === 'egypt');
const sec = (id) => EG.sectors.find((s) => s.id === id);
const HEX = THEME.colors;
const DIV = {   // order matches the dashboard
  gas:    { name: 'TAQA Gas',   hex: HEX.accent3, tint: 'DCFCE7', ink: '15803D', scheme: 'accent3' },
  master: { name: 'Master Gas', hex: HEX.accent4, tint: 'D1FAE5', ink: '047857', scheme: 'accent4' },
  petro:  { name: 'Petroleum',  hex: HEX.accent6, tint: 'E2E8F0', ink: '475569', scheme: 'accent6' },
  power:  { name: 'TAQA Power', hex: HEX.accent2, tint: 'FEF3C7', ink: 'B45309', scheme: 'accent2' },
  water:  { name: 'Water',      hex: HEX.accent5, tint: 'E0F2FE', ink: '0369A1', scheme: 'accent5' },
};
const ORDER = ['gas', 'master', 'petro', 'power', 'water'];
const SLATE = '475569', SLATE2 = '64748B', MUTE = 'A9B8D6', LINE = '94A3B8';
const TOTAL = 1538;

const COPY = {
  gas:    { pct: '36%', sub: 'Piped natural gas, vehicle fuelling and process heat.',
            bullets: ['Distribution networks and EPC build-out into industrial zones', 'NGV stations and vehicle conversion', 'Process heat for kilns, boilers, ovens and dryers'] },
  master: { pct: '7%',  sub: 'Natural gas products across the widest footprint we have.',
            bullets: ['CNG vehicle distribution — the bulk of the book', 'Mobile CNG: gas trucked to sites with no pipeline', 'Present in 19 of the 23 governorates we serve'] },
  petro:  { pct: '5%',  sub: 'Fuel and lubricants, spread deliberately wide.',
            bullets: ['Oil-marketing stations and fuel terminals', 'Lubricants retail and distribution', 'Bulk fuel storage and logistics'] },
  power:  { pct: '52%', sub: 'Distribution at every voltage level, plus generation and solar.',
            bullets: ['Medium- and low-voltage distribution networks', 'Service-voltage connections and O&M contracts', 'Solar plants and captive generation'] },
  water:  { pct: '1%',  sub: 'Desalination and treatment for coastal demand.',
            bullets: ['Reverse-osmosis desalination plants', 'Filtration and chemical treatment', 'Solar-powered, smart-metered operations'] },
};
// services as the dashboard words them (Gas/Petro/Water have a single line item)
const SERVICES = {
  gas: [[559, 'Piped Natural Gas']], master: [[90, 'CNG Vehicle Distribution'], [10, 'Mobile CNG Units']],
  petro: [[71, 'Petroleum Products']],
  power: [[405, 'Medium Voltage Electricity Distribution'], [297, 'Low Voltage Electricity Distribution'], [58, 'Service Voltage Electricity Distribution'],
          [24, 'O&M Contract'], [7, 'Solar Power Plant'], [3, 'Power Generation']],
  water: [[14, 'Desalination & Treatment']],
};
const SECTOR_TOTALS = [['Other Services', 330], ['Hotels', 238], ['Other Industries', 192], ['Food Industries', 162], ['Engineering Industries', 105],
  ['Vehicle Fueling', 105], ['Natural Gas Products', 90], ['Petroleum Products', 72], ['Iron & Steel', 35]];
const MATRIX = [ // sector, gas, master, petro, power, water, total
  ['Other Services', 0, 0, 0, 330, 0, 330], ['Hotels', 138, 7, 0, 86, 7, 238], ['Other Industries', 90, 1, 0, 101, 0, 192],
  ['Food Industries', 104, 2, 0, 56, 0, 162], ['Engineering Industries', 22, 0, 0, 83, 0, 105], ['Vehicle Fueling', 105, 0, 0, 0, 0, 105],
  ['Natural Gas Products', 0, 90, 0, 0, 0, 90], ['Petroleum Products', 0, 0, 71, 1, 0, 72], ['Iron & Steel', 14, 0, 0, 21, 0, 35]];

/* ---- helpers -------------------------------------------------------------------- */
function bubbles(slide, frame, sites, hex, o = {}) {
  const k = o.scale ?? 1;
  const list = sites.map((s) => ({ s, d: Math.min(0.95 * k, (0.15 + Math.sqrt(s.count) * 0.03) * k), p: frame.pt(s.ll[0], s.ll[1]) }))
    .sort((a, b) => b.d - a.d);
  list.forEach(({ s, d, p }) => slide.addShape('ellipse', { x: p.x - d / 2, y: p.y - d / 2, w: d, h: d, objectName: `${s.gov} bubble`,
    fill: { color: hex, transparency: o.transparency ?? 28 }, line: { color: 'FFFFFF', width: 0.75 } }));
  if (o.labels) {
    const placed = [];
    list.slice(0, o.labels).forEach(({ s, d, p }) => {
      if (placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.42)) return;
      placed.push(p);
      const left = p.x > frame.ox + frame.w * 0.62;
      slide.addText(`${s.gov} · ${s.count}`, { x: left ? p.x - d / 2 - 0.03 - 1.5 : p.x + d / 2 + 0.03, y: p.y - 0.11, w: 1.5, h: 0.22, fontSize: 10, bold: true, color: '0F172A',
        align: left ? 'right' : 'left', margin: 0, valign: 'middle', isTextBox: true, objectName: `${s.gov} label` });
    });
  }
}
function barChart(pres, slide, labels, values, x, y, w, h, color, o = {}) {
  slide.addChart(pres.charts.BAR, [{ name: o.name || 'Accounts', labels, values }], {
    x, y, w, h, barDir: 'bar', chartColors: [color], catAxisOrientation: 'maxMin', valAxisHidden: true,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, catAxisLineShow: false, valAxisLineShow: false,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: o.val, dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelFontFace: '+mn-lt',
    dataLabelFormatCode: '#,##0', catAxisLabelColor: o.cat, catAxisLabelFontSize: 11, catAxisLabelFontFace: '+mn-lt',
    showLegend: false, showTitle: false, barGapWidthPct: o.gap ?? 45, objectName: o.obj || 'Bar chart',
  });
}
const label = (slide, text, x, y, w, color) => slide.addText(text.toUpperCase(), { x, y, w, h: 0.25, fontSize: 10, bold: true, charSpacing: 2,
  color, margin: 0, valign: 'middle', isTextBox: true, objectName: `${text} label` });
function pill(slide, C, text, x, y, o = {}) {
  const w = 0.3 + text.length * (o.cw ?? 0.085);
  slide.addShape('roundRect', { x, y, w, h: o.h ?? 0.3, rectRadius: 0.15, fill: { color: o.fill, transparency: o.ft ?? 0 }, line: { color: o.line || o.fill, width: 0.75, transparency: o.lt ?? 0 }, objectName: 'Pill' });
  slide.addText(text, { x, y, w, h: o.h ?? 0.3, fontSize: o.fs ?? 11, bold: true, color: o.color, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Pill text' });
  return w;
}

(async () => {
  const out = process.argv[2] || 'briefing.pptx';
  const { pres, C } = newDeck('TAQA Arabia — Portfolio Analytics Briefing', 'Business development read of the 1,538-account portfolio');

  /* 1 — cover */
  let s = pres.addSlide({ masterName: 'TAQA Cover' });
  chip(s, C, 'Portfolio Analytics · BD Briefing', true, 0.7, 0.85);
  setTitle(s, C, true, [[['1,538 accounts.']], [['Five divisions.']], [['One pipeline.', true]]]);
  ORDER.forEach((id, i) => {
    const d = DIV[id], x = 0.7 + i * 2.425, y = 4.75, w = 2.2, h = 1.3;
    glass(s, C, x, y, w, h, { name: `${d.name} card` });
    s.addText(String(sec(id).records), { x: x + 0.22, y: y + 0.12, w: w - 0.3, h: 0.55, fontSize: 30, bold: true, color: d.hex, margin: 0, valign: 'middle', isTextBox: true, objectName: `${d.name} accounts` });
    s.addText(d.name, { x: x + 0.22, y: y + 0.68, w: w - 0.3, h: 0.28, fontSize: 13, bold: true, color: C.background1, margin: 0, valign: 'middle', isTextBox: true });
    s.addText(`${COPY[id].pct} of portfolio`, { x: x + 0.22, y: y + 0.95, w: w - 0.3, h: 0.25, fontSize: 11, color: LINE, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.addText('What the dashboard shows when you read it as one company instead of five.', { x: 0.7, y: 6.3, w: 11.9, h: 0.4, fontSize: 15, color: MUTE, margin: 0, isTextBox: true, objectName: 'Cover caption' });

  /* 2 — the pipeline */
  s = pres.addSlide({ masterName: 'TAQA Dark' });
  chip(s, C, 'The Pipeline', true);
  setTitle(s, C, true, [[['1,531 clients across '], ['23 governorates.', true]]]);
  label(s, 'Where the pipeline sits by sector', 0.7, 1.95, 6, LINE);
  barChart(pres, s, SECTOR_TOTALS.map((r) => r[0]), SECTOR_TOTALS.map((r) => r[1]), 0.6, 2.25, 6.3, 4.6, C.accent1 && HEX.accent1,
    { val: 'FFFFFF', cat: 'CBD5E1', obj: 'Accounts by sector' });
  card(s, C, 7.25, 1.9, 5.4, 4.95, { name: 'Map card', noShadow: true });
  ORDER.forEach((id, i) => {   // legend
    const x = 7.5 + [0, 1.0, 2.1, 3.1, 4.3][i];
    s.addShape('ellipse', { x, y: 2.15, w: 0.12, h: 0.12, fill: { color: DIV[id].hex }, line: { type: 'none' }, objectName: `Legend ${DIV[id].name}` });
    s.addText(DIV[id].name.replace('TAQA Power', 'Electricity'), { x: x + 0.17, y: 2.07, w: 1.0, h: 0.28, fontSize: 10, color: SLATE, margin: 0, valign: 'middle', isTextBox: true });
  });
  {
    const f = egyptFrame(7.45, 2.5, 5.0, 3.95);
    drawEgypt(s, C, f, 'E5E7EB', 'CBD5E1');
    ORDER.slice().sort((a, b) => sec(b).records - sec(a).records).forEach((id) => bubbles(s, f, sec(id).sites, DIV[id].hex, { scale: 0.85, transparency: 30 }));
    s.addText('Marker size = accounts per governorate', { x: 7.45, y: 6.5, w: 5.0, h: 0.25, fontSize: 10, color: SLATE2, align: 'center', margin: 0, isTextBox: true, objectName: 'Map note' });
  }

  /* 3 — sector × service */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'Sector × Service', false);
  setTitle(s, C, false, [[['Every sector, and '], ['who inside TAQA serves it.', true]]]);
  s.addText('An empty cell next to a full one is a client we already have, buying something we already sell — from somebody else.',
    { x: 0.7, y: 1.55, w: 11.9, h: 0.6, fontSize: 15, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Lede' });
  const hair = [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: 'E5E7EB' }, { type: 'none' }];
  const head = [['Sector', null], ...ORDER.map((id) => [DIV[id].name, DIV[id]]), ['Total', null]].map(([t, d], i) => ({ text: t,
    options: { bold: true, fontSize: 12, color: d ? d.ink : C.text2, align: i === 0 ? 'left' : 'center', border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: 'CBD5E1' }, { type: 'none' }] } }));
  const rows = [head, ...MATRIX.map((r) => [
    { text: r[0], options: { fontSize: 13, color: C.text1, border: hair } },
    ...ORDER.map((id, i) => r[i + 1]
      ? { text: String(r[i + 1]), options: { bold: true, fontSize: 13, align: 'center', color: DIV[id].ink, fill: { color: DIV[id].tint }, border: hair } }
      : { text: '·', options: { fontSize: 13, align: 'center', color: 'CBD5E1', border: hair } }),
    { text: String(r[6]), options: { bold: true, fontSize: 13, align: 'center', color: C.text1, border: hair } },
  ])];
  s.addTable(rows, { x: 0.7, y: 2.35, w: 11.9, colW: [3.4, 1.5, 1.5, 1.5, 1.5, 1.5, 1.0], rowH: 0.42, valign: 'middle', fontFace: THEME.bodyFontFace, objectName: 'Sector by service matrix' });

  /* 4–8 — one slide per division */
  ORDER.forEach((id) => {
    const d = DIV[id], sc = sec(id), cp = COPY[id];
    s = pres.addSlide({ masterName: 'TAQA Light' });
    chip(s, C, d.name, false);
    setTitle(s, C, false, [[[`${sc.records} accounts `], [`across ${sc.govCount} governorates.`, true]]]);
    s.addText(cp.sub, { x: 0.7, y: 1.55, w: 7.2, h: 0.4, fontSize: 15, color: SLATE, margin: 0, valign: 'top', isTextBox: true, objectName: 'Lede' });

    [[String(sc.records), 'Accounts', `${cp.pct} of portfolio`], [String(sc.govCount), 'Governorates', 'of 23 served'],
     [String(sc.activities.length), 'Sectors', 'distinct activities']].forEach(([n, l, sub], i) => {
      const x = 0.7 + i * 2.475, y = 2.2, w = 2.25, h = 1.2;
      card(s, C, x, y, w, h, { name: `Stat ${l}` });
      s.addText(n, { x: x + 0.2, y: y + 0.1, w: w - 0.3, h: 0.5, fontSize: 28, bold: true, color: d.ink, margin: 0, valign: 'middle', isTextBox: true, objectName: `${l} value` });
      s.addText(l, { x: x + 0.2, y: y + 0.6, w: w - 0.3, h: 0.27, fontSize: 13, bold: true, color: C.text2, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(sub, { x: x + 0.2, y: y + 0.86, w: w - 0.3, h: 0.24, fontSize: 10, color: SLATE2, margin: 0, valign: 'middle', isTextBox: true });
    });

    label(s, 'What we sell', 0.7, 3.7, 3.9, SLATE2);
    let y = 4.05;
    SERVICES[id].forEach(([n, name]) => {
      s.addText(String(n), { x: 0.7, y, w: 0.6, h: 0.3, fontSize: 15, bold: true, color: d.ink, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Service count' });
      s.addText(name, { x: 1.35, y, w: 3.3, h: 0.3, fontSize: 11.5, color: C.text1, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Service' });
      y += 0.31;
    });
    s.addText(cp.bullets.map((b, i) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: i < cp.bullets.length - 1, paraSpaceAfter: 4 } })),
      { x: 0.7, y: y + 0.1, w: 3.9, h: 6.85 - (y + 0.1), fontSize: 11, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'What we sell notes' });

    label(s, 'Sectors served', 4.9, 3.7, 3.0, SLATE2);
    const top = sc.activities.slice(0, 6);
    barChart(pres, s, top.map((a) => a.name), top.map((a) => a.count), 4.8, 3.95, 3.15, Math.min(2.85, 0.5 * top.length + 0.3), d.hex, { val: C.text1 && '0B1220', cat: SLATE, obj: `${d.name} sectors served`, gap: 55 });

    card(s, C, 8.25, 2.2, 4.4, 4.6, { name: 'Map card' });
    s.addText('Marker size = accounts per governorate', { x: 8.45, y: 2.32, w: 4.0, h: 0.25, fontSize: 10, color: SLATE2, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Map note' });
    const f = egyptFrame(8.4, 2.65, 4.1, 4.0);
    drawEgypt(s, C, f, 'E5E7EB', 'CBD5E1');
    bubbles(s, f, sc.sites, d.hex, { labels: 4, scale: 0.9 });
  });

  /* 9 — the finding */
  s = pres.addSlide({ masterName: 'TAQA Dark' });
  chip(s, C, 'The Finding', true);
  setTitle(s, C, true, [[['Out of 1,531 clients, '], ['3 are contracted twice.', true]]]);
  s.addText([{ text: 'One — Soma Bay — is contracted across three. ', options: { color: MUTE } },
             { text: 'The cross-sell has barely been attempted,', options: { bold: true, color: C.background1 } },
             { text: ' which is why the pipeline below is still wide open.', options: { color: MUTE } }],
    { x: 0.7, y: 1.6, w: 11.5, h: 0.75, fontSize: 16, valign: 'top', margin: 0, isTextBox: true, objectName: 'Lede' });
  [['سيميتار إيجيبت للإنتاج المحدودة', ['TAQA Gas', 'TAQA Power']], ['قرية ريكسوس مجاويش', ['TAQA Gas', 'Water']],
   ['أورا_سيلفر ساندز', ['TAQA Power', 'Water']]].forEach(([name, tags], i) => {
    const x = 0.7 + i * 4.05, y = 3.0, w = 3.8, h = 1.75;
    glass(s, C, x, y, w, h, { name: `Client ${i + 1}` });
    s.addText(name, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.5, fontSize: 17, bold: true, color: C.background1, align: 'right', rtlMode: true, fontFace: 'Arial', margin: 0, valign: 'middle', isTextBox: true, objectName: 'Client name (Arabic)' });
    let px = x + 0.25;
    tags.forEach((t) => { px += pill(s, C, t, px, y + 0.85, { fill: C.accent1, ft: 82, line: C.accent1, lt: 60, color: C.accent1, fs: 11 }) + 0.12; });
    s.addText('Two services.', { x: x + 0.25, y: y + 1.3, w: w - 0.5, h: 0.28, fontSize: 11, color: LINE, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.shapes;
  s.addShape('roundRect', { x: 0.7, y: 5.1, w: 11.9, h: 1.55, rectRadius: 0.12, fill: { color: C.accent1, transparency: 90 }, line: { color: C.accent1, transparency: 55, width: 1 }, objectName: 'Proof panel' });
  s.addText('THE PROOF IT WORKS', { x: 1.0, y: 5.3, w: 4, h: 0.25, fontSize: 10, bold: true, charSpacing: 2.5, color: C.accent1, margin: 0, valign: 'middle', isTextBox: true });
  s.addText('Soma Bay', { x: 1.0, y: 5.65, w: 2.9, h: 0.7, fontSize: 28, bold: true, color: C.background1, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Soma Bay' });
  { let px = 4.0; ['TAQA Gas', 'TAQA Power (Solar)', 'Water'].forEach((t) => { px += pill(s, C, t, px, 5.85, { fill: C.background1, ft: 88, line: C.background1, lt: 70, color: C.background1, fs: 11 }) + 0.12; }); }
  s.addText('One destination, three TAQA contracts. This is the shape every resort account could take.', { x: 8.6, y: 5.5, w: 3.7, h: 0.9, fontSize: 13, color: MUTE, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Proof note' });

  /* 10 — the whole opportunity */
  s = pres.addSlide({ masterName: 'TAQA Dark' });
  chip(s, C, 'What We Do With It', true);
  setTitle(s, C, true, [[['The whole opportunity, '], ['in one picture.', true]]]);
  glass(s, C, 0.7, 1.9, 6.7, 4.95, { name: 'Portfolio panel' });
  label(s, 'Where the portfolio actually sits', 1.0, 2.1, 5.5, LINE);
  s.addImage({ path: path.join(__dirname, 'brief-dots.png'), x: 1.0, y: 2.5, w: 6.1, h: 3.595, altText: '1,531 dots, one per client; three gold dots hold two TAQA services and one larger gold dot, Soma Bay, holds three', objectName: 'Client dot matrix' });
  [[LINE, 'Single service', 1.0], [C.accent1, 'Two services · 3', 2.85], [C.accent1, 'Three · Soma Bay', 4.55]].forEach(([col, t, x]) => {
    s.addShape('ellipse', { x, y: 6.27, w: 0.12, h: 0.12, fill: { color: col }, line: { type: 'none' }, objectName: 'Legend dot' });
    s.addText(t, { x: x + 0.18, y: 6.2, w: 1.7, h: 0.26, fontSize: 10.5, color: LINE, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.addText('0.3% of clients hold more than one TAQA service.', { x: 1.0, y: 6.48, w: 6, h: 0.26, fontSize: 11, color: MUTE, margin: 0, valign: 'middle', isTextBox: true });

  glass(s, C, 7.65, 1.9, 5.0, 2.85, { name: 'Loop panel' });
  {
    const c = { x: 10.15, y: 3.32 }, rx = 1.45, ry = 0.82;
    const ring = [['More\nservices', -90, true], ['Deeper\nrelationship', 0], ['Pricing\npower', 90], ['Easier\nupsell', 180]].map(([l, a, hot]) => ({ l, hot,
      x: c.x + rx * Math.cos(a * Math.PI / 180), y: c.y + ry * Math.sin(a * Math.PI / 180) }));
    ring.forEach((n, i) => { const m = ring[(i + 1) % 4]; const dx = m.x - n.x, dy = m.y - n.y, dd = Math.hypot(dx, dy), r = 0.5;
      link(s, n.x + dx / dd * r, n.y + dy / dd * r, m.x - dx / dd * r, m.y - dy / dd * r, { color: LINE, width: 1.5, arrow: true, name: `Loop ${i + 1}` }); });
    ring.forEach((n) => node(s, C, n.x, n.y, 0.98, n.l, { fs: 10, fill: n.hot ? C.accent1 : '0B1B3F', color: n.hot ? C.text1 : C.background1, line: n.hot ? C.accent1 : LINE, lw: 1, name: `Loop ${n.l.replace('\n', ' ')}` }));
  }
  [['Read the account', 'Check all five divisions before the visit.'], ['One owner', 'Whoever holds it carries all of TAQA in.'],
   ['Start with resorts', 'Soma Bay is the template, not the exception.'], ['Log the referral', 'The dashboard is only true if we record it.']].forEach(([h, b], i) => {
    const x = 7.65 + (i % 2) * 2.55, y = 4.9 + Math.floor(i / 2) * 1.0, w = 2.45, hh = 0.9;
    glass(s, C, x, y, w, hh, { name: `Action ${i + 1}` });
    s.addText(h, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.27, fontSize: 12, bold: true, color: C.accent1, margin: 0, valign: 'middle', isTextBox: true });
    s.addText(b, { x: x + 0.15, y: y + 0.36, w: w - 0.3, h: 0.5, fontSize: 10.5, color: MUTE, margin: 0, valign: 'top', isTextBox: true });
  });

  await finish(pres, out);
  console.log('wrote', out);
})();
