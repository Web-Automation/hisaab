/* ==========================================================================
   app.js: UI only. Data comes from data.js (sample now, real inputs later),
   rules come from config.js, calculations come from tax.js.
   No build step and no dependencies: plain scripts that work on GitHub Pages.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.CONFIG, U = window.U, TAX = window.TAX, D = window.DATA;
  const HEADS = C.heads, E = D.entries;
  const TODAY_S = D.today, TODAY = U.parse(TODAY_S);
  const FY_START = U.fyStart(TODAY, C.fyStartMonth), FY_S = U.ymd(FY_START);
  const FY_END = new Date(FY_START.getFullYear() + 1, FY_START.getMonth(), 0);
  const DED = {}; C.tax.deductionHeads.forEach(h => { DED[h.id] = h; });
  const $ = (s, r) => (r || document).querySelector(s);

  /* ------------------------------------------------------------------ state */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('hisaab.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hisaab.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    clear() { try { Object.keys(localStorage).filter(k => k.indexOf('hisaab.') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ } }
  };
  const state = {
    period: store.get('period', 'FY'),
    theme: store.get('theme', (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'),
    mask: store.get('mask', false),
    userGoals: store.get('goals', []),
    regime: null, group: 'instrument', filter: null, keepFilter: false, first: true
  };
  if (['M', 'Q', 'FY'].indexOf(state.period) < 0) state.period = 'FY';
  let TM = null;                                   // memoised tax model, reset every render
  const tm = () => TM || (TM = taxModel());

  /* ------------------------------------------------------------------ icons */
  const ICON = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    inbox: '<path d="M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13"/><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-4.5a2.5 2.5 0 0 1-5 0H4z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.7C3.9 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const ic = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  /* ------------------------------------------------------- small components */
  const esc = U.esc;
  const amt = (n, compact) => `<span class="amt">${compact ? U.inrC(n) : U.inr(n)}</span>`;
  const catName = e => (HEADS[e.head] && HEADS[e.head].cats && HEADS[e.head].cats[e.cat]) || e.cat;
  // Colour for the i-th of n categories inside one head: lightness spread from dark to light, plus a small hue drift
  const ramp = (hue, i, n) => { const f = (n && n > 1 ? i / (n - 1) : 0).toFixed(3);
    return `hsl(calc(var(--hue-${hue}) + ${Math.round(i * Math.min(9, 45 / Math.max(1, (n || 2) - 1)))}) var(--sat-${hue}) calc(var(--rl0) + ${f} * (var(--rl1) - var(--rl0))))`; };
  const plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));

  function delta(cur, prev, good, vs) {
    if (!prev) return '<span class="delta flat">No earlier data</span>';
    const d = (cur - prev) / Math.abs(prev), up = d > 0.005, down = d < -0.005;
    const kind = !up && !down ? 'flat' : good === 'neutral' ? 'flat' : (good === 'up' ? (up ? 'good' : 'bad') : (down ? 'good' : 'bad'));
    const arrow = up ? '▲' : down ? '▼' : '●';
    const txt = up || down ? (up ? '+' : '−') + Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + '%' : 'No change';
    return `<span class="delta ${kind}"><span aria-hidden="true">${arrow}</span><span class="sr">${up ? 'Up' : down ? 'Down' : ''}</span> ${txt} <span class="delta-vs">${vs}</span></span>`;
  }

  function spark(vals, w, h) {
    w = w || 120; h = h || 36;
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    const pts = vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 10)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}L${w} ${h}L0 ${h}Z" class="spark-a"/><path d="${line}" class="spark-l"/></svg>`;
  }

  function chip(kind, text, icon) { return `<span class="chip ${kind}">${icon ? ic(icon) : ''}${text}</span>`; }

  function pbar(frac, o) {
    o = o || {};
    const w = Math.max(0, Math.min(1, frac)) * 100;
    const extra = o.ghost != null ? `<i class="ghost" style="width:${Math.max(0, Math.min(1, o.ghost)) * 100}%"></i>` : '';
    const tick = o.pace != null ? `<b class="tick" style="left:${Math.min(1, o.pace) * 100}%" title="Where you would be if progress were even"></b>` : '';
    return `<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(w)}" aria-label="${esc(o.label || 'Progress')}">${extra}<i style="width:${w}%"></i>${tick}</div>`;
  }

  /* ----------------------------------------------------------------- charts */
  // Axis top such that four equal steps are round numbers (e.g. 15,000 / 30,000 / 45,000 / 60,000)
  function niceMax(v) {
    if (v <= 0) return 4;
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return step * p * 4;
  }
  const tipRow = (color, name, v) => `<div class="tip-r"><span>${color ? `<i style="background:${color}"></i>` : ''}${esc(name)}</span><b class="amt">${U.inr(v)}</b></div>`;

  function barChart(o) {
    const W = 680, H = o.h || 250, pl = 48, pr = 8, pt = 10, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    const keys = o.keys, stack = o.mode !== 'group';
    const totals = keys.map((k, i) => stack ? o.series.reduce((t, s) => t + (o.data[s.id][i] || 0), 0) : Math.max.apply(null, o.series.map(s => o.data[s.id][i] || 0)));
    const max = niceMax(Math.max.apply(null, totals.concat([1])));
    const step = iw / keys.length, y = v => pt + ih - (v / max) * ih;
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = max * t / 4;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${pl - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="axis amt">${U.inrC(v)}</text>`;
    }
    keys.forEach((k, i) => {
      const x0 = pl + step * i;
      if (stack) {
        const bw = Math.min(36, step * 0.64); let acc = 0;
        o.series.forEach(s => {
          const v = o.data[s.id][i] || 0; if (v <= 0) return;
          const y1 = y(acc + v), y0 = y(acc);
          g += `<rect x="${(x0 + (step - bw) / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" style="fill:${s.color}"/>`;
          acc += v;
        });
      } else {
        const n = o.series.length, bw = Math.min(17, step * 0.34), gap = 2, tw = n * bw + (n - 1) * gap, sx = x0 + (step - tw) / 2;
        o.series.forEach((s, j) => {
          const v = o.data[s.id][i] || 0, y1 = y(v);
          g += `<rect x="${(sx + j * (bw + gap)).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y(0) - y1).toFixed(1)}" rx="2" style="fill:${s.color}"/>`;
        });
      }
      g += `<text x="${(x0 + step / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis">${U.monLabel(k)}</text>`;
      let tip = `<div class="tip-h">${U.monLabelY(k)}</div>` + o.series.filter(s => (o.data[s.id][i] || 0) > 0).slice().reverse().map(s => tipRow(s.color, s.name, o.data[s.id][i])).join('');
      if (stack && o.series.length > 1) tip += `<div class="tip-r tip-t"><span>Total</span><b class="amt">${U.inr(totals[i])}</b></div>`;
      if (o.tipExtra) tip += o.tipExtra(i);
      g += `<rect class="hit" x="${x0.toFixed(1)}" y="${pt}" width="${step.toFixed(1)}" height="${ih}" data-tip="${esc(tip)}"/>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">${g}</svg>`;
  }

  function lineChart(o) {
    const W = 680, H = o.h || 250, pl = 56, pr = 12, pt = 12, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    const min = Math.min.apply(null, o.values), max = Math.max.apply(null, o.values);
    const lo = min - (max - min) * 0.25, hi = max + (max - min) * 0.1, span = (hi - lo) || 1;
    const x = i => pl + (i / Math.max(1, o.values.length - 1)) * iw, y = v => pt + ih - ((v - lo) / span) * ih;
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = lo + span * t / 4;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${pl - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="axis amt">${U.inrC(v)}</text>`;
    }
    const path = o.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    g += `<path d="${path}L${x(o.values.length - 1).toFixed(1)} ${pt + ih}L${pl} ${pt + ih}Z" class="line-a" style="fill:${o.color}"/><path d="${path}" class="line-l" style="stroke:${o.color}"/>`;
    const step = iw / Math.max(1, o.values.length - 1);
    o.keys.forEach((k, i) => {
      if (i % 2 === (o.keys.length - 1) % 2) g += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis">${U.monLabel(k)}</text>`;
      const chg = i ? o.values[i] - o.values[i - 1] : 0;
      const tip = `<div class="tip-h">${U.monLabelY(k)}</div>${tipRow(o.color, o.name, o.values[i])}` + (i ? `<div class="tip-r"><span>Change from previous month</span><b class="amt">${(chg < 0 ? '−' : '+') + U.inr(Math.abs(chg))}</b></div>` : '');
      g += `<rect class="hit" x="${(x(i) - step / 2).toFixed(1)}" y="${pt}" width="${step.toFixed(1)}" height="${ih}" data-tip="${esc(tip)}"/>`;
    });
    const L = o.values.length - 1;
    g += `<circle cx="${x(L).toFixed(1)}" cy="${y(o.values[L]).toFixed(1)}" r="4.5" class="line-dot" style="fill:${o.color}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">${g}</svg>`;
  }

  function waterfall(title, rows) {
    let run = 0;
    const pts = rows.map(r => {
      let from, to;
      if (r.total) { from = 0; to = r.value; run = r.value; } else { from = run; to = run + r.value; run = to; }
      return Object.assign({}, r, { from, to });
    });
    const vals = pts.reduce((a, p) => a.concat([p.from, p.to]), [0]);
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = (hi - lo) || 1, pos = v => ((v - lo) / span) * 100;
    return `<div class="wf"><h3>${title}</h3>${pts.map(p => {
      const a = pos(Math.min(p.from, p.to)), w = Math.max(0.8, pos(Math.max(p.from, p.to)) - a);
      const val = p.total || Math.round(p.value) === 0 ? U.inr(p.value) : (p.value < 0 ? '−' : '+') + U.inr(Math.abs(p.value));
      return `<div class="wf-row${p.total ? ' total' : ''}"><span class="wf-l">${p.label}</span><span class="wf-track">${lo < 0 ? `<b class="wf-zero" style="left:${pos(0).toFixed(1)}%"></b>` : ''}<i class="wf-bar ${p.tone || ''}" style="left:${a.toFixed(1)}%;width:${w.toFixed(1)}%"></i></span><span class="wf-v amt">${val}</span></div>`;
    }).join('')}</div>`;
  }

  /* ------------------------------------------------------------------ model */
  function rangeFor(p) {
    let s, ps, pe, name, vs;
    if (p === 'M') { s = U.som(TODAY); ps = U.addMonths(s, -1); pe = U.addMonths(TODAY, -1); name = 'this month'; vs = 'vs last month'; }
    else if (p === 'Q') {
      const into = (TODAY.getFullYear() - FY_START.getFullYear()) * 12 + TODAY.getMonth() - FY_START.getMonth();
      s = U.addMonths(FY_START, 3 * Math.floor(into / 3)); ps = U.addMonths(s, -3); pe = U.addMonths(TODAY, -3); name = 'this quarter'; vs = 'vs last quarter';
    } else { s = FY_START; ps = U.addMonths(s, -12); pe = U.addMonths(TODAY, -12); name = 'this year so far'; vs = 'vs last year'; }
    const R = { key: p, start: U.ymd(s), end: TODAY_S, pStart: U.ymd(ps), pEnd: U.ymd(pe), name, vs };
    R.label = U.fmtRange(R.start, R.end); R.pLabel = U.fmtRange(R.pStart, R.pEnd);
    return R;
  }
  function sum(head, s, en, pred) {
    let t = 0;
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (e.head === head && e.date >= s && e.date <= en && (!pred || pred(e))) t += e.amount; }
    return t;
  }
  function monthKeys(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(U.monthKey(U.addMonths(U.som(TODAY), -i))); return out; }
  function monthly(head, pred, keys) {
    const m = {}; keys.forEach(k => { m[k] = 0; });
    E.forEach(e => { if (e.head !== head) return; const k = e.date.slice(0, 7); if (k in m && (!pred || pred(e))) m[k] += e.amount; });
    return keys.map(k => m[k]);
  }
  function flows(s, en) {
    const income = sum('income', s, en), tax = sum('tax', s, en), spend = sum('spend', s, en), emi = sum('emi', s, en), invest = sum('invest', s, en);
    const saved = income - tax - spend - emi;
    return { income, tax, spend, emi, invest, saved, kept: saved - invest, rate: income > 0 ? saved / income : 0 };
  }
  function entriesFor(head, R, pred) {
    return E.filter(e => e.head === head && e.date >= R.start && e.date <= R.end && (!pred || pred(e)))
      .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
  }

  /* Tax model: projects the full financial year from what has happened so far */
  function taxModel() {
    const fyE = E.filter(x => x.date >= FY_S && x.date <= TODAY_S);
    const elapsed = Math.max(0.5, U.daysBetween(FY_START, TODAY) / (365 / 12));
    function project(list, val, policy) {
      const actual = list.reduce((t, x) => t + val(x), 0), groups = {};
      list.forEach(x => { if (x.series) (groups[x.series] = groups[x.series] || []).push(x); });
      let add = 0;
      Object.keys(groups).forEach(k => { const a = groups[k]; add += Math.max(0, 12 - a.length) * val(a[a.length - 1]); });
      if (policy === 'runrate') add += list.filter(x => !x.series).reduce((t, x) => t + val(x), 0) * (12 / elapsed - 1);
      return { actual, projected: actual + add };
    }
    const inc = {};
    Object.keys(HEADS.income.cats).forEach(c => { inc[c] = project(fyE.filter(x => x.head === 'income' && x.cat === c), x => x.amount, C.tax.projection[c]); });
    const cgList = fyE.filter(x => x.head === 'income' && x.cat === 'capital');
    const stcg = cgList.filter(x => x.cg && x.cg.term === 'short').reduce((t, x) => t + x.amount, 0);
    const ltcg = cgList.filter(x => x.cg && x.cg.term === 'long').reduce((t, x) => t + x.amount, 0);
    const rentG = inc.rental.projected;
    const inp = { salary: inc.salary.projected, houseProperty: rentG * (1 - C.tax.houseProperty.standardDeductionPct), business: inc.business.projected,
                  foreign: inc.foreign.projected, other: inc.other.projected, stcgEquity: stcg, ltcgEquity: ltcg, deductions: {}, profile: D.profile };
    const ded = C.tax.deductionHeads.map(h => {
      const list = fyE.filter(x => x.ded && x.ded.some(d => d.id === h.id)), val = x => x.ded.find(d => d.id === h.id).amt;
      const p = project(list, val, null);
      inp.deductions[h.id] = p.projected;
      return Object.assign({}, h, { limit: TAX.limitFor(h, D.profile), claimed: p.actual, projected: p.projected, entries: list, val });
    });
    const cmp = TAX.compare(inp), key = state.regime || cmp.best, res = cmp[key];
    const tds = project(fyE.filter(x => x.head === 'tax' && x.cat === 'tds'), x => x.amount, null);
    const advList = fyE.filter(x => x.head === 'tax' && x.cat === 'advance');
    const advPaid = advList.reduce((t, x) => t + x.amount, 0);
    const gross = inp.salary + rentG + inp.business + inp.foreign + inp.other + stcg + ltcg;
    const full = {}; ded.forEach(d => { full[d.id] = d.limit == null ? d.projected : d.limit; });
    const oldNoDed = TAX.computeRegime('old', Object.assign({}, inp, { deductions: {} })).total;
    const oldFull = TAX.computeRegime('old', Object.assign({}, inp, { deductions: full })).total;
    const capped = ded.filter(d => d.limit != null);
    return {
      inc, inp, ded, cmp, key, res, tds, advList, advPaid, gross, rentG, rentStd: rentG - inp.houseProperty, stcg, ltcg, cg: stcg + ltcg,
      balance: res.total - tds.projected - advPaid,
      adv: TAX.advanceSchedule(Math.max(0, res.total - tds.projected), FY_START.getFullYear(), advList, TODAY_S),
      savedByClaims: oldNoDed - cmp.old.total, potentialMore: Math.max(0, cmp.old.total - oldFull),
      dedUsed: capped.reduce((t, d) => t + Math.min(d.projected, d.limit), 0),
      dedSoFar: capped.reduce((t, d) => t + Math.min(d.claimed, d.limit), 0),
      dedLimit: capped.reduce((t, d) => t + d.limit, 0),
      marg: TAX.marginalRate('old', cmp.old.taxable), daysLeft: U.daysBetween(TODAY, FY_END)
    };
  }

  /* ------------------------------------------------------------------ goals */
  const allGoals = () => D.goals.concat(state.userGoals);
  function goalWindow(g) {
    if (g.period === 'month') {
      const dim = U.daysIn(TODAY.getFullYear(), TODAY.getMonth() + 1);
      return { s: U.ymd(U.som(TODAY)), e: TODAY_S, elapsed: TODAY.getDate() / dim, left: dim - TODAY.getDate() };
    }
    const total = U.daysBetween(FY_START, FY_END) + 1;
    return { s: FY_S, e: TODAY_S, elapsed: (U.daysBetween(FY_START, TODAY) + 1) / total, left: U.daysBetween(TODAY, FY_END) };
  }
  function evalGoal(g) {
    const w = goalWindow(g), m = n => amt(n);
    let cur, r;
    if (g.type === 'spend-cap') {
      cur = sum('spend', w.s, w.e, g.cat ? e => e.cat === g.cat : null);
      const proj = w.elapsed > 0.12 ? cur / w.elapsed : cur;
      const st = cur > g.target ? 'bad' : proj > g.target ? 'warn' : 'good';
      r = { status: st, text: st === 'bad' ? 'Over budget' : st === 'warn' ? 'Spending fast' : 'On track', frac: cur / g.target, pace: w.elapsed,
            curText: m(cur), targetText: m(g.target), note: cur > g.target ? `${m(cur - g.target)} over` : `${m(g.target - cur)} left, ${plural(w.left, 'day')} to go` };
    } else if (g.type === 'invest-target') {
      cur = sum('invest', w.s, w.e);
      const gap = g.target * w.elapsed - cur, done = cur >= g.target;
      const st = done ? 'done' : gap <= g.target * 0.03 ? 'good' : gap <= g.target * 0.2 ? 'warn' : 'bad';
      r = { status: st, text: done ? 'Goal met' : st === 'good' ? 'On track' : st === 'warn' ? 'Slightly behind' : 'Behind', frac: cur / g.target, pace: w.elapsed,
            curText: m(cur), targetText: m(g.target), note: done ? 'Target reached' : `${m(g.target - cur)} to go, ${plural(w.left, 'day')} left` };
    } else if (g.type === 'deduction-target') {
      const d = tm().ded.find(x => x.id === g.ded) || { claimed: 0, projected: 0 };
      cur = d.claimed;
      const st = cur >= g.target ? 'done' : d.projected >= g.target ? 'good' : 'warn';
      r = { status: st, text: st === 'done' ? 'Goal met' : st === 'good' ? 'On track' : 'Needs a top-up', frac: cur / g.target, pace: w.elapsed, ghost: d.projected / g.target,
            curText: m(cur), targetText: m(g.target),
            note: st === 'warn' ? `${m(g.target - d.projected)} short by 31 Mar` : `${m(d.projected)} expected by 31 Mar` };
    } else if (g.type === 'savings-rate') {
      const f = flows(w.s, w.e); cur = f.rate;
      const st = cur >= g.target ? 'good' : cur >= g.target * 0.85 ? 'warn' : 'bad';
      r = { status: st, text: st === 'good' ? 'On track' : 'Below target', frac: cur / g.target, pace: null, curText: U.pct(cur), targetText: U.pct(g.target),
            note: `${U.pct(Math.max(0, cur - g.target))} ${cur >= g.target ? 'above' : 'below'} target` };
      if (cur < g.target) r.note = `${U.pct(g.target - cur)} below target`;
    } else {
      cur = (D.holdings.find(h => h.cls === 'cash') || { value: 0 }).value;
      const done = cur >= g.target, f = cur / g.target;
      r = { status: done ? 'done' : f >= 0.5 ? 'good' : 'warn', text: done ? 'Goal met' : f >= 0.5 ? 'Building steadily' : 'Just started', frac: f, pace: null,
            curText: m(cur), targetText: m(g.target), note: done ? 'Fully funded' : `${m(g.target - cur)} to go` };
    }
    return r;
  }
  const STATUS_ICON = { good: 'check', done: 'check', warn: 'alert', bad: 'alert' };
  const statusChip = ev => chip(ev.status, ev.text, STATUS_ICON[ev.status]);
  function goalCard(g) {
    const ev = evalGoal(g);
    return `<li class="goal ${ev.status}"><div class="goal-top"><span class="goal-name">${esc(g.name)}</span>${statusChip(ev)}</div>${pbar(ev.frac, { pace: ev.pace, ghost: ev.ghost, label: g.name })}<div class="goal-meta"><span>${ev.curText} of ${ev.targetText}</span><span>${ev.note}</span></div></li>`;
  }

  /* ------------------------------------------------------------ alerts list */
  function alerts() {
    const a = [], T = tm();
    const cc = D.liabilities.find(l => l.id === 'cc');
    if (cc && cc.dueDate) {
      const d = U.daysBetween(TODAY, U.parse(cc.dueDate));
      if (d >= 0 && d <= 10) a.push({ tone: 'warn', icon: 'clock', href: '#/overview/liab', text: `Credit card bill of ${amt(cc.outstanding)} is due ${d === 0 ? 'today' : 'in ' + plural(d, 'day')}.` });
    }
    const unc = E.filter(e => e.cat === 'uncat' && e.date >= FY_S).length;
    if (unc) a.push({ tone: 'warn', icon: 'alert', href: '#/overview/spend', pre: 'uncat', text: `${plural(unc, 'entry', 'entries')} without a category. Sort them to keep your totals accurate.` });
    allGoals().map(g => ({ g, ev: evalGoal(g) })).filter(x => x.ev.status === 'warn' || x.ev.status === 'bad').slice(0, 2)
      .forEach(x => a.push({ tone: x.ev.status, icon: 'target', href: '#/goals', text: `${esc(x.g.name)}: ${x.ev.text.toLowerCase()}.` }));
    const next = T.adv.items.find(i => i.next);
    if (next && T.adv.required) a.push({ tone: 'info', icon: 'clock', href: '#/tax', text: next.gap > 0 ? `Advance tax due ${U.shortDate(next.due)}. Add about ${amt(next.gap)} to stay on schedule.` : `Advance tax due ${U.shortDate(next.due)}. You are ahead of schedule.` });
    return a.slice(0, 4);
  }

  /* ----------------------------------------------------------------- shell */
  function parseRoute() {
    const h = (location.hash || '#/overview').replace(/^#\/?/, '').split('/');
    const page = ['overview', 'tax', 'goals', 'sources', 'settings'].indexOf(h[0]) >= 0 ? h[0] : 'overview';
    return { page, sub: h[1] || null };
  }

  function shell(route, page) {
    const isOv = route.page === 'overview', isTax = route.page === 'tax', dash = isOv || isTax;
    const nav = [['#/overview', 'Dashboard', 'grid', dash], ['#/goals', 'Goals', 'target', route.page === 'goals'], ['#/sources', 'Sources', 'inbox', route.page === 'sources'], ['#/settings', 'Settings', 'sliders', route.page === 'settings']];
    const per = [['M', 'Month'], ['Q', 'Quarter'], ['FY', 'Financial year']];
    return `<a class="skip" href="#page">Skip to content</a>
<div class="shell" data-mode="${isTax ? 'tax' : 'overview'}">
  <nav class="rail" aria-label="Main">
    <a class="brand" href="#/overview" aria-label="${esc(C.appName)} home"><span>₹</span></a>
    ${nav.map(n => `<a class="rail-link${n[3] ? ' on' : ''}" href="${n[0]}"${n[3] ? ' aria-current="page"' : ''}>${ic(n[2])}<span>${n[1]}</span></a>`).join('')}
  </nav>
  <div class="main">
    <header class="topbar">
      <div class="mode" role="group" aria-label="Dashboard view">
        <a href="#/overview" class="${isOv ? 'on' : ''}"${isOv ? ' aria-current="page"' : ''}>Overview</a>
        <a href="#/tax" class="${isTax ? 'on' : ''}"${isTax ? ' aria-current="page"' : ''}>Tax</a>
      </div>
      ${isOv ? `<div class="toggle" role="group" aria-label="Period">${per.map(p => `<button type="button" data-period="${p[0]}" aria-pressed="${state.period === p[0]}">${p[1]}</button>`).join('')}</div>`
        : isTax ? `<span class="fy-pill">${C.tax.fyLabel}, April to March</span>` : ''}
      <div class="tools">
        ${D.sample ? '<span class="chip sample">Sample data</span>' : ''}
        <span class="sync">${ic('clock')}Synced ${esc(D.lastSync.label)}</span>
        <button type="button" class="icon-btn" data-mask aria-pressed="${!!state.mask}" title="${state.mask ? 'Show amounts' : 'Hide amounts'}"><span class="sr">${state.mask ? 'Show amounts' : 'Hide amounts'}</span>${ic(state.mask ? 'eyeoff' : 'eye')}</button>
        <button type="button" class="icon-btn" data-theme-toggle title="Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme"><span class="sr">Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme</span>${ic(state.theme === 'dark' ? 'sun' : 'moon')}</button>
      </div>
    </header>
    <main id="page" class="page${state.first ? ' reveal' : ''}" tabindex="-1">${page}</main>
  </div>
</div>`;
  }

  /* --------------------------------------------------------- Overview page */
  function headTile(o) {
    return `<a class="head" href="${o.href}" style="--hc:${o.color}">
      <span class="head-top"><span class="head-name">${o.name}</span>${ic('chev')}</span>
      <span class="head-val display">${o.value}</span>
      <span class="head-sub">${o.sub}</span>
      ${o.sub2 ? `<span class="head-sub2">${o.sub2}</span>` : ''}
      ${o.delta || ''}
      ${o.body || ''}
    </a>`;
  }

  function viewOverview() {
    const R = rangeFor(state.period), f = flows(R.start, R.end), pf = flows(R.pStart, R.pEnd);
    const B = D.balances, ck = U.monthKey(TODAY), pk = R.pEnd.slice(0, 7);
    const nw = B.assets[ck] - B.liabs[ck], nwp = B.assets[pk] - B.liabs[pk];
    const m12 = monthKeys(12), nwSeries = m12.map(k => B.assets[k] - B.liabs[k]);
    const out = f.tax + f.spend + f.emi, base = Math.max(f.income, out + f.invest) || 1;
    const segs = [
      { name: 'Tax paid', v: f.tax, color: 'var(--tax)', go: '#/tax' },
      { name: 'Spends', v: f.spend, color: 'var(--spend)', go: '#/overview/spend' },
      { name: 'Loan EMIs', v: f.emi, color: 'var(--liab)', go: '#/overview/liab' },
      { name: 'Invested', v: f.invest, color: 'var(--invest)', go: '#/overview/invest' },
      { name: 'Kept in cash', v: Math.max(0, f.kept), color: 'var(--income)', go: '#/overview/savings', hatch: true }
    ];
    const bStart = out / base, bWidth = Math.min(1 - bStart, Math.max(0, f.saved) / base);
    const bracket = f.saved > 0 ? `<a class="bracket" href="#/overview/savings" style="left:${(bStart * 100).toFixed(2)}%;width:${(bWidth * 100).toFixed(2)}%"><span>Saved ${U.pct(f.rate)}, ${amt(f.saved, true)}</span></a>` : '';
    const band = `<div class="band-wrap"><div class="band" role="list">${segs.filter(s => s.v > 0).map(s => {
      const sh = s.v / base;
      return `<a class="seg${s.hatch ? ' hatch' : ''}" role="listitem" href="${s.go}" style="flex-grow:${(sh * 1000).toFixed(1)};--sc:${s.color}" data-tip="${esc(`<div class="tip-h">${s.name}</div>${tipRow('', U.pct(sh, 1) + ' of income', s.v)}`)}" aria-label="${s.name}: ${U.inr(s.v)}, ${U.pct(sh)}"><span class="seg-t">${sh >= 0.08 ? U.pct(sh) : ''}</span></a>`;
    }).join('')}</div>${bracket}</div>`;
    const legend = `<ul class="legend">${segs.map(s => `<li><a href="${s.go}"><i class="dot${s.hatch ? ' hatch' : ''}" style="--sc:${s.color}"></i><span class="lg-n">${s.name}</span><span class="lg-v amt">${U.inrC(s.v)}</span></a></li>`).join('')}</ul>`;
    const overNote = f.kept < 0 ? `<p class="note warn">${ic('alert')}You invested ${amt(-f.kept)} more than you saved this period, so part of it came from existing cash.</p>` : '';

    const hero = `<section class="hero" aria-label="Net worth and savings">
      <div class="hero-nw">
        <a class="hero-link" href="#/overview/networth">
          <h2>Net worth</h2>
          <div class="hero-num display"><span class="amt">${U.inrC(nw)}</span></div>
          ${delta(nw, nwp, 'up', R.vs)}
        </a>
        ${spark(nwSeries, 220, 56)}
        <p class="muted small">Everything you own minus everything you owe.</p>
      </div>
      <div class="hero-flow">
        <div class="hero-flow-head"><h2>Where your income went</h2><p class="muted"><span class="amt">${U.inrC(f.income)}</span> earned ${R.name}</p></div>
        ${band}${legend}${overNote}
      </div>
    </section>`;

    const tiles = `<section class="heads" aria-label="Major heads">
      ${headTile({ href: '#/overview/income', name: 'Income', color: 'var(--income)', value: `<span class="amt">${U.inrC(f.income)}</span>`, sub: `earned ${R.name}`, delta: delta(f.income, pf.income, 'up', R.vs), body: spark(monthly('income', null, m12)) })}
      ${headTile({ href: '#/overview/spend', name: 'Spends', color: 'var(--spend)', value: `<span class="amt">${U.inrC(f.spend)}</span>`, sub: `spent ${R.name}, before loan EMIs`, delta: delta(f.spend, pf.spend, 'down', R.vs), body: spark(monthly('spend', null, m12)) })}
      ${headTile({ href: '#/overview/invest', name: 'Investments', color: 'var(--invest)', value: `<span class="amt">${U.inrC(B.assets[ck])}</span>`, sub: 'total value today', sub2: `${amt(f.invest, true)} added ${R.name}`, delta: delta(B.assets[ck], B.assets[pk], 'up', R.vs), body: spark(m12.map(k => B.assets[k])) })}
      ${headTile({ href: '#/overview/liab', name: 'Liabilities', color: 'var(--liab)', value: `<span class="amt">${U.inrC(B.liabs[ck])}</span>`, sub: 'still owed today', sub2: `${amt(f.emi, true)} paid as EMIs ${R.name}`, delta: delta(B.liabs[ck], B.liabs[pk], 'down', R.vs), body: spark(m12.map(k => B.liabs[k])) })}
    </section>`;

    const inA = monthly('income', null, m12), spA = monthly('spend', null, m12), emA = monthly('emi', null, m12), txA = monthly('tax', null, m12), ivA = monthly('invest', null, m12);
    const outA = inA.map((_, i) => spA[i] + emA[i] + txA[i]);
    const chart = barChart({
      keys: m12, mode: 'group', h: 240, aria: 'Income compared with money out (tax, spends and loan EMIs) for the last 12 months',
      series: [{ id: 'in', name: 'Income', color: 'var(--income)' }, { id: 'out', name: 'Tax, spends and EMIs', color: 'var(--spend)' }],
      data: { in: inA, out: outA },
      tipExtra: i => tipRow('', 'Invested', ivA[i]) + tipRow('', 'Saved', inA[i] - outA[i])
    });
    const savedA = inA.map((v, i) => v - outA[i]), bestI = savedA.indexOf(Math.max.apply(null, savedA));
    const rate12 = inA.reduce((t, v) => t + v, 0) ? savedA.reduce((t, v) => t + v, 0) / inA.reduce((t, v) => t + v, 0) : 0;
    const statsRow = [['Savings rate, last 12 months', U.pct(rate12)], ['Saved per month, on average', amt(savedA.reduce((t, v) => t + v, 0) / 12, true)], ['Strongest month', `${U.monLabelY(m12[bestI])}, ${amt(savedA[bestI], true)}`]].map(x => `<div><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`).join('');
    const al = alerts(), goals = allGoals().slice(0, 4);
    const lower = `<section class="lower">
      <div class="panel"><div class="panel-head"><h2>Money in and out, last 12 months</h2>
        <ul class="key"><li><i style="background:var(--income)"></i>Income</li><li><i style="background:var(--spend)"></i>Tax, spends and EMIs</li></ul></div>
        ${chart}<p class="muted small">The gap between the bars is what you saved. Hover a month for the detail.</p>
        <dl class="sum-stats">${statsRow}</dl></div>
      <div class="panel side">
        <div class="panel-head"><h2>Goals</h2><a class="link" href="#/goals">All goals</a></div>
        <ul class="goals compact">${goals.map(goalCard).join('')}</ul>
        ${al.length ? `<h2 class="sub-h">Needs attention</h2><ul class="alerts">${al.map(x => `<li class="alert ${x.tone}"><a href="${x.href}"${x.pre ? ` data-pre="${x.pre}"` : ''}>${ic(x.icon)}<span>${x.text}</span></a></li>`).join('')}</ul>` : ''}
      </div></section>`;
    return `<div class="page-head"><div><h1>Overview</h1><p class="muted">${R.label}, compared with ${R.pLabel}</p></div></div>${hero}${tiles}${lower}${footNote()}`;
  }

  const footNote = () => D.sample ? '<p class="foot">All numbers on this page are sample data so you can judge the layout. Real inputs come in the next phase.</p>' : '';

  /* ---------------------------------------------------- Overview drill-downs */
  function flowCfg(head, R, dim, labels, hue) {
    const keys = Object.keys(labels), m12 = monthKeys(12), tot12 = {}, cur = {}, prev = {};
    keys.forEach(k => { tot12[k] = 0; });
    E.forEach(e => { if (e.head === head && m12.indexOf(e.date.slice(0, 7)) >= 0) { const k = dim(e); if (k in tot12) tot12[k] += e.amount; } });
    keys.forEach(k => { cur[k] = sum(head, R.start, R.end, e => dim(e) === k); prev[k] = sum(head, R.pStart, R.pEnd, e => dim(e) === k); });
    const order = keys.slice().sort((a, b) => tot12[b] - tot12[a]), color = {};
    order.forEach((k, i) => { color[k] = ramp(hue, i, order.length); });
    const total = keys.reduce((t, k) => t + cur[k], 0), ptotal = keys.reduce((t, k) => t + prev[k], 0);
    const rows = keys.filter(k => cur[k] > 0 || prev[k] > 0).sort((a, b) => cur[b] - cur[a])
      .map(k => ({ key: k, name: labels[k], value: cur[k], color: color[k], share: total ? cur[k] / total : 0 }));
    const series = order.filter(k => tot12[k] > 0).map(k => ({ id: k, name: labels[k], color: color[k] }));
    const data = {}; series.forEach(s => { data[s.id] = monthly(head, e => dim(e) === s.id, m12); });
    return { rows, series, data, total, ptotal, keys: m12 };
  }

  function tagsFor(e) {
    return (e.ded || []).map(d => `<span class="tag" title="Counts toward ${esc(DED[d.id].ref)}">${esc(DED[d.id].short)}</span>`).join('');
  }
  function entriesPanel(title, list, o) {
    o = o || {};
    const shown = list.slice(0, 12);
    const clear = state.filter && o.filterName ? `<button type="button" class="chip clear" data-filter="${esc(state.filter)}">Showing ${esc(o.filterName)}${ic('x')}<span class="sr">Clear filter</span></button>` : '';
    const table = shown.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Category</th>${o.via ? '<th scope="col">Paid with</th>' : ''}<th scope="col" class="r">Amount</th></tr></thead><tbody>
      ${shown.map(e => `<tr><td class="nw">${U.shortDate(e.date)}</td><td>${esc(e.label)} ${tagsFor(e)}</td><td>${esc(catName(e))}</td>${o.via ? `<td>${esc(HEADS.spend.instruments[e.instrument] || '')}</td>` : ''}<td class="r"><span class="amt">${U.inr(e.amount)}</span></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">No entries in this period.</p>';
    return `<section class="panel entries"><div class="panel-head"><h2>${title}</h2>${clear}</div>${table}${list.length > shown.length ? `<p class="muted small">Showing the latest ${shown.length} of ${list.length}.</p>` : ''}</section>`;
  }

  function breakdownHtml(b) {
    const groups = b.groups || [{ title: null, rows: b.rows }];
    return groups.map(gp => { const top = Math.max.apply(null, gp.rows.map(r => r.share || 0).concat([0.0001]));
      return `${gp.title ? `<h3 class="grp">${gp.title}</h3>` : ''}<div class="brows">${gp.rows.map(r => {
      const inner = `<i class="sw" style="background:${r.color || 'var(--ink-3)'}"></i><span class="bname">${esc(r.name)}${r.extra ? `<small>${r.extra}</small>` : ''}</span>
        ${r.share != null ? `<span class="bbar"><b style="width:${Math.max(1.5, r.share / top * 100).toFixed(1)}%;background:${r.color}"></b></span>` : '<span class="bbar"></span>'}
        <span class="bval amt">${r.text || U.inr(r.value)}</span><span class="bshare">${r.share != null ? U.pct(r.share) : ''}</span>`;
      return b.filterable ? `<button type="button" class="brow${state.filter === r.key ? ' on' : ''}" data-filter="${esc(r.key)}" aria-pressed="${state.filter === r.key}">${inner}</button>` : `<div class="brow static">${inner}</div>`;
    }).join('')}</div>`; }).join('');
  }

  function drillPage(c) {
    return `<nav class="crumb" aria-label="Breadcrumb"><a href="${c.backHref}">${ic('back')}${c.backLabel}</a></nav>
    <div class="page-head"><div><h1>${c.title}</h1><p class="muted">${c.sub}</p></div>${c.toggle || ''}</div>
    <section class="summary" style="--hc:${c.color}"><div class="sum-main"><span class="sum-label">${c.valueLabel}</span><span class="sum-val display">${c.value}</span>${c.delta || ''}</div>
      <dl class="sum-stats">${c.stats.map(s => `<div><dt>${s.l}</dt><dd>${s.v}</dd></div>`).join('')}</dl></section>
    <div class="drill-grid">
      <section class="panel"><h2>${c.breakdown.title}</h2>${breakdownHtml(c.breakdown)}${c.breakdown.note ? `<p class="muted small">${c.breakdown.note}</p>` : ''}</section>
      <section class="panel"><h2>${c.trend.title}</h2>${c.trend.html}<p class="muted small">${c.trend.note || 'Colours match the list on the left. Hover a month for the exact split.'}</p></section>
    </div>${c.entries || ''}${c.after || ''}`;
  }

  function viewDrill(kind) {
    const R = rangeFor(state.period), B = D.balances, ck = U.monthKey(TODAY), pk = R.pEnd.slice(0, 7), m12 = monthKeys(12);
    const base = { backHref: '#/overview', backLabel: 'Overview', sub: `${R.label}, compared with ${R.pLabel}` };
    const f = flows(R.start, R.end);

    if (kind === 'income' || kind === 'spend') {
      const isSp = kind === 'spend', byInst = isSp && state.group === 'instrument';
      const dim = byInst ? e => e.instrument : e => e.cat;
      const labels = isSp ? (byInst ? HEADS.spend.instruments : HEADS.spend.cats) : HEADS.income.cats;
      if (state.filter && !(state.filter in labels)) state.filter = null;
      const cf = flowCfg(kind, R, dim, labels, kind);
      const total = cf.total, ptotal = cf.ptotal;
      const list = entriesFor(kind, R, state.filter ? e => dim(e) === state.filter : null);
      const toggle = isSp ? `<div class="toggle" role="group" aria-label="Group spends by"><button type="button" data-group="instrument" aria-pressed="${byInst}">Payment type</button><button type="button" data-group="category" aria-pressed="${!byInst}">Category</button></div>` : '';
      const top = cf.rows[0];
      const stats = isSp
        ? [{ l: 'Share of income', v: U.pct(f.income ? f.spend / f.income : 0) }, { l: 'Average per month', v: amt(f.spend / Math.max(1, (U.daysBetween(U.parse(R.start), TODAY) + 1) / 30.4), true) }, { l: byInst ? 'Most used' : 'Biggest category', v: top ? esc(top.name) : 'None' }]
        : [{ l: 'Sources active', v: String(cf.rows.length) }, { l: 'Largest source', v: top ? esc(top.name) : 'None' }, { l: 'Same period before', v: amt(ptotal, true) }];
      return drillPage(Object.assign({}, base, {
        title: HEADS[kind].name, color: `var(--${kind})`, toggle, valueLabel: isSp ? `Spent ${R.name}, before loan EMIs` : `Earned ${R.name}`,
        value: `<span class="amt">${U.inr(total)}</span>`, delta: delta(total, ptotal, HEADS[kind].good, R.vs), stats,
        breakdown: { title: isSp ? (byInst ? 'By payment type' : 'By category') : 'By source', rows: cf.rows, filterable: true, note: 'Select a row to filter the entries below.' },
        trend: { title: 'Month by month', html: barChart({ keys: cf.keys, series: cf.series, data: cf.data, aria: `${HEADS[kind].name} by month for the last 12 months` }) },
        entries: entriesPanel(isSp ? 'Latest spends' : 'Latest income', list, { via: isSp, filterName: state.filter ? labels[state.filter] : '' })
      }));
    }

    if (kind === 'invest') {
      const labels = HEADS.invest.cats;
      if (state.filter && !(state.filter in labels)) state.filter = null;
      const order = D.holdings.slice().sort((a, b) => b.value - a.value), color = {};
      order.forEach((h, i) => { color[h.cls] = ramp('invest', i, order.length); });
      const total = order.reduce((t, h) => t + h.value, 0), cost = order.reduce((t, h) => t + h.invested, 0);
      const added = {}; Object.keys(labels).forEach(k => { added[k] = sum('invest', R.start, R.end, e => e.cat === k); });
      const rows = order.map(h => {
        const g = h.invested ? h.value / h.invested - 1 : 0;
        return { key: h.cls, name: labels[h.cls], value: h.value, share: h.value / total, color: color[h.cls],
                 extra: [added[h.cls] ? `Added ${U.inrC(added[h.cls])}` : '', h.cls === 'cash' ? '' : `${g >= 0 ? 'Up' : 'Down'} ${U.pct(Math.abs(g), 1)} on cost`].filter(Boolean).join('. ') };
      });
      const cats = Object.keys(labels).filter(k => monthly('invest', e => e.cat === k, m12).some(v => v > 0));
      const series = cats.sort((a, b) => order.findIndex(h => h.cls === a) - order.findIndex(h => h.cls === b)).map(k => ({ id: k, name: labels[k], color: color[k] }));
      const data = {}; series.forEach(s => { data[s.id] = monthly('invest', e => e.cat === s.id, m12); });
      const list = entriesFor('invest', R, state.filter ? e => e.cat === state.filter : null);
      return drillPage(Object.assign({}, base, {
        title: 'Investments', color: 'var(--invest)', valueLabel: 'Total value today', value: `<span class="amt">${U.inr(total)}</span>`,
        delta: delta(B.assets[ck], B.assets[pk], 'up', R.vs),
        stats: [{ l: `Added ${R.name}`, v: amt(f.invest, true) }, { l: 'Gain on cost', v: amt(total - cost, true) }, { l: 'Asset types', v: String(order.length) }],
        breakdown: { title: 'Where your money sits', rows, filterable: true, note: 'Select a row to filter the entries below. Retirement covers EPF, PPF and NPS.' },
        trend: { title: 'Money added each month', html: barChart({ keys: m12, series, data, aria: 'Money added to investments each month, by asset type' }), note: 'Shows what you put in, not market value. Cash and property have no monthly purchases.' },
        entries: entriesPanel('Latest investments', list, { filterName: state.filter ? labels[state.filter] : '' })
      }));
    }

    if (kind === 'liab') {
      if (state.filter && !(state.filter in HEADS.liab.cats)) state.filter = null;
      const L = D.liabilities.slice().sort((a, b) => b.outstanding - a.outstanding), color = {};
      L.forEach((l, i) => { color[l.id] = ramp('liab', i, L.length); });
      const total = L.reduce((t, l) => t + l.outstanding, 0);
      const rows = L.map(l => ({ key: l.id, name: l.name, value: l.outstanding, share: l.outstanding / total, color: color[l.id],
        extra: l.emi ? `EMI ${U.inr(l.emi)}. ${l.rate}% interest. ${plural(l.monthsLeft, 'month')} left` : `Due ${U.shortDate(l.dueDate)}. Minimum ${U.inr(l.minDue)}` }));
      const series = L.map(l => ({ id: l.id, name: l.name, color: color[l.id] }));
      const data = {}; series.forEach(s => { data[s.id] = m12.map(k => B.liabByLoan[s.id][k]); });
      const emis = D.liabilities.filter(l => l.emi).reduce((t, l) => t + l.emi, 0);
      const interest = E.filter(e => e.head === 'emi' && e.date >= R.start && e.date <= R.end).reduce((t, e) => t + (e.interest || 0), 0);
      const list = entriesFor('emi', R, state.filter ? e => e.cat === state.filter : null);
      return drillPage(Object.assign({}, base, {
        title: 'Liabilities', color: 'var(--liab)', valueLabel: 'Still owed today', value: `<span class="amt">${U.inr(total)}</span>`,
        delta: delta(B.liabs[ck], B.liabs[pk], 'down', R.vs),
        stats: [{ l: 'Monthly EMIs', v: amt(emis, true) }, { l: `Interest paid ${R.name}`, v: amt(interest, true) }, { l: `EMIs paid ${R.name}`, v: amt(f.emi, true) }],
        breakdown: { title: 'What you owe', rows, filterable: true, note: 'Select a loan to filter the EMI payments below.' },
        trend: { title: 'Balance over time', html: barChart({ keys: m12, series, data, aria: 'Outstanding balance by loan for the last 12 months' }), note: 'Month-end balances. Credit card dues move with your spending.' },
        entries: entriesPanel('EMI payments', list, { filterName: state.filter ? HEADS.liab.cats[state.filter] : '' })
      }));
    }

    if (kind === 'networth') {
      const A = D.holdings.slice().sort((a, b) => b.value - a.value), L = D.liabilities.slice().sort((a, b) => b.outstanding - a.outstanding);
      const aT = A.reduce((t, h) => t + h.value, 0), lT = L.reduce((t, l) => t + l.outstanding, 0), nw = aT - lT, nwp = B.assets[pk] - B.liabs[pk];
      const series = D.months.map(k => B.assets[k] - B.liabs[k]);
      return drillPage(Object.assign({}, base, {
        title: 'Net worth', color: 'var(--accent)', valueLabel: 'Assets minus liabilities', value: `<span class="amt">${U.inr(nw)}</span>`, delta: delta(nw, nwp, 'up', R.vs),
        stats: [{ l: 'Assets', v: amt(aT, true) }, { l: 'Liabilities', v: amt(lT, true) }, { l: `Change ${R.name}`, v: amt(nw - nwp, true) }],
        breakdown: { title: 'What makes it up', filterable: false, groups: [
          { title: 'Assets', rows: A.map((h, i) => ({ key: h.cls, name: HEADS.invest.cats[h.cls], value: h.value, share: h.value / aT, color: ramp('invest', i, A.length) })) },
          { title: 'Liabilities', rows: L.map((l, i) => ({ key: l.id, name: l.name, value: l.outstanding, share: l.outstanding / lT, color: ramp('liab', i, L.length) })) }] },
        trend: { title: 'Net worth over time', html: lineChart({ keys: D.months, values: series, color: 'var(--accent)', name: 'Net worth', aria: 'Net worth at each month end' }), note: 'Month-end values, worked back from today\'s balances.' }
      }));
    }

    // savings
    const inA = monthly('income', null, m12), spA = monthly('spend', null, m12), emA = monthly('emi', null, m12), txA = monthly('tax', null, m12), ivA = monthly('invest', null, m12);
    const savedA = inA.map((v, i) => v - spA[i] - emA[i] - txA[i]);
    const investedA = savedA.map((s, i) => Math.max(0, Math.min(ivA[i], s))), keptA = savedA.map((s, i) => Math.max(0, s - ivA[i]));
    const series = [{ id: 'inv', name: 'Invested', color: 'var(--invest)' }, { id: 'kept', name: 'Kept in cash', color: 'var(--income)' }];
    const pf = flows(R.pStart, R.pEnd);
    const st = (name, v, sign) => ({ name, value: v, text: `${sign}${U.inr(Math.abs(v))}`, color: null, share: null });
    return drillPage(Object.assign({}, base, {
      title: 'Savings', color: 'var(--income)', valueLabel: `Saved ${R.name}`, value: `<span class="amt">${U.inr(f.saved)}</span>`, delta: delta(f.saved, pf.saved, 'up', R.vs),
      stats: [{ l: 'Savings rate', v: U.pct(f.rate) }, { l: 'Rate in the same period before', v: U.pct(pf.rate) }, { l: 'Invested from it', v: amt(f.invest, true) }],
      breakdown: { title: 'How it adds up', filterable: false, groups: [{ rows: [
        st('Income', f.income, '+'), st('Tax paid', -f.tax, '−'), st('Spends', -f.spend, '−'), st('Loan EMIs', -f.emi, '−'),
        Object.assign(st('Saved', f.saved, ''), { extra: 'Income minus tax, spends and EMIs' }),
        Object.assign(st('Invested', f.invest, ''), { color: 'var(--invest)', share: f.saved > 0 ? Math.min(1, f.invest / f.saved) : 0 }),
        Object.assign(st('Kept in cash', f.kept, ''), { color: 'var(--income)', share: f.saved > 0 ? Math.max(0, f.kept / f.saved) : 0 })
      ] }] },
      trend: { title: 'Saved each month', html: barChart({ keys: m12, series, data: { inv: investedA, kept: keptA }, aria: 'Savings each month, split into invested and kept in cash',
        tipExtra: i => `<div class="tip-r"><span>Savings rate</span><b>${inA[i] ? U.pct(savedA[i] / inA[i]) : '0%'}</b></div>` }), note: 'Months with an unusually high or low bar usually have a capital gain, a bonus or a large one-off bill.' }
    }));
  }

  /* --------------------------------------------------------------- Tax page */
  function regimeCompare(T) {
    const c = T.cmp, cheaper = c.best === 'new' ? 'new' : 'old';
    const col = k => `<button type="button" class="cmp-col${T.key === k ? ' on' : ''}" data-regime="${k}" aria-pressed="${T.key === k}">
      <span class="cmp-name">${c[k].name}${cheaper === k ? chip('good', 'Cheaper', 'check') : ''}</span>
      <span class="cmp-val display amt">${U.inrC(c[k].total)}</span>
      <small>Taxable income <span class="amt">${U.inrC(c[k].taxable)}</span></small></button>`;
    const have = c.old.dedApplied;
    let msg;
    if (c.breakEven == null) msg = `The new regime saves you ${amt(c.diff)}. The old regime does not win at any realistic level of deductions for your income.`;
    else if (c.best === 'new') msg = `The new regime saves you ${amt(c.diff)}. The old regime only wins once deductions pass ${amt(c.breakEven, true)}. You are at ${amt(have, true)}, and every limit filled adds up to ${amt(T.dedLimit, true)} at most.`;
    else msg = `The old regime saves you ${amt(c.diff)}, as long as deductions stay above ${amt(c.breakEven, true)}. You are at ${amt(have, true)}.`;
    return `<section class="panel"><div class="panel-head"><h2>Old regime or new regime</h2></div><div class="cmp">${col('new')}${col('old')}</div><p class="cmp-note">${msg}</p><p class="muted small">Select a regime to see the whole page for it. Your employer may be deducting TDS on the other one.</p></section>`;
  }

  function advancePanel(T) {
    const a = T.adv;
    const items = a.required ? `<ol class="adv">${a.items.map(i => {
      const st = i.status === 'paid' ? chip('good', 'Paid', 'check') : i.status === 'short' ? chip('bad', `Short by ${amt(i.gap)}`, 'alert') : (i.next ? chip('info', `Due in ${plural(U.daysBetween(TODAY, U.parse(i.due)), 'day')}`, 'clock') : chip('flat', 'Upcoming', ''));
      return `<li class="${i.status}${i.next ? ' next' : ''}"><span class="adv-d">${U.shortDate(i.due)}</span><span class="adv-t">${U.pct(i.cum)} of tax after TDS<small>Total paid should reach <span class="amt">${U.inr(i.target)}</span>${i.next && i.gap > 0 ? `, so add <span class="amt">${U.inr(i.gap)}</span>` : ''}</small></span>${st}</li>`;
    }).join('')}</ol>` : `<p class="empty">Your tax after TDS is under ${amt(a.threshold)}, so no advance tax is due.</p>`;
    return `<section class="panel"><div class="panel-head"><h2>Advance tax</h2></div>${items}<p class="muted small">Paid so far: ${amt(T.advPaid)}. Amounts are cumulative and use the ${T.res.name.toLowerCase()} estimate.</p></section>`;
  }

  function viewTax() {
    const T = tm(), res = T.res, bal = T.balance, m12 = monthKeys(12);
    const hero = `<section class="hero tax-hero" aria-label="Tax summary">
      <div class="hero-nw">
        <h2>${bal > 0 ? 'Still to pay this year' : 'Refund expected'}</h2>
        <div class="hero-num display"><span class="amt">${U.inr(Math.abs(bal))}</span></div>
        <p class="muted">Total tax ${amt(res.total)}, less TDS ${amt(T.tds.projected)} and advance tax paid ${amt(T.advPaid)}.</p>
        <div class="toggle" role="group" aria-label="Tax regime">${['new', 'old'].map(k => `<button type="button" data-regime="${k}" aria-pressed="${T.key === k}">${T.cmp[k].name}${T.cmp.best === k ? ' (cheaper)' : ''}</button>`).join('')}</div>
        <p class="muted small">Projected for the full year from data up to ${U.shortDate(TODAY_S)}.</p>
      </div>
      <div class="hero-flow wf-pair">
        ${waterfall('From income to taxable income', [
          { label: 'Income from all sources', value: T.gross, total: true, tone: 'ink' },
          { label: 'Standard deductions', value: -(res.stdDed + T.rentStd), tone: 'good' },
          { label: res.regime === 'old' ? 'Deductions claimed' : 'Deductions (old regime only)', value: -res.dedApplied, tone: 'good' },
          { label: 'Capital gains, taxed separately', value: -T.cg, tone: 'muted' },
          { label: 'Taxable at slab rates', value: res.taxable, total: true, tone: 'ink' }])}
        ${waterfall('From tax to balance', [
          { label: 'Tax on slab income', value: res.slabAfter, total: true, tone: 'ink' },
          { label: 'Tax on capital gains', value: res.cgTax, tone: 'bad' },
          { label: 'Cess at 4%', value: res.cess, tone: 'bad' },
          { label: 'Total tax', value: res.total, total: true, tone: 'ink' },
          { label: 'TDS by March', value: -T.tds.projected, tone: 'good' },
          { label: 'Advance tax paid', value: -T.advPaid, tone: 'good' },
          { label: bal > 0 ? 'Still to pay' : 'Refund', value: bal, total: true, tone: bal > 0 ? 'bad' : 'good' }])}
      </div></section>`;

    const dedFrac = T.dedLimit ? T.dedUsed / T.dedLimit : 0;
    const tiles = `<section class="heads" aria-label="Tax heads">
      ${headTile({ href: '#/tax/income', name: 'Income', color: 'var(--income)', value: `<span class="amt">${U.inrC(T.gross)}</span>`, sub: 'expected this financial year', sub2: `${amt(res.taxable, true)} taxable at slab rates`, body: spark(monthly('income', null, m12)) })}
      ${headTile({ href: '#/tax/deductions', name: 'Deductions', color: 'var(--invest)', value: `<span class="amt">${U.inrC(T.dedUsed)}</span>`, sub: `of ${amt(T.dedLimit, true)} in capped limits`, sub2: `${amt(T.dedSoFar, true)} claimed so far`,
         body: pbar(dedFrac, { ghost: T.dedLimit ? T.dedSoFar / T.dedLimit : 0, label: 'Deduction limits used' }) + `<span class="head-note">${res.regime === 'old' ? 'Reducing your tax now' : 'Not counted in the new regime'}</span>` })}
      ${headTile({ href: '#/tax/tax', name: 'Tax amount', color: 'var(--tax)', value: `<span class="amt">${U.inrC(res.total)}</span>`, sub: `${res.name.toLowerCase()}, including cess`, sub2: `${U.pct(T.gross ? res.total / T.gross : 0, 1)} of your gross income` })}
      ${headTile({ href: '#/tax/savings', name: 'Tax savings', color: 'var(--income)', value: `<span class="amt">${U.inrC(T.savedByClaims)}</span>`, sub: T.cmp.best === 'new' ? `saved by deductions under the old regime, which is still ${U.inrC(T.cmp.diff)} dearer` : 'saved by your deductions, old regime', sub2: `${amt(T.potentialMore, true)} more if every limit is filled by 31 Mar` })}
    </section>`;

    return `<div class="page-head"><div><h1>Tax</h1><p class="muted">${C.tax.fyLabel} (${C.tax.ayLabel}), ${plural(T.daysLeft, 'day')} to 31 March</p></div></div>${hero}${tiles}<section class="lower even">${regimeCompare(T)}${advancePanel(T)}</section>${taxFoot()}`;
  }
  const taxFoot = () => `<p class="foot">Tax rules checked on ${C.tax.verifiedOn}. This is an estimate, not filing advice. ${esc(C.tax.notes[2])}</p>`;

  /* ---------------------------------------------------------- Tax drill-downs */
  function taxHead(title, T, valueLabel, value, stats) {
    return `<nav class="crumb" aria-label="Breadcrumb"><a href="#/tax">${ic('back')}Tax</a></nav>
    <div class="page-head"><div><h1>${title}</h1><p class="muted">${C.tax.fyLabel}, ${T.res.name.toLowerCase()}, projected for the full year</p></div></div>
    <section class="summary" style="--hc:var(--tax)"><div class="sum-main"><span class="sum-label">${valueLabel}</span><span class="sum-val display">${value}</span></div>
    <dl class="sum-stats">${stats.map(s => `<div><dt>${s.l}</dt><dd>${s.v}</dd></div>`).join('')}</dl></section>`;
  }

  function drillTaxIncome() {
    const T = tm(), cats = HEADS.income.cats;
    const rows = Object.keys(cats).map(k => {
      const p = T.inc[k];
      const taxable = k === 'salary' ? Math.max(0, p.projected - T.res.stdDed) : k === 'rental' ? T.inp.houseProperty : k === 'capital' ? T.stcg + T.res.ltcgTaxable : p.projected;
      return { k, name: cats[k], sofar: p.actual, proj: p.projected, taxable, how: C.tax.treatment[k] };
    }).filter(r => r.proj > 0 || r.sofar > 0).sort((a, b) => b.proj - a.proj);
    const tot = rows.reduce((t, r) => ({ s: t.s + r.sofar, p: t.p + r.proj, x: t.x + r.taxable }), { s: 0, p: 0, x: 0 });
    const comp = `<div class="comp" role="img" aria-label="Share of expected income by source">${rows.map((r, i) => `<i style="flex-grow:${r.proj.toFixed(0)};background:${ramp('income', i, rows.length)}" data-tip="${esc(`<div class="tip-h">${r.name}</div>${tipRow('', U.pct(r.proj / tot.p, 1), r.proj)}`)}"></i>`).join('')}</div>`;
    const foreign = E.filter(e => e.foreign && e.date >= FY_S);
    const fPanel = foreign.length ? `<section class="panel"><h2>Foreign income in its original currency</h2><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Received</th><th scope="col" class="r">Rate</th><th scope="col" class="r">In rupees</th></tr></thead><tbody>${foreign.slice().reverse().map(e => `<tr><td class="nw">${U.shortDate(e.date)}</td><td>${e.foreign.currency} <span class="amt">${e.foreign.amount}</span></td><td class="r">₹${e.foreign.rate}</td><td class="r"><span class="amt">${U.inr(e.amount)}</span></td></tr>`).join('')}</tbody></table></div><p class="muted small">Sample rates. Keep the original amount so you can claim foreign tax credit later if it applies.</p></section>` : '';
    return taxHead('Income for tax', T, 'Expected this financial year', `<span class="amt">${U.inr(T.gross)}</span>`, [
      { l: 'Received so far', v: amt(tot.s, true) }, { l: 'Taxable at slab rates', v: amt(T.res.taxable, true) }, { l: 'Capital gains, taxed separately', v: amt(T.cg, true) }]) +
      `<section class="panel"><h2>By source</h2>${comp}<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Source</th><th scope="col" class="r">Received so far</th><th scope="col" class="r">Expected by 31 Mar</th><th scope="col" class="r">Counted as taxable</th><th scope="col">How it is taxed</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><i class="sw" style="background:${ramp('income', i, rows.length)}"></i>${esc(r.name)}</td><td class="r"><span class="amt">${U.inr(r.sofar)}</span></td><td class="r"><span class="amt">${U.inr(r.proj)}</span></td><td class="r"><span class="amt">${U.inr(r.taxable)}</span></td><td class="muted">${esc(r.how)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="r"><span class="amt">${U.inr(tot.s)}</span></td><td class="r"><span class="amt">${U.inr(tot.p)}</span></td><td class="r"><span class="amt">${U.inr(tot.x)}</span></td><td></td></tr></tbody></table></div>
      <p class="muted small">Salary and rent continue at their current monthly amounts. Business, foreign and other income are projected at your average so far. Capital gains are counted only once realised.</p></section>${fPanel}${taxFoot()}`;
  }

  function drillTaxDeductions() {
    const T = tm(), inNew = T.res.regime === 'new';
    const rows = T.ded.map(d => {
      const cap = d.limit, w = cap ? cap : Math.max(d.projected, 1);
      const room = cap == null ? null : Math.max(0, cap - d.projected);
      const entries = d.entries.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8);
      return `<details class="ded"><summary>
        <span class="ded-n">${esc(d.name)}<small>${esc(d.ref)}${d.id === '80d_parents' && D.profile.seniorParents ? ', senior citizen limit' : ''}</small></span>
        <span class="ded-b">${pbar(cap ? d.claimed / cap : 1, { ghost: cap ? d.projected / cap : null, label: d.name })}</span>
        <span class="ded-v"><span class="amt">${U.inr(d.projected)}</span><small>${cap ? 'of <span class="amt">' + U.inr(cap) + '</span>' : 'no limit'}</small></span>
        <span class="ded-r">${room == null ? chip('flat', 'No cap', '') : room > 0 ? chip('warn', `<span class="amt">${U.inrC(room)}</span> room`, '') : chip('good', 'Filled', 'check')}</span></summary>
        <div class="ded-body"><p class="muted small">Claimed so far <span class="amt">${U.inr(d.claimed)}</span>. Expected by 31 March <span class="amt">${U.inr(d.projected)}</span>. ${esc(d.tip)}</p>
        ${entries.length ? `<ul class="ded-list">${entries.map(e => `<li><span class="nw">${U.shortDate(e.date)}</span><span>${esc(e.label)}<small>Also counted under ${esc(HEADS[e.head].name)}</small></span><span class="amt">${U.inr(d.val(e))}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing counted yet.</p>'}</div></details>`;
    }).join('');
    return taxHead('Deductions', T, 'Used of capped limits by 31 March', `<span class="amt">${U.inr(T.dedUsed)}</span>`, [
      { l: 'Capped limits in total', v: amt(T.dedLimit, true) }, { l: 'Claimed so far', v: amt(T.dedSoFar, true) }, { l: 'Days left to act', v: String(T.daysLeft) }]) +
      `<section class="panel"><div class="panel-head"><h2>By deduction</h2></div>
      <p class="note ${inNew ? 'warn' : 'info'}">${ic(inNew ? 'alert' : 'check')}${inNew ? `You are viewing the new regime, which does not allow these deductions. They are shown so you can compare. Switch regime on the Tax page to apply them.` : 'These deductions are applied to your old-regime tax.'}</p>
      <div class="ded-list-wrap">${rows}</div><p class="muted small">Each entry is stored once. An ELSS SIP shows under Investments and here, and is counted once in your totals. Open a row to see what is included.</p></section>${taxFoot()}`;
  }

  function drillTaxTax() {
    const T = tm(), r = T.res, cg = C.tax.capitalGains.equity;
    const slab = r.slabRows.filter(s => s.inSlab > 0 || s.from < r.taxable + 1).map(s => `<tr><td>${s.to == null ? 'Above ' + U.inrC(s.from) : U.inrC(s.from) + ' to ' + U.inrC(s.to)}</td><td class="r"><span class="amt">${U.inr(s.inSlab)}</span></td><td class="r">${U.pct(s.rate)}</td><td class="r"><span class="amt">${U.inr(s.tax)}</span></td></tr>`).join('');
    const line = (l, v, cls) => `<tr class="${cls || ''}"><td>${l}</td><td class="r"><span class="amt">${v < 0 ? '−' : ''}${U.inr(Math.abs(v))}</span></td></tr>`;
    return taxHead('Tax amount', T, `Total tax, ${r.name.toLowerCase()}`, `<span class="amt">${U.inr(r.total)}</span>`, [
      { l: 'Effective rate', v: U.pct(T.gross ? r.total / T.gross : 0, 1) }, { l: 'Taxable at slab rates', v: amt(r.taxable, true) }, { l: 'Top slab you reach', v: U.pct(r.marginal) }]) +
      `<div class="drill-grid"><section class="panel"><h2>Slab by slab</h2><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Slab</th><th scope="col" class="r">Your income in slab</th><th scope="col" class="r">Rate</th><th scope="col" class="r">Tax</th></tr></thead><tbody>${slab}<tr class="tot"><td>Tax on slab income</td><td></td><td></td><td class="r"><span class="amt">${U.inr(r.slabTaxRaw)}</span></td></tr></tbody></table></div></section>
      <section class="panel"><h2>From slab tax to what you owe</h2><div class="tablewrap"><table class="tbl"><tbody>
        ${line('Tax on slab income', r.slabTaxRaw)}
        ${r.rebate ? line('Less rebate under Section 87A', -r.rebate) : ''}${r.relief ? line('Less marginal relief above the rebate limit', -r.relief) : ''}
        ${line(`Short-term gains ${U.inrC(T.stcg)} at ${U.pct(cg.stcg)}`, r.stcgTax)}
        ${line(`Long-term gains ${U.inrC(T.ltcg)}, first ${U.inrC(cg.ltcgExempt)} exempt, rest at ${U.pct(cg.ltcg, 1)}`, r.ltcgTax)}
        ${line(`Health and education cess at ${U.pct(C.tax.cess)}`, r.cess)}
        ${line('Total tax', r.total, 'tot')}
        ${line('Less TDS expected by March', -T.tds.projected)}${line('Less advance tax paid', -T.advPaid)}
        ${line(T.balance > 0 ? 'Still to pay' : 'Refund expected', T.balance, 'tot')}</tbody></table></div>
        <p class="muted small">Long-term gains this year so far use ${amt(r.ltcgExemptUsed, true)} of the ${amt(cg.ltcgExempt, true)} exemption.</p></section></div>
      ${regimeCompare(T)}${taxFoot()}`;
  }

  function drillTaxSavings() {
    const T = tm(), rate = T.marg * (1 + C.tax.cess), newBest = T.cmp.best === 'new';
    const opp = T.ded.filter(d => d.limit != null && d.limit - d.projected > 0 && d.id !== 'hl' && d.id !== '80tta').map(d => ({ d, room: d.limit - d.projected, save: (d.limit - d.projected) * rate })).sort((a, b) => b.save - a.save);
    return taxHead('Tax savings', T, 'Saved by your deductions, old regime', `<span class="amt">${U.inr(T.savedByClaims)}</span>`, [
      { l: 'More if every limit is filled', v: amt(T.potentialMore, true) }, { l: 'Your top old-regime rate', v: U.pct(T.marg) }, { l: 'Days left to act', v: String(T.daysLeft) }]) +
      `<section class="panel"><h2>Where you can still save</h2>
      ${newBest ? `<p class="note info">${ic('check')}The new regime is ${amt(T.cmp.diff)} cheaper for you today, so filling these gaps only pays off if you switch to the old regime${T.cmp.breakEven != null ? ` and pass ${amt(T.cmp.breakEven, true)} in deductions` : ''}. Check the comparison on the Tax page before investing just to save tax.</p>` : ''}
      ${opp.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Deduction</th><th scope="col" class="r">Room left</th><th scope="col" class="r">Tax saved, approx.</th><th scope="col">What to do</th></tr></thead><tbody>${opp.map(o => `<tr><td>${esc(o.d.name)}<small class="muted block">${esc(o.d.ref)}</small></td><td class="r"><span class="amt">${U.inr(o.room)}</span></td><td class="r"><span class="amt">${U.inr(o.save)}</span></td><td class="muted">${esc(o.d.tip)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Every capped limit is on track to be filled.</p>'}
      <p class="muted small">Approximate: room left multiplied by your old-regime top rate plus cess. Home loan and savings interest are claimed automatically, so they are not listed.</p></section>${taxFoot()}`;
  }

  /* ---------------------------------------------------- Goals, Sources, Settings */
  function viewGoals() {
    const gs = allGoals();
    const sections = [['Spending caps', ['spend-cap']], ['Investment targets', ['invest-target']], ['Tax-saving targets', ['deduction-target']], ['Savings', ['savings-rate', 'emergency-fund']]];
    const html = sections.map(s => {
      const list = gs.filter(g => s[1].indexOf(g.type) >= 0); if (!list.length) return '';
      return `<section class="goal-sec"><h2>${s[0]}</h2><ul class="goals">${list.map(g => goalCard(g).replace('</li>', g.user ? `<button type="button" class="link rm" data-rmgoal="${esc(g.id)}">Remove goal</button></li>` : '</li>')).join('')}</ul></section>`;
    }).join('');
    return `<div class="page-head"><div><h1>Goals</h1><p class="muted">Set a target once. It shows up on the dashboard, and on the page it belongs to.</p></div><button type="button" class="btn primary" data-newgoal>${ic('plus')}New goal</button></div>${html}<p class="foot">The tick on each bar marks where you would be if progress were even through the period. Goals you add are saved in this browser only.</p>`;
  }

  function viewSources() {
    const items = [
      ['Bank statements', 'Upload PDF or CSV statements. Spends are split by UPI, debit card, net banking and cash.', 'Planned'],
      ['Credit card statements', 'Upload monthly statements to capture card spends, dues and due dates.', 'Planned'],
      ['Stocks and mutual funds', 'Read broker statements and consolidated account statements for holdings and SIPs.', 'Planned'],
      ['Tax documents', 'Form 16, Form 26AS and AIS to match TDS and income with what the tax department sees.', 'Planned'],
      ['Manual entries', 'Cash spends, property, digital gold, foreign income and anything else without a statement.', 'Planned']];
    return `<div class="page-head"><div><h1>Sources</h1><p class="muted">Where your data will come from. This is the next phase of the build.</p></div></div>
      <section class="panel"><ul class="src">${items.map(i => `<li><div><h3>${i[0]}</h3><p class="muted">${i[1]}</p></div>${chip('flat', i[2], '')}</li>`).join('')}</ul></section>
      <section class="panel"><h2>Data health</h2><dl class="sum-stats plain"><div><dt>Entries in the sample</dt><dd>${E.length}</dd></div><div><dt>Waiting for a category</dt><dd>${D.lastSync.uncategorised}</dd></div><div><dt>Last synced</dt><dd>${esc(D.lastSync.label)}</dd></div></dl></section>`;
  }

  function viewSettings() {
    const slabTable = k => { const R = C.tax.regimes[k]; let prev = 0; return `<div class="panel"><h3>${R.name}</h3><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Income slab</th><th scope="col" class="r">Rate</th></tr></thead><tbody>${R.slabs.map(s => { const row = `<tr><td>${s.upto == null ? 'Above ' + U.inrC(prev) : U.inrC(prev) + ' to ' + U.inrC(s.upto)}</td><td class="r">${U.pct(s.rate)}</td></tr>`; prev = s.upto; return row; }).join('')}</tbody></table></div><p class="muted small">Standard deduction ${U.inr(R.standardDeduction)}. Rebate up to ${U.inr(R.rebate.max)} when taxable income is ${U.inrC(R.rebate.limit)} or less.</p></div>`; };
    return `<div class="page-head"><div><h1>Settings</h1><p class="muted">Preferences are saved in this browser.</p></div></div>
      <section class="panel"><h2>Appearance and privacy</h2><div class="set-row"><span>Theme</span><div class="toggle" role="group" aria-label="Theme">${['light', 'dark'].map(t => `<button type="button" data-theme-set="${t}" aria-pressed="${state.theme === t}">${t === 'light' ? 'Light' : 'Dark'}</button>`).join('')}</div></div>
        <div class="set-row"><span>Hide amounts</span><div class="toggle" role="group" aria-label="Hide amounts">${[[false, 'Show'], [true, 'Hide']].map(o => `<button type="button" data-mask-set="${o[0]}" aria-pressed="${!!state.mask === o[0]}">${o[1]}</button>`).join('')}</div></div></section>
      <section class="panel"><h2>Tax rules in use</h2><p class="muted">${C.tax.fyLabel}, checked on ${C.tax.verifiedOn}. These come from config.js, so changing a rule never touches the layout.</p><div class="drill-grid">${slabTable('new')}${slabTable('old')}</div>${C.tax.notes.map(n => `<p class="muted small">${esc(n)}</p>`).join('')}</section>
      <section class="panel"><h2>Saved data</h2><p class="muted">Clears your theme, period, privacy choice and any goals you added.</p><button type="button" class="btn" data-reset>Clear saved preferences</button></section>`;
  }

  /* ----------------------------------------------------------- goal modal */
  function goalForm(type) {
    const types = [['spend-cap', 'Spending cap'], ['invest-target', 'Investment target'], ['deduction-target', 'Tax-saving target'], ['savings-rate', 'Savings rate'], ['emergency-fund', 'Emergency fund']];
    let scope = '', tLabel = 'Target amount (₹)', periods = [['month', 'Every month'], ['fy', 'This financial year']];
    if (type === 'spend-cap') { scope = `<label>Applies to<select id="g-scope"><option value="">All spends</option>${Object.keys(HEADS.spend.cats).filter(k => k !== 'uncat').map(k => `<option value="${k}">${HEADS.spend.cats[k]}</option>`).join('')}</select></label>`; tLabel = 'Spend no more than (₹)'; }
    if (type === 'invest-target') tLabel = 'Invest at least (₹)';
    if (type === 'deduction-target') { scope = `<label>Deduction<select id="g-scope">${C.tax.deductionHeads.map(h => `<option value="${h.id}">${h.name}, ${h.short}</option>`).join('')}</select></label>`; tLabel = 'Claim at least (₹)'; periods = [['fy', 'This financial year']]; }
    if (type === 'savings-rate') tLabel = 'Save at least (% of income)';
    if (type === 'emergency-fund') { tLabel = 'Cash to keep aside (₹)'; periods = [['fy', 'No deadline']]; }
    return `<label>Goal type<select id="g-type">${types.map(t => `<option value="${t[0]}"${t[0] === type ? ' selected' : ''}>${t[1]}</option>`).join('')}</select></label>${scope}
      <label>${tLabel}<input id="g-target" type="number" inputmode="numeric" min="1" step="any" placeholder="${type === 'savings-rate' ? 'For example 30' : 'For example 50000'}"></label>
      <label>Period<select id="g-period">${periods.map(p => `<option value="${p[0]}">${p[1]}</option>`).join('')}</select></label>
      <p class="form-err" id="g-err" role="alert"></p>`;
  }
  function openGoalModal() {
    $('#modal-root').innerHTML = `<div class="modal-back" data-close><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">New goal</h2><div id="g-body">${goalForm('spend-cap')}</div>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="g-save">Save goal</button></div></div></div>`;
    const el = $('#g-type'); if (el) el.focus();
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  function saveGoal() {
    const type = $('#g-type').value, scopeEl = $('#g-scope'), scope = scopeEl ? scopeEl.value : '';
    let target = parseFloat($('#g-target').value), period = $('#g-period').value;
    if (!(target > 0)) { $('#g-err').textContent = 'Enter a target greater than zero.'; return; }
    if (type === 'savings-rate') { if (target > 95) { $('#g-err').textContent = 'Enter a percentage between 1 and 95.'; return; } target = target / 100; }
    const per = period === 'month' ? 'a month' : 'this financial year', tInr = U.inr(target);
    let name;
    if (type === 'spend-cap') name = `${scope ? HEADS.spend.cats[scope] : 'Spends'} under ${tInr} ${per}`;
    else if (type === 'invest-target') name = `Invest ${tInr} ${period === 'month' ? 'every month' : per}`;
    else if (type === 'deduction-target') name = `Claim ${tInr} under ${DED[scope].short}`;
    else if (type === 'savings-rate') name = `Save at least ${U.pct(target)} of income`;
    else name = `Emergency fund of ${tInr} in cash`;
    const g = { id: 'u' + Date.now(), type, name, target, period, user: true };
    if (type === 'spend-cap' && scope) g.cat = scope;
    if (type === 'deduction-target') g.ded = scope;
    state.userGoals.push(g); store.set('goals', state.userGoals); closeModal(); render({ keepScroll: true });
  }

  /* --------------------------------------------------------------- routing */
  function routePage(route) {
    if (route.page === 'overview') return route.sub && ['income', 'spend', 'invest', 'liab', 'networth', 'savings'].indexOf(route.sub) >= 0 ? viewDrill(route.sub) : viewOverview();
    if (route.page === 'tax') {
      if (route.sub === 'income') return drillTaxIncome();
      if (route.sub === 'deductions') return drillTaxDeductions();
      if (route.sub === 'tax') return drillTaxTax();
      if (route.sub === 'savings') return drillTaxSavings();
      return viewTax();
    }
    if (route.page === 'goals') return viewGoals();
    if (route.page === 'sources') return viewSources();
    return viewSettings();
  }

  const TITLES = { overview: 'Overview', tax: 'Tax', goals: 'Goals', sources: 'Sources', settings: 'Settings' };
  const FOCUS_KEYS = ['data-period', 'data-regime', 'data-group', 'data-filter', 'data-mask-set', 'data-theme-set', 'data-mask', 'data-theme-toggle'];
  function focusSelector(el) {
    if (!el || !el.getAttribute) return null;
    for (const k of FOCUS_KEYS) if (el.hasAttribute(k)) return `[${k}="${String(el.getAttribute(k)).replace(/"/g, '')}"]`;
    return null;
  }
  function render(opts) {
    const y = window.scrollY; TM = null;
    const refocus = opts && opts.keepScroll ? focusSelector(document.activeElement && document.activeElement.closest && document.activeElement.closest(FOCUS_KEYS.map(k => `[${k}]`).join(','))) : null;
    const route = parseRoute();
    document.documentElement.setAttribute('data-theme', state.theme);
    document.body.classList.toggle('mask', !!state.mask);
    $('#app').innerHTML = shell(route, routePage(route));
    document.title = TITLES[route.page] + ' | ' + C.appName;
    state.first = false;
    if (opts && opts.keepScroll) window.scrollTo(0, y);
    if (refocus) { const n = $(refocus); if (n) n.focus({ preventScroll: true }); }
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', ev => {
    const t = ev.target; let el;
    if ((el = t.closest('[data-period]'))) { state.period = el.dataset.period; store.set('period', state.period); state.filter = null; return render({ keepScroll: true }); }
    if ((el = t.closest('[data-regime]'))) { state.regime = el.dataset.regime; return render({ keepScroll: true }); }
    if ((el = t.closest('[data-group]'))) { state.group = el.dataset.group; state.filter = null; return render({ keepScroll: true }); }
    if ((el = t.closest('[data-filter]'))) { state.filter = state.filter === el.dataset.filter ? null : el.dataset.filter; return render({ keepScroll: true }); }
    if (t.closest('[data-mask]')) { state.mask = !state.mask; store.set('mask', state.mask); return render({ keepScroll: true }); }
    if ((el = t.closest('[data-mask-set]'))) { state.mask = el.dataset.maskSet === 'true'; store.set('mask', state.mask); return render({ keepScroll: true }); }
    if (t.closest('[data-theme-toggle]')) { state.theme = state.theme === 'dark' ? 'light' : 'dark'; store.set('theme', state.theme); return render({ keepScroll: true }); }
    if ((el = t.closest('[data-theme-set]'))) { state.theme = el.dataset.themeSet; store.set('theme', state.theme); return render({ keepScroll: true }); }
    if (t.closest('[data-newgoal]')) return openGoalModal();
    if ((el = t.closest('[data-rmgoal]'))) { state.userGoals = state.userGoals.filter(g => g.id !== el.dataset.rmgoal); store.set('goals', state.userGoals); return render({ keepScroll: true }); }
    if (t.closest('[data-reset]')) { store.clear(); state.userGoals = []; state.mask = false; state.period = 'FY'; return render({ keepScroll: true }); }
    if (t.closest('#g-save')) return saveGoal();
    if ((el = t.closest('[data-close]'))) { if (el.classList.contains('modal-back') && t.closest('.modal')) return; return closeModal(); }
    if ((el = t.closest('[data-pre]'))) { state.group = 'category'; state.filter = el.dataset.pre; state.keepFilter = true; }
  });
  document.addEventListener('change', ev => { if (ev.target && ev.target.id === 'g-type') { $('#g-body').innerHTML = goalForm(ev.target.value); $('#g-type').focus(); } });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#modal-root').firstChild) closeModal(); });

  const tip = () => $('#tip');
  function placeTip(e) {
    const t = tip(), w = t.offsetWidth, h = t.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    t.style.transform = `translate(${Math.max(8, x)}px,${Math.max(8, y)}px)`;
  }
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) return; tip().innerHTML = el.getAttribute('data-tip'); tip().classList.add('on'); placeTip(e); });
  document.addEventListener('mousemove', e => { if (tip().classList.contains('on')) placeTip(e); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) tip().classList.remove('on'); });

  window.addEventListener('hashchange', () => {
    if (!state.keepFilter) state.filter = null;
    state.keepFilter = false;
    tip().classList.remove('on'); closeModal();
    render(); window.scrollTo(0, 0);
    const p = $('#page'); if (p) p.focus({ preventScroll: true });
  });

  render();
})();
