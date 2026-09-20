/* ==========================================================================
   data.js: SAMPLE DATA ONLY.
   Generates believable, deterministic entries relative to today's date.
   In the backend phase this file is replaced by real data with the same shape:

   entries[]  { id, date:'YYYY-MM-DD', head:'income'|'spend'|'invest'|'emi'|'tax',
                cat, label, amount, instrument?, series?, ded?:[{id, amt}], cg?, foreign? }
   holdings[] { cls, value, invested }        (snapshot today)
   liabilities[], balances{assets,liabs,liabByLoan} (month-end series), profile, goals[]

   One entry is stored once. Deduction tags (ded) let the same entry show under
   Investments/Spends AND under Tax deductions without double counting.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.CONFIG, U = window.U;
  const todayStr = C.today || U.ymd(new Date());
  const TODAY = U.parse(todayStr);
  const FYS = U.fyStart(TODAY, C.fyStartMonth);
  const START = U.addMonths(FYS, -12);                   // start of the previous FY, for year-on-year comparison

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const r = mulberry32(20260920);
  const rnd = (a, b) => a + (b - a) * r();
  const ri = (a, b) => Math.round(rnd(a, b));
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = a => a[Math.floor(r() * a.length)];
  const wpick = o => { const x = r(); let s = 0, last; for (const k in o) { s += o[k]; last = k; if (x <= s) return k; } return last; };
  const r10 = n => Math.round(n / 10) * 10;

  const entries = [];
  let nid = 1;
  const add = e => { if (e.date > todayStr) return; e.id = nid++; entries.push(e); };

  /* ---------- static definitions ---------- */
  const SPEND = [
    { cat: 'groceries', n: [6, 9], a: [450, 1700], m: ['BigBasket', 'DMart', 'Blinkit', 'Zepto', 'Local kirana'], inst: { upi: .5, cc: .35, dc: .1, cash: .05 } },
    { cat: 'dining',    n: [4, 7], a: [320, 1100], m: ['Swiggy', 'Zomato', 'Cafe Coffee Day', 'Neighbourhood restaurant', 'Chai Point'], inst: { cc: .5, upi: .45, cash: .05 } },
    { cat: 'transport', n: [5, 8], a: [180, 1500], m: ['HP Petrol Pump', 'Uber', 'FASTag recharge', 'Metro card top-up', 'Ola'], inst: { upi: .4, cc: .35, dc: .2, cash: .05 } },
    { cat: 'shopping',  n: [1, 3], a: [700, 3800], m: ['Amazon', 'Myntra', 'Croma', 'Decathlon', 'Flipkart'], inst: { cc: .75, upi: .2, nb: .05 } },
    { cat: 'health',    n: [0, 2], a: [250, 1400], m: ['Apollo Pharmacy', 'Diagnostics lab', 'Clinic consultation'], inst: { upi: .6, dc: .2, cash: .2 } },
    { cat: 'travel',    n: [0, 2], a: [1200, 6500], m: ['IRCTC', 'MakeMyTrip', 'Weekend stay', 'Cinema'], inst: { cc: .65, nb: .25, upi: .1 } }
  ];
  const BILLS = [
    { cat: 'utilities', d: 12, label: 'Electricity bill', a: [1300, 2600], inst: 'nb' },
    { cat: 'utilities', d: 3,  label: 'Broadband', a: [1180, 1180], inst: 'upi' },
    { cat: 'utilities', d: 8,  label: 'Mobile recharge', a: [599, 599], inst: 'upi' },
    { cat: 'utilities', d: 20, label: 'Cooking gas', a: [880, 940], inst: 'upi', every: 2 },
    { cat: 'subs',      d: 14, label: 'Streaming and cloud subscriptions', a: [898, 898], inst: 'cc' }
  ];
  // [year-month, day, cat, instrument, label, amount, ded]
  const ONE_SPEND = [
    ['2025-05', 12, 'insurance', 'nb', 'Health insurance premium, family floater', 17200, [{ id: '80d_self', amt: 17200 }]],
    ['2026-05', 12, 'insurance', 'nb', 'Health insurance premium, family floater', 18400, [{ id: '80d_self', amt: 18400 }]],
    ['2025-06', 20, 'insurance', 'nb', 'Life insurance premium', 12000, [{ id: '80c', amt: 12000 }]],
    ['2026-06', 20, 'insurance', 'nb', 'Life insurance premium', 12000, [{ id: '80c', amt: 12000 }]],
    ['2025-08', 9,  'insurance', 'cc', 'Car insurance renewal', 13500, null],
    ['2026-08', 9,  'insurance', 'cc', 'Car insurance renewal', 14200, null],
    ['2025-10', 18, 'giving', 'upi', 'Donation to a registered charity (50% eligible)', 5000, [{ id: '80g', amt: 2500 }]],
    ['2026-08', 22, 'giving', 'upi', 'Donation to a registered charity (50% eligible)', 3000, [{ id: '80g', amt: 1500 }]]
  ];
  const ONE_INVEST = [
    ['2025-09', 12, 'fd', 'Fixed deposit, 7.1% for 3 years', 100000],
    ['2025-10', 15, 'mf', 'Flexi-cap fund, lump sum', 30000],
    ['2025-12', 11, 'bond', 'Corporate bond purchase', 40000],
    ['2026-06', 12, 'fd', 'Fixed deposit, 7.1% for 3 years', 75000],
    ['2026-07', 14, 'mf', 'Flexi-cap fund, lump sum', 25000],
    ['2026-08', 13, 'bond', 'Corporate bond purchase', 30000]
  ];
  const CG = [
    ['2025-06', 'short', 18000, 'Sold ETF units'], ['2025-08', 'long', 42000, 'Sold mutual fund units'],
    ['2025-11', 'short', 9000, 'Sold stock, HDFCBANK'], ['2026-02', 'long', 68000, 'Sold mutual fund units'],
    ['2026-05', 'short', 14500, 'Sold stock, INFY'], ['2026-07', 'long', 52000, 'Sold mutual fund units'],
    ['2026-08', 'short', 21000, 'Sold stock, TATAMOTORS']
  ];
  const ADVANCE = [['2025-06-14', 6000], ['2025-09-14', 9000], ['2025-12-13', 9000], ['2026-03-14', 7000], ['2026-06-14', 8500], ['2026-09-14', 16000]];

  const LOANS = [
    { id: 'home', name: 'Home loan', lender: 'HDFC Bank', outstanding: 2200000, rate: 8.35, emi: 21500, day: 5, ded: 'hl', monthsLeft: 150 },
    { id: 'car',  name: 'Car loan', lender: 'SBI', outstanding: 360000, rate: 9.2, emi: 11200, day: 7, ded: null, monthsLeft: 36 },
    { id: 'edu',  name: 'Education loan', lender: 'Bank of Baroda', outstanding: 190000, rate: 8.9, emi: 4800, day: 10, ded: '80e', monthsLeft: 44 }
  ];
  LOANS.forEach(l => { l.principal = Math.round(l.emi - l.outstanding * l.rate / 1200); });

  const prevMonthStart = U.addMonths(U.som(TODAY), -1);
  const curMonthIdx = TODAY.getFullYear() * 12 + TODAY.getMonth();

  /* ---------- month-by-month generation ---------- */
  const months = [];
  for (let m = new Date(START); m <= TODAY; m = U.addMonths(m, 1)) {
    const Y = m.getFullYear(), M = m.getMonth() + 1, dim = U.daysIn(Y, M), ym = `${Y}-${U.pad(M)}`;
    const day = d => `${ym}-${U.pad(Math.min(d, dim))}`;
    const cur = m >= FYS;
    const back = curMonthIdx - (Y * 12 + M - 1);
    const qtr = [3, 6, 9, 12].indexOf(M) >= 0;
    months.push(ym);

    // ---- income
    add({ head: 'income', cat: 'salary', date: day(1), label: 'Salary, Northwind Pvt Ltd', amount: cur ? 95000 : 88000, series: 'salary' });
    add({ head: 'income', cat: 'rental', date: day(5), label: 'Rent from tenant, 2BHK flat', amount: 10000, series: 'rent' });
    for (let i = 0, n = rint(1, 2); i < n; i++) {
      add({ head: 'income', cat: 'business', date: day(rint(3, 27)), label: 'Freelance, ' + pick(['brand design', 'UX audit', 'website build', 'monthly retainer']), amount: r10(ri(3500, 9500)) });
    }
    if (r() < 0.25) {
      const usd = rint(250, 420), fx = +rnd(86.4, 88.6).toFixed(2);
      add({ head: 'income', cat: 'foreign', date: day(rint(6, 24)), label: `Client in Berlin, USD ${usd} at ₹${fx}`, amount: Math.round(usd * fx), foreign: { currency: 'USD', amount: usd, rate: fx } });
    }
    if (qtr) {
      add({ head: 'income', cat: 'other', date: day(1), label: 'Fixed deposit interest, quarterly', amount: 10500 });
      add({ head: 'income', cat: 'other', date: day(1), label: 'Savings account interest', amount: 1500, ded: [{ id: '80tta', amt: 1500 }] });
    }
    if (r() < 0.4) add({ head: 'income', cat: 'other', date: day(rint(8, 26)), label: 'Dividends, ' + pick(['ITC', 'Coal India', 'HDFC Bank', 'Infosys']), amount: ri(800, 3200) });
    CG.filter(x => x[0] === ym).forEach(x => add({
      head: 'income', cat: 'capital', date: day(rint(10, 25)), amount: x[2],
      label: x[3] + (x[1] === 'long' ? ', long-term gain' : ', short-term gain'), cg: { term: x[1], asset: 'equity' }
    }));

    // ---- spends
    SPEND.forEach(c => {
      const n = rint(c.n[0], c.n[1]);
      for (let i = 0; i < n; i++) add({ head: 'spend', cat: c.cat, instrument: wpick(c.inst), date: day(rint(1, dim)), label: pick(c.m), amount: r10(ri(c.a[0], c.a[1])) });
    });
    BILLS.forEach(b => { if (b.every && M % b.every) return; add({ head: 'spend', cat: b.cat, instrument: b.inst, date: day(b.d), label: b.label, amount: ri(b.a[0], b.a[1]) }); });
    ONE_SPEND.filter(x => x[0] === ym).forEach(x => add({ head: 'spend', cat: x[2], instrument: x[3], date: day(x[1]), label: x[4], amount: x[5], ded: x[6] || undefined }));
    if (m >= prevMonthStart) {
      add({ head: 'spend', cat: 'uncat', instrument: 'upi', date: day(4), label: 'UPI payment, unknown payee', amount: 640 });
      add({ head: 'spend', cat: 'uncat', instrument: 'dc', date: day(11), label: 'Card swipe, unrecognised merchant', amount: 1250 });
      if (back === 0) add({ head: 'spend', cat: 'uncat', instrument: 'upi', date: day(15), label: 'UPI payment, unknown payee', amount: 300 });
    }

    // ---- investments
    add({ head: 'invest', cat: 'sip', date: day(7), label: 'SIP, Nifty 50 index fund', amount: 10000, series: 'sip-idx' });
    add({ head: 'invest', cat: 'sip', date: day(7), label: 'SIP, ELSS tax saver fund', amount: 2500, ded: [{ id: '80c', amt: 2500 }], series: 'sip-elss' });
    add({ head: 'invest', cat: 'sip', date: day(7), label: 'SIP, small-cap fund', amount: 3000, series: 'sip-sc' });
    add({ head: 'invest', cat: 'gold', date: day(10), label: 'Digital gold purchase', amount: 2000, series: 'gold' });
    add({ head: 'invest', cat: 'retirement', date: day(1), label: 'EPF, employee contribution', amount: 5700, ded: [{ id: '80c', amt: 5700 }], series: 'epf' });
    add({ head: 'invest', cat: 'retirement', date: day(15), label: 'NPS Tier I, additional contribution', amount: 3500, ded: [{ id: 'nps', amt: 3500 }], series: 'nps' });
    if (M === 4) add({ head: 'invest', cat: 'retirement', date: day(6), label: 'PPF deposit', amount: 20000, ded: [{ id: '80c', amt: 20000 }] });
    if (r() < 0.45) add({ head: 'invest', cat: 'equity', date: day(rint(3, 26)), label: 'Bought ' + pick(['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ITC']) + ' shares', amount: r10(ri(6000, 22000)) });
    if (qtr) add({ head: 'invest', cat: 'etf', date: day(18), label: 'Nifty ETF units', amount: 10000 });
    ONE_INVEST.filter(x => x[0] === ym).forEach(x => add({ head: 'invest', cat: x[2], date: day(x[1]), label: x[3], amount: x[4] }));

    // ---- loan EMIs (interest portion feeds the deduction tags)
    LOANS.forEach(l => {
      const interest = Math.round((l.outstanding + l.principal * (back + 1)) * l.rate / 1200);
      add({ head: 'emi', cat: l.id, date: day(l.day), label: l.name + ' EMI', amount: l.emi, principal: l.emi - interest, interest,
            ded: l.ded ? [{ id: l.ded, amt: interest }] : undefined, series: 'emi-' + l.id });
    });

    // ---- tax already paid
    add({ head: 'tax', cat: 'tds', date: day(1), label: 'TDS on salary, Northwind Pvt Ltd', amount: cur ? 5200 : 4600, series: 'tds-sal' });
    if (qtr) add({ head: 'tax', cat: 'tds', date: day(25), label: 'TDS deducted by freelance clients', amount: 1800 });
  }
  ADVANCE.forEach(a => add({ head: 'tax', cat: 'advance', date: a[0], label: 'Advance tax instalment', amount: a[1] }));

  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

  /* ---------- snapshots ---------- */
  const holdings = [
    { cls: 'equity',     value: 685000,  invested: 598000 },
    { cls: 'etf',        value: 210000,  invested: 188000 },
    { cls: 'mf',         value: 540000,  invested: 465000 },
    { cls: 'sip',        value: 425000,  invested: 372000 },
    { cls: 'gold',       value: 105000,  invested: 92000 },
    { cls: 'retirement', value: 812000,  invested: 735000 },
    { cls: 'fd',         value: 600000,  invested: 560000 },
    { cls: 'bond',       value: 150000,  invested: 144000 },
    { cls: 'cash',       value: 320000,  invested: 320000 },
    { cls: 'other',      value: 7200000, invested: 6300000 }
  ];
  const liabilities = LOANS.map(l => ({ id: l.id, name: l.name, lender: l.lender, outstanding: l.outstanding, rate: l.rate, emi: l.emi, monthsLeft: l.monthsLeft }));
  liabilities.push({ id: 'cc', name: 'Credit card dues', lender: 'Two cards', outstanding: 38200, dueDate: U.ymd(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 5)), minDue: 1910 });

  /* ---------- month-end balance series (back-cast from today's snapshot) ---------- */
  const N = months.length;
  const finNow = holdings.filter(h => h.cls !== 'other').reduce((t, h) => t + h.value, 0);
  const propNow = holdings.find(h => h.cls === 'other').value;
  const assets = {}, liabs = {}, liabByLoan = { home: {}, car: {}, edu: {}, cc: {} };
  months.forEach((k, i) => {
    const back = N - 1 - i, noise = back === 0 ? 0 : (r() - 0.5) * 0.012;
    assets[k] = Math.round(finNow * Math.pow(0.9905, back) * (1 + noise) + propNow * Math.pow(0.997, back));
    let L = 0;
    LOANS.forEach(l => { const v = Math.round(l.outstanding + l.principal * back); liabByLoan[l.id][k] = v; L += v; });
    const cc = back === 0 ? 38200 : ri(22000, 52000);
    liabByLoan.cc[k] = cc; L += cc; liabs[k] = L;
  });

  /* ---------- goals (user can add more in the UI) ---------- */
  const goals = [
    { id: 'g1', type: 'spend-cap',        name: 'Keep spends under ₹45,000 a month',      target: 45000, period: 'month', cat: null },
    { id: 'g2', type: 'spend-cap',        name: 'Dining and delivery under ₹5,000 a month', target: 5000, period: 'month', cat: 'dining' },
    { id: 'g3', type: 'invest-target',    name: 'Invest ₹4,00,000 this financial year',   target: 400000, period: 'fy' },
    { id: 'g4', type: 'deduction-target', name: 'Fill the ₹1.5 lakh Section 80C limit',   target: 150000, period: 'fy', ded: '80c' },
    { id: 'g5', type: 'savings-rate',     name: 'Save at least 30% of income',            target: 0.30, period: 'fy' },
    { id: 'g6', type: 'emergency-fund',   name: 'Emergency fund of ₹5,00,000 in cash',    target: 500000, period: 'fy' }
  ];

  window.DATA = {
    sample: true, today: todayStr, entries, holdings, liabilities, months,
    balances: { assets, liabs, liabByLoan },
    profile: { seniorParents: true, residency: 'Resident individual' },
    goals, lastSync: { label: 'Today, 8:42 am', uncategorised: entries.filter(e => e.cat === 'uncat').length }
  };
})();
