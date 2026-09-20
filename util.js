/* util.js: formatting and date helpers shared by every other file. */
(function (root) {
  'use strict';

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const daysIn = (y, m) => new Date(y, m, 0).getDate();            // m is 1-12
  const som = d => new Date(d.getFullYear(), d.getMonth(), 1);

  function addMonths(d, n) {
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), daysIn(t.getFullYear(), t.getMonth() + 1)));
  }
  const monthKey = d => (typeof d === 'string' ? d : ymd(d)).slice(0, 7);
  const monLabel = k => MON[+k.slice(5, 7) - 1];
  const monLabelY = k => MON[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);

  function fyStart(d, startMonth) {
    const y = d.getMonth() + 1 >= startMonth ? d.getFullYear() : d.getFullYear() - 1;
    return new Date(y, startMonth - 1, 1);
  }

  const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const inr = n => (n < 0 ? '−' : '') + '₹' + nf.format(Math.round(Math.abs(n)));

  function trim(x) {
    const s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }
  // Compact Indian format: ₹1.25 L, ₹3.4 Cr
  function inrC(n) {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e7) return s + '₹' + trim(a / 1e7) + ' Cr';
    if (a >= 1e5) return s + '₹' + trim(a / 1e5) + ' L';
    return s + '₹' + nf.format(Math.round(a));
  }
  const pct = (x, d) => (x * 100).toFixed(d || 0) + '%';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function shortDate(s) { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function longDate(s) { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtRange(a, b) {
    const A = parse(a), B = parse(b), ds = d => d.getDate() + ' ' + MON[d.getMonth()];
    if (A.getFullYear() === B.getFullYear()) {
      return A.getMonth() === B.getMonth()
        ? `${A.getDate()}–${B.getDate()} ${MON[A.getMonth()]} ${A.getFullYear()}`
        : `${ds(A)} – ${ds(B)} ${B.getFullYear()}`;
    }
    return `${ds(A)} ${A.getFullYear()} – ${ds(B)} ${B.getFullYear()}`;
  }

  root.U = { MON, pad, ymd, parse, daysIn, som, addMonths, monthKey, monLabel, monLabelY, daysBetween, fyStart,
             inr, inrC, pct, esc, shortDate, longDate, fmtRange };
})(window);
