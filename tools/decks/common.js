/* Shared building blocks for the TAQA Arabia PowerPoint exports.
   Both decks use one theme and three layouts (Cover, Dark, Light), so a colour or
   font change is made once, in the theme, and every slide follows. */
const path = require('path');
const pptxgen = require('pptxgenjs');

const SKILL = process.env.PPTX_SKILL_DIR ||
  '/root/.claude/skills/synced/6a99b7e6-443e-45da-8990-27630623aea1_4a5b7b2a-6250-46f9-9a77-5cf0745c5f59/pptx';
const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js'));

/* Colours: dk1 deep navy · dk2 brand navy · lt2 paper · accent1 gold.
   accent2..6 are the division colours used on every chart and map. */
const THEME = {
  name: 'TAQA Arabia',
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '00102F', lt1: 'FFFFFF', dk2: '002060', lt2: 'FAF9F7',
    accent1: 'FFC10E',   // gold
    accent2: 'E8A020',   // TAQA Power
    accent3: '16A34A',   // TAQA Gas
    accent4: '10B981',   // Master Gas
    accent5: '0EA5E9',   // Water
    accent6: '64748B',   // Petroleum
    hlink: '005298', folHlink: '64748B',
  },
};

const W = 13.333, H = 7.5;
const px = (n) => n / 96;            // the web decks are 1280 x 720 px

function newDeck(title, subject) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = title; pres.subject = subject; pres.author = 'TAQA Arabia';
  pres.company = 'TAQA Arabia';
  const C = pres.SchemeColor;

  const footer = (col) => [
    { text: { text: 'TAQA ARABIA  ·  CONFIDENTIAL', options: { x: 0.7, y: 7.08, w: 5, h: 0.25, fontSize: 10,
        color: col, charSpacing: 2, bold: true, margin: 0, fontFace: THEME.bodyFontFace } } },
    { text: { text: 'A World of Energy', options: { x: 8.0, y: 7.08, w: 4.0, h: 0.25, fontSize: 10, italic: true,
        color: col, align: 'right', margin: 0, fontFace: THEME.bodyFontFace } } },
  ];
  const titlePh = (color, o = {}) => ({ placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.95, w: 11.9, h: 1.2,
      fontSize: 34, bold: true, color, align: 'left', valign: 'top', margin: 0, fontFace: THEME.headFontFace, ...o }, text: 'Slide title' } });

  pres.defineSlideMaster({ title: 'TAQA Cover', background: { color: C.text1 },
    objects: [titlePh(C.background1, { y: 1.45, h: 3.1, fontSize: 58 }), ...footer('7C8DB0')], slideNumber: { x: 12.2, y: 7.08, w: 0.45, h: 0.25, fontSize: 10, color: '7C8DB0', align: 'right' } });
  pres.defineSlideMaster({ title: 'TAQA Dark', background: { color: C.text1 },
    objects: [titlePh(C.background1), ...footer('7C8DB0')], slideNumber: { x: 12.2, y: 7.08, w: 0.45, h: 0.25, fontSize: 10, color: '7C8DB0', align: 'right' } });
  pres.defineSlideMaster({ title: 'TAQA Light', background: { color: C.background2 },
    objects: [titlePh(C.text2), ...footer('7C8DB0')], slideNumber: { x: 12.2, y: 7.08, w: 0.45, h: 0.25, fontSize: 10, color: '7C8DB0', align: 'right' } });
  return { pres, C };
}

/* Title as lines of runs: setTitle(slide, C, dark, [[['Every dot is a client']], [['we ', ], ['already', true]]])
   Each run is [text, accent?]; accent runs are gold. Lines are joined with real line breaks. */
function setTitle(slide, C, dark, lines) {
  const runs = [];
  lines.forEach((line, li) => line.forEach(([text, accent], ri) => {
    runs.push({ text, options: { color: accent ? (dark ? C.accent1 : C.accent2) : (dark ? C.background1 : C.text2),
                                 breakLine: ri === line.length - 1 && li < lines.length - 1 } });
  }));
  slide.addText(runs, { placeholder: 'title' });
}

/* "Gas\nrep" -> runs split with real line breaks (a bare \n would start a new paragraph mid-run) */
function lines(label, o = {}) {
  if (Array.isArray(label)) return label;
  const parts = String(label).split('\n');
  return parts.map((t, i) => ({ text: t, options: { ...o, breakLine: i < parts.length - 1 } }));
}

