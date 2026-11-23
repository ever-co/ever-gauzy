# Feature Specification: Payroll setup

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `payroll-setup`
**Branch**: `feat/payroll-setup`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_PAYROLL` (default off); shared with `payroll-processing`

---

## 1. Overview

Today an employee carries a pay period, an hourly pay rate with its currency and a bill rate; recurring employee
costs (salary, salary taxes, bonus) feed the statistics dashboards; a pay-run register stores runs whose lines are
typed in with their amounts; a report prices tracked time at the pay rate. Nothing calculates pay. This feature adds
the definitions a calculating payroll needs, in the new `payroll` plugin that `payroll-processing` shares: **pay
elements** (earnings, deductions, employer contributions, accruals, informational figures) with an amount rule, a
condition and formulas in the platform's formula language; **pay structures** that group elements; **pay groups** and
**payroll years** with their pay periods; **structure assignments** that bind an employee to a structure from a date
with base pay, cost to company and cost allocation; **tax tables**, exemption categories, employee **declarations and
proofs**, other income; **flexible benefits**, claims against them (filed as expense claims) and the benefit ledger;
**end-of-service rules**; and **opening balances**. Country rules arrive from `regional-compliance-packs` through named
extension points. Surfaces: the Gauzy web app (Payroll → Setup), the REST API and SDKs, MCP tools, and employee
self-service (declarations, proofs, benefit choices) in the Gauzy web app, laid out for phones and installable on them.

**Advanced capabilities.** Formulas are a readable, parsed language — never evaluated as code — that references
elements by identity (renaming never breaks a formula), orders itself by its references, carries test cases that run
on every save, is versioned by effective date and can be run in a sandbox that shows every step for a real employee
and period; before a change is saved its impact on every affected employee is shown. Pay can come straight from the
platform's own tracked time: approved timesheet hours priced at the rate each time log stored, per-project pay rates,
contractors paid from approved time with no re-entry. Cost is allocated to projects, clients and cost centres from
the hours people actually tracked. An assistant drafts an element from a sentence, with its tests, and never saves
it. Pay groups let one tenant run several countries and currencies side by side. Employees of kind AI agent are
costed by usage and kept out of every statutory rule. Enabling the feature proposes structures and assignments from
the pay rates and recurring costs that already exist.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an organization that has just enabled payroll, **when** a payroll administrator opens Payroll → Setup,
  **then** a checklist (pay group, payroll year, elements, structures, accounts, tax table, assignments) shows its
  progress, a starter set of elements exists — one per register line type plus hourly pay from approved time, overtime,
  unpaid time-off deduction and income tax — and a proposal per employee built from their pay rate, pay period and
  recurring salary costs waits to be accepted, edited or skipped.
- **Given** an element "Transport allowance" with the formula `min(basic * 10%, 300)` and the condition
  `employee.level.rank >= 3`, **when** the administrator saves it, **then** names, types and cycles are checked and
  its three test cases pass; **when** the element `basic` is later renamed `base_pay`, **then** the formula reads
  `min(base_pay * 10%, 300)` without anyone editing it.
- **Given** the sandbox, **when** the administrator picks Ana and March 2027, **then** each element is listed in
  calculation order with the version in force, the condition's result, the formula with values substituted, each
  intermediate value, the rounding and the amount, followed by phase totals and the tax working; nothing is saved.
- **Given** an unsaved change raising the transport cap to 350, **when** the administrator asks for its impact,
  **then** the last closed period is recalculated for the affected employees and the result shows how many payslips
  change, the total difference and the largest differences, before anything is saved.
- **Given** the structure "Engineering monthly" and level "Senior" with a default base, **when** HR assigns 40
  filtered employees from 1 April, **then** a background job assigns each with the level's base and reports assigned,
  skipped (an assignment from that date exists, not active on the date, agent) and failed, with reasons.
- **Given** a target yearly cost to company of 90,000, **when** the administrator asks the assignment to solve for
  base pay, **then** the base that reaches 90,000 within 0.01 is proposed with the breakdown per element.
- **Given** a contractor on "Contractor hourly" with a project pay rate of 60 on project "Website", **when** the
  sandbox runs March, **then** approved hours on Website are paid at 60 and other approved hours at the rate each
  time log stored, one line per project, with no tax or statutory element.
- **Given** an assignment allocated "by tracked time", **when** the employee tracked 60 % of approved hours on
  "Website" (client Acme) and 40 % on internal work, **then** the cost preview splits 60/40 between the project and
  the department's cost centre.
- **Given** the 2027 tax table, **when** an employee declares 1,500 in a retirement-savings exemption capped at
  1,200, **then** the declaration shows 1,500 declared and 1,200 allowed and the sandbox's projected tax drops; **when**
  they later submit proof of 1,000 and HR verifies it, **then** 1,000 replaces the declared amount from the next payslip.
- **Given** a flexible benefit allowance of 2,400 a year, **when** the employee splits it 1,800 meals and 600 phone,
  **then** the choice is saved for the year; **when** they file an expense claim of 150 on the phone benefit's category
  with a receipt and it is approved, **then** additional pay of 150 is created for the next pay run.
- **Given** an end-of-service rule, **when** HR previews the amount for a leaver with 7.4 years of service, **then**
  the preview shows service counted, the bands used and the amount.
- **Given** branches in two countries with their packs applied, **when** the administrator creates pay groups
  "Germany monthly EUR" and "India monthly INR", **then** each uses its own payroll year, tax table and pack rules.
- **Given** an assistant asked for "10 % of basic, at most 500, only from level rank 3", **when** it drafts the
  element, **then** it returns formula, condition and test cases with a sandbox result as a draft a person must save.

### 2.2 Edge cases & failures

- **Given** a user without `PAYROLL_SETUP_EDIT`, **when** they save an element, **then** `403`; with the feature off
  every new route answers `404`, menus are hidden, and employee pay rates, recurring costs, the pay-run register and
  the amounts-owed report behave as today.
- **Given** element A reading B and B reading A, **when** either is saved, **then** it is refused naming the chain
  `A → B → A`; an unknown name is refused with its position in the formula.
- **Given** a division by zero in a sandbox run, **when** it happens, **then** that element is marked in error with
  the values involved and the run reports it; it never silently becomes zero.
- **Given** an element used by a confirmed payslip, **when** someone changes its kind or deletes it, **then** refused;
  deactivating it from a date is offered instead.
- **Given** two assignments from the same date, one before joining, one after end of work, or a structure of another
  organization, **when** saved, **then** each is refused naming the field.
- **Given** cost-allocation shares totalling 95, **when** saved, **then** refused showing the 5 missing.
- **Given** two payroll years of one pay group that overlap, **when** saved, **then** refused naming the other year.
- **Given** a closed pay period, **when** HR changes an assignment with effect inside it, **then** the change is
  accepted only as a retroactive change and the arrears it causes are proposed by `payroll-processing`.
- **Given** a benefit claim above the remaining eligible amount, **when** submitted, **then** refused with the
  remaining amount; a second claim for the same benefit and month is warned.
- **Given** two administrators editing one structure version, **when** both save, **then** the second gets `409`.
- **Given** a pack hook that fails, **when** the sandbox runs, **then** the element is in error naming the pack.
- **Given** an employee of kind agent, **when** someone assigns a structure, a declaration or a benefit, **then** it
  is refused.

## 3. Functional Requirements

### 3.1 Pay elements

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `PAYROLL_SETUP_EDIT` can maintain the pay elements of an organization: name, code, kind (earning, deduction, employer contribution, accrual, informational), description, the register line type it is written as in the pay-run register, payslip display order and an active flag. |
| **FR-2** | The system MUST keep codes unique per organization (a letter, then letters, digits or underscores, never a reserved word of the formula language) and store formulas with references to elements, so renaming a code updates every formula that reads it. |
| **FR-3** | The system MUST refuse changing the kind of an element, or deleting it, once a confirmed payslip used it, and offer deactivation from a date instead, after which new calculations leave it out. |
| **FR-4** | The system MUST let an element's amount be a fixed amount, a formula, hours or units times a rate (from tracked time, attendance or a pay table), or an amount entered per pay run and employee with an optional default (input element). |
| **FR-5** | The system MUST let an element carry a condition written in the formula language; when it is false the element is left out of the payslip and the trace records the condition and its values. |
| **FR-6** | The system MUST pro-rate fixed and base-derived earnings by payable days over working days by default and let an element pro-rate by payable hours or not at all; saving a formula that already reads payable days with pro-rating on is refused with the reason. |
| **FR-7** | The system MUST let an earning be taxable or not, a deduction reduce taxable pay (before tax) or not, one deduction per tax table be the income tax element that receives the computed tax, and an earning be taxed in full in the period it is paid instead of being spread over the payroll year. |
| **FR-8** | The system MUST let an element be paid and counted in gross (default), paid outside gross (added to net, never taxed, for example a reimbursement), informational (computed, shown and readable by formulas, never paid), excluded from journals, and dropped from the payslip when zero (default on). |
| **FR-9** | The system MUST round an element's amount by its rule: none (default), to the currency unit, or to a step (for example 0.05 or 10), half up. |
| **FR-10** | The system MUST let an element be arrears-eligible (default on for earnings and deductions), which decides whether a retroactive change produces arrears for it in `payroll-processing`. |
| **FR-11** | A user with `PAYROLL_SETUP_EDIT` can set per element and organization the ledger accounts it posts to (expense for earnings and contributions, liability for deductions and contributions, accrued liability for accruals) when `accounting` is on; activating a structure that holds a posted element without accounts warns, naming the element. |
| **FR-12** | The system MUST version elements by effective date: a change becomes a version from a date (default the first day of the next open pay period); a pay period uses the version in force on its last day; versions used by a confirmed payslip are never edited. |
| **FR-13** | The system MUST show, before a change to an element, pay table or structure is saved, the structures, assignments and employees it affects and recalculate the last closed period for up to 500 of them, giving the count of changed payslips, the total difference and the ten largest differences. *(advanced)* |
| **FR-14** | The system MUST create, when the feature is first enabled for an organization without elements, one element per existing register line type plus hourly pay from approved time, overtime, unpaid time-off deduction and income tax, each an ordinary editable element. |
| **FR-84** | A user with `PAYROLL_SETUP_EDIT` can set, when `accounting` is on, the organization's default payroll payable and employee advance accounts, kept as designations of `accounting-foundation` and used when neither the assignment nor the element names an account; an account of another organization, or in a currency other than the organization's or a pay group's, is refused, and a missing one is a setup checklist finding. |

### 3.2 Formula language, tests and sandbox

| ID | Requirement |
| --- | --- |
| **FR-15** | A formula is written in the platform's one formula language (shared with custom fields and other features), extended for payroll: an expression of decimal numbers, percentages (`10%`), `+ - * /`, parentheses, comparisons, `and`, `or`, `not`, `if(condition, then, else)` and the functions `round`, `round_up`, `round_down` (each with an optional step), `min`, `max`, `abs`, `clamp`, `between`, `years_between`, `months_between`, `days_in_month` and `lookup`; it has no loops, assignments, user functions or access to anything but the names of FR-16. |
| **FR-16** | A formula can read: element codes (their amount in this payslip), `assignment.base`, `assignment.variable` and their yearly values, period facts (days, working days, payable days, unpaid days, hours worked, approved hours, hours per project, overtime, night and holiday hours), `gross` and `taxable` so far, year-to-date amounts, and employee facts (level and its rank, position, department, branch and its country, employment type, joining date, years of service), custom fields the organization marks payroll-readable and the applied pack's statutory fields. |
| **FR-17** | The system MUST check a formula on save — syntax with the position of the error, unknown names, incompatible comparisons, cycles across every structure that holds the element (naming the chain) — and limit a formula to 2,000 characters and an evaluation to 10,000 steps. |
| **FR-18** | The system MUST compute in exact decimals, divide to 10 decimal places, and report division by zero, a missing pay-table key or an element in error as an error of the element naming the values, never as zero. |
| **FR-19** | The system MUST order elements by their references within the calculation phases of `payroll-processing` (an element is computed after every element it reads); the display order only governs the payslip. *(advanced)* |
| **FR-20** | A user with `PAYROLL_SETUP_EDIT` can attach test cases to an element (inputs and the expected amount, or "left out"); they run on every save of the element and of any element it reads, and a failing case blocks activating the version unless overridden with a recorded reason. *(advanced)* |
| **FR-21** | A user with `PAYROLL_SETUP_VIEW` can run the sandbox on facts entered by hand, and with `PAYROLL_ASSIGNMENTS_VIEW` for a real employee and period, optionally with unsaved element or structure versions: the system calculates with the pay-run engine and shows each step (version, condition, formula with values, intermediate values, rounding, amount, phase totals, tax working) and saves nothing. *(advanced)* |
| **FR-22** | A user with `PAYROLL_SETUP_EDIT` can maintain pay tables: named, dated lookup tables with one or two keys (for example level and branch) and an amount, read by `lookup`; a missing key without a default value is an error of the element. |
| **FR-23** | The system MUST let an assistant draft an element from a plain-language description — formula, condition, test cases and a sandbox result for a chosen employee — as an unsaved draft that only a person with `PAYROLL_SETUP_EDIT` can save. *(advanced)* |

### 3.3 Pay structures

| ID | Requirement |
| --- | --- |
| **FR-24** | A user with `PAYROLL_SETUP_EDIT` can maintain pay structures: name, currency, pay frequency, pay basis (salaried, hourly from approved time, mixed), elements with an optional amount or formula overriding the element's for this structure, maximum flexible benefits per year, default payment method and an active flag. |
| **FR-25** | The system MUST version structures by effective date and refuse activating a version that holds a cycle, a formula error, a failing test case without override, or two income tax elements for one tax table; it warns when a sample payslip at the structure's typical base has a negative net. |
| **FR-26** | The system MUST apply an element's new version to every structure holding it from the version's date, keep structure-level overrides, and list the structures whose override now differs so the user keeps or drops each. |
| **FR-27** | A user with `PAYROLL_ASSIGNMENTS_VIEW` can preview from a structure the payslip of a chosen employee and period through the sandbox. |
| **FR-28** | A user with `PAYROLL_ASSIGNMENTS_EDIT` can assign a structure to many active employees filtered by branch, department, position, level, employment type and pay group, from a date, with base and variable pay given or taken from each level's default, as a background job reporting per employee assigned, skipped with reason or failed. |

### 3.4 Pay groups, payroll years and pay periods

| ID | Requirement |
| --- | --- |
| **FR-29** | A user with `PAYROLL_SETUP_EDIT` can maintain pay groups (employees paid together): organization, country, currency, pay frequency (the register's frequencies plus daily), payroll year calendar, pay-date rule (last working day, a fixed day, or a number of days after period end), paying bank account, default structure, and the payable-day basis (working days by holiday calendar, calendar days, or a fixed number of days). |
| **FR-30** | A user with `PAYROLL_SETUP_EDIT` can define payroll years per pay group (start, end) whose pay periods the system generates from the frequency with start, end and pay date; years of one pay group never overlap and its periods cover the year without gaps. |
| **FR-31** | The system MUST answer, for an employee and a date, the number of pay periods remaining in the payroll year in which the employee is active between joining and end of work, for tax and benefit projections. |
| **FR-32** | The system MUST keep each pay period open or closed (closed by `payroll-processing`); a change to assignments, opening balances, declarations or proofs with effect inside a closed period is accepted only as a retroactive change that produces arrears. |
| **FR-33** | The system MUST list active employees without an assignment, or with an assignment outside any pay group, for a chosen date. |

### 3.5 Structure assignments and cost to company

| ID | Requirement |
| --- | --- |
| **FR-34** | A user with `PAYROLL_ASSIGNMENTS_EDIT` can assign a structure to an employee from a date with base pay (per hour, per period or per year), variable pay, pay group, tax table, payment currency when it differs from the structure's, an optional daily amount for time-off encashment, cost allocation and an optional payable account; it ends the day before the employee's next assignment starts. From its date, an hourly assignment's rate becomes the employee's pay rate, so newly tracked time, the amounts-owed report and project costs use the same figure; a salaried assignment leaves the pay rate unchanged. |
| **FR-35** | The system MUST refuse an assignment dated before joining or after end of work, for an employee of another organization or of kind agent, a second one from the same date, a structure of another organization, or a tax table in another currency than the pay group's. |
| **FR-36** | The system MUST propose on a new assignment the structure and base pay the employee's level defines, when it defines them. |
| **FR-37** | The system MUST turn a promotion or pay-rate change applied by `hr-core-lifecycle` into a proposed assignment from its effective date that a user with `PAYROLL_ASSIGNMENTS_EDIT` confirms or rejects. |
| **FR-38** | The system MUST show on an assignment the yearly gross pay and the yearly cost to company — earnings, employer contributions, accruals and benefits over a full year at its values, with the pack's cost-to-company components — element by element. |
| **FR-39** | A user with `PAYROLL_ASSIGNMENTS_EDIT` can enter a target yearly cost to company and get the base pay that reaches it, at the currency's precision and with a cost within 0.01 of the target, with the breakdown (for each stretch of the base range where the cost follows one line, the base nearest the exact solution; the smallest such base when several stretches have one), or a message that no base reaches it, which holds for formulas that rise and fall with the base too; for a formula the solver cannot analyze, the message names the element instead. |
| **FR-40** | The system MUST give `time-off-management` the daily amount for encashment: the assignment's amount, else the structure's daily-amount formula, else base pay per period divided by the period's working days. |
| **FR-41** | The system MUST keep each employee's assignment history (who, when, before, after) and, when the organization allows it, show the employee their own structure, base pay and yearly cost to company. |

### 3.6 Pay from tracked time

| ID | Requirement |
| --- | --- |
| **FR-42** | The system MUST let a structure pay from the platform's tracked time: approved timesheet hours of the period (all tracked hours where the organization does not approve timesheets), priced at the pay rate each time log stored when it was tracked, so time is never typed in again and a later rate change never reprices paid time. *(advanced)* |
| **FR-43** | The system MUST pay hours on a project at the dated pay rate the project's rate cards of `project-costing-and-billing` hold for the employee on that project, else for the project, overriding the stored rate; hours become one line per project. *(advanced)* |
| **FR-44** | The system MUST give elements tracked and manual hours, billable and non-billable hours, and hours per project and client as separate facts. |
| **FR-45** | The system MUST let a structure be marked for contractors (employees of employment types the organization marks as contractors) paid from approved time with no income tax or statutory elements; adding such an element to it is refused. *(advanced)* |
| **FR-46** | The system MUST cap paid hours by the employee's weekly limit when the structure says so, and warn when approved hours exceed the period's working hours by more than a setting (default 25 %). |

### 3.7 Cost allocation

| ID | Requirement |
| --- | --- |
| **FR-47** | A user with `PAYROLL_ASSIGNMENTS_EDIT` can allocate an assignment's cost to cost centres, departments and projects by fixed shares totalling 100 %, defaulting to the employee's primary department and its cost centre. |
| **FR-48** | The system MUST offer allocation by tracked time: each period's cost split by the employee's approved hours per project (and so per client), the untracked share following the fixed shares or the default. *(advanced)* |
| **FR-49** | The system MUST refuse shares that do not total 100 %, an inactive cost centre or one of another organization, and warn on a project the employee is not a member of. |

### 3.8 Tax tables

| ID | Requirement |
| --- | --- |
| **FR-50** | A user with `PAYROLL_SETUP_EDIT` can maintain income tax tables per country and currency, effective from a date: ordered bands (from, to, rate, optional condition in the formula language), a standard deduction, a taxable-income threshold at or below which no tax is due, and surcharges as a percentage of tax applying from an income level. |
| **FR-51** | The system MUST compute yearly tax as the sum over bands of the taxable income inside each band times its rate, zero at or below the threshold, plus surcharges, then the pack's relief hook. |
| **FR-52** | The system MUST refuse overlapping, unordered or gapped bands and negative rates, make an activated table read-only once a payslip used it, and refuse its use for a pay period starting before its effective date. |
| **FR-53** | The system MUST let a pay group offer several tax tables for one year (for example two regimes) and an employee choose one before their first payslip of the year, defaulting to the group's default. |

### 3.9 Exemptions, declarations, proofs and other income

| ID | Requirement |
| --- | --- |
| **FR-54** | A user with `PAYROLL_SETUP_EDIT` can maintain exemption categories and sub-categories per country, each with a yearly maximum and an active flag, and link a sub-category to a pack rule that computes the amount allowed. |
| **FR-55** | An employee with `PAYROLL_SELF_SERVICE` (or HR with `PAYROLL_DECLARATIONS_REVIEW` for them) can declare planned exempt amounts per sub-category for a payroll year; the system shows declared and allowed totals (capped per sub-category and category, or computed by the pack); one declaration per employee and year, editable while the year's declaration window is open. |
| **FR-56** | An employee can submit proofs (actual amounts and attachments per sub-category); a user with `PAYROLL_DECLARATIONS_REVIEW` verifies or rejects each line with a reason; verified amounts replace the declared amounts of their sub-categories in projections from the next payslip. |
| **FR-57** | The system MUST keep a declaration window and a proof window per payroll year, remind employees before each closes, and, once the year's last pay period is reached without verified proof, project tax without unproven exemptions (organization setting, default on). |
| **FR-58** | An employee or HR can declare other income for a payroll year (source and amount), added to projected taxable income. |
| **FR-59** | The system MUST, when the organization enables document reading, pre-fill a proof line's amount, date and issuer from its attachment for the reviewer to confirm. *(advanced)* |

### 3.10 Flexible benefits, claims and the benefit ledger

| ID | Requirement |
| --- | --- |
| **FR-60** | The system MUST let an earning be a flexible benefit with a yearly maximum and a payout method (paid each period; accrued each period and paid at year end; accrued and paid only against claims), with an option to pay the unclaimed balance in the year's last period or at end of work. |
| **FR-61** | The system MUST let an earning be an accrual: computed each period into the benefit ledger instead of paid, shown on the payslip as accrued and counted in cost to company. |
| **FR-62** | A structure lists its flexible benefits with default yearly amounts; a duplicate benefit or defaults above the structure's maximum are refused. |
| **FR-63** | An employee can split their maximum among the structure's flexible benefits for a payroll year — one choice per year, each amount above zero and within its benefit's maximum, the total within the structure's maximum; the organization can require the choice before the year's first payslip, otherwise the defaults apply. |
| **FR-64** | An employee claims a flexible benefit as an expense claim of `expenses-and-travel` on the category linked to the benefit, with amount, date and receipt, in the same claim flow and approval queue as other expenses; the system MUST refuse a claim line above the eligible amount (chosen yearly amount less claims this year, or the accrued balance for claim-only benefits) and warn on a second claim for the same benefit and month; an approved claim line becomes additional pay of `payroll-processing`. Without `expenses-and-travel`, claim-only benefits pay out by their unclaimed-balance rule. |
| **FR-65** | The system MUST keep a benefit ledger per employee, benefit and payroll year of accruals, payouts and claims, each linked to its payslip or claim, written when a payslip is confirmed and reversed when it is cancelled. |

### 3.11 End-of-service rules

| ID | Requirement |
| --- | --- |
| **FR-66** | A user with `PAYROLL_SETUP_EDIT` can maintain end-of-service rules: applicability (pay group, employment type, separation kind), bands of service with the days of pay per year in each, the elements forming the daily pay base and its divisor, how service is counted (completed years, exact years, rounded years, entered by hand), whether unpaid days reduce service, a minimum service, and whether bands apply to the years inside them or to the whole service. |
| **FR-67** | The system MUST refuse bands that overlap or leave gaps and an open-ended band followed by another. |
| **FR-68** | The system MUST preview the end-of-service amount of an employee at a date (service, bands used, base, amount), using the pack's end-of-service hook where the pay group's country has one; `payroll-processing` pays it. |

### 3.12 Opening balances and starting from existing data

| ID | Requirement |
| --- | --- |
| **FR-69** | A user with `PAYROLL_ASSIGNMENTS_EDIT` can record opening balances per employee and payroll year — taxable pay, tax withheld and amounts per element to date — for mid-year joiners and earlier payroll periods; projections and year-to-date figures include them. |
| **FR-70** | The system MUST warn on an assignment starting after the first pay period of a payroll year when the employee declared earlier employment that year and no opening balance exists. |
| **FR-71** | The system MUST propose, when first enabled, a structure and assignment per employee from existing data: an hourly structure for employees with a pay rate, a salaried one with the recurring salary cost as base and recurring bonus and salary-tax costs as elements; each proposal is accepted, edited or skipped by a person, and recurring costs stay as they are. *(advanced)* |
| **FR-72** | The system MUST import elements, pay tables, structures, assignments, opening balances, declarations and tax tables through the mapped import, reporting errors per row. |

### 3.13 Country rules

| ID | Requirement |
| --- | --- |
| **FR-73** | The system MUST accept the payroll content a pack applies — statutory employee fields, element templates with statutory tags, tax tables, exemption categories, end-of-service rules, employer contributions, salary file layouts — as ordinary records marked with their pack, whose user edits survive pack upgrades as the packs' rules say. |
| **FR-74** | The system MUST call, for the country of the employee's pay group, the pack extension points — exemption of a declaration, exemption for part of a year, tax relief or cap, regional deductions, employer contributions, cost-to-company components, end-of-service amount — use generic rules where a country has none, record each hook's inputs and result in the trace, and fail the element naming the pack when a hook fails. |

### 3.14 Agents, privacy, API and compatibility

| ID | Requirement |
| --- | --- |
| **FR-75** | The system MUST keep employees of kind agent out of structures, assignments, tax tables, declarations, benefits and end-of-service rules, and list them under "agent employees" with their period usage cost from `ai-agents-and-assistants` allocated to projects by their tracked work. *(advanced)* |
| **FR-76** | The system MUST show the pay amounts this feature adds (assignments, cost to company, opening balances, declarations, proofs, benefit choices and ledger) only to holders of payroll permissions and to the employee for themself; managers see none of them by default; the employee's existing pay rate, bill rate and recurring costs stay visible to whoever sees them today; each read of another person's pay is logged in the platform's access log of `access-control-and-security` when it is loaded. |
| **FR-77** | The system MUST expose every action through the REST API and register elements, structures, assignments, declarations and proofs as record types for saved views, custom fields, approval definitions and automation triggers (benefit claims are expense claims of `expenses-and-travel`). |
| **FR-78** | The system MUST publish events (element or structure version activated, assignment created or changed with its effective date, declaration submitted, proof verified or rejected, tax table activated) on the event outbox for `payroll-processing`, automations, webhooks and real-time updates. |
| **FR-79** | The system MUST offer MCP tools to read elements, structures, assignments and cost to company, run the sandbox and the impact preview, draft an element, and declare and prove for oneself (benefit claims through the expense tools of `expenses-and-travel`); mutating tools return a preview first and act with the caller's permissions, marked as agent actions. |
| **FR-80** | The system MUST grant `PAYROLL_SELF_SERVICE` to the employee role and the setup keys to administrators, effective only while the feature is on. |
| **FR-81** | The system MUST remind employees and reviewers (declaration and proof windows, pending proofs, decisions) through the platform's notification preferences, once per person and occasion. |
| **FR-82** | The system MUST, with the feature off, load no route, menu entry or job of the feature and keep its data; the employee's pay period, recurring costs, the register and the amounts-owed report are never changed by it, and the employee's pay rate only as FR-34 says. |
| **FR-83** | The system MUST record who, when, before and after for every change to elements, versions, pay tables, structures, pay groups, years, assignments, tax tables, rules, declarations, proofs and opening balances. |
| **FR-85** | With the feature on and the organization setting "Salary cost from payslips" switched on (off by default, so the statistics read as today), the employee statistics and the dashboards that show an employee's salary cost MUST take it from confirmed payslips for the months payroll has paid and from the recurring salary, salary-tax and bonus costs for other months, so pay is never counted twice; the recurring costs themselves are not changed. |

## 4. Non-Functional Requirements

- **Performance**: sandbox for one employee and a structure of 60 elements under 1 s at the 95th percentile; element
  save with 20 test cases under 500 ms; impact preview of 500 employees within 30 s in the background; bulk
  assignment of 10,000 employees within 5 minutes; setup lists under 300 ms at the 95th percentile with 1 million
  rows per tenant; cost-to-company solve under 2 s.
- **Data volume and concurrency**: 100,000 employees, 1 million assignments and 10,000 element versions per tenant;
  optimistic versions on elements, structures, assignments and declarations (`409` on conflict).
- **Reliability**: bulk jobs resumable, one result per employee, repeated runs change nothing twice.
- **Security & privacy**: tenant and organization scoped; pay data is sensitive (FR-76); formulas are parsed and
  never executed as code; proofs readable by the employee and reviewers only; leaves the platform: reminder emails,
  attachments sent to the document reader and descriptions sent to the assistant's AI provider only when the
  organization enables them (never another person's pay).
- **Observability and audit**: audit entries of FR-83, bulk job results, test-case results per version, hook errors.
- **Accessibility and localization**: keyboard-operable formula editor with screen-reader error messages, every string
  in every shipped locale, decimal separators and dates in the user's format, formula function names identical in
  every locale.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted; existing employee,
  recurring-expense and pay-run routes unchanged; additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `PayElement` / version | An earning, deduction, contribution, accrual or informational figure and its dated rule |
| `PayElementTestCase` | Inputs and the expected result of an element |
| `PayTable` / row | A dated lookup table read by formulas |
| `PayStructure` / version / line | A dated set of elements for a group of employees, with overrides |
| `PayGroup` | Employees paid together: country, currency, frequency, calendar, bank account |
| `PayrollYear`, `PayPeriod` | A tax or payroll year of a pay group and its periods, open or closed |
| `PayAssignment` / allocation share | An employee's structure from a date with base pay, tax table and cost allocation |
| Project pay rate | A dated pay rate on a project's rate card (`project-costing-and-billing`), for the project or an employee on it |
| `LevelPayDefault` | The structure and base pay a level (grade) proposes |
| `TaxTable` / band / surcharge | Dated income tax rules of a country and currency |
| `ExemptionCategory`, `TaxDeclaration`, `TaxProof`, `OtherIncome` | Exempt amounts declared and proven by employees, and their other income |
| `BenefitChoice`, `BenefitLedgerEntry` | Flexible benefit split, and accrual, payout and claim movements (a claim is an expense claim line) |
| `EndOfServiceRule` / band | How an end-of-service amount is computed |
| `OpeningBalance` | Year-to-date amounts brought in from before |
| Payroll settings | Per-organization payroll options in the platform settings, shared with `payroll-processing` |
| Sandbox run, impact preview | A calculation that saves nothing |

## 6. Out of Scope

- Pay runs, payslips, payment days, tax projection per payslip, additional pay, withholding, arrears, journals, bank
  files, payslip delivery and payroll reports: `payroll-processing` (shares the plugin).
- Country payroll content and its hook implementations: `regional-compliance-packs`.
- Grades, branches, reporting lines and final settlement: `hr-core-lifecycle`; employees' bank details:
  `banking-and-reconciliation`; holiday calendars, unpaid days and encashment: `time-off-management`; attendance and
  overtime approval: `attendance-and-shifts`.
- Ledger accounts, cost centres and dimensions: `accounting-foundation`; postings: `general-ledger`; offers and their
  compensation preview: `recruitment`; usage cost of agents: `ai-agents-and-assistants`.
- Expense claims, their receipts and approval: `expenses-and-travel`; project rate cards: `project-costing-and-billing`;
  the formula language itself: `custom-fields-and-forms`; report builder: `report-builder-and-dashboards`.

## 7. Acceptance Criteria

- [ ] **AC-1** Elements of each kind and amount method are created; a renamed code keeps every formula working; kind
      change and deletion after use are refused (FR-1, FR-2).
- [ ] **AC-2** Formula checks refuse unknown names, cycles and division by zero with positions and values; test cases
      block activation until fixed or overridden (advanced, formulas) (FR-17, FR-18).
- [ ] **AC-3** The sandbox shows every step for a seeded employee and matches a hand-computed golden payslip; the
      impact preview of a change lists the changed payslips and differences without saving (advanced, sandbox) (FR-19, FR-21).
- [ ] **AC-4** A structure version with a cycle or two tax elements is refused; an element's new version reaches
      every structure from its date while overrides are listed (FR-12, FR-25, FR-26).
- [ ] **AC-5** Pay groups, payroll years and periods are generated without gaps; overlaps are refused; remaining
      periods are answered for a mid-year joiner and a leaver (FR-30).
- [ ] **AC-6** Bulk assignment of 200 employees reports assigned, skipped and failed; cost to company and the target
      solve agree within 0.01; a promotion from `hr-core-lifecycle` arrives as a proposed assignment (FR-28, FR-38, FR-39, FR-41).
- [ ] **AC-7** A contractor paid from approved time uses stored rates and a project rate, one line per project; cost
      allocated by tracked time splits by approved hours (advanced, time) (FR-42, FR-43, FR-45).
- [ ] **AC-8** Tax table bands, threshold and surcharge give the golden yearly tax; declarations, verified proofs and
      other income change the projection; unproven exemptions drop after the last period (FR-50, FR-51, FR-56, FR-57).
- [ ] **AC-9** A flexible benefit choice, an over-limit expense claim line refused, an approved claim line on a benefit
      category turned into additional pay, and ledger entries written and reversed with the payslip (FR-62–FR-65).
- [ ] **AC-10** End-of-service preview gives the golden amounts for bands applying inside and to the whole service (FR-66–FR-68).
- [ ] **AC-11** First enable creates starter elements and proposals from pay rates and recurring costs; nothing is
      applied without a person (advanced, start from what exists) (FR-71).
- [ ] **AC-12** A pack's hooks change exemption, relief and contributions with the hook recorded in the trace; a
      country without hooks uses the generic rules (FR-73, FR-74).
- [ ] **AC-13** The assistant drafts an element with tests that a person saves; an agent employee is refused every
      setup record and appears under agent employees (advanced, agents) (FR-23, FR-75).
- [ ] **AC-14** Denial answers `403`; concurrent saves `409`; the pay amounts this feature adds are shown only to payroll
      permission holders and to the employee for themself, and the employee's existing pay rate, bill rate and recurring
      costs read as today for every role that reads them today (FR-76).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_PAYROLL`; with it off, existing employee, recurring-cost and register suites pass unchanged.
