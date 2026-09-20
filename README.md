# Hisaab: a personal money and tax dashboard for India

Hisaab ("account" in Hindi) brings a person's whole financial picture into one place: what they earn, what they spend, what they own, what they owe, and what tax they will pay. It is built around the Indian financial year (April to March) and Indian tax rules, so it can answer questions such as "how much of my 80C limit is left?" and "am I better off in the old or new regime?"

> **Status: Phase 1 (frontend) is done. Phase 2 (backend) is planned, not started.**
> Every number on screen today is **sample data**. Nothing here reads a real bank or tax document yet.

`Hisaab` is a placeholder name. Change it in `config.js` (`appName`) and the `<title>` in `index.html`.

---

## Contents

1. [The idea](#1-the-idea)
2. [How the product is organised](#2-how-the-product-is-organised)
3. [What has been built so far](#3-what-has-been-built-so-far)
4. [Files and how they fit together](#4-files-and-how-they-fit-together)
5. [The data contract](#5-the-data-contract)
6. [Money definitions used today](#6-money-definitions-used-today)
7. [Next: the backend plan](#7-next-the-backend-plan)
8. [Open questions](#8-open-questions)
9. [Run it and put it on GitHub Pages](#9-run-it-and-put-it-on-github-pages)
10. [Known limits](#10-known-limits)

---

## 1. The idea

Most people can tell you their salary but not their savings rate, and most only think about tax in March. The information exists (bank statements, card statements, broker reports, Form 16, AIS) but it is scattered across PDFs and apps, and nothing connects a spend to its tax effect.

Hisaab's job is to connect them:

- **One place for everything.** Income, spends, investments, liabilities, savings and net worth.
- **Tax as a second lens on the same data.** The same entries that show up as an investment or a spend also count as tax deductions, without being counted twice.
- **Goals with a pace.** "Invest ₹4 lakh this year", "keep dining under ₹5,000 a month", "fill the 80C limit by 31 March". Each goal shows whether you are on track today, not just at year end.
- **Private by default.** This is sensitive data. A privacy mask hides every amount with one click, and the backend plan below is built around keeping data with the user.

Primary user for now: **one individual** tracking their own finances. Family or HUF profiles and CA (advisor) access are parked for later, but the data model should not make them impossible.

---

## 2. How the product is organised

### The heads

| Head | What it holds |
|---|---|
| **Income** | Salaried, capital gains, business, foreign income, rental income, other sources |
| **Spends** | Everything paid out, split by payment instrument (credit card, debit card, UPI, net banking, cash) and by category |
| **Investments** | Stocks, ETFs, mutual funds, SIPs, digital gold and silver, retirement (EPF, PPF, NPS), fixed deposits, bonds, cash, and land, buildings and others |
| **Liabilities** | Home, car and education loans, credit card dues |
| **Savings and net worth** | Worked out from the four above (see section 6) |
| **Deductions** | Tax-saving claims, tracked against their legal limits (Tax mode only) |

Retirement (EPF, PPF, NPS) was added to the original list of investment types because those are the main drivers of the 80C and NPS deductions.

### Two modes on one shell

| | **Overview** | **Tax** |
|---|---|---|
| Question it answers | Where is my money going and growing? | How much tax will I pay and how can I lower it? |
| Period | Month, quarter or financial year | Locked to the financial year |
| Hero | Net worth, and where your income went | Tax still to pay (or refund) |
| Tiles | Income, Spends, Investments, Liabilities | Income, Deductions, Tax amount, Tax savings |
| Extras | Money in and out, goals, alerts | Old vs new regime, advance tax dates |

Both share the same top bar (mode switch, period, sync status, privacy mask, theme). Overview uses a blue accent and Tax uses an amber one so you always know which mode you are in.

### The key idea: store once, tag once, count once

A transaction is stored a single time. It is then **tagged** so it can appear in more than one view:

- An ELSS SIP is an **investment** and also counts toward **80C**.
- A health insurance premium is a **spend** and also counts toward **80D**.
- A home loan EMI is a **liability payment** and its interest part counts toward **Section 24(b)**.

In the data this is the `ded` field on an entry. Totals never add the same rupee twice.

---

## 3. What has been built so far

**Phase 1: frontend with sample data.** A static site, no build step, no libraries. Charts are hand-drawn SVG.

### Screens

| Route | What it shows |
|---|---|
| `#/overview` | Net worth, an income-flow bar (tax, spends, EMIs, invested, kept in cash, with a "saved" bracket), four head tiles with change vs the earlier period and a sparkline, a 12-month money in/out chart, goals and a "needs attention" list |
| `#/overview/income` `spend` `invest` `liab` | Drill-down per head: breakdown list, month-by-month stacked chart, filterable entries table. Spends can be grouped by payment type or by category. Click a row to filter the entries |
| `#/overview/networth` `savings` | Assets vs liabilities over time; savings split into invested and kept in cash |
| `#/tax` | Tax still to pay, two mini waterfalls (income to taxable income, tax to balance), four tiles, old vs new regime comparison with break-even, advance tax timeline |
| `#/tax/income` `deductions` `tax` `savings` | Income by source with how each is taxed and foreign income in original currency; deductions against limits with expandable entries; full slab-by-slab tax working; where the remaining tax saving is |
| `#/goals` | All goals grouped by type, with a pace tick on each bar. Add or remove your own goals |
| `#/sources` | Placeholder list of planned inputs (this is what Phase 2 builds) and a data health panel |
| `#/settings` | Theme, privacy mask, the tax rules in use, clear saved preferences |

### Behaviours

- **Goal types:** spending cap, investment target, tax-saving target, savings rate, emergency fund.
- **Tax engine:** new and old regime, slab tax, rebate, marginal relief, 4% cess, STCG and LTCG on equity, projection of the full year from data so far, advance tax schedule, break-even deductions between the regimes.
- **Look and feel:** calm and data-first. A colour per head, tabular figures, Indian number format (₹12,34,567, and L/Cr in compact views), light and dark themes, responsive down to a phone, and no colour-only meaning (arrows and labels always accompany colour).
- **Privacy mask:** blurs every amount, including chart axes and tooltips.
- **Saved in the browser only** (`localStorage`, keys `hisaab.period`, `hisaab.theme`, `hisaab.mask`, `hisaab.goals`).

### How it was checked

- The tax engine was checked against 8 hand-worked cases (for example zero tax up to ₹12.75 lakh salary under the new regime, and marginal relief just above ₹12 lakh).
- All 15 routes render without errors in both themes and on three different "today" dates.
- 23 interaction checks passed in headless Chromium.
- Not yet tested on Safari or real phones. **These checks were run by hand and are not in the repository yet.** Automated tests are part of Phase 2.

---

## 4. Files and how they fit together

Keep all files in one folder. They are plain scripts loaded in order by `index.html` (not modules, so double-clicking the page also works).

| File | Role | Fate in Phase 2 |
|---|---|---|
| `index.html` | Page shell, loads fonts and scripts | Stays |
| `styles.css` | All visual design: tokens, layout, dark mode, responsive rules | Stays |
| `app.js` | UI: routing, views, charts, goals. **Also holds some calculation logic** (see below) | Views stay; logic moves out |
| `config.js` | Tax slabs, deduction limits, labels, category lists, projection rules | Grows; becomes per financial year |
| `tax.js` | Pure tax calculation with no screen code. Already exports for Node | Moves to the backend as is |
| `data.js` | **Sample data generator** | **Replaced by real data** |
| `util.js` | Indian number format, date and financial-year helpers | Stays |

**A refactor Phase 2 needs first.** `app.js` currently contains logic that is not about drawing: period ranges, `flows` (income, spends, savings), `taxModel` (projection to full year, deduction totals, TDS, advance tax), `evalGoal` and `alerts`. This logic must move into shared modules so the browser and the backend run the *same* code. Otherwise the two will drift apart and disagree about a user's tax.

---

## 5. The data contract

`data.js` sets `window.DATA`. Whatever the backend does, it must hand the UI this same shape. If it does, `app.js` barely changes.

```js
DATA = {
  today: 'YYYY-MM-DD',
  entries:     [ Entry, ... ],           // every transaction, stored once
  holdings:    [ { cls, value, invested }, ... ],   // snapshot today, per asset class
  liabilities: [ { id, name, lender, outstanding, rate, emi, monthsLeft, dueDate?, minDue? }, ... ],
  months:      [ 'YYYY-MM', ... ],       // month keys covered
  balances: {                            // month-end series
    assets: { 'YYYY-MM': n },
    liabs:  { 'YYYY-MM': n },
    liabByLoan: { home: {...}, car: {...}, edu: {...}, cc: {...} }
  },
  profile: { seniorParents, residency }, // facts the tax engine needs
  goals:   [ Goal, ... ],
  lastSync: { label, uncategorised }
}

Entry = {
  id, date: 'YYYY-MM-DD',
  head:  'income' | 'spend' | 'invest' | 'emi' | 'tax',
  cat,                  // category key, defined in config.js (e.g. 'groceries', 'sip', 'salary', 'tds')
  label, amount,        // amount is always positive; the head gives the direction
  instrument?,          // spends only: 'cc' | 'dc' | 'upi' | 'nb' | 'cash'
  series?,              // repeating items ('salary', 'epf', 'emi-home') so the year can be projected
  ded?: [ { id, amt } ],// counts toward a deduction, e.g. { id: '80c', amt: 2500 }
  cg?: { term: 'short' | 'long', asset },      // capital gains
  foreign?: { currency, amount, rate },        // foreign income in original currency
  principal?, interest? // EMIs: the split, so interest can feed 24(b) and 80E
}

Goal = { id, type, name, target, period: 'month' | 'fy', cat?, ded? }
```

**What Phase 2 must add to this contract** (none of it is needed by the UI today, all of it is needed for real data): a stable `sourceDocId` and `sourceRow` on every entry (so any number can be traced back to the line it came from), a `fingerprint` for duplicate detection, a `reviewStatus`, and an `accountId`.

---

## 6. Money definitions used today

These are the rules the sample dashboard follows. Confirm them before real data goes in, because they decide every headline number.

| Term | Definition |
|---|---|
| Financial year | 1 April to 31 March. Quarters follow it (Apr to Jun, and so on) |
| Income | **Gross** income. Salary is the gross amount, not the bank credit. Capital gains count the *gain*, not the sale proceeds |
| Spends | Everything paid out through cards, UPI, net banking and cash, **before loan EMIs**. EMIs are shown under Liabilities |
| Tax paid | TDS plus advance tax paid in the period |
| Savings | Income − tax paid − spends − loan EMIs |
| Savings rate | Savings ÷ income |
| Invested | Money put into investments in the period (including EPF and NPS) |
| Kept in cash | Savings − invested |
| Investments (tile) | Total value today of all asset classes, including cash, FDs and property |
| Net worth | Total assets − total liabilities |
| Full-year projection | Salary and rent: current monthly amount for the remaining months. Business, foreign and other income: average so far. Capital gains: only what has been realised. Rules live in `config.js` under `projection` |
| Old vs new regime | The cheaper one is marked "best". Break-even shows the deduction total at which the old regime would win |

The period comparison ("vs last year") always compares the **same span**, so a year-to-date view is compared against the same dates last year rather than the full previous year.

---

## 7. Next: the backend plan

**Goal of Phase 2:** replace `data.js` with real data. That means getting information in from the places it lives, cleaning it up, filing each item under the right head, and running the calculations and rules on it.

The work splits into three layers, built in this order:

1. **Ingestion layer:** get data in, one head at a time.
2. **Calculation layer:** turn entries into totals, tax and balances.
3. **Logic layer:** the rules that decide categories, tags, goals and alerts.

### 7.1 Principles

- **Traceable.** Every number can be traced to the file and row it came from.
- **Reconciled.** Every import is checked against a total the source itself states (for example a statement's opening balance + credits − debits = closing balance). If it does not add up, the import is flagged, not silently accepted.
- **Reviewable.** The software never guesses silently. Anything uncertain goes into a review queue for the user.
- **Rules, not magic.** Start with explicit rules the user can see and edit. Learning from corrections comes later.
- **One source of logic.** The same calculation code runs in the browser and on the server.
- **Tax rules in config, per financial year.** Never hard-coded, and verified before use.

### 7.2 Architecture: the first decision

GitHub Pages only serves static files. It cannot run a server, and a Pages site is **publicly reachable**, so real financial data must never be committed to the repository or served from it. Three ways forward:

| Option | How it works | Good | Watch out |
|---|---|---|---|
| **A. Local-first** | Statements are parsed **in the browser** and stored on the user's device (IndexedDB). No server holds financial data. The site stays on GitHub Pages | Best privacy; no hosting cost; keeps the current deployment | Data lives on one device; needs export and import for backup and moving devices; PDF parsing runs on the client |
| **B. Hosted backend** | A small API plus database (for example a managed Postgres with login). The site calls it | Sync across devices; heavier parsing possible; easier to add a CA view later | You now hold sensitive data: encryption, login, backups, deletion and compliance become your job |
| **C. Hybrid** | Parse locally, store only encrypted results on a server for sync | Privacy of A with the sync of B | The most to build |

**Suggested starting point: Option A.** It keeps the current hosting, avoids becoming custodian of anyone's bank data, and the ingestion and calculation code is the same either way, so it can move to B or C later. This is a recommendation, not a decision. See the open questions.

### 7.3 The ingestion pipeline

Every source, whatever it is, goes through the same stages:

```
Upload → Identify → Parse → Normalise → Clean → Categorise & tag → Review → Store → Aggregate
```

| Stage | What happens |
|---|---|
| Upload | User adds a file (PDF, CSV, Excel) or types an entry |
| Identify | Work out which bank, card or report it is (a small adapter per source) |
| Parse | Pull out rows. Many Indian statement PDFs are password-protected, so the user is asked for the password, which is used once and never stored |
| Normalise | Turn each row into an `Entry` (section 5): date, amount, direction, description |
| Clean | Remove duplicates, spot internal transfers, net off refunds (see 7.5) |
| Categorise & tag | Assign `cat`, `instrument` and any `ded` tags using the rules in 7.6 |
| Review | Anything uncertain (unknown merchant, possible duplicate, unmatched transfer, failed reconciliation) waits for the user |
| Store | Save entries with their source document and row |
| Aggregate | Build the month-end balances and totals the UI reads |

### 7.4 Ingestion, head by head

| Head | Where the data comes from | What is tricky |
|---|---|---|
| **Spends** | Bank account statements, credit card statements, UPI activity (visible in bank statements), net banking, manual entry for cash | Detecting the instrument from the bank's narration text (each bank words it differently); avoiding double counts (see 7.5); categorising thousands of merchant strings |
| **Income: salary** | Payslips and Form 16 (gross, TDS, PF, deductions); bank credits to cross-check | The bank shows **net** pay but Hisaab counts **gross**. Gross, TDS and EPF must come from the payslip or Form 16, with the bank credit used to confirm |
| **Income: capital gains** | Broker tax P&L reports; consolidated mutual fund statements (CAS from the registrars) | Lot-by-lot matching, holding periods, short vs long term, different rules by asset type |
| **Income: business, rental, other** | Bank credits tagged by the user; AIS for interest and dividends | Bank credits do not say what they are for. Needs a "what is this credit?" review step and recurring-rule support (rent arrives monthly) |
| **Income: foreign** | Bank credits with the foreign remittance details | Keep the original currency, amount and rate on the entry. The exact rate rule for tax purposes must be confirmed before we rely on it |
| **Investments** | CAS statements, broker holdings and contract notes, EPFO passbook, NPS statement, FD certificates, digital gold platform statements; manual for property and other assets | Many different formats; SIP debits show up in both the bank statement and the CAS and must be counted once; property needs manual values |
| **Liabilities** | Loan statements and repayment schedules, credit card statements (outstanding, due date, minimum due) | Splitting each EMI into principal and interest (interest feeds 24(b) and 80E); matching bank EMI debits to the loan |
| **Deductions** | Derived from tagged entries, plus documents: insurance premium receipts, loan interest certificates, donation receipts, Form 16 Part B | Deciding what qualifies; capping at limits; not counting the same entry twice (the `ded` tag does this) |
| **Tax paid** | Form 26AS and AIS (TDS), challans for advance tax, Form 16 | Matching what the tax department shows against what the user's own records say |

### 7.5 Cleaning: the double-counting traps

These will corrupt every total if missed, so they get explicit handling and tests:

1. **Credit card bill payments.** The bank shows "paid ₹38,200 to card". The card statement shows the individual purchases. Count the *purchases* as spends and treat the payment as a transfer.
2. **Transfers between the user's own accounts.** Not income and not a spend.
3. **SIPs and EMIs.** They appear in the bank statement *and* in the CAS or loan statement. Match them and store once.
4. **Refunds and reversals.** Net them against the original spend rather than showing them as income.
5. **Salary.** Bank credit (net) versus payslip (gross), as above.
6. **Re-uploading the same file.** A fingerprint on each entry (date, amount, description, account) prevents duplicates.

### 7.6 Categorising spends (how spending is split into types)

Two separate questions are answered for each spend:

- **Instrument** (credit card, debit card, UPI, net banking, cash): mostly known from *which statement* the row came from, and from the narration prefix on bank rows.
- **Category** (groceries, dining, transport, and so on): needs a layered approach, tried in this order:

1. User rules ("description contains X → category Y"). These always win.
2. A built-in merchant dictionary (for example Swiggy and Zomato → Dining and delivery).
3. Hints from the UPI ID or merchant code.
4. Otherwise → **Uncategorised**, which goes to the review queue.

When the user fixes a category, the fix becomes a rule, so the same merchant is right next time. Machine-learning suggestions are deliberately left out of the first version: rules are explainable, testable and private.

Tax tags follow the same pattern. For example, "insurance premium, health" → `80d_self`, "PPF deposit" → `80c`. The tags, limits and caps come from `config.js`.

### 7.7 The calculation layer

Pure functions with no screen code, shared by the browser and the server, each with automated tests:

| Module | Does | Status |
|---|---|---|
| `tax` | Slab tax, rebate, marginal relief, cess, capital gains, both regimes, break-even, advance tax schedule | **Exists** (`tax.js`), needs tests and the gaps below |
| `aggregate` | Period ranges, totals by head and category, month-by-month series, savings and savings rate | In `app.js`, to extract |
| `projection` | Full-year estimate from data so far | In `app.js`, to extract |
| `networth` | Balances over time from holdings and liabilities | Sample-only today; real version needed |
| `capitalGains` | Lot matching, holding periods, short vs long term per asset type | **New** |
| `deductions` | Claimed vs limit, room left, tax effect of the remaining room | In `app.js`, to extract |
| `goals` and `alerts` | Progress, pace and status; due dates, overspend warnings | In `app.js`, to extract |

**Tax logic still to add** (all listed as "not modelled yet" in `config.js`): surcharge above ₹50 lakh, HRA and LTA, employer NPS contribution (which the new regime still allows), marginal relief on special-rate income, 80G eligibility percentages, foreign tax credit, and rules that differ by asset type for capital gains. Tax rules also need to be keyed **by financial year**, so that last year's figures are calculated with last year's rules.

### 7.8 The logic layer (rules)

Decisions that change over time or by user should be **data, not code**:

| Rules | Examples | Lives in |
|---|---|---|
| Categorisation | Merchant and keyword to category | User rules plus a built-in dictionary |
| Deduction tagging | Which entries count toward which section, and how much of them (for example 50% for some donations) | `config.js` |
| Tax rules | Slabs, limits, rebates, cess, dates, per financial year | `config.js`, verified before each FY |
| Goal rules | How progress and pace are judged for each goal type | Code, with thresholds in `config.js` |
| Alert rules | What is worth flagging and how urgently | Code, with thresholds in `config.js` |

Tax rules get a "verified on" date. Section numbers follow the Income-tax Act 1961 today, and the Income-tax Act 2025 renumbers them, so section labels are kept as labels in `config.js` and can be remapped in one place.

### 7.9 Tentative data model

Enough to plan with, to be refined once the architecture is chosen.

| Record | Key fields |
|---|---|
| Profile | residency, age band, senior parents, chosen regime |
| Account | type (bank, card, demat, loan, EPF, NPS), institution, masked number |
| Document | file hash, type, account, parse status, reconciliation result, upload date (the file itself is optional to keep) |
| Entry | as section 5, plus account, document, row, fingerprint, review status |
| Rule | match text, target category, target tags, created from a correction or by hand |
| Holding and lot | asset class, instrument, units, cost, date, current value (lots feed capital gains) |
| Liability | lender, outstanding, rate, EMI, schedule |
| Goal | as section 5 |
| Tax config | per financial year: slabs, limits, cess, thresholds, verified-on date |
| Audit log | what changed, when, and why (imports, corrections, deletions) |

### 7.10 What the UI still needs

The current screens assume data simply exists. Real data needs these additions:

- **Real Sources page:** upload area, per-file status, parse errors, reconciliation result, re-import.
- **Review queue:** uncategorised entries, possible duplicates, unmatched transfers, "what is this credit?" prompts.
- **Manual entry forms:** cash spends, property, gold, foreign income, anything without a statement.
- **Category rule editor:** see, edit and delete the rules that categorise spends.
- **Profile and tax settings:** regime choice, senior parents, residency.
- **Empty, loading and error states.** The app currently reads `window.DATA` instantly. Real data loads asynchronously and can be empty or partial.
- **Data controls:** export everything, delete everything.
- **Export for a CA or ITR filing** (parked from the original plan).
- **Login**, only if Option B or C is chosen.

### 7.11 Phased roadmap

Each phase ends only when its "done when" is true.

| Phase | Work | Done when |
|---|---|---|
| **0. Frontend with sample data** | Everything in section 3 | **Complete** |
| **1. Foundations** | Choose the architecture. Extract the shared calculation modules out of `app.js`. Add automated tests for `tax` and `aggregate`. Finalise the entry schema and reconciliation rules. Collect anonymised sample statements as test fixtures | The UI runs unchanged on the extracted modules; tests pass in the browser and in Node |
| **2. Spends** | Bank and credit card statement ingestion, instrument detection, cleaning (7.5), categorisation and rule editor, review queue, reconciliation | A real anonymised statement from at least one bank and one card imports with only category corrections needed, totals reconcile to the statement, and no duplicates appear on re-import |
| **3. Income and liabilities** | Payslip and Form 16 parsing, salary gross-up, business, rental and foreign income entry, loan and card-dues ingestion, EMI splitting | Salary shows gross with TDS and EPF matched to Form 16; each loan's outstanding matches its statement |
| **4. Investments** | CAS and broker imports, holdings and lots, EPF, NPS, FD and gold, manual property, month-end balances and real net worth, capital gains engine | Holdings value matches the statement; capital gains match the broker's own report |
| **5. Tax, end to end** | Deduction tagging from documents, TDS matching against 26AS and AIS, the tax gaps in 7.7, per-FY config, real goals and alerts | The tax estimate has been reviewed line by line by a CA against a real return |
| **6. Polish** | CA export, insurance renewals, multi-profile, performance, Safari and phone testing | To be decided later |

**Why Spends first:** it is the highest-volume, most-used head, it exercises every stage of the pipeline (parse, clean, categorise, review, reconcile), and every later head reuses that machinery. Income and investments are more document-specific and are easier once the pipeline exists.

### 7.12 Testing and accuracy

- **Unit tests** for every calculation function, using hand-worked cases as the tax engine already was.
- **Fixture tests** for each source adapter, using anonymised real files.
- **Reconciliation checks** on every import (statement totals, holdings totals, TDS totals against AIS).
- **A CA review** of the tax logic before it is trusted. The dashboard shows an estimate, not filing advice, and says so on screen.

### 7.13 Security and privacy

- **Never commit real data or statements to this repository.** A Pages site and its repository can be public. Keep real files out of the repo (add a `.gitignore` for any private folder).
- Statement passwords are used once in memory and never stored.
- Any stored data is encrypted at rest. Under Option A that means on the user's own device, with export and import for backup.
- Account numbers are stored masked. Only the last few digits are kept.
- The user can export and delete everything.
- No analytics or third-party scripts touch financial data. The only external request today is Google Fonts.
- Direct bank connections through the RBI Account Aggregator framework are a possible future option, but they need regulatory onboarding and are out of scope for now.

---

## 8. Open questions

These block or shape Phase 1, so they come first:

1. **Architecture:** Option A (local-first), B (hosted backend) or C (hybrid)? This decides where the pipeline runs and how much security work sits on us.
2. **First sources:** which bank and which credit card should we build the first two adapters for? Their statement formats are the test fixtures, so anonymised samples are needed.
3. **Does anyone else need access?** Only the individual, or also a spouse or a CA? If yes, the data model needs owners and permissions from day one.
4. **Who reviews the tax logic?** A CA review is part of Phase 5, so it helps to know early who and when.
5. **Salary source:** are payslips and Form 16 available to the user for each year, or should salary fall back to bank credits and manual gross-up?
6. **Retirement accounts:** EPF, PPF and NPS from statements, or entered manually to start?
7. **Foreign income:** confirm the exchange-rate rule to apply before we build it.
8. **The money definitions in section 6:** is gross income, spends *before* EMIs, and "savings = income − tax − spends − EMIs" how you want these to read?

---

## 9. Run it and put it on GitHub Pages

**Preview locally:** double-click `index.html`.

**Publish:**
1. Create a repository and upload every file in this folder to the root, keeping them together.
2. Go to **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**, pick `main` and `/ (root)`, then Save.
3. After a minute the site is live at `https://<your-username>.github.io/<repository>/`.

Remember that the published site is public. It contains sample data only, which is fine. Real data must never be added here (see 7.13).

**Freeze the sample date** (useful for screenshots): set `today: '2026-09-20'` in `config.js`.

---

## 10. Known limits

- **All data is sample data.** The sample is regenerated relative to today's date, and its numbers are illustrative.
- **Tax estimate only.** Rules were checked on 20 Sep 2026 against Budget 2026 for FY 2026-27 (slabs unchanged from FY 2025-26). Not modelled yet: surcharge, HRA and LTA, marginal relief on capital gains, 80G eligibility percentages, foreign tax credit.
- **Section numbers** follow the Income-tax Act 1961 and will need remapping for the Income-tax Act 2025.
- **Fonts** (Bricolage Grotesque, Figtree) load from Google Fonts, so the first view needs internet. The layout falls back to system fonts without it.
- **Browser support** has been checked in Chromium only.
- **No login, no sync.** Goals and preferences are saved in the browser you used and are not shared between devices.
