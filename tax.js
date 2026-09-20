/* ==========================================================================
   tax.js: pure calculation, no DOM. Reads all rules from CONFIG.tax.
   Written so it can move to the backend unchanged (module.exports at the end).
   ========================================================================== */
(function (root) {
  'use strict';
  const cfg = () => root.CONFIG.tax;

  function limitFor(h, profile) {
    if (h.limitSenior != null && profile && h.seniorFlag && profile[h.seniorFlag]) return h.limitSenior;
    return h.limit;
  }

  function slabTax(income, slabs) {
    let prev = 0, tax = 0;
    const rows = slabs.map(s => {
      const top = s.upto == null ? Infinity : s.upto;
      const inSlab = Math.max(0, Math.min(income, top) - prev);
      const row = { from: prev, to: s.upto, rate: s.rate, inSlab, tax: inSlab * s.rate };
      tax += row.tax; prev = top;
      return row;
    });
    return { tax, rows };
  }

  function marginalRate(regime, income) {
    const slabs = cfg().regimes[regime].slabs;
    for (const s of slabs) if (income <= (s.upto == null ? Infinity : s.upto)) return s.rate;
    return slabs[slabs.length - 1].rate;
  }

  /* inp: { salary, houseProperty (net), business, foreign, other, stcgEquity, ltcgEquity,
            deductions: {id: amount}, profile }
     opts.dedTotal overrides the deduction total (used for break-even search). */
  function computeRegime(key, inp, opts) {
    const T = cfg(), R = T.regimes[key], cg = T.capitalGains.equity;
    const slabIncome = inp.salary + inp.houseProperty + inp.business + inp.foreign + inp.other;
    const stdDed = inp.salary > 0 ? Math.min(R.standardDeduction, inp.salary) : 0;

    let dedApplied = 0;
    const dedRows = [];
    if (R.allowsDeductions) {
      if (opts && opts.dedTotal != null) {
        dedApplied = opts.dedTotal;
      } else {
        T.deductionHeads.forEach(h => {
          const claimed = (inp.deductions && inp.deductions[h.id]) || 0;
          const limit = limitFor(h, inp.profile);
          const allowed = limit == null ? claimed : Math.min(claimed, limit);
          dedApplied += allowed;
          dedRows.push({ id: h.id, claimed, limit, allowed });
        });
      }
    }

    const taxable = Math.max(0, slabIncome - stdDed - dedApplied);
    const st = slabTax(taxable, R.slabs);
    let rebate = 0, relief = 0;
    if (taxable <= R.rebate.limit) rebate = Math.min(st.tax, R.rebate.max);
    else if (R.rebate.marginalRelief) relief = Math.max(0, st.tax - (taxable - R.rebate.limit));
    const slabAfter = st.tax - rebate - relief;

    const stcgTax = inp.stcgEquity * cg.stcg;
    const ltcgTaxable = Math.max(0, inp.ltcgEquity - cg.ltcgExempt);
    const ltcgTax = ltcgTaxable * cg.ltcg;
    const preCess = slabAfter + stcgTax + ltcgTax;
    const total = Math.round(preCess * (1 + T.cess));
    const slabAfterR = Math.round(slabAfter), cgTax = Math.round(stcgTax + ltcgTax);

    return {
      regime: key, name: R.name, slabIncome, stdDed, dedApplied, dedRows, taxable,
      slabRows: st.rows, slabTaxRaw: st.tax, rebate, relief,
      slabAfter: slabAfterR, stcgTax, ltcgTax, ltcgTaxable, ltcgExemptUsed: Math.min(inp.ltcgEquity, cg.ltcgExempt),
      cgTax, cess: total - slabAfterR - cgTax, total,
      marginal: marginalRate(key, taxable)
    };
  }

  // Smallest total deduction at which the old regime costs no more than the new regime
  function breakEven(inp, newTotal) {
    for (let d = 0; d <= 4000000; d += 5000) {
      if (computeRegime('old', inp, { dedTotal: d }).total <= newTotal) return d;
    }
    return null;
  }

  function compare(inp) {
    const n = computeRegime('new', inp), o = computeRegime('old', inp);
    return { new: n, old: o, best: o.total < n.total ? 'old' : 'new', diff: Math.abs(n.total - o.total), breakEven: breakEven(inp, n.total) };
  }

  /* advances: [{date:'YYYY-MM-DD', amount}] paid so far in this FY */
  function advanceSchedule(netTax, fyStartYear, advances, todayStr) {
    const c = cfg().advanceTax, required = netTax >= c.threshold, pad = n => String(n).padStart(2, '0');
    const items = c.instalments.map(i => {
      const y = i.month >= 4 ? fyStartYear : fyStartYear + 1;
      const due = `${y}-${pad(i.month)}-${pad(i.day)}`;
      const target = required ? Math.round(netTax * i.cum) : 0;
      const cutoff = due < todayStr ? due : todayStr;
      const paidCum = advances.filter(a => a.date <= cutoff).reduce((t, a) => t + a.amount, 0);
      const past = due < todayStr;
      return { due, cum: i.cum, target, paidCum, past, status: past ? (paidCum >= target ? 'paid' : 'short') : 'upcoming', gap: Math.max(0, target - paidCum) };
    });
    const next = items.find(i => i.status === 'upcoming');
    if (next) next.next = true;
    return { required, threshold: c.threshold, items };
  }

  const api = { limitFor, slabTax, marginalRate, computeRegime, breakEven, compare, advanceSchedule };
  root.TAX = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
