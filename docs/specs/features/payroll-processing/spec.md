# Feature Specification: Payroll processing

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `payroll-processing`
**Branch**: `feat/payroll-processing`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_PAYROLL` (default off; shared with `payroll-setup`); earned pay on demand behind `FEATURE_PAYROLL_EARNED_PAY` (default off)

---

## 1. Overview

Today the pay-run register keeps runs (period, pay date, frequency, currency, a lifecycle to paid with a separate
approve permission) whose lines are typed in with their amounts; the server only adds them up, with no screen, MCP
tool, payslip, journal or payment. This feature makes the register calculate, in the `payroll` plugin it shares with
`payroll-setup`: a **pay run** for a pay group and period selects its employees, gathers their facts from the
platform (calendars and unpaid days from time off, absences and overtime from attendance, approved hours from tracked
time), computes each **payslip** (payable days, order of elements, year to date, tax projection), adds **additional
pay**, incentives and bonuses, honours **withheld pay**, proposes **arrears and corrections**, publishes accrual facts
for `general-ledger`, hands net pay to `payments-and-collections` and delivers payslips. The calculating run writes the
same register — its lines are the payslips' earnings and deductions — and typed-in runs keep working as today.
Surfaces: the Gauzy web app (Payroll → Runs, Payslips, Reports), the REST API and SDKs, MCP tools, and employees' own
payslips in the Gauzy web app, laid out for phones and installable on them.

**Advanced capabilities.** Pay comes from the platform's own tracked time, timesheets, attendance and shifts with no
re-entry, each time log paid exactly once. Retroactive changes become arrears on their own, explained in words.
What-if runs compare assumed changes side by side before anything is committed. Review checks and an assistant flag
missing days and outliers against earlier periods and propose fixes as previews, never committing. Employees ask an
assistant why their pay changed and get an answer from their own payslip's trace in their language. Several countries
and currencies run in one tenant with a consolidated overview. Labour cost is allocated to projects, cost centres and
clients from tracked hours. AI agents appear with their usage cost, never in payslips, taxes or bank files. Earned pay
can be drawn during the period and is recovered automatically.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** the pay group "Germany monthly" with 120 employees, **when** a payroll officer creates and calculates the
  March run, **then** progress shows live, 118 payslips calculate, 2 fail with reasons ("no assignment on 1 March",
  "joining date missing"), and the register's lines and totals equal the payslips'.
- **Given** 2 approved unpaid days and a half-paid sick day in March, **when** the run calculates, **then** payable
  days are 19.5 of 22 and the payslip explains them, naming the time-off requests.
- **Given** an hourly contractor with approved March timesheets, **when** the run calculates, **then** each project's
  hours are paid at the stored or project rate with the timesheets listed; a later run never pays those logs again.
- **Given** a raise entered in May effective 1 March, **when** the May run calculates, **then** accepted arrear lines
  read "Base pay 4,000 → 4,400 from 1 March: March +400, April +400", taxed in May.
- **Given** a calculated run, **when** the officer opens the review, **then** findings list "Ana: net −32 % against her
  last three payslips (6 unpaid days approved)", "Bo: 4 working days with no time, time off or absence" and "Chen:
  missing from the run"; the assistant groups them and offers "recalculate after approving Bo's timesheet" as a preview.
- **Given** a submitted run, **when** an approver who did not prepare it approves, **then** payslips are confirmed and
  numbered, the accrual journal posts with project and cost-centre splits, a payment order is proposed and payslips
  are delivered; **when** the order is executed, **then** payslips and the run show paid, and a rejected line shows
  "payment failed" with the bank's reason until paid again.
- **Given** a finance lead, **when** they run what-ifs "+5 % for Engineering" and "pension contribution 3 %" for June,
  **then** both compare side by side with the last confirmed run and neither touches register, journals or payments.
- **Given** an employee whose net dropped, **when** they ask the assistant why, **then** it answers in their language
  from their payslip — "two unpaid days (−310) and one-off tax on your bonus (−120)" — citing the lines.
- **Given** a final settlement confirmed by HR, **when** the settlement run is approved, **then** unpaid pay, encashed
  days, the end-of-service amount and withheld payslips are paid, advances recovered, and the settlement shows paid.
- **Given** earned pay at 50 %, **when** an hourly employee who earned 1,000 net requests 400, **then** 400 is paid
  out and the regular payslip deducts it.

### 2.2 Edge cases & failures

- **Given** a user without `ORG_PAYROLL_EDIT`, **when** they calculate, **then** `403`; with the feature off new routes
  answer `404` and the register's routes behave as today; a second concurrent calculation or a stale version gets `409`.
- **Given** 3 failed employees or a negative net, **when** the officer submits, **then** refused naming them until
  fixed, recalculated or removed.
- **Given** a time-off change after its pay period closed, **when** it arrives, **then** it is accepted as today and
  arrears detection (FR-42) or an HR correction lets the next run pay the difference; only where the organization
  switched on the closed-period lock (FR-83) does time off refuse it.
- **Given** the preparer, **when** they approve, **then** refused; **given** an element without ledger account or a
  locked ledger period, **when** approving, **then** refused naming it.
- **Given** an exported payment order, **when** someone cancels the run, **then** refused, pointing to a correction run.
- **Given** an employee without a verified bank account, **when** the run is approved, **then** their net is held and
  listed while the others are paid; a missing exchange rate fails the affected payslips with "rate missing".
- **Given** an agent employee, **when** someone adds it to a run or records pay for it, **then** refused.
- **Given** the installed web app offline, **when** an employee reopens a payslip, **then** the last downloaded one
  shows read-only with its date.

## 3. Functional Requirements

### 3.1 Pay runs (extends the existing pay-run register)

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `ORG_PAYROLL_EDIT` can create a calculating pay run for a pay group and pay period of `payroll-setup` — period, frequency, currency and pay date come from them, the pay date stays editable — of kind regular, off-cycle (bonus, overtime, correction), settlement or earned pay; the run is a row of the existing register. |
| **FR-2** | The system MUST select the run's employees: active in the period, assigned to the pay group, matching optional filters (branch, department, position, level, employment type, project, cost centre), never of kind agent, and for a regular run without a non-cancelled payslip overlapping the period in another regular run (listed with that run); employees can be added or removed while the run is draft. |
| **FR-3** | A user with `ORG_PAYROLL_EDIT` can calculate and recalculate a draft run; above 50 employees calculation runs in the background with progress pushed to open screens; each employee ends calculated, failed (the element and values, or the missing fact) or skipped (joined after the period, ended before it, no assignment). |
| **FR-4** | The system MUST write each payslip's earnings and deductions as lines of the run in the register with the element's register line type, amount, quantity, rate and taxable flag, linked to the payslip and element; employer contributions, accruals and informational figures stay on the payslip; register totals, per-employee summary and statistics then equal the payslips'. |
| **FR-5** | The system MUST keep lines typed through the existing line routes on a draft calculating run as manual adjustments of that employee's payslip (taxed when flagged taxable) across recalculations; calculated lines change only through recalculation, additional pay or corrections. |
| **FR-6** | The system MUST leave runs created through the existing routes (typed-in runs) exactly as today: lines, totals, approval, "process as paid" and cancellation are unchanged by this feature. |
| **FR-7** | A calculating run moves draft → submitted (frozen; recalculating returns it to draft) → approved (payslips confirmed and numbered, journals posted, payment handed off) → processing (payment sent) → paid (every payable payslip paid), or cancelled, through the register's existing statuses. |
| **FR-8** | The system MUST refuse submitting a run with a failed employee, a payslip with negative net pay, an open blocking review finding (FR-55), or a fact changed since calculation (time off, attendance, approved time, assignment, additional pay), naming the employees. |
| **FR-9** | A user with `ORG_PAYROLL_APPROVE` who did not prepare, calculate or submit the run can approve it; with `approval-workflows` on, approval follows the organization's pay-run definition (default one step to those holders, amount bands allowed); with it off, the submitted run waits on the existing Approvals page as a request to the pay-run approvers the organization names (else to administrators), decided there or on the run. |
| **FR-10** | A user with `ORG_PAYROLL_EDIT` can cancel a calculating run with no paid payslip and no exported payment: in the background payslips are cancelled, journals reversed, payment lines withdrawn, and benefit-ledger entries, paid time logs and consumed additional pay released; otherwise refused, pointing to a correction run. |
| **FR-11** | The system MUST record who prepared, calculated, submitted, approved, cancelled and paid each run and when, and show runs, their progress and payslip states in real time. |

### 3.2 Facts gathered from the platform

| ID | Requirement |
| --- | --- |
| **FR-12** | The system MUST count a period's working days on the employee's holiday calendar (`time-off-management`; else the organization's official holidays with Saturday and Sunday off), a half holiday as half a day, unless the pay group counts calendar days or a fixed number of days. |
| **FR-13** | The system MUST compute payable days as the days from the later of period start and joining to the earlier of period end and end of work, on the pay group's basis, less unpaid days and, on the attendance basis, absent days; hourly structures use approved hours. |
| **FR-14** | The system MUST take unpaid and partly paid days from approved time off (a half day as 0.5, a partly paid day as one minus its pay fraction) and, on the attendance basis, absent and half days from `attendance-and-shifts`, counting unmarked working days as present or absent per pay-group setting (default present). |
| **FR-15** | A user with `ORG_PAYROLL_EDIT` can require complete attendance for a pay group; submission is then refused listing employees with unmarked working days in the period. |
| **FR-16** | The system MUST take approved timesheet hours of the period (all tracked hours where timesheets are not approved) split by project, client, billable and manual, priced as `payroll-setup` says; each time log is paid by one confirmed payslip only, the payslip lists the timesheets and logs it paid, and a paid log changed later produces a correction in the next run. *(advanced)* |
| **FR-17** | The system MUST take approved overtime, night, holiday and shift-differential hours from `attendance-and-shifts`; without it, it offers approved hours above the organization's standard hours per day and the employee's weekly limit as a fact elements may pay. *(advanced)* |
| **FR-18** | A user with `ORG_PAYROLL_EDIT` can pay approved overtime in the regular run or first in an off-cycle overtime run; overtime paid by one run is never paid again. |
| **FR-19** | A user with `ORG_PAYROLL_EDIT` can override an employee's payable days with a reason (warned when different from the computed figure); an employee whose end of work lies before the period while their status is still active fails naming the inconsistency. |
| **FR-20** | The payslip MUST explain payable days: period days, days before joining and after end of work, holidays, unpaid days with their time-off requests, absences with dates, overrides with reasons. |

### 3.3 Calculation

| ID | Requirement |
| --- | --- |
| **FR-21** | The system MUST calculate in phases — earnings (base per assignment segment, pro-rated; time-based pay; additional pay and manual adjustments; benefit accruals and payouts), gross, deductions before tax, taxable pay, income tax and tax on one-off pay, deductions after tax, loan repayments and advance recoveries, regional deductions, employer and regional contributions, rounding, net — and order elements inside a phase by their references. |
| **FR-22** | The system MUST split a period in which the assignment changes into segments, each computed with its own assignment and payable days, and combine them per element. |
| **FR-23** | The system MUST let additional pay that overrides an element replace that element's amount for its periods, and add a line otherwise. |
| **FR-24** | The system MUST round net pay by the pay group's rule (none, currency unit by default, or a step) and add the difference as a rounding line so the register's net equals the amount paid; the unrounded net stays on the payslip. |
| **FR-25** | A payslip MUST hold: period and pay group; working, payable, unpaid and absent days and hours; each line with element, quantity, rate, amount and year-to-date; employer contributions; accrued benefits; gross, deductions, net, rounded net and net in words in the employee's language; run and organization currency amounts with the rate; payment method and masked account; number and state. |
| **FR-26** | A payslip is draft, confirmed, withheld, paid, payment failed or cancelled; one non-cancelled payslip per employee and regular period; a confirmed payslip never changes — differences go to later runs. |
| **FR-27** | The system MUST fail a payslip when the joining date is missing, skip employees who join after or leave before the period, and call the pack's regional deductions, employer contributions and cost-to-company components with each result in the trace. |
| **FR-28** | The system MUST keep each payslip's full calculation trace (facts, versions, conditions, formulas with values, hook results) for as long as the payslip is kept. |

### 3.4 Tax projection and year to date

| ID | Requirement |
| --- | --- |
| **FR-29** | The system MUST compute income tax each period as: projected yearly taxable income (confirmed taxable pay this payroll year, opening balance, this period's regular taxable pay, the same for the remaining periods, one-off taxable pay to date, other income, unclaimed flexible benefits, less verified or declared exemptions and the standard deduction) taxed by the employee's tax table, less tax already withheld this year, spread over this and the remaining periods. |
| **FR-30** | The system MUST tax one-off pay marked "taxed in full" in its period (the tax with it less the tax without it), and show how much of the period's tax relates to one-off pay and to benefit payouts. |
| **FR-31** | The payslip MUST show the tax working (projected income, exemptions used, deduction, taxable income, tax by band, relief, surcharges, tax to date, tax this period, remaining periods) and say when unproven exemptions were dropped. |
| **FR-32** | The system MUST show year-to-date per line, gross and net (including opening balances) and month-to-date for pay groups paid more than once a month, from maintained totals, never by re-reading every payslip. |
| **FR-33** | The system MUST show the employee's time-off balances on the payslip when the pay group enables it. |

### 3.5 Additional pay, incentives and bonuses

| ID | Requirement |
| --- | --- |
| **FR-34** | A user with `PAYROLL_ADDITIONAL_PAY_EDIT` can record additional pay: employee, element, amount, one-off (pay date → the run whose period holds it) or recurring (from–to), reason, whether it overrides the element and whether it is taxed in full; it must lie inside employment, overlapping overrides of one element are refused, the income tax element cannot be overridden, and recurring pay can be stopped. |
| **FR-35** | The system MUST create additional pay from confirmed records of other features — time-off encashments, approved benefit claims, final settlements, referral bonuses of `recruitment`, commissions of `sales-order-management`, advance recoveries of `expenses-and-travel` (never above the open advance), arrears and corrections — linked to the source and cancelled with it unless already paid. |
| **FR-36** | A user with `PAYROLL_ADDITIONAL_PAY_EDIT` can grant an incentive (employee with an active assignment, element, amount, pay date), which becomes additional pay. |
| **FR-37** | A user with `PAYROLL_ADDITIONAL_PAY_EDIT` can grant a retention bonus with a future pay date: HR is reminded a configurable number of days before (default 14), it lapses when the employee's work ends first, and cancelling it cancels its additional pay. |
| **FR-38** | A user with `PAYROLL_ADDITIONAL_PAY_EDIT` can record a loan repayment from pay as recurring additional pay on a deduction element written as the register's loan deduction line (amount per period, from–to, reason); a repayment that would make net pay negative is deferred to the next period with a warning. |

### 3.6 Withholding pay

| ID | Requirement |
| --- | --- |
| **FR-39** | A user with `PAYROLL_WITHHOLDING_EDIT` can withhold an employee's pay from a date for a number of pay periods with a reason; overlapping withholdings are refused; payslips in those periods are calculated, confirmed and posted with state withheld, and their net is not paid. |
| **FR-40** | The run's employee list MUST mark employees whose pay is withheld. |
| **FR-41** | A user with `PAYROLL_WITHHOLDING_EDIT` can release all or some withheld periods, handing their net to payment as separate lines; the withholding becomes released when every period is; withheld unpaid payslips are payable lines of the final settlement of `hr-core-lifecycle`. |

### 3.7 Arrears and corrections

| ID | Requirement |
| --- | --- |
| **FR-42** | The system MUST detect retroactive changes — an assignment, element or structure version, pay table, approved time off, attendance or paid time log taking effect inside a closed period — and propose arrears per affected employee for the next regular run, by recalculating each affected confirmed payslip in a shadow with the new data and taking the differences of arrears-eligible elements. *(advanced)* |
| **FR-43** | Each arrear line MUST explain itself in words: what changed, from when, old and new value, and the amount per period. *(advanced)* |
| **FR-44** | A user with `ORG_PAYROLL_EDIT` can accept, edit with a reason or dismiss each proposal; a negative difference (recovery) is never applied without acceptance and is capped per period at a share of net pay (default 30 %), the rest carried to the next periods. |
| **FR-45** | A user with `ORG_PAYROLL_EDIT` can request arrears for an employee from a date with a preview; it is refused when no confirmed payslip follows that date or nothing differs. |
| **FR-46** | A user with `ORG_PAYROLL_EDIT` can correct unpaid days of a confirmed payslip (days reversed, positive and not above its unpaid days); the next run pays them at that payslip's daily rate with the explanation. |
| **FR-47** | The system MUST tax arrears and corrections as one-off pay of the period they are paid in, unless the pack's hooks say otherwise. |

### 3.8 End-of-service payouts and final settlement

| ID | Requirement |
| --- | --- |
| **FR-48** | A user with `PAYROLL_ADDITIONAL_PAY_EDIT` can compute an end-of-service payout for an employee with an end-of-work date and at least one confirmed payslip, by the applicable rule of `payroll-setup` on the last payslip's elements (zero below the minimum service), and pay it through the final payslip or as a direct payment; it moves draft → confirmed → paid or cancelled. |
| **FR-49** | The system MUST, when `hr-core-lifecycle` confirms a final settlement, pay its net through a settlement run (or the next regular run, by setting): payable lines as additional pay, receivable lines as deductions; it reports paid back to the settlement and offers unpaid pay, withheld payslips and the end-of-service amount as settlement sources. |

### 3.9 Review, anomaly detection and approval

| ID | Requirement |
| --- | --- |
| **FR-50** | The system MUST check every calculated payslip and list findings with severity: gross or net change beyond a threshold against the average of the employee's last three confirmed payslips (default 20 %), working days without time, time off or absence (missing days), active employees of the pay group missing from the run, elements that appear or vanish, zero or negative net, an effective tax rate change beyond a threshold, a pay account changed since the last run or shared by two employees, hours above the weekly limit, a first or last payslip. *(advanced)* |
| **FR-51** | An assistant MUST review the findings, group related ones, explain the likely cause from the trace and the platform's records (a new assignment, approved unpaid time off, an unapproved timesheet), and propose actions as previews (approve-then-recalculate, add the missing employee, withhold one payslip); it never changes, submits or approves a run. *(advanced)* |
| **FR-52** | A user with `ORG_PAYROLL_EDIT` can acknowledge each finding with a note; findings, notes and the assistant's review are kept with the run. |
| **FR-53** | Approvers MUST see totals, differences from the previous run per element and pay group, open findings and acknowledgements before deciding. |
| **FR-54** | The system MUST check the run's postings through the ledger's effects preview before approval and refuse approval naming the element whose account is missing or the locked period. |
| **FR-55** | The organization MUST be able to mark finding kinds blocking (default: negative net, missing employee, shared pay account); a blocking finding must be acknowledged before submission. |

### 3.10 What-if runs and previews

| ID | Requirement |
| --- | --- |
| **FR-56** | A user with `PAYROLL_SIMULATE` can create what-if runs for a pay group and period with assumed changes — draft element or structure versions, base changes by percent or amount for filtered employees, another tax table, planned hires (level and base), leavers — calculated like a regular run and compared per employee and element with a base (the last confirmed run or the current draft); several what-ifs show side by side. *(advanced)* |
| **FR-57** | What-if runs MUST never enter the register, journals, year to date, payments, reports or statistics; they are kept 90 days unless pinned, and their changes can be turned into drafts (versions, assignments) that follow normal approval. *(advanced)* |
| **FR-58** | The system MUST preview a payslip without saving it for an employee, a period and optionally a proposed assignment, for the sandbox and cost to company of `payroll-setup` and the offer compensation preview of `recruitment`. |

### 3.11 Journals and cost allocation

| ID | Requirement |
| --- | --- |
| **FR-59** | On approval the system MUST publish the run's accrual facts for `general-ledger`: earnings to their expense accounts, deductions to their liability accounts, advance and loan recoveries, rounding, and net pay payable to the employees, per element and allocation, leaving out informational elements and elements excluded from journals, in the run currency with the rate to the organization currency; the journal reference shows on the run and its payslips. |
| **FR-60** | The system MUST post employer contributions as expense against liability in the same journal or, per organization setting, in a separate journal. |
| **FR-61** | The system MUST post per employee (the employee as party on payable and expense lines) or summarised per element, per organization setting; net pay payable is always per employee when payments settle open items. |
| **FR-62** | The system MUST allocate each payslip's cost by its assignment: fixed shares, or by tracked time (approved hours per project in the period, so per client, the rest to the fixed shares or default), carrying cost centre, department and project on every posted line. *(advanced)* |
| **FR-63** | The system MUST hand each period's labour cost per employee, project and client (cost to company spread by approved hours) to `project-costing-and-billing` as actual cost; for a period payroll has closed, this cost replaces the labour cost project costing estimated from rates, so a project's labour is counted once. *(advanced)* |
| **FR-64** | Cancelling a run MUST reverse its journals through the ledger; with `accounting` off, payslips are documents without postings and everything else works. |
| **FR-65** | The system MUST post a withheld payslip like any other and keep its net payable open until released and paid. |

### 3.12 Paying employees

| ID | Requirement |
| --- | --- |
| **FR-66** | On approval the system MUST hand the net pay of each confirmed, not withheld payslip to `payments-and-collections` as a payable of the employee and propose a payment order for the pay group's bank account and the pay date; approving and exporting the order follow that feature's rules. |
| **FR-67** | The system MUST pay into the employee's primary verified bank account, read from the one encrypted store of bank details of `banking-and-reconciliation` (the HR pay-account screen edits the same record), with its method (transfer, cash, cheque); a payslip without a usable account (missing, pending verification, other currency) is held with the reason and listed. |
| **FR-68** | The system MUST pay through the payout channel of `payment-gateways` where the organization connected one for the pay group, otherwise through bank files of the payment order's generators, including salary file layouts a pack ships. |
| **FR-69** | The system MUST mark a payslip paid when its payment is confirmed, payment failed with the bank's reason when its line is rejected (payable again once fixed), and the run paid when every payable payslip is paid. |
| **FR-70** | Without `payments-and-collections`, a user with `ORG_PAYROLL_APPROVE` can export the run's payment list and mark payslips paid with date and reference; the existing process route does this for a whole calculating run. |
| **FR-71** | Released withheld pay and end-of-service payouts paid directly MUST be paid as separate payment lines. |

### 3.13 Payslip documents and delivery

| ID | Requirement |
| --- | --- |
| **FR-72** | The system MUST register the payslip and the pay run as business document types with numbering series per organization, and print payslips through print templates in three shipped layouts (standard, compact, detailed) with the organization's letterhead and amounts in words. |
| **FR-73** | A user with `PAYROLL_PAYSLIPS_SEND` can deliver payslips of a run (automatically on approval per setting): in the Gauzy web app with a notification, and by email with the PDF attached or as a sign-in link; the PDF can be password-protected with a pattern the organization chooses from fields not printed on the payslip; delivery runs in the background with a state per employee (sent, no email, failed) and resend; employees without email are listed. |
| **FR-74** | An employee with `PAYROLL_SELF_SERVICE` can read and download only their own payslips with history and year to date; the Gauzy web app installed on a phone keeps the last downloaded ones readable offline until sign-out. |
| **FR-75** | The system MUST let an assistant explain a payslip to its employee in the employee's language — what changed against the previous payslip and why, what each line means, how tax was projected — from that payslip's trace only, citing the lines, and route what it cannot answer to payroll as an inbox item. *(advanced)* |
| **FR-105** | The employee's own payroll screens (payslips with history and year to date, payslip download, earned pay where offered) MUST be pages of the Gauzy web app laid out for phone width and installable on the phone; no other app is needed. |

### 3.14 Multi-currency and multi-country

| ID | Requirement |
| --- | --- |
| **FR-76** | The system MUST calculate a run in its pay group's currency and store payslip amounts in run currency and organization currency with the rate (from the ledger's rate feed when `accounting` is on, else entered on the run); journals post with that rate; the payable account's currency must be the organization's or the run's. |
| **FR-77** | The system MUST convert an assignment paid in another currency than its structure at the run's rate and show both amounts. |
| **FR-78** | The system MUST resolve tax tables and pack rules per pay group country, so one tenant runs several countries and currencies side by side. |
| **FR-79** | A user with `PAYROLL_REPORTS_VIEW` in several organizations can open a payroll overview of a month: every run of their organizations and pay groups with state, headcount, gross, net and employer cost in each currency and converted to a reporting currency. *(advanced)* |

### 3.15 Earned pay on demand

| ID | Requirement |
| --- | --- |
| **FR-80** | With `FEATURE_PAYROLL_EARNED_PAY` on for a pay group, an employee can request part of the net pay earned so far in the current period — approved hours (hourly) or elapsed payable days (salaried) less deductions estimated at the previous period's rate — up to the group's cap (default 50 %), at most a number of times per period (default 2), never in the last days before the pay date (default 3) nor while pay is withheld. *(advanced)* |
| **FR-81** | A request within limits is approved automatically or by a user with `ORG_PAYROLL_APPROVE` (setting), paid through the payout channel or the next payment order, posted as an advance to the employee, and recovered as a deduction on the period's regular payslip. *(advanced)* |

### 3.16 Agents and period close

| ID | Requirement |
| --- | --- |
| **FR-82** | The system MUST never give an employee of kind agent a payslip, register line, tax, statutory element, payment or bank-file line, and show agents in a run's agent employees section with their period usage cost from `ai-agents-and-assistants`, allocated to projects by their tracked work and included in labour-cost reports and project cost. *(advanced)* |
| **FR-83** | A user with `ORG_PAYROLL_APPROVE` can close a pay period once its regular runs are paid or cancelled; closing publishes the event `time-off-management` uses, when the organization switched on "lock time off in closed pay periods" (default off), to refuse changes inside it; with the setting off, time-off changes inside a closed period are accepted as today and become arrears or corrections of the next run (FR-42, FR-46); reopening needs a reason and is refused once a later period is closed. |

### 3.17 Reports

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable. Amounts follow the
reader's payroll permissions; bank details are masked without the bank account numbers permission of
`banking-and-reconciliation`.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-84** | Pay and deductions per payslip | What did each payslip pay and withhold? One row per payslip, one column per element in payslip order, with the day counts and the run's totals; employer cost on request | pay group, period, branch, department, payslip state |
| **FR-85** | Net pay per employee and account | Who is paid how much, into which account, from which organization account, on which date? | run or pay date |
| **FR-86** | Yearly employer cost per assignment | What does an assignment cost a year, element by element, and what share of the total is each? | employee, assignment |
| **FR-87** | Yearly income tax calculation per employee | How was each employee's yearly tax reached, from pay through exemptions to tax and what is already withheld? | payroll year, department; declared or proven exemptions |
| **FR-88** | Tax withheld per payslip | How much tax did each payslip withhold, under which tax number of the employee? | period, pay group |
| **FR-89** | Amounts paid per method and branch | How much was paid by each method in each branch? | period, run |
| **FR-90** | Transfer instructions per branch | Which transfer instructions go to the bank, grouped by branch? | run, method |
| **FR-91** | Benefit entitlement, accrual and payment per employee | What benefit is each employee entitled to, what has accrued, what was paid and what is still owed? | payroll year, element, department |
| **FR-92** | Payroll charts | Benefit claim amounts; payroll cost by department and by position for the last month; net pay paid over time | dates |
| **FR-93** | Payroll cards | Benefit claims this month; tax proofs received this year; tax declarations submitted; incentives paid last month; net pay paid last month; pay structures in use | organization |
| **FR-94** | Labour cost by project and client | Payroll and agent usage cost per project and client from allocations *(advanced)* | dates, organization, project, client, department |
| **FR-95** | Run variance | Run against the previous run per element and employee *(advanced)* | pay group, runs |

| ID | Requirement |
| --- | --- |
| **FR-96** | The existing amounts-owed report MUST keep its figures and, with the feature on, show how much of each employee's owed amount confirmed payslips have paid. |

### 3.18 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-97** | The system MUST expose every action through the REST API (existing register routes unchanged) and register pay runs, payslips, additional pay, withholdings, arrears and earned-pay requests as record types for saved views, custom fields, approval definitions and automation triggers. |
| **FR-98** | The system MUST publish events (run calculated, submitted, approved, paid, cancelled; payslip confirmed, delivered, paid, failed; pay period closed; arrears proposed; review finding raised; settlement and encashment paid) on the event outbox for ledger, payments, time off, HR, project costing, automations, webhooks and real-time updates. |
| **FR-99** | The system MUST offer MCP tools to read runs, payslips and findings, create and calculate runs, run what-ifs, record additional pay and withholdings, propose arrears and explain a payslip; tools that confirm, approve, pay or cancel return a preview first, act with the caller's permissions and are marked as agent actions. |
| **FR-100** | The system MUST grant `PAYROLL_SELF_SERVICE` (own payslips, earned-pay requests) to the employee role and the processing keys to administrators, effective only while the feature is on. |
| **FR-101** | The system MUST show payslip amounts to the holders of `ORG_PAYROLL_VIEW`, who read the existing payroll runs and their items today, and to the employee; a manager without that permission sees none, as with the existing payroll runs; every read of another person's payslip is logged in the platform's access log of `access-control-and-security` when it is loaded. |
| **FR-102** | A user with `ORG_PAYROLL_EDIT` can import historical payslips (totals and lines per element) as confirmed payslips without postings or payments, so year to date and projections start right. |
| **FR-103** | The system MUST, with the feature off, load no route, menu entry or job of the feature, keep its data, and leave the register's routes, GraphQL, totals and statistics behaving as today. |
| **FR-104** | The system MUST record who, when, before and after for every change to runs, payslips (state), additional pay, withholdings, arrears, corrections, payouts and earned-pay requests. |

## 4. Non-Functional Requirements

- **Performance**: calculation of 1,000 employees within 60 s and 10,000 within 10 minutes on one worker (more
  workers divide it by employee partitions); one payslip recalculation under 1 s; review checks for 10,000 payslips
  within 2 minutes; PDF rendering and delivery of 10,000 payslips within 15 minutes; run and payslip lists under
  300 ms at the 95th percentile with 5 million payslips per tenant; year to date from maintained totals.
- **Data volume and concurrency**: 100,000 employees, 2.4 million payslips, 50 million register lines a year per
  tenant; one calculation per run at a time (`409` otherwise); optimistic versions on runs and adjustments.
- **Reliability**: calculations, postings, payment hand-offs and deliveries keyed so a repeated job changes nothing
  twice; a failed employee never blocks the others' calculation; a crash resumes from the last employee written.
- **Security & privacy**: tenant and organization scoped; pay data sensitive (FR-101); leaves the platform: payslip
  emails and PDFs, bank files and payouts (name, account, amount, reference), and — only when enabled — assistant
  questions with the asking employee's own trace sent to the organization's AI provider.
- **Observability and audit**: run timeline, per-employee results, findings, delivery states, audit of FR-104.
- **Accessibility and localization**: keyboard-operable run and payslip pages, labelled tables, payslips and amounts
  in words in every shipped locale, dates and numbers in the reader's format, right-to-left payslip layouts.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; existing register routes,
  GraphQL fields, totals and statistics unchanged for typed-in runs; additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `PayrollRun` (extended) | The existing register run, now also calculating: pay group, pay period, kind, calculation and payment state |
| `PayrollItem` (extended) | The existing register line, now linked to its payslip and element, with year to date and source |
| `Payslip` | One employee's result in a run: days, totals, currencies, state, number, tax working |
| `PayslipLine`, `PayslipTrace` | Figures that do not change net pay (contributions, accruals, informational); the full calculation trace |
| `PayslipTimeSource` | A timesheet or time log a payslip paid (each log paid once) |
| `AdditionalPay` | One-off or recurring extra earning or deduction: incentives, retention bonuses, pay from other features |
| `PayWithholding` / period | Pay held for a number of periods and its release |
| `PayArrear` / line, `EndOfServicePayout` | An explained retroactive difference or correction; the amount paid for service at end of work |
| `PayRunFinding`, `PayrollWhatIf` | A review check result and its acknowledgement; a simulated run outside the register |
| `PayslipCostAllocation`, `AgentUsageCost` | A payslip's cost by cost centre, department, project and client; an agent's usage cost |
| `PayslipDelivery`, `EarnedPayRequest` | Delivery of a payslip and its state; a draw on pay earned during the period |

## 6. Out of Scope

- Elements, formulas, structures, assignments, pay groups and periods, tax tables, declarations, benefits and
  end-of-service rules: `payroll-setup` (same plugin). Journals and posting rules: `general-ledger`.
- Payment orders, bank file generators, payee verification: `payments-and-collections`; provider payouts:
  `payment-gateways`; country rules, salary file layouts, statutory returns: `regional-compliance-packs`.
- Unpaid days, encashment, calendars: `time-off-management`; attendance and overtime approval: `attendance-and-shifts`;
  final settlement: `hr-core-lifecycle`; employees' bank details: `banking-and-reconciliation`; advances and benefit
  claims: `expenses-and-travel`; commissions: `sales-order-management`; referral bonuses and offers: `recruitment`.
  Loan agreements are not managed here; repayments from pay are recorded as deductions (FR-38).
- Approval engine: `approval-workflows`; print designer: `print-and-pdf-designer`; report builder:
  `report-builder-and-dashboards`; profitability: `project-costing-and-billing`; delivery channels:
  `automation-and-notifications` and `email-and-communications`.

## 7. Acceptance Criteria

- [ ] **AC-1** A seeded run calculates with live progress; failures name employee and cause; register lines and totals
      equal the payslips; a typed-in run behaves exactly as before (FR-3, FR-5).
- [ ] **AC-2** Payable days follow holidays, joining, end of work, unpaid and partly paid time off and absences, with
      the explanation; complete-attendance mode refuses submission listing employees (FR-12–FR-14, FR-20).
- [ ] **AC-3** Approved hours are paid per project at stored and project rates, each log and each overtime hour once
      (advanced, time) (FR-16–FR-18).
- [ ] **AC-4** Golden payslips (phases, segments, rounding, one-off tax, year to date, tax working) match to the cent (FR-21, FR-30, FR-31).
- [ ] **AC-5** Additional pay of every kind and source reaches one payslip once; withholding holds and releases pay (FR-39–FR-41).
- [ ] **AC-6** A retroactive raise yields explained, accepted arrears; recoveries are capped; an unpaid-day correction
      pays the difference (advanced, arrears) (FR-43, FR-44, FR-46).
- [ ] **AC-7** Planted anomalies are found and grouped by the assistant as previews that change nothing (advanced, review) (FR-50–FR-52).
- [ ] **AC-8** Two what-ifs compare side by side and leave register, journals, year to date and statistics untouched
      (advanced, what-if) (FR-56, FR-57).
- [ ] **AC-9** The preparer cannot approve; approval posts a balanced journal with project and cost-centre splits, a
      missing account refuses naming the element, labour cost reaches project costing (advanced, allocation) (FR-9, FR-60, FR-62).
- [ ] **AC-10** Net pay reaches a payment order and bank file; executed and rejected lines set paid and payment failed;
      without payments the run is marked paid by hand (FR-66, FR-68, FR-69).
- [ ] **AC-11** Payslips print in three layouts and deliver in app and by email; the assistant explains one in the
      employee's language citing lines (advanced, explanation) (FR-72, FR-73, FR-75).
- [ ] **AC-12** Two countries and currencies calculate with their rates and tables and appear in the overview (advanced; FR-76–FR-78).
- [ ] **AC-13** An earned-pay draw is paid and recovered on the regular payslip (advanced, earned pay) (FR-80, FR-81).
- [ ] **AC-14** An agent never appears in payslips, register lines or bank files; its usage cost is in labour cost (advanced; FR-82).
- [ ] **AC-15** The reports of §3.17 agree with seeded payslips; the amounts-owed report shows paid amounts.
- [ ] **AC-16** Denial `403`; concurrent calculation `409`; cancel after export refused; with the closed-period lock
      off (the default) a time-off edit inside a closed period is accepted and proposed as arrears, and with it on the
      edit is refused (FR-10, FR-83).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-103).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_PAYROLL`; with it off, the existing register suites pass unchanged.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Calculating runs accept currencies with up to two decimals, as the register's columns do (applied); widening them
  for three-decimal currencies is an additive type change.
