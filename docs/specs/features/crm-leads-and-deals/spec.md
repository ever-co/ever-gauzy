# Feature Specification: CRM leads and deals

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `crm-leads-and-deals`
**Branch**: `feat/crm-leads-and-deals`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CRM` (new, default off) for everything this spec adds; `FEATURE_PIPELINE`, `FEATURE_PIPELINE_DEAL` and `FEATURE_CONTACT` (existing, default on) keep gating what they gate today and are also read by the CRM routes for pipelines and deals, while the existing pipeline and deal routes answer as today

---

## 1. Overview

Contacts (clients, customers, leads), pipelines with ordered stages and deals with a title, a stage, a client and a 0–5
rating already exist in the Angular app, the API and the MCP server. This feature turns them into a CRM in the same
records: **leads** with their own fields, owner, stage, source, campaign attribution, score and qualification;
**organisations and people** (a contact of kind company with its members); **conversion** of a lead into a deal with
field mapping; **deal depth** (amount, currency, probability, expected close, owner, outcome, lost reasons, the chosen alternatives,
item lines, several people); **quotations from a deal** through the Sales app, or as the platform's estimates with their
accept-by-link page where the Sales app is off; **pipeline masters** for leads and deals;
**contracts** with signature, requirements and renewal; CRM settings; phone layout; and CRM assistants. Clients: the
Angular app (new `crm-ui` pages over the existing records, beside the existing contact and deal-board pages, which an
organization may choose to have the CRM pages open in place of; installable on phones), the MCP server and the SDKs.

Advanced capabilities: a won deal becomes a project, an order, a subscription
or a contract without re-entry and its page shows delivered work, tracked time, invoices and payments live; **deal health
and next best action** from rules and an agent that reads the deal and its timeline; **duplicate detection on entry and
merge with undo**; a **relationship map** of the people of an organisation; **pipeline rules** (required fields per
stage, stale alerts, safe stage removal); an **explainable lead score**; and **assistants through MCP tools** that draft
follow-ups, update fields from a conversation and prepare a meeting brief, always with a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a salesperson with `ORG_CONTACT_ADD`, **when** they type a lead "Ana Ruiz, Ruiz Logistics, ana@ruiz.example", **then** before saving they see that an organisation "Ruiz Logistics S.L." exists with the same web domain and a person with a similar name, each with the reason of the match; they save anyway (the rule is "warn") and the lead is in the first open stage of the default lead pipeline with them as owner and the source "Website".
- **Given** that lead with the campaign attribution of the web visit, **when** the score rules give 30 points for "job title contains director" and 20 for "employee band 50–200", **then** the lead shows score 50, "warm", and the list of rules that produced it.
- **Given** a qualified lead, **when** the salesperson converts it choosing the existing organisation and the deal pipeline "New business", **then** in one step the lead's record becomes the person (comments and files stay), the person is a member of the organisation, a deal exists with the lead's owner, source, attribution, territory and item lines, the lead sits in the converted stage and both link to each other.
- **Given** a deal with three item lines and "amount from lines" on, **when** the salesperson changes a quantity, **then** the amount follows; **when** they drag the deal to "Offer sent", **then** the probability takes the stage's 60%.
- **Given** a deal, **when** the salesperson creates a quotation from it, **then** a quotation for the deal's organisation opens with the deal's lines (the Sales app's quotation, or an estimate while the Sales app is off); **when** the customer accepts it online, **then** the deal is won with the accepted total, the organisation becomes a customer and its people follow.
- **Given** a won deal with a 40-hour service line and a yearly licence line, **when** the salesperson chooses "Create project, subscription and contract" and confirms the preview, **then** a project with a 40-hour task, a subscription for the licence and a draft contract exist, all linked to the deal; **when** 12 hours are tracked and the first invoice is paid, **then** the deal page shows 12 of 40 hours delivered and the paid amount, live.
- **Given** a manager with `EDIT_SALES_PIPELINES`, **when** they make "budget confirmed" required to enter "Offer sent" and set a stale limit of 14 days on "Discovery", **then** a drag without the field opens a form asking for it, and a deal untouched for 15 days in Discovery shows "stale" and its owner gets one Inbox notice.
- **Given** an organisation page, **when** a user opens the relationship map, **then** they see the members as a tree by "reports to" with their roles on open deals, and the open deal without a decision maker is flagged.
- **Given** an agent connected through MCP, **when** it calls `update_deal_from_conversation` with call notes and `preview: true`, **then** it receives the proposed field changes, a new person and the next step, each with the sentence it came from, and nothing is written; called with `preview: false` by a user who confirmed, the deal changes and its history says "by agent for <user>".
- **Given** a won deal, **when** the user creates a contract from it and sends it for signature, **then** the customer signs through a link, the organisation's signatory countersigns, the contract becomes active on its start date and its owner is reminded 30 days before the notice date of the renewal.

### 2.2 Edge cases & failures

- **Given** `FEATURE_CRM` off, **when** any CRM route is called, **then** `404`; menus, pages, MCP tools and jobs of this spec are absent and contacts, pipelines and deals behave exactly as today.
- **Given** a user without `CRM_LEADS_CONVERT`, **when** they call conversion, **then** `403` and nothing changes.
- **Given** two users converting the same lead at once, **then** one deal is created and the second caller is told the lead was converted, with the deal.
- **Given** a lead in a lost-kind stage, **when** someone converts it, **then** it is refused with the stage named.
- **Given** two users editing one deal, **when** the second saves a version older than the current one, **then** `409` with the current version; nothing is overwritten.
- **Given** a manager removing a stage that holds 12 deals, **when** they save the pipeline without naming a target stage, **then** it is refused naming the count; with a target, the deals move and their history says so.
- **Given** a deal dragged into a lost-kind stage, **when** the user dismisses the lost-reason prompt, **then** the card goes back and nothing is saved.
- **Given** a deal with a sent quotation, **when** the user marks the deal lost, **then** it is refused unless they also mark the quotation lost in the same step.
- **Given** a deal already lost, **when** its old quotation is accepted, **then** the deal is not won automatically; its owner is told and may reopen it.
- **Given** 40 leads converted in bulk, **when** 3 fail (lost stage, missing required field, already converted), **then** 37 deals exist and the result lists the 3 with their reasons.
- **Given** the duplicate rule "refuse on same email", **when** an import row repeats an email, **then** the row is rejected naming the clashing record the importer may read; the other rows are imported.
- **Given** a merge done yesterday, **when** a moved deal changed today and the user undoes the merge, **then** the undo lists the changed deal, leaves it on the survivor and moves the rest back.
- **Given** a person already a member of one organisation, **when** they are added to another, **then** it is refused until the first membership is ended.
- **Given** a deal in another currency while `FEATURE_MULTI_CURRENCY` is off, **then** it is refused naming the setting.
- **Given** no AI provider configured, **when** a user asks for the next best action, **then** they get the rule-based signals and actions without a written summary.
- **Given** a phone that loses its connection while a deal form is open, **when** the user saves, **then** the form keeps the edits and offers retry; nothing is half-written.
- **Given** a contract amended after signing, **when** the old signature link is opened, **then** it says the contract was superseded and offers nothing to sign.

## 3. Functional Requirements

### 3.1 Presence and compatibility

- **FR-1** The system MUST answer every route this spec adds with `404` when `FEATURE_CRM` is off for the tenant; no menu entry, page, MCP tool, job effect or event of this spec is then observable.
- **FR-2** The system MUST read `FEATURE_PIPELINE` on the CRM pipeline routes and `FEATURE_PIPELINE_DEAL` on the CRM deal routes (`404` when off), as the menu already does; the existing pipeline and deal routes keep answering as today, and `FEATURE_CONTACT` keeps gating the contact pages only.
- **FR-3** The system MUST keep every existing field, route and contract of contacts, pipelines, stages and deals, including the deal's 0–5 rating; new fields are added to responses and are written through the CRM routes.
- **FR-4** The system MUST allow several deals per contact (today at most one) and keep every existing deal.
- **FR-5** The system MUST, with `FEATURE_CRM` on, offer the CRM pages over the same records from their own menu entries, beside the existing contact, lead, pipeline and deal-board pages, which keep working as today; where an organization chooses to open the CRM pages instead (setting, off by default), the menu entries for contacts, leads and pipelines open them and the addresses of the existing contact lists, contact page, pipeline list and deal board lead to the matching CRM page (bookmarks keep working, filters carried); with the feature or that setting off the existing pages behave exactly as today, and they are never removed.

### 3.2 Leads

- **FR-6** A user with `ORG_CONTACT_ADD` can create a lead: a contact of type lead with salutation, first, middle and last name, job title, company name, emails, phones, website, language, address, source, owner and description (the contact's existing notes text); the system builds its display name from the name parts, else the company name, else the part of the email before `@`, and refuses a lead with none of name, company or email.
- **FR-7** The system MUST keep on a lead its industry and segment (tag types owned by `sales-order-management`), employee band, annual revenue and its currency, territory (the territory tree of `sales-order-management`), logo and social profile links; the company description is the lead's description (FR-6).
- **FR-8** The system MUST keep on a lead its campaign attribution as set by intake: the source in the contact's existing acquisition channel, which users keep editing as today (any text is accepted; CRM forms offer the organization's lead sources), and, read-only to users, the campaign as a reference to the organization's campaign record (never free text) and the rest (channel, content, keyword, referrer, landing page) with its intake references (channel, form, external id); `marketing-campaigns`, when loaded, keeps every touch and writes the first touch here.
- **FR-9** The system MUST validate email and phone formats, refuse an owner who is not a user of the organization, and refuse an owner whose sign-in email is the lead's own email.
- **FR-10** The system MUST give every lead an owner (default: its creator, per setting) and record each owner change with who and when.
- **FR-11** The system MUST keep every lead in a stage of a lead pipeline (default: the organization's default lead pipeline, its first open stage) and offer only stages of the lead's pipeline.
- **FR-12** A user with `ORG_CONTACT_EDIT` can mark a lead, a person or an organisation "do not contact" while `email-and-communications` is on: the mark is a withdrawal of every channel and purpose in its consent records and turns the contact's marketing consent flag off; the system keeps the mark through stage changes, conversion and merge, shows it wherever the record appears and leaves the record out of automated outreach. While that feature is off, the marketing consent flag is the only mark offered.
- **FR-13** A user with `ORG_CONTACT_EDIT` can record a lead's qualification (not assessed, in progress, qualified, not qualified) with who and when; the system acts on it only where a conversion requirement names it (FR-33).
- **FR-14** The system MUST keep a score 0–100 and a temperature (cold, warm, hot) on every lead from the scoring rules (field conditions with points, points lost per idle week) and temperature bands a user with `CRM_SETTINGS_EDIT` defines, recalculate scores on change and nightly, and let automation actions add or set points within 0–100.
- **FR-15** (advanced) The system MUST show why a lead has its score: each contributing rule with its points, and the last score change with its cause.
- **FR-16** A user with `ORG_CONTACT_EDIT` can add item interest lines to a lead under the rules of FR-55; the system moves them to the deal on conversion.
- **FR-17** The system MUST derive and show a lead's progress beside its stage (open, deal open, quotation open, quotation lost, customer) and recalculate it when the deal, its quotations or the customer state change.

### 3.3 Pipelines, stages and history

- **FR-18** A user with `EDIT_SALES_PIPELINES` can create pipelines for deals or for leads, mark one default per kind and organization, archive a pipeline and order its stages.
- **FR-19** The system MUST give a stage, besides name, description and position: a kind (open, on hold, won, lost), a colour, a default probability 0–100 (deal pipelines), an optional stale limit in days and optional required fields (FR-71); a pipeline without won or lost stages keeps working and its deals are won or lost by action.
- **FR-20** The system MUST give every organization without one a default lead pipeline and a default deal pipeline when `FEATURE_CRM` is turned on; existing pipelines keep their stages, all of kind open without probability.
- **FR-21** The system MUST record every stage change of a lead or deal: from, to, when, by whom (person, automation or agent) and the time spent in the stage left; the record page shows it.
- **FR-22** The system MUST, with `FEATURE_CRM` on, refuse on every route (the existing pipeline update included) removing a stage or deleting a pipeline that holds leads or deals unless a target stage is named; the records then move and the move is recorded.
- **FR-23** The system MUST win a deal that enters a won-kind stage (FR-57) and offer conversion for a lead; on entry into a lost-kind stage it asks for the lost reason, and a dismissed prompt cancels the move.
- **FR-24** A user with `EDIT_SALES_PIPELINES` can move a deal to another pipeline; the system places it in the stage of the same kind nearest its position and records the move.

### 3.4 Duplicates and merge

- **FR-25** (advanced) The system MUST return the likely duplicates among the organization's leads, people and organisations whenever one is entered (form, quick entry, import, intake, API, MCP): same normalised email, same phone digits, same website domain, or similar names once legal-form words, accents and case are removed, each with the reason of the match.
- **FR-26** The system MUST apply the organization's duplicate rule: allow, warn (default) or refuse on same email; a refusal names the clashing records the caller may read and counts the others.
- **FR-27** A user with `ORG_CONTACT_EDIT` can mark two records as "not duplicates"; the system no longer proposes the pair.
- **FR-28** (advanced) A user with `CRM_CONTACTS_MERGE` can merge two to five records of one kind into a survivor, choosing per field which value wins, after a preview listing what moves: deals, lines, memberships, comments, tags, documents, quotations, orders, invoices, projects, contracts and timeline entries.
- **FR-29** (advanced) The system MUST move every reference of a merge in one transaction, keep the merged records in trash marked "merged into" the survivor, and allow undo for 30 days; records changed since the merge stay on the survivor and are listed.
- **FR-30** The system MUST refuse a merge across organizations, of records the user cannot edit, and of two records that both have portal sign-in unless the user picks the one that keeps it.

### 3.5 Conversion

- **FR-31** A user with `CRM_LEADS_CONVERT` can convert a lead: in one step the lead's record becomes the person, or the organisation when the lead names no person (keeping its comments, documents, tags and history), an organisation is reused or created from the company name, the person becomes its member with the lead's job title, and a deal is created in the chosen pipeline.
- **FR-32** The system MUST propose at conversion the duplicates found by FR-25 for reuse; choosing an existing person merges the lead into that person under FR-29; a lead without a company name converts to a person-only deal.
- **FR-33** The system MUST ask at conversion for the deal fields the organization requires (setting) and refuse while one is missing; a requirement may also name the lead's qualification.
- **FR-34** The system MUST copy to the deal at conversion the owner, source, campaign, territory, item lines and the lead's people (the rest of the attribution is read from the deal's source lead), and copy custom field values to the deal field with the same key, or else to the one deal field with the same label and type; values without a single match stay on the person.
- **FR-35** The system MUST refuse converting a lead in a lost-kind stage, convert a converted lead again only per the re-conversion policy (interactive default: another deal; API and automation callers choose another deal, the existing deal, or refusal), and produce one result from concurrent conversions of one lead.
- **FR-36** The system MUST, after conversion, put the lead in the converted stage of its pipeline (setting, default its first won-kind stage) with who and when, link lead and deal both ways, and include the lead's earlier timeline entries in the deal's timeline.
- **FR-37** A user with `CRM_LEADS_CONVERT` can convert up to 500 selected leads with one pipeline and defaults; the system checks and converts each lead alone and lists converted, skipped and failed leads with reasons.
- **FR-38** A user with `CRM_LEADS_CONVERT` can turn a lead into a customer without a deal (person and organisation as in FR-31), or convert it and open a quotation from the new deal in one step (FR-63).
- **FR-39** The system MUST publish "lead converted" naming the lead, person, organisation and deal.

### 3.6 Organisations and people

- **FR-40** The system MUST hold an organisation as a contact of kind company (any relationship type) with name, website, logo, industry, segment, employee band, annual revenue, currency, territory, description, social links, owner, tags and addresses from the address book with billing and shipping roles; names follow the duplicate rule (FR-26).
- **FR-41** The system MUST hold a person as a contact of kind individual with name parts, job title, photo, language, addresses and several labelled emails, phones and messaging handles, one primary per kind, the primary mirrored to the contact's primary email and phone.
- **FR-42** The system MUST let a person be a member of at most one organisation at a time, with job title, department, reports-to (another member) and a primary-contact flag (at most one per organisation), and keep an ended membership when the person leaves.
- **FR-43** The system MUST show on the organisation page its members, deals (open and closed, with value), quotations, orders, invoices, payments, projects and contracts the user may read, and on the person page their organisation, deals and the same, with fields editable in place.
- **FR-44** (advanced) The system MUST draw on the organisation page a relationship map: members as a tree by reports-to, with title, their roles on open deals and the date of last contact (from `crm-engagement` when loaded), flagging an open deal with no decision maker or no contact for 30 days.
- **FR-45** A user with `ORG_CONTACT_EDIT` can add, end or change a membership from either page and create a person inside an organisation.
- **FR-46** The system MUST offer, when an organisation or person is deleted through the CRM, to unlink or to trash its people and its open deals; a record named by a confirmed order, an invoice or a signed contract is archived, never trashed.
- **FR-47** The system MUST keep the existing buyer roles of members working; a member added through the CRM has no buying authority until a role is given.
- **FR-48** A user with `ORG_CONTACT_EDIT` can upload, change and remove a person's photo or an organisation's logo from the record header.

### 3.7 Deals

- **FR-49** The system MUST give a deal, besides title, stage, contact and rating: owner, amount and currency, probability in percent, expected close date, closed date, outcome (open, won, lost), deal type, source, campaign, territory, next step with its due date, description, source lead and a reference number.
- **FR-50** The system MUST default a deal's currency to the organization currency and allow another currency only while `FEATURE_MULTI_CURRENCY` is on.
- **FR-51** The system MUST set a deal's probability to its new stage's default when the stage changes unless a user set it in the current stage; the 0–5 rating follows the percent (one point per 20%), and writing only the rating sets the percent.
- **FR-52** The system MUST keep a deal's amount equal to its lines' net total, read-only, while "amount from lines" is on (organization default, changeable per deal); otherwise the amount is typed.
- **FR-53** The system MUST require the amount and the expected close date when an open deal leaves its pipeline's first stage while "forecast fields required" is on (off by default).
- **FR-54** A user with `EDIT_SALES_PIPELINES` can put several people on a deal, each with a deal role from a list; the system keeps exactly one primary (a sole person is primary), shows the primary's email and phone on the deal and refuses a second primary.
- **FR-55** A user with `EDIT_SALES_PIPELINES` can add deal lines holding an item variant or text, quantity, unit, unit price, discount percent and net amount, one-time or recurring (monthly, quarterly, yearly, for a number of periods); the system prices them by price resolution for the deal's contact, date and currency, applies no tax and totals one-time and recurring value.
- **FR-56** The system MUST take items on deal lines from the item catalogue and refuse an inactive item; text lines are allowed.
- **FR-57** A user with `EDIT_SALES_PIPELINES` can win an open deal: outcome won, closed date today (or an earlier date, never a future one), the pipeline's first won-kind stage when it has one, probability 100.
- **FR-58** A user with `EDIT_SALES_PIPELINES` can lose an open deal with one or more active lost reasons (a reason marked as needing a note needs one), the alternatives the customer chose and a note; the system keeps the stage at loss, sets probability 0, and refuses while a quotation of the deal is sent or viewed unless the same step marks it lost.
- **FR-59** A user with `CRM_DEALS_REOPEN` can reopen a won or lost deal into an open stage; outcome, reasons and closed date are cleared and kept in the history.
- **FR-60** The system MUST offer in the deal page header the stage selector with stage colours, win, lose, reopen, create quotation, create from win (FR-67) and, when their plugins are loaded, email and call shortcuts.
- **FR-61** The system MUST accept on leads, people, organisations and deals an external id unique per organization, used as the update key by imports and connectors.
- **FR-62** The system MUST give leads and deals a reference number from their numbering series (per organization, yearly reset).

### 3.8 Quotations and the one-platform hand-off

- **FR-63** A user with `EDIT_SALES_PIPELINES` can create a quotation from a deal: for the deal's contact, with the deal's lines (text lines as priced text lines), owner and attribution, linked to the deal. While `sales-order-management` is on it is that feature's quotation (with `SALES_QUOTATIONS_EDIT`); otherwise it is the platform's estimate (with `ESTIMATES_EDIT`), sent and accepted or declined by the customer through the existing estimate link. Lines are copied one way from the deal; no third kind of quotation exists.
- **FR-64** The system MUST list on the deal page its quotations or estimates with revision, status, total, validity and views, updated live.
- **FR-65** The system MUST win an open deal when its quotation or estimate is accepted (setting, default on), taking the accepted total as amount (setting); when every quotation or estimate of an open deal is lost or declined, it tells the owner and offers to lose the deal with the quotation's reasons prefilled where a deal reason has the same name.
- **FR-66** A user with `EDIT_SALES_PIPELINES` who may create requests for quotation can ask suppliers to quote a deal's lines to gather costs: the requests are drafted in `procurement` and linked to the deal.
- **FR-67** (advanced) A user with `EDIT_SALES_PIPELINES` and the create permission of each target can create from a won deal, without re-entry and after a preview: a project for the deal's contact with one task per service line (estimate = hours), an order when no quotation was accepted, a subscription for the recurring lines, and a contract (FR-80); the system links each to the deal.
- **FR-68** (advanced) The system MUST show live on a won deal's page its document flow (quotations, orders, deliveries, invoices, payments), project progress, tracked hours and their cost against the hours sold, invoiced and paid amounts against the deal amount, and the state of its subscriptions.
- **FR-69** The system MUST turn a won deal's contact into a customer when it is a lead (setting, default on); the people of an organisation follow its relationship type unless set by hand.
- **FR-70** The system MUST use for CRM records the platform's one customer record, item catalogue and permission model: no copy, sync or mirrored permission is kept, and every document created from a deal reads the same contact and items.

### 3.9 Pipeline rules

- **FR-71** (advanced) The system MUST require a stage's required fields (standard or custom) before a lead or deal enters it, refuse a move without them listing what is missing, and open a form for those fields from the board.
- **FR-72** (advanced) The system MUST mark stale, on cards and lists, a lead or deal that stays in a stage beyond its stale limit without activity (timeline entries when `crm-engagement` is loaded, field changes otherwise), and send its owner one Inbox notice per stale spell, from a daily job.
- **FR-73** The system MUST, where the organization turns auto-close on (off by default), lose a deal stale for a further number of days with the reason chosen in settings and the note "closed as stale", and tell its owner.
- **FR-74** The system MUST also offer the stage rules as automation templates, so an organization can add actions to them.

### 3.10 Deal health and next best action

- **FR-75** (advanced) The system MUST give every open deal a health (good, at risk, poor) with its signals: days since last activity, days in stage against the median of won deals in that stage, expected close date passed, no decision maker, quotation viewed and unanswered, overdue tasks, amount lowered; recomputed on change and nightly.
- **FR-76** (advanced) A user with `VIEW_SALES_PIPELINES` can ask for the next best action on a deal: an agent reads the deal, its people, lines, quotations and timeline and proposes up to three actions (follow-up draft, task, meeting, field update) with reasons; the system writes nothing until the user accepts one.
- **FR-77** The system MUST provide health and next best action without an AI provider (signals and rule-based actions) and add a short written summary when one is configured.

### 3.11 Contracts

- **FR-78** A user with `CRM_CONTRACTS_EDIT` can create a contract with a party (contact, vendor or employee): title, start and end date (end not before start), terms, value and currency, owner, an optional source (deal, quotation, order, project, purchase order, invoice), from a template or blank; it is numbered from the contract series.
- **FR-79** A user with `CRM_CONTRACTS_EDIT` can keep contract templates holding terms with placeholders (party, dates, value, lines) and a requirement list, which the system copies into a new contract.
- **FR-80** The system MUST prefill a contract created from a won deal with party, value, line summary and owner, and link it to the deal.
- **FR-81** A user with `CRM_CONTRACTS_EDIT` can send a contract for signature: the signer opens a link, reads and signs, and the system records name, email, time, network address (hashed), signature and a fingerprint of the terms as the platform's append-only acceptance evidence; a holder of `CRM_CONTRACTS_SIGN` countersigns, or records a signature on paper with the scanned copy.
- **FR-82** The system MUST NOT change a signed contract's terms and signatures; a change is an amendment (a linked new version) signed again, which supersedes the earlier one and its links.
- **FR-83** The system MUST keep a contract draft, awaiting signature, active (signed and within its dates), expired, terminated (with date and reason) or cancelled (before signing), with a daily job moving signed contracts in and out of active.
- **FR-84** A user with `CRM_CONTRACTS_EDIT` can list requirements on a contract (title, due date, responsible, note); after signing the system lets them be ticked, not added or removed, and shows fulfilment as not applicable, open, partly, fulfilled or lapsed (a due date passed unfulfilled).
- **FR-85** (advanced) The system MUST renew a contract set to renew automatically for its term with its notice period: it reminds the owner before the notice date, creates the linked next contract at the end, and for a customer opens a renewal deal (setting) that forecasting counts.
- **FR-86** The system MUST show the organization's contracts to holders of `CRM_CONTRACTS_VIEW`, and to others only the contracts they own or that name them as the employee party.
- **FR-87** The system MUST print a contract with its print template and a signature certificate page.

### 3.12 Lists and settings

- **FR-88** A user with `CRM_SETTINGS_EDIT` can maintain the organization's lists: lead sources, deal types, lost reasons (for leads, deals or both; one may require a note), chosen alternatives (name, note), salutations and deal roles; each item has name, description, colour, position and active flag; an item in use is deactivated, never deleted.
- **FR-89** The system MUST hold per organization CRM settings for every default and rule this spec names (duplicate rule, owner default, default pipelines, converted stage, conversion requirements, re-conversion default, amount from lines, forecast fields required, customer on win, win on acceptance, stale auto-close, scoring rules, health thresholds, number prefixes, CRM pages in place of the existing ones), changed only with `CRM_SETTINGS_EDIT` and audited.
- **FR-90** The system MUST offer settings and lists in Settings → CRM and seed them per organization when the feature is turned on.

### 3.13 Lists, phones, real time, automation, import

- **FR-91** The system MUST register leads, deals, organisations, people and contracts as record types, so their lists are saved views (list, table, board by stage, calendar by expected close or contract end) with filters by owner, stage, source, territory, industry, attribution, health and staleness, and bulk owner, stage, tag and conversion actions.
- **FR-92** The system MUST honour custom fields and form layouts on every CRM form.
- **FR-93** The system MUST accept comments with mentions on deals and contracts as on contacts today.
- **FR-94** The system MUST reflect in open CRM lists, boards and pages the changes made elsewhere within 2 s, with a refresh fallback.
- **FR-95** The system MUST render CRM pages at 360 px width: one column, header actions in a bottom sheet, a board scrolled stage by stage; the web app installed on a phone is the phone client.
- **FR-96** The system MUST publish lead, deal and contract events as automation triggers and webhook events: created, stage changed, won, lost, reopened, converted, merged, stale, health changed, contract signed, contract expiring.
- **FR-97** The system MUST use external ids as update keys in imports of leads, organisations, people and deals and apply the duplicate rule with the import's chosen action.

### 3.14 Assistants and MCP tools

- **FR-98** The system MUST make every existing contact, pipeline and deal MCP tool call a route that exists: missing routes are added (deal stage move, own deals, deal search and statistics, pipeline stage add, update and remove, contact statistics and bulk writes) or the tool is pointed at an existing route; no tool is removed or renamed.
- **FR-99** The system MUST offer MCP tools and in-app assistant tools for leads, conversion, organisations, people, memberships, deals, lines, outcomes, duplicates and merge, quotations from deals, hand-offs, contracts and settings, under the caller's permissions; every new writing tool takes `preview: true`, and the existing tools keep their names, inputs and answers.
- **FR-100** (advanced) A user with `VIEW_SALES_PIPELINES` can have an assistant draft a follow-up to a deal's people from the deal, its recent timeline and the user's instruction; the system returns the draft (kept as an email draft when `crm-engagement` is loaded) and never sends it.
- **FR-101** (advanced) A user with `EDIT_SALES_PIPELINES` can have an assistant propose updates to a lead or deal from a conversation text (field changes, new people, next step), each with the sentence it came from; the system applies them only on confirmation.
- **FR-102** (advanced) A user with `VIEW_SALES_PIPELINES` can have an assistant prepare a meeting brief for a deal or organisation (people and roles, history and stage age, open quotations, delivered work and invoices, open tasks, risks from the health signals, questions to ask) as text and structured data; the system writes nothing.
- **FR-103** The system MUST record changes made by an agent as made by the agent on behalf of the user who confirmed them.

## 4. Non-Functional Requirements

- **Performance**: lead, deal, organisation and people lists P95 < 300 ms at 1 M contacts and 500 k deals per tenant; a board of 2,000 deals renders its first stages < 800 ms; duplicate check P95 < 200 ms at 1 M contacts; conversion P95 < 500 ms; a merge moving 500 references < 3 s; nightly score and health for 100 k open records < 15 min.
- **Concurrency**: writes state the version they read (`If-Match`); conversion, merge and contract signature are single-winner; bulk work reports per record.
- **Reliability**: events through the event outbox (at least once, deduplicated per consumer); daily jobs (stale, contract status, renewals, scores, health) are idempotent and catch up after downtime.
- **Security & privacy**: tenant and organization scoped; leads and people are personal data, included in the contact's export and erasure (signatures and network addresses too); "do not contact" is honoured by automation; signature links carry random tokens stored hashed and expire. Leaving the platform: contract signature emails, follow-up drafts sent by a user, and AI provider calls when an organization configured one (only the deal facts the request needs).
- **Auditability**: who, when, before and after for lead, deal and contract fields, stage moves, conversions, merges and settings; agent changes carry the agent marker.
- **Accessibility and localization**: keyboard operable boards (move a card with the keyboard), labelled controls, a typed alternative to drawn signatures; every string in all shipped locales; amounts and dates in the user's formats.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Lead | A contact of type lead in the lead process: name parts, company text, owner, stage, source, attribution, score |
| Organisation | A contact of kind company, with its members |
| Person | A contact of kind individual, with several emails, phones and handles |
| Membership | A person at an organisation: title, department, reports-to, primary flag, end date |
| Pipeline / stage | Existing records; a pipeline serves leads or deals; a stage has kind, colour, probability, rules |
| Stage history entry | One move of a lead or deal between stages with the time spent |
| Deal | Existing record, extended with value, owner, dates, outcome, attribution and people |
| Deal person | A person on a deal with a role, one primary |
| Line | Item interest on a lead or deal, one-time or recurring |
| Lost reason, source, deal type, chosen alternative, salutation, deal role | The organization's CRM lists |
| Deal link | A document or record created from or related to a deal (estimate, quotation, invoice, proposal, order, project, task, subscription, contract, request for quotation), kept as one of the platform's record links |
| Duplicate pair, merge | A proposed or dismissed pair; a recorded, undoable merge |
| Deal health | The computed state of an open deal with its signals |
| Contract, requirement, template | An agreement with a party, its obligations and a reusable text |
| CRM settings | The organization's CRM defaults and rules |

## 6. Out of Scope

- Activity timeline, notes, email, tasks, calls on records, communication status, service levels, first response, assignment rules, visibility and sharing, sales hierarchy → `crm-engagement`.
- Web forms, intake from email, calls, messaging and ad platforms, enrichment → `lead-capture-and-enrichment`.
- Call logs and click-to-call → `telephony`; campaigns and consent management → `marketing-campaigns`.
- Deal rates and organization-currency amounts, weighted pipeline, forecast, CRM dashboard and all CRM reports → `crm-forecasting-and-analytics`.
- Quotations, orders, territories, sales people, industry and segment tag types, customer master and sales profile → `sales-order-management`; requests for quotation → `procurement`; subscriptions → `subscription-billing`.
- Saved views, boards, filters and bulk framework → `record-views-and-search`; custom fields and layouts → `custom-fields-and-forms`; automation engine → `automation-and-notifications`; numbering and document lifecycle → `business-document-engine`; print templates → `print-and-pdf-designer`; generic record merge → `data-import-export`.
- Rate feeds → `general-ledger`; address formats and state lists → `regional-compliance-packs`; menu customization → `platform-administration`; service contracts for maintenance → `maintenance-and-field-service`.
- Consent records and suppression → `email-and-communications`; job-board proposals stay as they are and can be linked to a deal.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_CRM` off, every CRM route answers `404` and the contact, pipeline and deal APIs pass their existing contract tests unchanged (FR-1, FR-2).
- [ ] **AC-2** A lead entered with an email of an existing person shows the duplicate with its reason; with the rule "refuse" it is refused naming the record (FR-26).
- [ ] **AC-3** A converted lead becomes the person with its comments, joins the chosen organisation, and a deal carries its owner, source, attribution, lines and mapped custom fields; a second concurrent conversion returns the same deal (FR-31, FR-34).
- [ ] **AC-4** Bulk conversion of 40 leads with 3 invalid converts 37 and reports the 3 with reasons (FR-37).
- [ ] **AC-5** Two deals for one contact can be saved; existing deals are unchanged after the migration on all three databases (FR-4).
- [ ] **AC-6** Moving a deal into a stage sets its default probability and rating; a won-kind stage wins it with today's closed date; a lost-kind stage asks for a reason and cancelling keeps the deal where it was (FR-23, FR-49).
- [ ] **AC-7** Removing a stage with deals is refused without a target and moves them with one (advanced: rules; FR-22).
- [ ] **AC-8** A required field blocks a stage move with the list of missing fields; a deal 15 days in a 14-day stage is stale and its owner has exactly one Inbox notice (advanced: rules; FR-71).
- [ ] **AC-9** A merge of two people moves their deals, memberships and comments; undo the next day restores them except a record changed since, which is listed (advanced: duplicates; FR-28, FR-29).
- [ ] **AC-10** A quotation created from a deal carries its lines, and so does an estimate created while the Sales app is off; online acceptance of either wins the deal with the accepted total and turns the lead organisation into a customer with its people (FR-63).
- [ ] **AC-11** Creating project, subscription and contract from a won deal links all three; tracked hours and a paid invoice appear on the deal page without reload (advanced: one platform; FR-67, FR-68).
- [ ] **AC-12** The relationship map shows members by reports-to and flags a deal with no decision maker (advanced: relationship map; FR-44).
- [ ] **AC-13** A deal with no activity for twice its stage median is "at risk" with the signal listed; next best action returns three proposals and writes nothing until one is accepted; without an AI provider it still answers (advanced: health; FR-75, FR-77).
- [ ] **AC-14** `update_deal_from_conversation`, `draft_deal_follow_up` and `prepare_meeting_brief` return previews that write nothing; a confirmed update is recorded as made by the agent for the user (advanced: assistants; FR-100–FR-102).
- [ ] **AC-15** Every existing contact, pipeline and deal MCP tool reaches a route that exists (tool-to-route test) (FR-98).
- [ ] **AC-16** A contract is signed through its link, countersigned, becomes active on its start date, expires after its end, and an amendment supersedes it; a requirement past due shows lapsed (FR-78, FR-83).
- [ ] **AC-17** The lead score shows the rules behind it and changes when a rule's field changes (advanced: score; FR-15).
- [ ] **AC-18** The system saved views "My open leads", "Stale deals" and "Deals closing this month" exist for every organization and return the right records on the demo data set (FR-73).
- [ ] **AC-19** CRM pages pass the keyboard and screen-reader checks and work at 360 px width (FR-95; §4).
- [ ] **AC-20** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-21** With `FEATURE_CRM` on and the page setting off, the existing contact, lead, pipeline and deal-board pages open at their addresses as before and the CRM pages are reached from their own menu entries; with the setting on, those addresses lead to the CRM pages; with `FEATURE_PIPELINE` or `FEATURE_PIPELINE_DEAL` off, the existing pipeline and deal routes answer as before; a lead source typed as free text through the existing contact routes is kept (FR-2, FR-5).
- [ ] **AC-22** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from a contact being allowed several deals and, with `FEATURE_CRM` on, a target stage being required when a stage or pipeline holding leads or deals is removed (FR-22).

