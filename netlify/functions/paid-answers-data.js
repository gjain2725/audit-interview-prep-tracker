// Model answers for the paid areas. Served only to paying accounts by
// answers.js - deliberately NOT present in the public HTML.
export const PAID_ANSWERS = {
 "rev-1": {
  "a": "1) Identify the contract with the customer. 2) Identify the distinct performance obligations (POBs). 3) Determine the transaction price (including variable consideration, financing, non-cash). 4) Allocate the price to each POB on relative stand-alone selling price. 5) Recognise revenue when/as each POB is satisfied — i.e., when control transfers, either over time or at a point in time.",
  "ex": "A mobile plan bundling a handset + 12 months of service is two POBs: handset revenue at delivery (point in time) and service revenue spread over the year (over time)."
 },
 "rev-2": {
  "a": "Recognise over time if any one of three is met: (a) the customer simultaneously receives and consumes the benefits as you perform (e.g., cleaning services); (b) you create or enhance an asset the customer controls as it's built; (c) the asset has no alternative use to you AND you have an enforceable right to payment for work done to date. If none apply, recognise at the point in time control transfers.",
  "ex": "A construction contract on the customer's land usually meets (b)/(c) → over time; a standard product sold off the shelf → point in time on delivery."
 },
 "rev-3": {
  "a": "Revenue is a presumed fraud risk, so I test occurrence and cut-off hard: vouch sales to PO + dispatch + invoice + receipt, and check invoices/dispatch either side of year-end. For cut-off, goods dispatched before year-end but invoiced after should still be revenue this year (accrue), and goods invoiced before but dispatched after should be reversed/deferred.",
  "ex": "Basic cut-off entry — goods delivered 30 Mar, invoiced 2 Apr: Dr Unbilled receivable / Cr Revenue in March; reverse when the invoice is raised in April."
 },
 "rev-4": {
  "a": "Trace booked revenue to third-party evidence (dispatch/POD, customer confirmation, bank receipt), test the year-end cut-off both ways, and analytically review margins and debtor-days for unexplained spikes. Watch for channel stuffing — big last-week sales reversed by post-year-end credit notes — and revenue to related or brand-new parties.",
  "tip": "Mention scanning April credit notes against March sales — it shows real fieldwork instinct."
 },
 "rev-5": {
  "a": "A promise is a distinct POB if the customer can benefit from it on its own (or with readily available resources) and it's separately identifiable from other promises. Variable consideration (discounts, rebates, penalties, bonuses, rights of return) is estimated using expected value or most-likely-amount, then constrained — included only to the extent it's highly probable there won't be a significant revenue reversal.",
  "ex": "A volume rebate a customer will likely earn is estimated and netted off revenue now, not when it's finally paid."
 },
 "lease-1": {
  "a": "Ind AS 116 puts almost all leases on the balance sheet under a single lessee model. At commencement, recognise a lease liability at the present value of future lease payments (discounted at the rate implicit in the lease, or the incremental borrowing rate), and a right-of-use (ROU) asset = liability + initial direct costs + prepayments + dismantling estimate − incentives. Then unwind interest on the liability (finance cost) and depreciate the ROU asset, usually straight-line over the shorter of lease term and useful life.",
  "ex": "A 5-year office lease of ₹10 lakh/year: you record the PV of those payments as both a liability and an ROU asset, then split each rent payment into interest and principal, and depreciate the asset over 5 years."
 },
 "lease-2": {
  "a": "Two exemptions for lessees: short-term leases (≤12 months, no purchase option) and low-value asset leases (e.g., laptops, small items). For these you just expense the rent straight-line — no ROU/liability. And importantly, the finance-vs-operating lease distinction is gone for lessees under Ind AS 116 (they're all on-balance-sheet); it only survives for lessors.",
  "tip": "That \"operating vs finance is gone for lessees but stays for lessors\" point is a favourite trap — nail it."
 },
 "lease-3": {
  "a": "Get the lease register and test completeness against the rent ledger and contracts, recompute the PV of payments, and challenge the discount rate (benchmark the IBR to the entity's borrowing cost and tenor). I check the lease term includes renewal/termination options that are reasonably certain to be exercised, and test the depreciation and interest unwind for the year.",
  "ex": "If a 3-year lease has two 3-year renewals the tenant is reasonably certain to take, the lease term for measurement is 9 years, not 3 — a common error I'd look for."
 },
 "fin-1": {
  "a": "A financial instrument is any contract giving rise to a financial asset of one party and a financial liability or equity of another — e.g., cash, receivables, loans, investments, payables, borrowings. Basic accounting involves initial recognition at fair value, then measurement at amortised cost or fair value; for items like loans we record interest on an effective-interest basis and unwind/amortise any discount over time.",
  "ex": "An interest-free security deposit is recorded at present value on day one; the difference unwinds as notional interest income over the deposit period."
 },
 "fin-2": {
  "a": "ECL is a forward-looking impairment model — you provide for expected losses, not just incurred ones. Three stages: Stage 1 books 12-month ECL for performing assets; Stage 2 books lifetime ECL when credit risk increases significantly; Stage 3 books lifetime ECL for credit-impaired assets. ECL = PD × LGD × EAD with forward-looking factors. For trade receivables, companies typically use the simplified provision-matrix (lifetime ECL) approach.",
  "ex": "A provision matrix might charge 1% on current debtors, 5% on 31–90 days, 20% on 91–180, and 100% on 1-year-plus — that's ECL applied practically."
 },
 "fin-3": {
  "a": "By the business model plus the SPPI test (are cash flows solely payments of principal and interest?). Amortised cost = hold-to-collect and SPPI passes (e.g., normal receivables, loans). FVOCI = hold-to-collect-and-sell and SPPI passes. FVTPL = everything else — trading assets, equity investments, or where SPPI fails (e.g., derivatives).",
  "tip": "Ind AS 32 = presentation (liability vs equity), 109 = recognition/measurement, 107 = disclosures — a clean way to show you know the family."
 },
 "ppe-1": {
  "a": "Existence: physically verify a sample and agree to the fixed-asset register. Rights: check invoices/title deeds. Completeness: reconcile the FAR to the GL and check capex approvals. Valuation: recompute depreciation, confirm useful lives are reasonable (Schedule II is the reference for companies), check componentisation of large assets, and consider impairment indicators (Ind AS 36). I also review additions for revenue-vs-capital classification and disposals for correct gain/loss and de-recognition.",
  "ex": "A big \"repairs\" charge that's really a machine replacement should be capitalised — I'd catch that in additions/repairs scrutiny."
 },
 "ppe-2": {
  "a": "Depreciation allocates an asset's depreciable amount (cost − residual value) over its useful life. For companies, Schedule II of the Companies Act prescribes indicative useful lives; a company can use a different life but must justify it by technical assessment and disclose it. Significant components with different lives are depreciated separately (componentisation). Methods are typically SLM or WDV, applied consistently.",
  "ex": "Plant with useful life 15 years per Schedule II, cost ₹15 lakh, residual 5% → roughly ₹95,000 depreciation a year on SLM."
 },
 "inv-1": {
  "a": "At the lower of cost and net realisable value. Cost includes purchase cost, conversion costs and costs to bring inventory to its present location and condition, but excludes abnormal waste, storage (unless part of production) and selling costs. NRV = estimated selling price − costs to complete − costs to sell. Cost formulas: FIFO or weighted average; LIFO is not allowed.",
  "ex": "If finished goods cost ₹100 but can only be sold for ₹90 net, they're written down to ₹90 — the ₹10 hits the P&L."
 },
 "inv-2": {
  "a": "Attend the physical count (existence and condition), test counts both ways (floor-to-sheet and sheet-to-floor), and check cut-off of goods received/dispatched around the count date. For valuation, test costing (purchase invoices, overhead absorption) and NRV (compare to post-year-end selling prices), and review slow-moving/obsolete stock for provisioning. Reconcile the count to the stock records and the GL.",
  "tip": "This links directly to the classic scenario — \"what if you can't attend the count?\" (see the Practical section)."
 },
 "recv-1": {
  "a": "Existence — send external confirmations (positive) for a value-weighted sample; for non-replies use alternative procedures (subsequent receipts, invoices, dispatch). Valuation/recoverability — review the ageing, test the ECL/provision matrix, and check subsequent collections. Completeness and cut-off — tie to revenue testing. Also scan for long-outstanding, related-party and credit-balance debtors.",
  "ex": "A debtor overdue 8 months with no receipt after year-end is a red flag for provisioning even if management is optimistic."
 },
 "recv-2": {
  "a": "I test the ageing accuracy first (a wrong ageing makes the whole provision wrong), then evaluate the ECL rates in the provision matrix against historical loss experience and current conditions, and corroborate with post-year-end receipts. I specifically challenge large or related-party balances that are fully outstanding but not provided.",
  "ex": "If historically 15% of 90+ day debtors go bad but management provides only 5%, I'd push back with the historical data."
 },
 "cash-1": {
  "a": "Bank: obtain independent bank confirmations for all accounts, agree balances to the ledger, and review the bank reconciliation — investigating old un-cleared cheques and any post-year-end reversals. Cash: attend or do a surprise cash count and agree to the cash book; for material balances test the reasonableness of cash held. I also check for unusual round-sum transfers near year-end (window dressing).",
  "ex": "A large cheque \"issued\" on 31 March but clearing only in May can be window-dressing to show lower creditors — I'd probe the reco."
 },
 "cash-2": {
  "a": "The strongest evidence is the direct bank confirmation received by us, not a statement handed over by the client (which can be doctored). I match the confirmation to the ledger and the reconciliation, examine reconciling items for validity, and look at the bank statement for the period after year-end to see the reconciling cheques actually clear.",
  "tip": "Emphasise \"confirmation received directly by the auditor\" — that's the control against a forged statement."
 },
 "pay-1": {
  "a": "I walk through the hire-to-pay cycle and test key controls (approval of new joiners, master-data changes, and payroll sign-off). Substantively: reconcile headcount, recompute a sample of salaries from appointment letters/attendance, check statutory deductions (PF, ESI, TDS) are computed and deposited on time, and do an analytical — average cost per employee and month-on-month movement — to spot ghost employees or unusual spikes.",
  "ex": "A month where payroll jumps but headcount is flat could mean bonuses — or ghost employees; the analytical flags it and I'd vouch the difference."
 },
 "pay-2": {
  "a": "Look for employees with no attendance but full pay, duplicate bank accounts or PAN across employees, salaries paid in cash, and staff who never take leave. I'd match the payroll master to HR records and, for a sample, tie back to appointment letters and actual bank credits.",
  "tip": "This shows fraud-alert thinking on a routine area — panels like that."
 },
 "conf-1": {
  "a": "For debtors: check subsequent receipts after year-end, and vouch to invoices and dispatch/POD. For creditors: check subsequent payments, and vouch to supplier invoices and GRNs; also do a search for unrecorded liabilities. For bank: a non-reply is more serious — I'd follow up directly with the bank, use the online statement obtained independently, and escalate, because bank confirmation is core evidence. After receiving any confirmation, I reconcile differences (goods/cash in transit, disputes) and investigate anything unexplained.",
  "ex": "A debtor who doesn't confirm but whose full balance is received in April is effectively validated by that subsequent receipt."
 },
 "conf-2": {
  "a": "I reconcile the client's ledger to the third-party confirmation, review supporting documents like invoices and payment receipts to find errors or omissions, and communicate with both parties to understand the discrepancy. Common causes are timing differences — goods or cash in transit — or disputed amounts. I document the reconciliation, escalate unresolved items to management, and include any material unresolved discrepancy in the audit findings with necessary disclosures.",
  "ex": "Client shows a debtor ₹10 lakh, customer confirms ₹8 lakh — usually ₹2 lakh of goods/cash in transit that I tie out to dispatch or the next month's receipt."
 },
 "caro-1": {
  "a": "CARO (Companies Auditor's Report Order) requires the auditor to report on specific matters in an annexure to the audit report. CARO 2020 is much more detailed than 2016 — it added clauses on disclosure of proceedings for benami property, whether the company was declared a wilful defaulter, diversion/utilisation of term loans, unrecorded income surrendered in tax assessments, related-party compliance under Sec 177/188, internal audit systems, and reporting on any resignation of statutory auditors and material uncertainty on meeting liabilities.",
  "ex": "The wilful-defaulter and benami-property clauses are new in 2020 — good concrete \"2-3 differences\" to quote."
 },
 "caro-2": {
  "a": "No — CARO 2020 does not apply to the auditor's report on consolidated financial statements, except for one clause requiring the auditor to report qualifications/adverse remarks in the CARO reports of the companies included in the consolidation. CARO applies to standalone statements of companies (with exemptions for banking companies, insurance companies, Section 8 companies, OPCs and certain small companies).",
  "tip": "The \"CARO doesn't apply to CFS except the one consolidation clause\" answer is exactly what this trick question wants."
 },
 "caro-3": {
  "a": "Clause 3(i) covers PPE and intangibles: whether the company maintains proper records showing full particulars including quantitative details and location; whether PPE is physically verified at reasonable intervals and material discrepancies dealt with; whether title deeds of immovable property are held in the company's name; whether any revaluation was done by a registered valuer; and whether any benami property proceedings are pending.",
  "ex": "Title deeds not in the company's name is a specific reportable item I'd check by inspecting the deeds against the register."
 },
 "sch3-1": {
  "a": "Schedule III sets the format of the financial statements. Recent amendments added disclosures such as: ageing schedules for trade receivables, trade payables, CWIP and intangibles under development; rounding-off is now mandatory based on turnover; disclosure of promoter shareholding and changes during the year; ratios with explanations for variances over 25%; details of benami property, wilful defaulter status, relationships with struck-off companies, loans to promoters/KMPs, and use of borrowed funds/CSR spend.",
  "ex": "The debtor/creditor ageing buckets and the 25%-variance ratio explanations are the ones I'd expect to prepare and check in practice."
 },
 "rep-1": {
  "a": "Unmodified (clean) — financials give a true and fair view. Then three modified opinions driven by two factors — whether the issue is material and whether it's pervasive. Qualified — a material but not pervasive misstatement, or inability to obtain evidence on a specific area (\"except for…\"). Adverse — a material and pervasive misstatement; the financials do not give a true and fair view. Disclaimer — unable to obtain sufficient evidence and the possible effect is material and pervasive, so we don't express an opinion.",
  "ex": "Can't attend the stock count and inventory is material but only one area → qualified; can't audit most of the records → disclaimer."
 },
 "rep-2": {
  "a": "No, not directly. If controls aren't effective, control risk is high, so I respond by increasing substantive procedures — larger samples, year-end testing, more detailed vouching — to get comfort on the numbers themselves. I only modify the opinion if, after that extended substantive work, I still find a material misstatement or can't get sufficient evidence. Control weaknesses are also communicated to management and those charged with governance, and reported under IFCR.",
  "tip": "This is a classic trap — the wrong answer is \"yes, I qualify.\" The right instinct is \"do more substantive work first.\""
 },
 "lr-1": {
  "a": "A limited review (SRE 2410, used for listed companies' quarterly results) gives limited (negative) assurance — \"nothing has come to our attention\" — and relies mainly on inquiry and analytical procedures. A statutory audit gives reasonable (positive) assurance — \"true and fair view\" — and involves detailed substantive testing, controls work and external confirmations. A review is quicker and less extensive; the audit is deeper and higher assurance.",
  "ex": "Quarterly results get a limited review; the annual financials get a full statutory audit."
 },
 "sit-1": {
  "a": "If physical verification isn't possible, I rely on detailed inventory records and cross-verify them with purchase and sales invoices. Analytical procedures like inventory turnover and gross-margin comparisons help assess the reasonableness of stock levels. Where stock is held in third-party warehouses I obtain independent confirmations, and if feasible I do a count on a later date and roll back to year-end. These steps let me form a reasonable opinion on existence and valuation; if I still can't get sufficient evidence and inventory is material, I'd consider a qualified opinion.",
  "ex": "Count on 15 April, then work back to 31 March using April purchases and sales — a roll-back that's widely accepted."
 },
 "sit-2": {
  "a": "I compare the rates in the PO and the invoice, then review whether there's a supplementary agreement, amended PO or approval that justifies the change. If no such document exists, I escalate to management for clarification. I document all findings and highlight material discrepancies in the audit report — because a rate mismatch can indicate a control gap in the three-way match or even a kickback/fraud risk.",
  "ex": "PO says ₹100/unit, invoice ₹115 with no amendment — I'd flag the P2P control weakness and check if it's a one-off or systemic."
 },
 "sit-3": {
  "a": "I reconcile the client's ledger with the third-party confirmation, examine supporting documents like invoices and receipts to spot errors or omissions, and if it stays unresolved I communicate with both parties for more information. I document the findings, escalate unresolved issues to management, and include any material discrepancy in the audit report with the necessary disclosures. Most mismatches turn out to be goods-in-transit or cash-in-transit timing differences.",
  "ex": "A ₹2 lakh gap that's a cheque in transit clears in the first week of April — I tie it to the bank statement and it's resolved."
 },
 "sit-4": {
  "a": "First I understand why and try to resolve it professionally, escalating within management and then to those charged with governance/the audit committee. I document the request and refusal. If I still can't obtain sufficient appropriate evidence, it's a scope limitation — leading to a qualified opinion or, if the area is material and pervasive, a disclaimer. Independence means I don't simply accept \"trust us.\"",
  "tip": "Show you escalate through governance before jumping to a modified opinion — that's the mature answer."
 },
 "xl-1": {
  "a": "VLOOKUP (and XLOOKUP) let me match data across sheets — for example tying the fixed-asset register to the depreciation working, or matching the debtor ledger to receipts — which quickly surfaces discrepancies in large datasets. Pivot Tables let me summarise and analyse — revenue by month or customer, expense trends, ageing buckets — so I can spot outliers fast. They save time and improve accuracy, which makes them invaluable for sampling, reconciliations and analytical procedures.",
  "ex": "A pivot of sales by month instantly shows a March spike; a VLOOKUP of March sales against April credit notes tests whether it reversed."
 },
 "xl-2": {
  "a": "I've worked hands-on in Zoho Books for accounting and reporting, and I'm very comfortable in Excel for audit workings, reconciliations and analytics. On statutory audits I worked within the firm's documentation approach — linking risks to assertions to procedures and maintaining review trails. Big-4 GDCs use platforms like EY Canvas, KPMG Clara, PwC Aura and Deloitte Omnia; the methodology is similar, so I'm confident I can pick up any of them quickly.",
  "tip": "Frame tool gaps as \"the methodology is the same, the software is just the interface\" — confidence without overclaiming."
 },
 "art-1": {
  "a": "I did my articleship at Pawan Ram Kumar & Co. in Rewari, a well-established firm known for statutory audits, tax and GST. On the audit side I assisted on statutory and tax audits — ensuring compliance with Schedule III, CARO 2020 and IFC requirements. I conducted walkthroughs of key cycles (Order-to-Cash, Procure-to-Pay and Payroll), evaluated internal controls and designed tests of controls and substantive procedures, applied analytical and ratio/variance analysis to spot unusual trends, and contributed to finalisation of accounts and audit deliverables. I also led a small team of four on some assignments, handling delegation and review.",
  "ex": "On a manufacturing client I owned the P2P walkthrough — testing the three-way match of PO, GRN and invoice — and the revenue cut-off testing at year-end.",
  "tip": "Anchor every claim to a cycle (O2C/P2P/Payroll) and an assertion — it makes limited experience sound structured and real."
 },
 "art-2": {
  "a": "A recurring one was weak revenue cut-off — invoices dated at year-end for goods dispatched only in April. I quantified the impact, discussed it with the senior and the client, and we passed adjusting entries to move that revenue to the correct year. Another was gaps in the three-way match in P2P where invoices were booked without a GRN; I flagged it as a control weakness, extended my sample to size the issue, and it went into the IFC/management points. The outcome each time was a corrected number plus a control recommendation.",
  "ex": "The cut-off adjustment moved ~₹X lakh of revenue from March to April — a clean, quantified finding I could defend.",
  "tip": "Panels love the \"I found it → quantified it → resolved it → recommended a control\" arc. Practise one story cold."
 },
 "art-3": {
  "a": "O2C (Order-to-Cash): credit approval before order, dispatch matched to invoice, and revenue cut-off. P2P (Procure-to-Pay): PO approval, three-way match of PO–GRN–invoice, and duplicate-payment checks. Payroll: approval of new joiners and master-data changes, and timely deposit of statutory dues (PF/ESI/TDS). For each I did a walkthrough to confirm the control existed and was designed well, then tested a sample for operating effectiveness.",
  "ex": "In O2C I tested that each sampled sales order had a documented credit-limit check before approval — a preventive control against bad-debt losses."
 },
 "art-4": {
  "a": "My articleship gave me the core audit toolkit — walkthroughs, controls testing, substantive procedures, analytical review and Schedule III/CARO compliance — and I led a small team, so I'm used to ownership and review. In my current role I run finance end-to-end and I've automated workflows using AI tools, which shows I learn systems fast. A GDC has strong methodology, training and review layers; I'm confident I can apply what I know, ramp quickly on the firm's platform, and add value from day one.",
  "tip": "Reframe \"limited\" as \"core toolkit + fast learner + ownership.\" Never apologise for experience — bridge to strengths."
 },
 "beh-1": {
  "a": "I'm a Chartered Accountant with articleship experience in statutory and tax audits at Pawan Ram Kumar & Co., where I worked across O2C, P2P and payroll — controls testing, substantive procedures and finalisation under Schedule III and CARO 2020 — and led a team of four. I cleared CA with exemptions in FR, AFM and Law. Currently I run end-to-end finance at Truva, a real-estate tech startup, handling accounting, tax, compliance and MIS, and I've automated invoicing and payment workflows using AI tools. I'm now looking to move into a Big-4 GDC in audit, to work with global clients and international standards and build deep technical expertise.",
  "tip": "Structure = present → past → future, ~60–90 seconds, and end with WHY this role. Practise it out loud until it's smooth."
 },
 "beh-2": {
  "a": "On one audit a client contact was slow giving us PBC data, which threatened the deadline. I sent a clear, prioritised request list, escalated professionally through my senior with a status tracker, and offered flexible call times to unblock queries. We got the data, met the deadline, and kept the relationship positive. My approach is always to stay professional and evidence-based, focus on the solution rather than blame, and use my senior to escalate when needed.",
  "ex": "Framing it as \"here are the 5 items I need first to keep us on track\" turned a stand-off into a working list."
 },
 "beh-3": {
  "a": "I prioritise by risk and dependency — high-materiality and blocking items first — keep a daily task tracker, and communicate realistic timelines, flagging slippage early rather than at the deadline. I batch similar work and keep documentation current instead of leaving it to the end. In a GDC I'd also align my handoffs with the onshore team's overlap hours so review cycles don't stall overnight.",
  "tip": "\"Flag slippage early\" and \"align with onshore overlap hours\" are GDC-savvy phrases that land well."
 },
 "beh-4": {
  "a": "The exposure to large global clients and international standards — US GAAP/IFRS and PCAOB — plus structured training and clear progression is exactly where I want to build. I enjoy technical audit work, and a GDC lets me specialise while collaborating with onshore teams worldwide. Gurgaon also fits me geographically, and the Big-4 methodology and quality culture are the best place to deepen my expertise early in my career."
 },
 "beh-5": {
  "a": "Strength: ownership and structure — whether it's an audit area or running finance at a startup, I take an area end-to-end and keep it organised and documented. I'm also quick with tools and automation. Weakness: I can be a perfectionist and spend too long polishing documentation; I've learned to time-box and prioritise by materiality so I don't over-invest in low-risk areas. I'm also actively building depth on newer standards by reading and practising, like with this tracker.",
  "tip": "Pick a real, non-fatal weakness + the concrete fix. \"Perfectionist who now time-boxes by materiality\" is audit-appropriate."
 },
 "cv-1": {
  "a": "My finance role deepened my understanding of how numbers are actually produced — accounting, tax, MIS and controls from the preparer's side — which makes me a sharper auditor because I know where errors and shortcuts creep in. My core interest and training are in audit and assurance, and a Big-4 GDC offers the scale, global exposure and technical depth that a startup can't. I see the finance experience as a strength that complements audit, not a detour from it.",
  "tip": "Turn the \"detour\" into an asset: \"I've sat on the preparer side, so I know where to look.\""
 },
 "cv-2": {
  "a": "At Truva I built workflows using Claude AI agents to automate invoice generation and receivables tracking for customer follow-ups, and to route vendor-invoice submission and post-approval payments. It reduced manual effort and errors and let a lean finance team scale. From an audit lens I was careful about controls — approvals still gate payments, and there's an audit trail — which is exactly the control mindset a GDC values.",
  "ex": "The AI drafts and tracks the invoice, but a human approval step still sits before any payment goes out — automation without losing the control."
 },
 "cv-3": {
  "a": "Heavy compliance work made me fast and accurate with data and with the tax and regulatory framework — Section 44AD presumptive cases, TDS returns and reconciliations, and monthly/quarterly GST returns and reconciliations. In audit that translates directly into tax audit work, checking TDS/GST compliance, reconciling books to returns (e.g., GSTR-2B vs purchases), and spotting compliance red flags quickly.",
  "ex": "A books-vs-GSTR-2B reconciliation mismatch is something I've done many times — it surfaces unrecorded purchases or wrong ITC claims."
 },
 "cv-4": {
  "a": "I break the assignment into areas, allocate by each person's strength and the risk of the area, and set clear expectations and timelines up front. I keep a tracker for status, stay available for queries, and review work against the audit programme and the assertions it's meant to cover — giving specific, teachable feedback rather than just corrections. The goal is the work gets done well and the juniors actually learn.",
  "tip": "Mention reviewing \"against the assertions the procedure targets\" — it signals real review discipline."
 },
 "cv-5": {
  "a": "Yes — I'm comfortable being tested on FR. The standards most likely to come up in audit are Ind AS 115 (revenue), 116 (leases), 109 (financial instruments/ECL), 16 and 2 (PPE and inventory) and 36 (impairment) — all of which are in the technical sections I've prepared here. I'd answer with the principle, then a simple example, then how I'd audit it, which shows both the FR knowledge and the audit application.",
  "tip": "An exemption invites deeper FR questions — make sure the Ind AS sections here are truly cold-ready."
 }
};