- [ ] **AC-15** With the feature on and its settings at their defaults, the employee statistics and dashboards show the
      same salary cost as before, and a manager still sees each employee's pay rate wherever they see it today (FR-76,
      FR-85).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-82).
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- A pay period uses the element version in force on its last day; changes inside a period split only assignments
  (applied). Per-day element versions are possible later if wanted.
- Formulas read custom fields only where the organization marks them payroll-readable (applied), so sensitive
  personal fields never feed formulas by accident.
- The level's default structure and base are proposals, not enforced pay bands (applied); enforcing minimum and
  maximum per level can follow.
- Contractors are employees of a contractor employment type (applied); contractors that are companies are paid
  through supplier bills of `invoicing-receivables-payables`.
- Daily pay is added to the pay frequencies (applied); quarterly and yearly runs stay for bonuses only.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `payroll` with `payroll-ui`; core gains one optional statistics hook.
- [x] II Tenant/organization scoping — every record scoped; pay groups per organization.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PAYROLL`; employee pay data, recurring costs and register kept.
- [x] V Contracts and API first; backwards compatible — contracts and REST before UI; one additive frequency value.
- [x] VI Permissions, privacy, security — six new keys; pay data masked; formulas parsed, never executed.
- [x] VII Real-time through the event bus — outbox events; bulk job progress pushed.
- [x] VIII i18n and accessibility — every string a key in all locales; accessible formula editor.
- [x] IX Tests accompany the change — evaluator golden cases, test-case runner, cycle checks, solver, jobs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`payroll-processing`](../payroll-processing/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md),
  [`time-off-management`](../time-off-management/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`attendance-and-shifts`](../attendance-and-shifts/spec.md), [`project-costing-and-billing`](../project-costing-and-billing/spec.md),
  [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`expenses-and-travel`](../expenses-and-travel/spec.md),
  [`access-control-and-security`](../access-control-and-security/spec.md)
- Existing code: `packages/core/src/lib/employee/employee.entity.ts` (pay period and rates),
  `packages/core/src/lib/employee-recurring-expense`, `packages/core/src/lib/payroll-run`,
  `packages/core/src/lib/time-tracking/time-log/{owed-rate,time-log-rates}.ts`, `packages/core/src/lib/money/decimal.ts`,
  `packages/contracts/src/lib/payroll.model.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (payroll), §3.4 (ledger posting), §3.12 (AI and MCP)