- A run approves all its payslips at once (applied); the preparer may not approve a calculating run, typed-in runs
  keep today's permission-only rule (applied).
- Recoveries are capped at 30 % of net pay per period (applied); packs may set legal caps.
- Earned pay is an advance of net pay, taxed by the regular payslip (applied); PDF passwords are off by default and
  never built from fields printed on the payslip (applied).

## 9. Constitution Gates

- [x] I Plugin-first — module of the new plugin `payroll`; core gains nullable register columns, one optional hook and
      one request approval type.
- [x] II Tenant/organization scoping — every record scoped; the overview spans only the reader's organizations.
- [x] III Both ORMs, additive migrations — nullable core columns and new plugin tables, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PAYROLL`, `FEATURE_PAYROLL_EARNED_PAY`; typed-in runs unchanged.
- [x] V Contracts and API first; backwards compatible — optional fields on register contracts; new routes additive.
- [x] VI Permissions, privacy, security — five new keys, separation of preparer and approver, masked pay, logged reads.
- [x] VII Real-time through the event bus — outbox events; run progress and states pushed.
- [x] VIII i18n and accessibility — every string a key in all locales; payslips localized with amounts in words.
- [x] IX Tests accompany the change — golden payslips, idempotent jobs, register equality, posting balance.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`payroll-setup`](../payroll-setup/spec.md), [`time-off-management`](../time-off-management/spec.md),
  [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`general-ledger`](../general-ledger/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md),
  [`regional-compliance-packs`](../regional-compliance-packs/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`business-document-engine`](../business-document-engine/spec.md), [`attendance-and-shifts`](../attendance-and-shifts/spec.md),
  [`banking-and-reconciliation`](../banking-and-reconciliation/spec.md), [`expenses-and-travel`](../expenses-and-travel/spec.md)
- Existing code: `packages/core/src/lib/payroll-run`, `packages/core/src/lib/payroll-item`, `packages/contracts/src/lib/payroll.model.ts`,
  `packages/core/src/lib/time-tracking/{time-log,timesheet}`, `packages/core/src/lib/employee/employee.entity.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (payroll), §3.1 (documents), §3.4 (ledger), §3.12 (AI and MCP)
