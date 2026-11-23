# Feature Specification: Lead capture and enrichment

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `lead-capture-and-enrichment`
**Branch**: `feat/lead-capture-and-enrichment`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_LEAD_CAPTURE` (new, default off; needs `FEATURE_CRM`); the plugin loads only when `GAUZY_LEAD_CAPTURE_ENABLED` is exactly `true`

---

## 1. Overview

Today leads are typed by hand or imported from a file, and clients arrive from two time-tracking integrations; no form,
mailbox, call, message or ad reaches the CRM by itself, and nothing fills a lead's company details. This feature adds
**lead forms** built in the app and published as a hosted page or embedded on any allowed site, above all the
organization's Ever Works sites; **intake** of leads from email, calls, messages, public bookings, signed webhooks (the
own forms of Ever Works sites included), the automation integrations the platform already offers and ad platform
connectors, every item kept in a **sync log** with retry; and **enrichment** of leads, deals and organisations from
their website, with rules, field mapping, write policies, a run log and undo. Every intake path ends in the lead service
of `crm-leads-and-deals`, so duplicates, scoring, assignment and timelines behave the same whatever the channel. Its
**defence against abuse** protects every public form of the platform. Clients: the Angular app (`lead-capture-ui`), the
hosted form page (a small transactional page; sites themselves are built with Ever Works), the MCP server and the SDKs.

Advanced capabilities: **consent captured with every lead** (the exact text shown, per channel and
purpose, kept with the platform's consent records); **duplicate handling at intake** that updates or links instead of
creating copies, with a merge suggestion; **abuse defence** on public forms (hidden trap field, fill-time check, rate
limits, a proof-of-work challenge, blocked domains); **conversational forms and
progressive profiling** that ask a returning visitor only what is still unknown; **automatic retry** of failed intake
with alerts; **enrichment with a confidence and a source per field**, optional AI extraction with the sentence it came
from, enrichment from email signatures, and one-click undo per field or per run; and **form analytics** with drop-off
per field and speed to lead.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a marketer with `LEAD_FORMS_MANAGE`, **when** they build "Request a demo" for leads with name, work email, company, employee band (required only when "company" is filled), a hidden campaign field defaulting to "autumn-webinar" and a marketing consent box, and publish it, **then** they get a share link and an embed code; publishing was refused earlier because the required field "last name" had neither a place on the form nor a default.
- **Given** that form embedded on `www.example.com` (an allowed origin), **when** a visitor submits it from a page opened with campaign tags, **then** a lead exists in the default lead pipeline with source "Web form", the campaign attribution, the consent with its exact text, the answers on its timeline, an owner chosen by the assignment rules within seconds, and the visitor sees the thank-you message with a reference.
- **Given** the same form embedded on an origin not on the list, **when** it is loaded there, **then** the browser refuses to show it.
- **Given** a visitor whose email matches an existing person, **when** the form's duplicate policy is "update existing", **then** no lead is created, empty fields of the person are filled, the submission is on the person's timeline and its owner is told.
- **Given** a sales mailbox with an intake rule "create leads", **when** an unknown sender "Lena Park <lena@parkfoods.example>" writes, **then** a lead "Lena Park" with company "parkfoods" from the domain, source "Email" and the mail on its timeline exists; a message from `no-reply@` or with an automatic-reply header creates nothing.
- **Given** an ad platform connector with one page and two forms mapped to lead fields and a 15-minute schedule, **when** the sync runs, **then** new ad leads since the last run (minus a 5-minute overlap) are created once each; a payload missing the email is logged as failed with the reason; "sync now" runs at once.
- **Given** a failed intake item, **when** the error was temporary, **then** it is retried automatically with back-off; after 5 failures the source owner gets one notice; a user retries it by hand from the log after fixing the mapping.
- **Given** a lead with website `parkfoods.example`, **when** a user chooses "Enrich", **then** the progress shows each step live (pages found, pages read, company details, contacts, industry), and the lead gains company description, logo, industry "Food production" with confidence 0.82, two social links and a phone, each marked with its source page; **when** the user undoes the run the next day, **then** the fields return to their earlier values except the phone the user had edited since, which is kept and reported.
- **Given** a returning visitor recognised by the form's signed token, **when** they open another form with progressive profiling, **then** they are asked job title and budget instead of name and email again; nothing stored is shown to them.
- **Given** a marketer opening form analytics, **when** they look at "Request a demo", **then** they see form loads, starts, submissions, completion rate, drop-off per field, spam blocked and the median time from submission to first response, and, for a form on a linked Ever Works site, the views of the page that holds it.

### 2.2 Edge cases & failures

- **Given** `FEATURE_LEAD_CAPTURE` or `FEATURE_CRM` off, **then** every route of this spec answers `404`, published forms answer "form not available" and store nothing, and no connector runs.
- **Given** a submission that fills the hidden trap field, or arrives faster than the minimum fill time, or exceeds the rate limit, **then** no lead is created; it is kept in the spam log for 30 days, and a user with `LEAD_INTAKE_MANAGE` can release it as a lead.
- **Given** a form with a required consent box left unticked, **then** the submission is refused with the field named and nothing is stored.
- **Given** a form changed after publishing, **then** visitors keep seeing the published version until the draft is published; each submission records its version.
- **Given** a redirect target that is not an allowed address or not `https`, **then** publishing is refused naming it.
- **Given** an embedding origin with a space, line break or a path, **then** it is refused at save.
- **Given** the CRM lead service refusing a submission (duplicate rule "refuse"), **then** the visitor still gets the thank-you message, the submission is logged as refused with the clashing record and the form owner is told; the visitor never learns about existing records.
- **Given** an ad connector whose sign-in expired, **then** the source shows "reconnect needed", its owner is told once, and the next sync after reconnecting resumes from the last watermark.
- **Given** a website that resolves to a private or loopback address, or redirects to one, **then** enrichment stops at that step with "address not allowed" and nothing is fetched.
- **Given** a site whose rules forbid crawling the pages, **then** only allowed pages are read and the run says so.
- **Given** two enrichment runs requested at once for one record, **then** the second waits for the first and runs on its result; undo is offered only for the latest completed run.
- **Given** an organisation enriched while linked deals have their own industry, **then** propagation fills only empty fields and never blocks the deal's save.
- **Given** a call from an unknown number shorter than the minimum duration, **then** no lead is created automatically; the call still offers "create lead".

## 3. Functional Requirements

### 3.1 Presence and settings

- **FR-1** The system MUST load only when `GAUZY_LEAD_CAPTURE_ENABLED` is exactly `true` and answer every route with `404` while `FEATURE_LEAD_CAPTURE` or `FEATURE_CRM` is off; public form addresses then answer "form not available" and store nothing.
- **FR-2** The system MUST create every lead through the lead service of `crm-leads-and-deals` (duplicate rule, owner default, score, stage, events) and never write lead records itself.
- **FR-3** A user with `LEAD_INTAKE_MANAGE` can maintain the organization's capture settings (spam defence, auto-reply limits, call and booking intake, default duplicate policy, log retention), kept in the platform's settings; changes are audited.

### 3.2 Form builder

- **FR-4** A user with `LEAD_FORMS_MANAGE` can create a lead form whose target is a lead, or a deal (a lead converted at once into a deal in a chosen pipeline and stage), with name, description, language, source item and default owner team.
- **FR-5** The system MUST let the form be laid out in sections of one to three columns, each field picked from the target's fields allowed on public forms (name parts, emails, phones, company, job title, website, country, address, message, industry, employee band, item interest, consent) and from custom fields marked public.
- **FR-6** The system MUST let each field carry label, placeholder, help text, default, required or optional, and conditions "required if", "read-only if" and "visible if" over other answers, evaluated by the platform's field rule evaluator in the builder preview, the visitor's browser and the server.
- **FR-7** The system MUST support field types single-line text, long text, number, email, phone, date, date and time, single and multiple choice, check box and consent box, and a choice of records (items, countries) only from a list the form owner grants explicitly to visitors; no other internal record can be searched by a visitor.
- **FR-8** A user with `LEAD_FORMS_MANAGE` can add hidden fields with fixed values (campaign, source detail, owner team, tags), and the system refuses publishing while a field the target requires is neither on the form nor given a default, naming the fields.
- **FR-9** The system MUST keep labels, help texts, options and messages per language and show the visitor's language when the form has it, else the form's language.
- **FR-10** The system MUST keep the published version of a form unchanged while a draft is edited, publish a draft as a new numbered version, and record the version on every submission.
- **FR-11** The system SHOULD allow a file field (default off per form) limited to 10 MB and PDF or image types, stored as a document linked to the new lead.

### 3.3 Publishing, sharing and embedding

- **FR-12** A user with `LEAD_FORMS_PUBLISH` can publish and unpublish a form; an unpublished form's address answers "form not available".
- **FR-13** The system MUST let a form end with a thank-you message (with the submission's reference) or a redirect to an `https` address on the form's allowed list, and carry its own submit button label.
- **FR-14** The system MUST give a published form a share link to a hosted page with the organization's branding and an embed code, and allow framing only on the form's allowed origins (scheme, host and port; a leading wildcard sub-domain allowed), refusing at save any origin with spaces, line breaks, paths or other characters outside an origin; a user with `LEAD_FORMS_MANAGE` can add the hostnames of the organization's linked Ever Works sites in one step, and they follow the sites' changes.
- **FR-15** A user with `LEAD_FORMS_MANAGE` can test-submit a form: every rule runs and the result shows what would be created (lead, deal, duplicates found, owner, consent, auto-reply) without writing a record or sending a message.

### 3.4 Submissions

- **FR-16** The system MUST validate every submission on the server with the published version's rules (required, formats, conditions, allowed choices), sanitise every answer, and refuse an invalid submission naming the fields without storing it.
- **FR-17** (advanced) The system MUST defend public forms: a hidden trap field, a minimum fill time (default 3 s), rate limits per network address (default 10 a minute) and per form (default 1,000 an hour), a proof-of-work challenge after suspicious signals, and blocked domains and addresses; blocked submissions go to the spam log, never to the CRM. The same defence, with each caller's own limits, is offered to the public forms other new features add (support forms and widget, newsletter sign-up, help centre feedback, portal sign-up, job applications), whether or not lead forms are switched on. A public form or endpoint that exists today (public booking pages, team join requests, sign-up, the public invoice, estimate, employee and organization pages) keeps its current checks and limits and adopts the defence only when an administrator switches it on for that form (setting, default off).
- **FR-18** A user with `LEAD_INTAKE_MANAGE` can list the spam log (kept 30 days), see why each item was blocked and release one as a lead.
- **FR-19** (advanced) The system MUST keep, with every lead created from a form, each consent box ticked or left unticked: a ticked box is recorded as the platform's append-only acceptance evidence (the exact text shown, its language, the form and version, the time and the hashed address) and a marketing box also sets the contact's marketing consent flag; the consent records of `email-and-communications` (per channel and purpose, granted or not) refer to that evidence; a required consent box blocks submission, and a marketing consent box is never ticked in advance.
- **FR-20** The system MUST record on the lead its source and its campaign (a reference to the organization's campaign whose code the tags carry, never free text), keep with the submission the full campaign attribution from the page address and referrer (source, channel, campaign, content, keyword), the landing page and the first touch kept by the hosted page for 30 days, and the intake references (channel, form, version, submission), and hand each touch to `marketing-campaigns` when it is loaded.
- **FR-21** (advanced) The system MUST check duplicates before creating (`crm-leads-and-deals` duplicate check) and apply the form's duplicate policy: create and link the likely duplicate as a merge suggestion (default), update the existing person or lead (empty fields only), or add a new lead to the existing person; the visitor never learns which happened.
- **FR-22** The system MUST put each accepted submission on the lead's timeline with its answers, page, version and consent, and run assignment rules for the new lead so it has an owner within 5 s of submission.
- **FR-23** The system MUST send, when the form says so, one acknowledgement email from a template to the submitter, at most once per address and form per hour, never to blocked or suppressed addresses.
- **FR-24** The system MUST, for a deal target, convert the new lead into a deal in the form's pipeline and stage and link the submission to both.
- **FR-25** The system MUST start enrichment for the new record when the organization's auto-enrich setting for its type is on.
- **FR-26** The system MUST answer a visitor within 2 s with the thank-you step while the CRM work completes in the background, and keep a submission that the CRM refused as "refused" with the reason and the clashing record for the form owner.

### 3.5 Conversational forms and progressive profiling `(advanced)`

- **FR-27** (advanced) A user with `LEAD_FORMS_MANAGE` can show a form in conversational mode, one question at a time with progress and keyboard navigation, under the same rules and validation.
- **FR-28** (advanced) The system MUST, with progressive profiling on, recognise a returning visitor by the signed token of an earlier submission or a personalized link, hide the questions whose answers are already known and ask the next ones from the form's "ask next" list; stored values are never shown to the visitor.
- **FR-29** (advanced) The system MAY keep partial answers once a visitor has entered a valid email and ticked consent, when the form owner switches it on (default off), as a partial submission listed for follow-up and deleted after 30 days.

### 3.6 Intake channels

- **FR-30** The system MUST declare lead intake to the mail intake of `email-and-communications`, so a mailbox rule can create leads from received mail: a lead from an unknown sender with name split from the display name, company from a non-public domain, the mail on its timeline and source "Email"; a sender who is already a lead or person gets the mail linked instead.
- **FR-31** The system MUST skip automated senders for lead intake: addresses such as no-reply, mailer-daemon and postmaster patterns, messages with automatic-reply or bulk headers, and the organization's own domains.
- **FR-32** The system MUST let a user create a lead from a call log of an unknown number (details optional) and link the call to it, and create such leads automatically for incoming calls from unknown numbers longer than a minimum duration when the organization switches it on (default off).
- **FR-33** The system MUST create a lead from an incoming message of a new sender on a messaging or text account whose owner chose "create leads", with the number or handle, the message on its timeline and source "Messaging".
- **FR-34** The system MUST create a lead when an unknown person books an appointment on a public booking page or accepts an event with an unknown external address, where the event type or calendar is set to do so (default off), linking the appointment to the lead.
- **FR-35** The system MUST accept leads from the organization's Ever Works sites: forms shown on those sites are lead forms (FR-12 to FR-14) whose allowed origins include the linked sites' hostnames, and a site template's own contact or newsletter form posts to a webhook intake source (FR-36), under the same submission rules.
- **FR-36** A user with `LEAD_INTAKE_MANAGE` can create a webhook intake source with a field mapping from the received document to lead fields, receiving signed calls through the inbound endpoints of `integration-hub`, or, without it, through a token address of this feature that checks a signature over the raw body; an Ever Works site with the integration enabled calls it with the integration's token.
- **FR-37** A user with `LEAD_INTAKE_MANAGE` can import leads from a file exported by an ad platform through the platform's import with the source's saved mapping, applying the source's duplicate policy and external ids.

### 3.7 Ad platform connectors and sync logs

- **FR-38** A user with `LEAD_INTAKE_MANAGE` can connect an ad platform account through a connector (sign-in through the connected accounts of `integration-hub`, credentials stored encrypted), pick the pages and lead forms to sync, and map each question to a lead field or custom field; unmapped questions are kept in the lead's intake details.
- **FR-39** The system MUST sync each connected source on its schedule (every 5, 10 or 15 minutes, hourly, daily, or by hand) and on "sync now", fetching incrementally from the last sync time minus an overlap (default 5 minutes), page by page until done, and through the platform's push when the connector supports it.
- **FR-40** The system MUST create each external lead once, keyed by the source and its external id, set the source to the connector's lead source, and apply the source's duplicate policy.
- **FR-41** The system MUST record every intake item of every channel in the sync log with its outcome (created, updated, duplicate, skipped, failed), the payload with secrets removed, the error and a trace reference, kept 90 days (setting).
- **FR-42** (advanced) The system MUST retry a failed item automatically when the error is temporary (back-off up to 5 attempts), let a user with `LEAD_INTAKE_MANAGE` retry one or many items by hand, and tell the source owner once when a source fails 5 times in a row or needs a new sign-in.
- **FR-43** The system MUST show per source its state (active, paused, reconnect needed, failing), last success, items today and failures, and let a user pause and resume it.
- **FR-44** The system MUST give the automation integrations the platform already offers a "create lead" action into the intake contract, so form and ad tools they reach need no connector, and accept connectors as plugins that declare their sign-in, page and form discovery, question list, fetch, push and mapping defaults for the rest; the feature ships the webhook source, the automation actions and the file import, and no connector is required for the rest to work.

### 3.8 Enrichment

- **FR-45** A user with `LEAD_ENRICH_RUN` and edit right can enrich a lead, deal or organisation from its website (else the domain of its email when not a public mail domain): the system finds pages (site map, links ranked by priority words), reads them, extracts company name, description, logo, industry, social profile links and the first public email and phone, and shows each step's progress live.
- **FR-46** A user with `LEAD_ENRICH_SETTINGS` can keep industry and social network rules: keywords or patterns with a scope (page title, headings, text, page source, page address) and a weight; the industry is the highest-scoring rule above a minimum, and the run stores its confidence.
- **FR-47** A user with `LEAD_ENRICH_SETTINGS` can map each extracted value to a field of leads, deals and organisations and say when it is written: only while the field is empty (default), each time the website gives a different value, or only while the field still holds its default; a mapping may create a missing list value (such as an industry) when the user may create it.
- **FR-48** The system MUST record every run as one of the platform's long-running operations with trigger, state (waiting, running, done, failed, undone), pages read, fields changed and kept, duration and, per field, the old and new value, source page and confidence.
- **FR-49** A user with `LEAD_ENRICH_RUN` can retry a failed run and undo the latest completed run of a record; undo restores only fields nobody has written since the run and reports the fields changed since, which are kept; a field counts as changed when anyone wrote it after the run, even back to the enriched value.
- **FR-50** The system MUST warn before a new run would overwrite fields a person edited since the last run and skip them unless the user includes them.
- **FR-51** A user with `LEAD_ENRICH_SETTINGS` can set per record type whether records are enriched on creation, and the crawl in four groups: budget (pages, default 10; link depth, 2; time per page, 10 s, and per run, 60 s; page size, 2 MB; retries of a failed page, 2), politeness (the agent text that names the organization), focus (words that rank pages first, address patterns never read) and scope (domains always allowed or always refused); a run starts from the site's map when it publishes one.
- **FR-52** The system MUST refuse every fetch to private, loopback, link-local or cloud metadata addresses, checking each address and each redirect, and this guard cannot be switched off.
- **FR-53** The system MUST honour a site's published crawl rules and delay, and stop a run that exceeds its limits with the pages read so far.
- **FR-54** The system MUST copy an enriched organisation's profile fields into the empty fields of the leads and deals linked to it, as a best effort that never blocks their save.
- **FR-55** The system MUST mark in forms and record pages the fields filled by enrichment with the source and time on hover, and drop the mark when a person edits the field.

### 3.9 Advanced enrichment `(advanced)`

- **FR-56** (advanced) A user can undo one enriched field from its mark, restoring the previous value, recorded in the run.
- **FR-57** (advanced) The system MUST, when the organization enables AI extraction and an AI provider is configured, propose values the rules missed (description, industry, employee band) with the sentence they came from and a confidence; proposals below the organization's minimum confidence (default 0.7) are shown, never written.
- **FR-58** (advanced) The system MUST, when signature enrichment is on, read the signature block of incoming mail linked to a person and propose job title, phone and address with the message as source, written only into empty fields.
- **FR-59** (advanced) The system MUST show per record the enrichment history with each run's changes and confidence, and per organization the share of runs completed, fields filled and runs undone.

### 3.10 Form analytics `(advanced)`

- **FR-60** (advanced) The system MUST count per form and version what reaches its own endpoints: views (form loads through the hosted page or the embed), starts (first field touched, sent by the form script), submissions, spam, completion rate, median time to complete and the drop-off per field (the last field reached, sent by the form script), without storing a visitor's identity for this. Public pages are rendered by Ever Works, so the views of a site page that holds the form are taken from Ever Works where the site is linked through the Ever Works integration and shown beside these counts.
- **FR-61** (advanced) The system MUST show per form the time from submission to the lead's first response by a person (from `crm-engagement` when loaded) and the share of submissions that became deals and wins.

### 3.11 API, MCP, events and reports

- **FR-62** The system MUST expose every capability through REST with idempotency keys on creating routes, and a public submission route per published form that answers within 2 s.
- **FR-63** The system MUST offer MCP tools and in-app assistant tools to list forms and their analytics, test-submit a form, list intake sources and their health, list and retry log items, enrich a record (preview first), list enrichment runs and undo a run, under the caller's permissions.
- **FR-64** The system MUST offer other features one intake contract (channel, fields, attribution, consent, external reference) used by telephony, bookings, webhook sources, the automation integrations and connectors, which applies duplicate policy and logging.
- **FR-65** The system MUST publish, with ids only, as automation triggers and webhook events: form submitted, submission blocked, intake item failed, source needs attention, enrichment done, enrichment undone.
- **FR-66** The system MUST record changes made by an agent as made by the agent on behalf of the user who confirmed them.
- **FR-67** The system MUST register these report definitions (filters period, form, source, channel, campaign and owner where they apply; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Lead intake | leads created per channel, source, form, campaign and day, with duplicates and refusals |
  | Form performance | views, starts, submissions, completion, drop-off per field and spam per form and version |
  | Intake health | per source: items, failures, retries, last success, reconnects |
  | Enrichment | runs by state, fields filled per key, confidence distribution, undo share |
  | Speed to lead | time from submission to owner assignment and to first response, by form and owner |

## 4. Non-Functional Requirements

- **Performance**: hosted form page first render < 1 s on a 4G phone (form definition cached, < 150 KB); submission acknowledged P95 < 500 ms and lead created P95 < 5 s; 50 submissions per second per tenant sustained; an enrichment run of 10 pages < 60 s; a connector sync of 5,000 items < 5 min.
- **Volume**: 1,000 forms and 200 sources per organization; 10 million submissions and log items per tenant with retention.
- **Reliability**: every submission and intake item is stored before the CRM is called, processed at least once and created once (submission id and external id); connector watermarks advance only after a page is committed; jobs catch up after downtime.
- **Security & privacy**: public routes rate limited and size limited (64 KB per submission without files); answers sanitised; embedding by allowed origins only; network addresses stored hashed except in the spam log (30 days); fetches guarded against internal addresses; credentials encrypted; consent texts kept as shown. Leaving the platform: acknowledgement emails, fetches of public websites with the agent text, calls to ad platforms the organization connected, AI provider calls when enabled (page text only).
- **Auditability**: who and when for form publishes, source and mapping changes, releases from spam, manual retries, enrichment runs and undos, with before and after values.
- **Accessibility and localization**: hosted and embedded forms meet keyboard, focus, label and error-announcement checks and work right to left; every builder string in all shipped locales; dates and numbers in the visitor's locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; works without `integration-hub`, `email-and-communications`, `telephony`, the Ever Works integration or `crm-engagement` (their channels are then absent and origins are typed by hand); OpenAPI and SDKs regenerated, the public form and intake routes published as their own group for sites.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Lead form, form version | A public form for leads or deals; its frozen published definitions |
| Submission | One visitor's answers with attribution, consent, outcome and version |
| Spam log entry | A blocked submission with the reason, kept for review |
| Form statistics | Daily counts of views, starts, submissions and drop-off per field |
| Intake source | A configured channel (mailbox rule, messaging account, webhook, file, ad connector) with mapping and schedule |
| Intake item | One received item of a source with its outcome, payload and attempts |
| Connector | A plugin that knows how to reach one ad platform |
| Enrichment rule, mapping | Patterns that score industries and networks; where an extracted value goes and how it is written |
| Enrichment run, change | One enrichment of a record; one field's old and new value with source and confidence |
| Capture settings | The organization's spam, intake and crawl settings |

## 6. Out of Scope

- Lead, person, organisation and deal records, duplicate rule, scoring and conversion → `crm-leads-and-deals`; timelines, assignment rules and first response → `crm-engagement`.
- Pages and sites: Ever Works (its sites embed lead forms or post to a webhook source, FR-35); generic record forms: not part of this feature.
- Mailboxes, mail intake engine, sending, templates, consent and suppression records → `email-and-communications`.
- Webhook transport, inbound endpoints, connected accounts, connector kit and sync job monitor → `integration-hub`.
- Calls and call logs → `telephony`; public booking pages → `calendar-and-scheduling`; campaigns and audiences → `marketing-campaigns`; file import framework → `data-import-export`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_LEAD_CAPTURE` off every route answers `404` and a published form's address stores nothing (FR-1).
- [ ] **AC-2** Publishing a form without a required target field or its default is refused naming it; a conditional field is required only when its condition holds, in the browser and on the server (FR-6, FR-8, FR-16).
- [ ] **AC-3** A submission from an allowed origin with campaign tags creates a lead with source, campaign reference, consent evidence, timeline entry and an owner within 5 s; a frame on another origin is refused by the browser; a frame on a linked Ever Works site's hostname is accepted without typing it (FR-14, FR-20, FR-22, FR-35).
- [ ] **AC-4** A test submission shows the lead, duplicates, owner and acknowledgement it would produce and writes nothing (FR-15).
- [ ] **AC-5** Trap field, fast fill and rate limit each block a submission into the spam log; release creates the lead; another feature's public form gets the same verdicts from the shared defence with lead forms switched off (advanced: abuse defence; FR-17, FR-18).
- [ ] **AC-6** Duplicate policies "update existing", "link suggestion" and "new lead for person" each behave as FR-21 (advanced: duplicates at intake).
- [ ] **AC-7** A consent box's exact text, form version and time are stored as acceptance evidence that the consent records refer to, and a ticked marketing box sets the contact's marketing consent flag; a required unticked consent refuses the submission (advanced: consent; FR-19).
- [ ] **AC-8** Progressive profiling hides known questions for a recognised visitor and shows nothing stored; conversational mode keeps the same validation (advanced: progressive forms; FR-27–FR-29).
- [ ] **AC-9** A mailbox rule creates a lead from an unknown sender with split name and company; automated senders and own domains create nothing (FR-30, FR-31).
- [ ] **AC-10** A call from an unknown number becomes a lead by hand; with the setting on, a call above the minimum duration does so automatically (FR-32, FR-34).
- [ ] **AC-11** A webhook source maps a signed document to a lead (an Ever Works site's contact form included); a bad signature is refused and logged; a "create lead" call of an automation integration creates the lead once (FR-35, FR-36).
- [ ] **AC-12** A connector sync with overlap creates each external lead once over two runs; a failing item retries automatically, then alerts the owner once after 5 failures (advanced: retry; FR-40–FR-42).
- [ ] **AC-13** An enrichment run on the fixture site fills description, logo, industry with confidence, social links and phone, each with its source; undo keeps a field edited since and reports it (FR-45, FR-46).
- [ ] **AC-14** A website resolving to a private address, or redirecting to one, is refused at that step; crawl rules of the site are honoured (FR-52, FR-53).
- [ ] **AC-15** An enriched organisation fills only the empty fields of its linked deals; enriched fields show their mark until edited (FR-54, FR-55).
- [ ] **AC-16** AI extraction proposals carry their sentence and confidence, and below the minimum are shown, not written; single-field undo restores one field (advanced: enrichment; FR-57).
- [ ] **AC-17** Form analytics show form loads, starts, completion and drop-off per field counted at the form's own endpoints for a form with known traffic, and the page views taken from Ever Works for a form on a linked site; speed to lead uses first responses (advanced: analytics; FR-60, FR-61).
- [ ] **AC-18** The five report definitions of FR-67 return the expected figures on the demo data set.
- [ ] **AC-19** Every MCP tool of FR-63 answers under the caller's rights; previews write nothing.
- [ ] **AC-20** Hosted and embedded forms pass keyboard and screen-reader checks and right-to-left rendering; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-14; §4).
- [ ] **AC-21** With `FEATURE_LEAD_CAPTURE` off, nothing changes: the existing public booking, team join, sign-up, invoice, estimate, employee and organization pages answer with today's checks and limits, the automation integrations offer the same actions, and contact import and client sync behave as before; whatever the flag, an existing public form gains the shared defence only after its setting is switched on (FR-1).
- [ ] **AC-22** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Which ad platform connectors ship first. Applied default: the connector contract, the webhook source and file import ship; each platform connector is a separate plugin.
- A deal form creates a lead and converts it at once. Applied default.
- The proof-of-work challenge keeps visitor data on the platform. Applied default.
- Partial answers are kept only after a valid email and consent, and only when the form owner turns it on. Applied default off.
- Automatic leads from unknown callers are off by default with a 30-second minimum. Applied default.
- Network addresses of accepted submissions are stored hashed only. Applied default; an organization that needs them in clear for fraud review would need a setting.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/lead-capture` and `lead-capture-ui`; the hosted page in `public-layout-ui`; leads written only through the CRM plugin; settings, permissions, consent evidence and runs in the platform's stores.
- [x] II Tenant/organization scoping — every record carries tenant and organization; public routes resolve the tenant from the form key only.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `GAUZY_LEAD_CAPTURE_ENABLED` and `FEATURE_LEAD_CAPTURE` off; contact import and client sync unchanged.
- [x] V Contracts and API first — contracts in `packages/contracts`; REST, public route and MCP before UI; one intake contract for other features.
- [x] VI Permissions, privacy, security — seven keys; signatures, allowed origins, rate limits, internal-address guard, encrypted credentials, consent records.
- [x] VII Real-time through the event bus — outbox events; enrichment progress and log changes on the platform channel.
- [x] VIII i18n and accessibility — form texts per language, accessible public forms, keys in every locale.
- [x] IX Tests accompany the change — unit, e2e, public route fuzz and fixture-site tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../crm-leads-and-deals/spec.md`](../crm-leads-and-deals/spec.md), [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md)
- Works with: [`../crm-engagement/spec.md`](../crm-engagement/spec.md), `email-and-communications`, `integration-hub`, `telephony`, `marketing-campaigns`, `calendar-and-scheduling`, [`../data-import-export/spec.md`](../data-import-export/spec.md), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md); Ever Works sites through the Ever Works integration
- Code: `packages/core/src/lib/integration/`, `integration-tenant/`, `integration-setting/`, `integration-map/` (connector base), `packages/core/src/lib/terms-acceptance/`, `packages/core/src/lib/operation/`, `packages/plugins/integration-ever-works/`, `packages/plugins/inbox/src/lib/email/handoff/inbox-email-handoffs.ts`, `packages/core/src/lib/employee-appointment/`, `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`, `packages/core/src/lib/core/util/ssrf-safe-agent.ts`, `packages/core/src/lib/public-share/invoice/public-invoice.controller.ts` (throttled public route)
