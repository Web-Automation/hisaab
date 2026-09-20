/* ==========================================================================
   config.js
   Everything that is a RULE or a LABEL lives here, not in the UI code.
   When tax rules change (or the Income-tax Act 2025 renumbers sections),
   this is the only file you edit.
   ========================================================================== */
window.CONFIG = {
  appName: 'Hisaab',          // placeholder product name, change freely
  today: null,                // set 'YYYY-MM-DD' to freeze the sample date; null = real today
  fyStartMonth: 4,            // Indian financial year starts in April

  /* ------------------------------ TAX RULES ------------------------------ */
  tax: {
    fyLabel: 'FY 2026-27',
    ayLabel: 'AY 2027-28',
    verifiedOn: '20 Sep 2026',
    notes: [
      'Slabs, rebate and standard deduction follow Budget 2026 for FY 2026-27, which left them unchanged from FY 2025-26.',
      'Section references follow the Income-tax Act 1961. The Income-tax Act 2025 renumbers them, so update the "ref" labels below when you switch.',
      'Not modelled yet: surcharge (income above ₹50 lakh), HRA and LTA, marginal relief on capital gains, 80G eligibility percentages, foreign tax credit.'
    ],
    cess: 0.04,

    regimes: {
      new: {
        name: 'New regime', short: 'New',
        standardDeduction: 75000,
        allowsDeductions: false,
        rebate: { limit: 1200000, max: 60000, marginalRelief: true },
        slabs: [
          { upto: 400000,  rate: 0 },
          { upto: 800000,  rate: 0.05 },
          { upto: 1200000, rate: 0.10 },
          { upto: 1600000, rate: 0.15 },
          { upto: 2000000, rate: 0.20 },
          { upto: 2400000, rate: 0.25 },
          { upto: null,    rate: 0.30 }
        ]
      },
      old: {
        name: 'Old regime', short: 'Old',
        standardDeduction: 50000,
        allowsDeductions: true,
        rebate: { limit: 500000, max: 12500, marginalRelief: false },
        slabs: [
          { upto: 250000, rate: 0 },
          { upto: 500000, rate: 0.05 },
          { upto: 1000000, rate: 0.20 },
          { upto: null,   rate: 0.30 }
        ]
      }
    },

    houseProperty: { standardDeductionPct: 0.30 },

    capitalGains: {
      // Listed equity and equity mutual funds
      equity: { stcg: 0.20, ltcg: 0.125, ltcgExempt: 125000 }
    },

    // Deductions (old regime). limit null = no cap. Section refs are labels only.
    deductionHeads: [
      { id: '80c',         name: 'PF, PPF, ELSS and life insurance', ref: 'Section 80C',      short: '80C',       limit: 150000,
        tip: 'Top up PPF or an ELSS SIP before 31 March.' },
      { id: 'nps',         name: 'NPS, additional contribution',     ref: 'Section 80CCD(1B)', short: '80CCD(1B)', limit: 50000,
        tip: 'A one-time NPS Tier I deposit closes the gap.' },
      { id: '80d_self',    name: 'Health insurance, self and family', ref: 'Section 80D',     short: '80D',       limit: 25000,
        tip: 'Premiums paid by cheque, card or net banking count.' },
      { id: '80d_parents', name: 'Health insurance, parents',        ref: 'Section 80D',      short: '80D',       limit: 25000, limitSenior: 50000, seniorFlag: 'seniorParents',
        tip: 'A parents\' health policy is a separate limit from your own.' },
      { id: 'hl',          name: 'Home loan interest',               ref: 'Section 24(b)',    short: '24(b)',     limit: 200000,
        tip: 'Comes from your home loan EMIs automatically.' },
      { id: '80e',         name: 'Education loan interest',          ref: 'Section 80E',      short: '80E',       limit: null,
        tip: 'No cap, and it comes from your EMIs automatically.' },
      { id: '80g',         name: 'Donations',                        ref: 'Section 80G',      short: '80G',       limit: null,
        tip: 'Keep the receipt and the charity\'s 80G registration.' },
      { id: '80tta',       name: 'Savings account interest',         ref: 'Section 80TTA',    short: '80TTA',     limit: 10000,
        tip: 'Claimed automatically from savings interest.' }
    ],

    advanceTax: {
      threshold: 10000,   // no advance tax if tax after TDS is below this
      instalments: [
        { month: 6,  day: 15, cum: 0.15 },
        { month: 9,  day: 15, cum: 0.45 },
        { month: 12, day: 15, cum: 0.75 },
        { month: 3,  day: 15, cum: 1.00 }
      ]
    },

    // How each income source is projected to the full year
    projection: { salary: 'series', rental: 'series', business: 'runrate', foreign: 'runrate', other: 'runrate', capital: 'actual' },

    treatment: {
      salary:   'Slab rates, after the standard deduction',
      rental:   'Slab rates, after a 30% standard deduction',
      business: 'Slab rates',
      foreign:  'Slab rates; foreign tax credit may apply',
      other:    'Slab rates',
      capital:  'Special rates: 20% short-term, 12.5% long-term above ₹1.25 lakh'
    }
  },

  /* ------------------------- HEADS AND CATEGORIES ------------------------ */
  heads: {
    income: {
      name: 'Income', hue: 'income', good: 'up',
      cats: { salary: 'Salaried', capital: 'Capital gains', business: 'Business', foreign: 'Foreign income', rental: 'Rental income', other: 'Other sources' }
    },
    spend: {
      name: 'Spends', hue: 'spend', good: 'down',
      cats: { groceries: 'Groceries', dining: 'Dining and delivery', utilities: 'Bills and utilities', transport: 'Transport and fuel',
              shopping: 'Shopping', health: 'Health', travel: 'Travel and leisure', subs: 'Subscriptions',
              insurance: 'Insurance', giving: 'Donations', uncat: 'Uncategorised' },
      instruments: { cc: 'Credit card', dc: 'Debit card', upi: 'UPI', nb: 'Net banking', cash: 'Cash' }
    },
    invest: {
      name: 'Investments', hue: 'invest', good: 'up',
      cats: { equity: 'Stocks', etf: 'ETFs', mf: 'Mutual funds', sip: 'SIPs', gold: 'Digital gold and silver',
              retirement: 'Retirement (EPF, PPF, NPS)', fd: 'Fixed deposits', bond: 'Bonds', cash: 'Cash and savings', other: 'Land, buildings and others' }
    },
    liab: {
      name: 'Liabilities', hue: 'liab', good: 'down',
      cats: { home: 'Home loan', car: 'Car loan', edu: 'Education loan', cc: 'Credit card dues' }
    },
    emi:  { name: 'Loan EMIs', cats: { home: 'Home loan', car: 'Car loan', edu: 'Education loan' } },
    tax:  { name: 'Tax paid',  cats: { tds: 'TDS', advance: 'Advance tax' } }
  }
};
