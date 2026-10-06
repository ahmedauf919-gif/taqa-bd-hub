/* "One Company, Every Utility" — business development briefing, as an editable PowerPoint.
   Mirrors intro/deck.html slide for slide. Run: node intro.js <out.pptx> */
const { newDeck, setTitle, chip, card, glass, link, node, finish } = require('./common');
const path = require('path');

const SLATE = '475569', SLATE2 = '64748B', MUTE = 'A9B8D6', LINE = '94A3B8';

/* point on circle edge, moving from centre a toward b */
const edge = (a, b, r) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); return { x: a.x + dx / d * r, y: a.y + dy / d * r }; };
function spoke(slide, from, to, rf, rt, o) {
  const a = edge(from, to, rf), b = edge(to, from, rt);
  link(slide, a.x, a.y, b.x, b.y, o);
}

(async () => {
  const out = process.argv[2] || 'intro.pptx';
  const { pres, C } = newDeck('One Company, Every Utility', 'TAQA Arabia business development briefing');

  /* 1 — cover */
  let s = pres.addSlide({ masterName: 'TAQA Cover' });
  chip(s, C, 'Business Development Briefing', true, 0.7, 0.85);
  setTitle(s, C, true, [[['One Company.']], [['Every Utility.']], [['One Relationship.', true]]]);
  s.addText("Why the next client we win — or grow — shouldn't have to talk to five different people at TAQA to get gas, power and water.",
    { x: 0.7, y: 4.75, w: 6.2, h: 1.0, fontSize: 18, color: MUTE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Cover subtitle' });
  s.addText([{ text: 'Your Name', options: { color: C.accent1, bold: true } }, { text: '   ·   ', options: { color: MUTE } },
             { text: 'Your Title', options: { color: C.accent1, bold: true } }],
    { x: 0.7, y: 6.15, w: 6, h: 0.4, fontSize: 15, margin: 0, isTextBox: true, objectName: 'Presenter' });

  /* 2 — the idea */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'The Idea', false);
  setTitle(s, C, false, [[['The ultimate '], ['utility partner.', true]]]);
  s.addText([
    { text: 'Electricity. Water. Gas. Most people choose a separate provider for each — different companies, different bills, different relationships to manage.', options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: 'TAQA Arabia is built to be the one company that supplies all of it. Four divisions, one balance sheet, one brand — ', options: { color: SLATE } },
    { text: 'already', options: { bold: true, color: C.text2 } }, { text: ' the full utility partner.', options: { color: SLATE } },
  ], { x: 0.7, y: 2.55, w: 5.9, h: 3.2, fontSize: 18, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Body copy' });
  card(s, C, 7.2, 1.85, 5.45, 4.75);
  {
    const hub = { x: 9.92, y: 3.95 }, R = 0.55, r = 0.42;
    const pts = [{ l: 'Gas', x: hub.x - 1.85, y: hub.y - 1.25 }, { l: 'Power', x: hub.x + 1.85, y: hub.y - 1.25 },
                 { l: 'Water', x: hub.x - 1.85, y: hub.y + 1.25 }, { l: 'Petro-\nleum', x: hub.x + 1.85, y: hub.y + 1.25 }];
    pts.forEach((p) => {
      spoke(s, p, hub, r, R, { color: C.accent1, width: 1.75, arrow: true, name: `Supplies ${p.l.replace('\n', '')}` });
      s.addText('supplies', { x: (p.x + hub.x) / 2 - 0.4, y: (p.y + hub.y) / 2 - 0.12, w: 0.8, h: 0.24, fontSize: 10, color: LINE, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Link label',
        fill: { color: C.background1 } });
    });
    pts.forEach((p) => node(s, C, p.x, p.y, r * 2, p.l, { fs: 13 }));
    node(s, C, hub.x, hub.y, R * 2, [{ text: 'TAQA', options: { color: C.background1, fontSize: 15, breakLine: true } }, { text: 'client', options: { color: C.accent1, fontSize: 12, bold: false } }], { fill: C.text2, line: C.text2, name: 'Hub' });
    s.addText('What TAQA Arabia already is: one company, four utilities.', { x: 7.4, y: 5.95, w: 5.05, h: 0.4, fontSize: 12, italic: true, color: LINE, align: 'center', margin: 0, isTextBox: true, objectName: 'Diagram caption' });
  }

  /* 3 — the problem */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'The Problem', false);
  setTitle(s, C, false, [[['The unified approach.']]]);
  s.addText([
    { text: "In practice, one client gets approached by TAQA's divisions separately — a gas rep, a power rep, a water rep, none of them coordinated.", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Sometimes 5 or 6 different people from the same company, each pitching one service. ', options: {} },
    { text: 'None of them tell the client the full story.', options: { bold: true, color: C.text2 } },
  ], { x: 0.7, y: 2.55, w: 5.9, h: 3.2, fontSize: 18, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Body copy' });
  card(s, C, 7.2, 1.85, 5.45, 4.75);
  {
    const hub = { x: 9.92, y: 3.95 }, R = 0.55, r = 0.42;
    const pts = [{ l: 'Gas\nrep', x: hub.x - 1.85, y: hub.y - 1.25 }, { l: 'Power\nrep', x: hub.x + 1.85, y: hub.y - 1.25 },
                 { l: 'Water\nrep', x: hub.x - 1.85, y: hub.y + 1.25 }, { l: 'Petrol.\nrep', x: hub.x + 1.85, y: hub.y + 1.25 }];
    pts.forEach((p) => spoke(s, p, hub, r, R, { color: LINE, width: 1.25, dash: 'dash', name: 'Disconnected rep' }));
    pts.forEach((p) => node(s, C, p.x, p.y, r * 2, p.l, { fs: 11, fill: 'F1F5F9', line: 'CBD5E1', color: SLATE2, bold: false }));
    node(s, C, hub.x, hub.y, R * 2, [{ text: 'Client', options: { fontSize: 14, bold: true, color: C.text2, breakLine: true } }, { text: '4 open bills', options: { fontSize: 10, bold: false, color: SLATE2 } }],
      { fill: C.background1, line: LINE, dash: 'dash', name: 'Client' });
    s.addText('No line connects the four reps — because today, nothing does.', { x: 7.4, y: 5.95, w: 5.05, h: 0.4, fontSize: 12, italic: true, color: LINE, align: 'center', margin: 0, isTextBox: true, objectName: 'Diagram caption' });
  }

  /* 4 — the evidence */
  s = pres.addSlide({ masterName: 'TAQA Dark' });
  chip(s, C, 'The Evidence', true);
  setTitle(s, C, true, [[['Every dot is a client']], [['we already serve.']]]);
  s.addText([{ text: "1,366 real named accounts, cross-checked one by one against TAQA's own records.", options: { breakLine: true, color: MUTE } },
             { text: 'Exactly one sits on more than a single service.', options: { bold: true, color: C.background1 } }],
    { x: 0.7, y: 2.4, w: 11, h: 0.8, fontSize: 17, valign: 'top', margin: 0, isTextBox: true, objectName: 'Evidence copy' });
  s.addImage({ path: path.join(__dirname, 'intro-dots.png'), x: 0.79, y: 3.7, w: 11.7, h: 2.395, altText: '1,366 dots, one per client; a single gold dot marks the one multi-service account', objectName: 'Client dot matrix' });
  s.addShape('ellipse', { x: 0.79, y: 6.42, w: 0.12, h: 0.12, fill: { color: LINE }, line: { type: 'none' }, objectName: 'Legend dot single' });
  s.addText('Single-service account', { x: 1.0, y: 6.34, w: 3, h: 0.28, fontSize: 12, color: LINE, valign: 'middle', margin: 0, isTextBox: true });
  s.addShape('ellipse', { x: 3.65, y: 6.42, w: 0.12, h: 0.12, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Legend dot multi' });
  s.addText('Multi-service account — the entire opportunity', { x: 3.86, y: 6.34, w: 6, h: 0.28, fontSize: 12, color: LINE, valign: 'middle', margin: 0, isTextBox: true });

  /* 5 — the opportunity */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'The Opportunity', false);
  setTitle(s, C, false, [[['Every existing client is']], [['a door to three more.']]]);
  const doors = [
    ['Already on Gas', 'Factory on natural gas', 'no solar yet', 'Solar at below-grid pricing, financed and owned by TAQA — zero capex, rate locked in for decades.'],
    ['Running on Diesel', 'Site on diesel gensets', 'already has solar', 'Mobile CNG or piped gas cuts diesel dependence directly — often the fastest payback in the portfolio.'],
    ['Single Service', 'Resort on water only', 'growing footprint', "Add electricity distribution and solar — one owner for the whole site's reliability story."],
  ];
  doors.forEach(([tag, head, arrow, body], i) => {
    const x = 0.75 + i * 4.02, y = 2.65, w = 3.8, h = 3.55;
    card(s, C, x, y, w, h, { name: `Card ${i + 1}` });
    const pw = 0.5 + tag.length * 0.092;
    s.addShape('roundRect', { x: x + 0.3, y: y + 0.35, w: pw, h: 0.3, rectRadius: 0.15, fill: { color: C.text2 }, line: { type: 'none' }, objectName: 'Tag pill' });
    s.addText(tag.toUpperCase(), { x: x + 0.3, y: y + 0.35, w: pw, h: 0.3, fontSize: 9, bold: true, charSpacing: 1.5, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Tag text' });
    s.addText(head, { x: x + 0.3, y: y + 0.85, w: w - 0.6, h: 0.45, fontSize: 18, bold: true, color: C.text2, valign: 'top', margin: 0, isTextBox: true, objectName: 'Card heading' });
    s.addText('→  ' + arrow, { x: x + 0.3, y: y + 1.35, w: w - 0.6, h: 0.35, fontSize: 14, bold: true, color: C.accent2, valign: 'top', margin: 0, isTextBox: true, objectName: 'Card cue' });
    s.addText(body, { x: x + 0.3, y: y + 1.95, w: w - 0.6, h: 1.8, fontSize: 14, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Card body' });
  });

  /* 6 — beyond existing clients */
  s = pres.addSlide({ masterName: 'TAQA Dark' });
  chip(s, C, 'Beyond Existing Clients', true);
  setTitle(s, C, true, [[['New prospects get the']], [['whole picture, '], ['not a slice.', true]]]);
  const pts6 = [
    ['Today a brand-new company hears from five TAQA divisions over months — separately.', 'No one tells them the full story until, if ever, someone connects the dots.'],
    ['Instead: one meeting, one proposal — gas, power and water laid out together from day one.', 'One decision for them to make, instead of five.'],
    ['No single-service competitor can make this pitch.', "It's a structural advantage only TAQA Arabia has."],
  ];
  pts6.forEach(([main, sub], i) => {
    const y = 2.85 + i * 1.3;
    s.addShape('diamond', { x: 0.75, y: y + 0.07, w: 0.17, h: 0.17, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Bullet' });
    s.addText([{ text: main, options: { breakLine: true, color: C.background1, fontSize: 16 } }, { text: sub, options: { color: LINE, fontSize: 12 } }],
      { x: 1.1, y, w: 5.9, h: 1.1, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 4, objectName: `Point ${i + 1}` });
  });
  glass(s, C, 7.35, 3.0, 5.3, 3.5, { name: 'Comparison panel' });
  s.addText('THE OLD WAY', { x: 7.35, y: 3.3, w: 5.3, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: LINE, align: 'center', margin: 0, isTextBox: true });
  s.addText('5 meetings', { x: 7.35, y: 3.65, w: 5.3, h: 0.7, fontSize: 32, bold: true, color: LINE, strike: 'sngStrike', align: 'center', margin: 0, isTextBox: true, objectName: 'Old way' });
  s.addText('↓', { x: 7.35, y: 4.4, w: 5.3, h: 0.45, fontSize: 24, bold: true, color: C.accent1, align: 'center', margin: 0, isTextBox: true });
  s.addText('THE TAQA WAY', { x: 7.35, y: 4.95, w: 5.3, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: C.accent1, align: 'center', margin: 0, isTextBox: true });
  s.addText('1 meeting', { x: 7.35, y: 5.3, w: 5.3, h: 0.95, fontSize: 48, bold: true, color: C.accent1, align: 'center', margin: 0, isTextBox: true, objectName: 'TAQA way' });

  /* 7 — client experience */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'The Client Experience', false);
  setTitle(s, C, false, [[['One SLA. One contact.']], [['Every service.']]]);
  s.addText([
    { text: "Instead of juggling ten or twenty relationships across TAQA's divisions, the client gets one account owner who orchestrates all of it.", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Simpler for them. ' }, { text: 'Stickier for us', options: { bold: true, color: C.text2 } }, { text: ' — every additional service raises the cost of ever leaving.' },
  ], { x: 0.7, y: 3.05, w: 5.9, h: 3.0, fontSize: 18, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Body copy' });
  card(s, C, 7.2, 2.2, 5.45, 4.4);
  {
    const cl = { x: 8.0, y: 4.2 }, ow = { x: 9.6, y: 4.2 };
    const out = [{ l: 'Gas', x: 11.6, y: 3.0 }, { l: 'Power', x: 11.6, y: 4.2 }, { l: 'Water', x: 11.6, y: 5.4 }];
    spoke(s, cl, ow, 0.4, 0.55, { color: LINE, width: 1.5, name: 'Client to owner' });
    out.forEach((p) => spoke(s, ow, p, 0.55, 0.38, { color: C.accent1, width: 1.75, arrow: true, name: `Owner to ${p.l}` }));
    node(s, C, cl.x, cl.y, 0.8, 'Client', { fs: 11 });
    node(s, C, ow.x, ow.y, 1.1, [{ text: 'Account', options: { color: C.accent1, fontSize: 11, breakLine: true } }, { text: 'Owner', options: { color: C.accent1, fontSize: 11 } }], { fill: C.text2, line: C.text2, name: 'Account owner' });
    out.forEach((p) => node(s, C, p.x, p.y, 0.76, p.l, { fs: 11 }));
    s.addText('One coordinating relationship — not four competing ones.', { x: 7.4, y: 6.0, w: 5.05, h: 0.4, fontSize: 12, italic: true, color: LINE, align: 'center', margin: 0, isTextBox: true, objectName: 'Diagram caption' });
  }

  /* 8 — loyalty compounds */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, "Why It's Worth Doing", false);
  setTitle(s, C, false, [[['Loyalty compounds']], [['into '], ['pricing power.', true]]]);
  const pts8 = [
    ['More services on one account means a deeper relationship — harder for a single-service competitor to displace.', null],
    ['A deeper relationship earns room to offer advantaged tariffs and bundled pricing.', "Pricing a single-service vendor structurally can't match."],
    ['Better pricing makes the next service easier to sell in — the loop reinforces itself.', null],
  ];
  pts8.forEach(([main, sub], i) => {
    const y = 2.85 + i * 1.3;
    s.addShape('diamond', { x: 0.75, y: y + 0.07, w: 0.17, h: 0.17, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Bullet' });
    const runs = [{ text: main, options: { color: C.text1, fontSize: 16, breakLine: !!sub } }];
    if (sub) runs.push({ text: sub, options: { color: SLATE2, fontSize: 12 } });
    s.addText(runs, { x: 1.1, y, w: 5.5, h: 1.1, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 4, objectName: `Point ${i + 1}` });
  });
  card(s, C, 7.2, 2.2, 5.45, 4.4);
  {
    const c = { x: 9.92, y: 4.4 }, Rr = 1.4;
    const ring = [{ l: 'More\nservices', a: -90, f: C.text2, col: C.accent1 }, { l: 'Deeper\nrelationship', a: 0 },
                  { l: 'Pricing\npower', a: 90 }, { l: 'Easier\nupsell', a: 180 }].map((n) => ({ ...n,
      x: c.x + Rr * 1.12 * Math.cos(n.a * Math.PI / 180), y: c.y + Rr * Math.sin(n.a * Math.PI / 180) }));
    ring.forEach((n, i) => { const m = ring[(i + 1) % 4]; spoke(s, n, m, 0.62, 0.62, { color: C.accent1, width: 1.75, arrow: true, name: `Loop ${i + 1}` }); });
    ring.forEach((n) => node(s, C, n.x, n.y, 1.2, n.l, { fs: 10.5, fill: n.f, color: n.col, line: C.text2, name: `Loop ${n.l.replace('\n', ' ')}` }));
  }

  /* 9 — the tooling already exists */
  s = pres.addSlide({ masterName: 'TAQA Light' });
  chip(s, C, 'Not A Someday Idea', false);
  setTitle(s, C, false, [[['The tooling already exists.']]]);
  const tools = [
    ['TAQA Analytics Dashboard', 'Every account, sector and current service — searchable and filterable, live.'],
    ['Outreach Opportunities', 'Each account already paired with the solution most likely to fit, and why.'],
    ['A unified going-forward approach', 'One account owner, one proposal — every division represented in a single conversation.'],
    ['Client presentation decks', 'Sector by sector, fully narrated, ready to send or present as-is.'],
  ];
  tools.forEach(([h, b], i) => {
    const x = 0.75 + (i % 2) * 6.05, y = 2.5 + Math.floor(i / 2) * 1.95;
    card(s, C, x, y, 5.85, 1.7, { name: `Tool ${i + 1}` });
    s.addText(h, { x: x + 0.35, y: y + 0.28, w: 5.15, h: 0.4, fontSize: 18, bold: true, color: C.text2, valign: 'top', margin: 0, isTextBox: true, objectName: 'Tool title' });
    s.addText(b, { x: x + 0.35, y: y + 0.78, w: 5.15, h: 0.75, fontSize: 14, color: SLATE, valign: 'top', margin: 0, isTextBox: true, objectName: 'Tool body' });
  });

  /* 10 — close */
  s = pres.addSlide({ masterName: 'TAQA Cover' });
  chip(s, C, 'Next · 15 Minutes, Live', true, 0.7, 0.85);
  setTitle(s, C, true, [[["Let's go "], ['look at it.', true]]]);
  [['The client presentation decks', 'Sector by sector — narrated, animated, ready to send today.'],
   ['The TAQA Analytics dashboard', 'Live and searchable — your own accounts, in the room, today.']].forEach(([h, b], i) => {
    const x = 0.7 + i * 6.2;
    glass(s, C, x, 3.75, 5.95, 1.65, { name: `Next ${i + 1}` });
    s.addText(h, { x: x + 0.35, y: 4.05, w: 5.25, h: 0.4, fontSize: 18, bold: true, color: C.accent1, margin: 0, valign: 'top', isTextBox: true, objectName: 'Next title' });
    s.addText(b, { x: x + 0.35, y: 4.55, w: 5.25, h: 0.7, fontSize: 14, color: MUTE, margin: 0, valign: 'top', isTextBox: true, objectName: 'Next body' });
  });

  await finish(pres, out);
  console.log('wrote', out);
})();