/* Small "• EYEBROW" pill that sits above each title */
function chip(slide, C, text, dark, x = 0.7, y = 0.5) {
  const w = 0.55 + text.length * 0.135;
  slide.addShape('roundRect', { x, y, w, h: 0.3, rectRadius: 0.15, objectName: 'Eyebrow chip',
    fill: dark ? { color: C.background1, transparency: 90 } : { color: C.background1 },
    line: dark ? { color: C.background1, transparency: 80, width: 0.75 } : { color: 'E2E8F0', width: 0.75 } });
  slide.addShape('ellipse', { x: x + 0.14, y: y + 0.105, w: 0.09, h: 0.09, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Eyebrow dot' });
  slide.addText(text.toUpperCase(), { x: x + 0.3, y, w: w - 0.34, h: 0.3, wrap: false, fontSize: 10, bold: true, charSpacing: 2.5,
    color: dark ? C.accent1 : C.text2, valign: 'middle', margin: 0, isTextBox: true, objectName: 'Eyebrow text' });
}

const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.12, blur: 14, offset: 3, angle: 90 });

/* White rounded card (light slides) */
function card(slide, C, x, y, w, h, o = {}) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: o.r ?? 0.12, objectName: o.name || 'Card',
    fill: { color: o.fill || C.background1 }, line: { color: o.line || 'E8ECF2', width: 0.75 }, shadow: o.noShadow ? undefined : shadow() });
}
/* Translucent card (dark slides) */
function glass(slide, C, x, y, w, h, o = {}) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: o.r ?? 0.12, objectName: o.name || 'Card',
    fill: { color: C.background1, transparency: o.t ?? 93 }, line: { color: C.background1, transparency: 85, width: 0.75 } });
}

/* Straight line from (x1,y1) to (x2,y2), arrowhead at the end when asked */
function link(slide, x1, y1, x2, y2, o = {}) {
  slide.addShape('line', {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH: x2 < x1, flipV: y2 < y1, objectName: o.name || 'Link',
    line: { color: o.color, width: o.width || 1.5, dashType: o.dash || 'solid', endArrowType: o.arrow ? 'triangle' : undefined },
  });
}
/* Node: circle with a label inside */
function node(slide, C, cx, cy, d, label, o = {}) {
  slide.addShape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d, objectName: o.name || `Node ${String(label).replace(/\n/g, ' ')}`,
    fill: { color: o.fill || C.background1 }, line: { color: o.line || C.text2, width: o.lw || 1.5, dashType: o.dash || 'solid' } });
  slide.addText(lines(label), { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fontSize: o.fs || 12, bold: o.bold ?? true,
    color: o.color || C.text2, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: `${o.name || 'Node'} label` });
}

/* ---- Egypt, drawn natively --------------------------------------------- */
const EGYPT = require('./egypt.json')[0];
const LON0 = 24.7, LON1 = 36.9, LAT0 = 21.99, LAT1 = 31.66;
const KX = Math.cos(27 * Math.PI / 180);           // keep the aspect true at Egypt's latitude
const egyptAspect = ((LON1 - LON0) * KX) / (LAT1 - LAT0);   // width / height

/* Returns a projector {x,y}(lon,lat) -> slide inches, fitted inside the box (bx,by,bw,bh) */
function egyptFrame(bx, by, bw, bh) {
  let w = bw, h = bw / egyptAspect;
  if (h > bh) { h = bh; w = bh * egyptAspect; }
  const ox = bx + (bw - w) / 2, oy = by + (bh - h) / 2;
  return {
    ox, oy, w, h,
    pt: (lon, lat) => ({ x: ox + (lon - LON0) / (LON1 - LON0) * w, y: oy + (LAT1 - lat) / (LAT1 - LAT0) * h }),
  };
}
function drawEgypt(slide, C, f, fill, line) {
  const pts = EGYPT.map(([lon, lat], i) => {
    const p = { x: (lon - LON0) / (LON1 - LON0) * f.w, y: (LAT1 - lat) / (LAT1 - LAT0) * f.h };
    return i === 0 ? { ...p, moveTo: true } : p;
  });
  pts.push({ close: true });
  slide.addShape('custGeom', { x: f.ox, y: f.oy, w: f.w, h: f.h, points: pts, objectName: 'Egypt outline',
    fill: { color: fill }, line: { color: line, width: 1 } });
}

async function finish(pres, file) {
  await pres.writeFile({ fileName: file });
  await applyTheme(file, THEME);
}

module.exports = { lines, THEME, W, H, px, newDeck, setTitle, chip, card, glass, link, node, shadow, egyptFrame, drawEgypt, finish, SKILL };