## 8. Open Questions

- One deal per contact is enforced today by a uniqueness on the deal's contact. Applied default: the uniqueness is lifted (no data changes, nothing removed from the API).
- `FEATURE_PIPELINE` and `FEATURE_PIPELINE_DEAL` gate the CRM routes of pipelines and deals (both default on); the existing pipeline and deal routes stay ungated as today. Applied default; `FEATURE_CONTACT` is not put on the contact routes, which invoices, projects and time also use.
- The CRM pages open in place of the existing contact and deal pages only where an organization chooses so (off by default). Applied default.
- A converted lead's record becomes the person (one record, not a copy). Applied default.
- Lost reasons: the CRM list serves leads and deals, quotation reasons stay in the Sales app and prefill by name. The two lists can be merged later.
- Gender is not a standard field (data minimisation); an organization that needs it adds a custom field. Applied default.
- Lead and deal owner is a user (as the quotation owner); tracked-time figures read that user's employee. Applied default.
- The existing contact delete route still removes a contact's deals with it; CRM routes trash or archive instead. Applied default: the old route is left as it is.
- Score decay default: 5 points per idle week; stale auto-close off. Applied defaults.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/crm` and `crm-ui`; core gets additive columns on its own contact, person, pipeline, stage, deal and record link tables and an opt-in redirect of its old contact and deal pages.
- [x] II Tenant/organization scoping — every new record has tenant and organization; queries are tenant-aware.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects; the one relaxed uniqueness loses no data.
- [x] IV Default-off flag; nothing removed — `FEATURE_CRM` off; existing pages, routes, fields and tools kept.
- [x] V Contracts and API first — contracts in `packages/contracts`; REST first, GraphQL reads; MCP tools fixed, not renamed.
- [x] VI Permissions, privacy, security — new `CRM_*` keys, hashed signature tokens, personal data in export and erasure.
- [x] VII Real-time through the event bus — outbox events, real-time change hints, Inbox notices.
- [x] VIII i18n and accessibility — keys in every locale, keyboard boards, typed signature alternative.
- [x] IX Tests accompany the change — unit, e2e and tool-to-route tests per task.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../sales-order-management/spec.md`](../sales-order-management/spec.md), [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md)
- Works with: `crm-forecasting-and-analytics`, `crm-engagement`, `lead-capture-and-enrichment`, `email-and-communications` (consent records), `marketing-campaigns` (campaign records), [`../business-document-engine/spec.md`](../business-document-engine/spec.md), [`../procurement/spec.md`](../procurement/spec.md), [`../subscription-billing/spec.md`](../subscription-billing/spec.md), [`../task-automations/spec.md`](../task-automations/spec.md), [`../inbox/spec.md`](../inbox/spec.md), [`../realtime-channel/spec.md`](../realtime-channel/spec.md)
- Code: `packages/core/src/lib/organization-contact/`, `packages/core/src/lib/contact/`, `packages/core/src/lib/resource-link/`, `packages/core/src/lib/estimate-email/`, `packages/core/src/lib/public-share/invoice/`, `packages/core/src/lib/terms-acceptance/`, `packages/core/src/lib/contact-buyer/`, `packages/core/src/lib/pipeline/`, `packages/core/src/lib/pipeline-stage/`, `packages/core/src/lib/deal/`, `apps/gauzy/src/app/pages/contacts/`, `apps/gauzy/src/app/pages/pipelines/`, `packages/mcp-server/src/lib/tools/{organization-contact,pipelines,deals}.ts`
