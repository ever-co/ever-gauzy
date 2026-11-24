# Feature Specification: Marketing campaigns

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `marketing-campaigns`
**Branch**: `feat/marketing-campaigns`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CAMPAIGNS` (tenant feature, default off) · the plugin loads only when `GAUZY_CAMPAIGNS_ENABLED`
is exactly `true` · email and text sends need `FEATURE_COMMUNICATIONS` · the campaign assistant also needs
`FEATURE_CAMPAIGNS_ASSISTANT` (default off)

---

## 1. Overview

Today "campaign" means only a promotion window with a budget used at checkout, a contact carries one marketing consent
flag and a free-text acquisition channel, and nothing sends a newsletter or measures one. This feature turns the
existing campaign into the one **campaign** record of marketing and promotions: it names an effort with dates, owner, a
marketing budget and costs, keeps its promotions and coupons, and its code becomes the campaign attribution of the
leads, deals, quotations and orders it brings. Marketers keep **subscription lists** with double opt-in and build
**segments** of contacts, people and leads from their fields, purchases and engagement (both are the organization's
contact groups), write **newsletters and campaign messages** (email and text) with personal tokens, a web version,
tests and link checks, and **schedule** them, throttled, in each recipient's time zone. Campaign **sequences** send steps
days after enrolment as flows of `automation-and-notifications`. Every send honours unsubscribes, suppressions, consent
and do-not-contact; opens, clicks, unsubscribes, bounces and conversions are **tracked** into results per message and
campaign. Transport, templates, tracking, unsubscribe pages, suppression at send time, consent records and delivery
states stay with `email-and-communications`; leads and people with `crm-leads-and-deals`; price promotions and coupons
with `pricing-and-promotions`. Clients: the Angular app, a public subscribe endpoint and sign-up box (used by the
organization's Ever Works sites and any other site), two small pages (subscription confirmation and a message's web
version), a public newsletter feed, the portal's newsletter preferences, the MCP server, the API and SDKs.

**Advanced capabilities.** **Send-time optimisation** sends each recipient at the hour they usually read.
**Experiments** test subjects and content on a share of the audience and send the winner automatically, and a **holdout
group** measures real lift. **Revenue attribution** follows a campaign to paid invoices through the document flow, and
campaign cost includes the **tracked time** spent on it. A **consent ledger** keeps proof per channel and, for every
marketing message, the consent that allowed it. An **assistant** drafts subjects, content and segments from a sentence,
always as drafts. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a marketer who creates the campaign "Spring launch" with code `spring-launch`, budget 5,000 EUR and dates,
  **when** a visitor arrives from a tracked link and becomes a lead, **then** the lead, its deal, quotation and order carry
  the campaign, and the campaign shows 1 lead, 1 deal and the order value.
- **Given** the public list "Product news" with double opt-in, **when** someone subscribes from the footer of the
  organization's Ever Works site, which posts to the subscribe endpoint, **then** they receive a confirmation email; **when** they confirm, **then** they are a subscribed person (a new lead if unknown),
  the consent is recorded with the text shown, and they land on the welcome page.
- **Given** a newsletter to "Product news" minus the segment "Open tickets", **when** the marketer sends a test, checks
  links (one image answers an error and is named) and schedules it for 09:00 in each recipient's time zone, **then** at
  each 09:00 the recipients of that zone are sent, throttled to 2,000 an hour, and the message page counts live.
- **Given** that newsletter sent, **when** recipients open, click and unsubscribe, **then** results show unique opens
  (marked approximate), clicks per link, unsubscribes and bounces; a recipient who unsubscribed from the list never gets
  its next issue, and their contact timeline shows the newsletter and the unsubscribe.
- **Given** a campaign sequence "Trial nurture" with steps on days 0, 3 and 10, **when** a salesperson enrols 40 leads from
  a saved view starting Monday, **then** 3 without email and 2 unsubscribed are refused with reasons, the others get each
  step on its day, and a step added on day 5 at day 7 still reaches them.
- **Given** a text message campaign to customers of the branch "North", **then** recipients without consent for marketing
  texts are listed as skipped, the part counter and estimated cost show before sending, and quiet hours hold messages.
- **Given** an experiment of two subjects on 20 % of the audience deciding by clicks after 4 hours, **then** the winner
  goes to the remaining 80 % and the holdout of 5 % receives nothing; results show the lift in orders. `(advanced)`
- **Given** send-time optimisation, **when** a newsletter goes out within 24 hours, **then** each recipient with history is
  sent at their usual reading hour and others at the scheduled time. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a message already sent, **when** someone presses send again, **then** it is refused; "send to new recipients"
  sends only to people who joined the audience since and never twice to anyone.
- **Given** a send interrupted after 6,000 of 10,000 recipients, **when** it resumes, **then** only the 4,000 not yet handed
  over are sent.
- **Given** a scheduled time in the past, **then** scheduling is refused; sending now cancels a pending schedule.
- **Given** more than 10 % failures in the first 200 recipients, **then** the send pauses and the author is asked to
  continue or cancel; a scheduled send that fails notifies its author with the reason.
- **Given** a forged or altered unsubscribe, confirmation or click link, **then** it shows "this link is not valid" and
  changes nothing; a click link never redirects to an address that was not in the message.
- **Given** more than 10 subscribe requests in an hour from one network address, **then** further requests answer `429`.
- **Given** a recipient who is suppressed for a hard bounce, **then** they are skipped and their list membership shows
  "bounced"; a complaint unsubscribes them from all marketing.
- **Given** a user without `MARKETING_MESSAGES_SEND`, **then** schedule and send answer `403`; with approval required, an
  unapproved message cannot be scheduled.
- **Given** `FEATURE_CAMPAIGNS` off, **then** every campaign route and public page answers `404`, promotion campaigns and
  transactional mail behave as today.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_CAMPAIGNS_ENABLED` is exactly `true` and gates every route, page, public endpoint, menu entry and MCP tool with `FEATURE_CAMPAIGNS`; off, they answer `404`.
- **FR-2** The system keeps promotion campaigns, their budgets and routes, the contact's marketing consent flag and acquisition channel, and transactional email working as today; a marketing campaign is the same campaign record with marketing fields added, so one campaign never exists twice.
- **FR-3** The system sends every message through `email-and-communications` with the marketing purpose and uses its sending identities, templates, suppression list, consent records and delivery states; it has no transport of its own.
- **FR-4** The system only adds routes, fields and enum values; nothing existing is renamed, repurposed or removed.

### 3.2 Campaigns

- **FR-5** A user with `MARKETING_CAMPAIGNS_EDIT` can create a campaign with name, code (the campaign's identifier, unique per organization, used as the attribution value; new codes are proposed in lowercase, an existing campaign keeps its identifier as written, and codes are matched without regard to case), objective, description, owner, start and end dates, a marketing budget and currency (planned spend, separate from the discount ceiling of its promotions) and tags; it is the same campaign record the promotions and coupons of `pricing-and-promotions` belong to, and the campaign page lists them.
- **FR-6** The system numbers campaigns from the platform's numbering series (default `CMP-`) and lets an organization display campaigns by name or by number.
- **FR-7** A campaign moves through planned, active, paused, completed and archived; pausing holds its scheduled messages and sequences, completing ends its enrolments, and an archived campaign keeps its results and attribution. The marketing state never changes the status, window or archive state that decide its promotions and coupons: those keep their own controls and permissions, and a user who also holds the promotion edit permission may choose to apply a pause or completion to the promotions as well.
- **FR-8** A user with `MARKETING_CAMPAIGNS_EDIT` records campaign costs (description, amount, currency, date) and links expenses to it; the campaign shows spend against budget.
- **FR-9** The system is the one writer of campaign attribution: it keeps every touch of a person with a campaign, writes the campaign (a reference found by its code, never free text) and the source as the first touch of leads (`crm-leads-and-deals`) created from its links, forms and lists, and the attribution is carried to deals, quotations, orders and deliveries as their owners copy it. An acquisition channel or campaign already set on a contact or lead is kept; the first touch is written only where it is empty.
- **FR-10** The system lists for each campaign its messages, sequences, lists, segments, members (people it targeted or enrolled) and the leads, deals, quotations, orders and invoices attributed to it.
- **FR-11** A user with `MARKETING_CAMPAIGNS_EDIT` duplicates a campaign with its messages and sequences as drafts.

### 3.3 Subscription lists and sign-up

- **FR-12** A user with `MARKETING_LISTS_MANAGE` can define lists with name, description per language, public or private, double opt-in (default on), confirmation and welcome templates, the page shown after confirming, and the consent text shown; a list is one of the organization's contact groups, so its subscribed people show in their contact's groups.
- **FR-13** A public subscribe endpoint and an embeddable sign-up box take an email, optional name and a public list, are protected by the platform's public-form defence (refusing more than 10 requests an hour per network address), and send a confirmation with a signed link valid 72 hours when double opt-in is on; the endpoint is the contract Ever Works sites and any other site use.
- **FR-14** Confirming makes the person subscribed, links them to the existing person with that address or creates a lead with source "newsletter", records the consent with its proof, sends the welcome message and redirects to the list's page.
- **FR-15** A user with `MARKETING_LISTS_MANAGE` adds people to a list from contacts, leads, saved views or an import file, stating the consent source per import; people without proof of consent are added as pending and asked to confirm when the list requires it.
- **FR-16** A lead form of `lead-capture-and-enrichment` can bind its consent box to a list, which subscribes the lead on submission.
- **FR-17** Lists show live member counts by state (pending, subscribed, unsubscribed, bounced, complained) and growth over time.
- **FR-18** Portal members manage their subscriptions to public lists from the portal's newsletter preferences.

### 3.4 Consent, unsubscribe and suppression

- **FR-19** Every marketing email carries the signed unsubscribe link and the one-click unsubscribe header of `email-and-communications`; its preference page lists the recipient's current lists and lets them leave chosen lists or all marketing, after a confirmation step.
- **FR-20** Leaving a list marks the membership unsubscribed and records the withdrawal; leaving all marketing also adds the address to the suppression list of `email-and-communications` for the marketing purpose.
- **FR-21** The system records every grant and withdrawal of marketing consent per person, channel and list in the platform's consent records with source, time, text shown and basis (consent or, where the organization allows it for existing customers, legitimate interest); the proof of a grant is the platform's append-only acceptance evidence of the exact text.
- **FR-22** A hard bounce marks the address bounced in every list, a complaint unsubscribes it from all marketing, and a stop keyword ends text marketing, as `email-and-communications` reports them.
- **FR-23** A user with `MARKETING_CONSENT_VIEW` sees a person's consent history, list memberships and every marketing message sent to them; a user with `MARKETING_CONSENT_MANAGE` records a consent or withdrawal given by phone or on paper with a note.
- **FR-24** The system offers a re-permission message for consents older than the organization's period (default 24 months), and stops marketing to people who do not confirm when the organization says so.

### 3.5 Audiences and segments

- **FR-25** A user with `MARKETING_AUDIENCES_EDIT` can build segments of contacts, people and leads with conditions on their fields and custom fields, tags, contact groups, owner, lead stage and score, attribution, country and language, purchases (orders and amounts in a period, items bought, last order), open tickets, list memberships, enrolments and engagement (opened, clicked or not in a period), combined with and, or and not.
- **FR-26** A segment shows its live count and a sample of 20 people before saving, and recomputes at send time unless saved as a snapshot, which freezes its members with the date; a segment is one of the organization's rule-based contact groups (a snapshot a fixed one), usable wherever contact groups are, and its conditions are the platform's rules.
- **FR-27** A message audience is lists, segments, contact groups and saved views of contacts or leads, minus excluded lists and segments; the system de-duplicates people and addresses.
- **FR-28** The system shows before sending how many will be sent and how many are skipped per reason (no address, suppressed, unsubscribed, no consent, do-not-contact, duplicate, invalid address).

### 3.6 Messages and newsletters

- **FR-29** A user with `MARKETING_MESSAGES_EDIT` writes an email message with subject, preview text, sending identity, reply-to address and body in rich text, Markdown, raw HTML or blocks (heading, text, image, button, divider, columns, video, item card), optionally centred, with attachments within the transport's limits.
- **FR-30** The body takes personal tokens (person, organization and custom fields, unsubscribe and web version links) with a fallback each; unknown tokens are refused at save.
- **FR-31** A user starts a message from a marketing template of `email-and-communications` and saves a message as a template.
- **FR-32** A user sends a test to up to 5 addresses at once, outside tracking and audience counts, with the tokens of a chosen person.
- **FR-33** The system checks every link and image before scheduling (an answer of 400 or above, or none within 5 seconds, is named), warns on a missing unsubscribe link, an image-only body or a subject over 120 characters, and shows the identity's delivery health.
- **FR-34** The system shows the message at desktop and phone widths and as plain text.
- **FR-35** A user publishes a web version at an address of the organization, optionally linked from the email and listed in the organization's public newsletter feed (JSON and RSS) that its Ever Works site or any site can show; an unpublished message has no web version and is not in the feed.
- **FR-36** When the organization requires approval (default off), a message is sent to approval through `approval-workflows`, else to holders of `MARKETING_MESSAGES_APPROVE`, and only an approved message can be scheduled; a change after approval asks for it again.
- **FR-37** A user with `MARKETING_MESSAGES_SEND` sends now or schedules to the minute, at one time or at the same local time in each recipient's time zone, with an optional hourly cap; a time in the past is refused and sending now cancels the schedule.
- **FR-38** A message is sent once: a sent message refuses another send, and "send to new recipients" sends only to people who joined its audience since.
- **FR-39** A user with `MARKETING_MESSAGES_SEND` pauses, resumes or cancels a sending message; resuming and recovering after a failure send only to recipients not yet handed over.
- **FR-40** A user with `MARKETING_MESSAGES_EDIT` writes text messages with a template, tokens and the part counter and estimated cost of `email-and-communications`, to contacts, people of customers, suppliers or partners, filtered by customer, supplier, department, branch or any segment.
- **FR-41** The message page shows during sending, live, the planned, sent, failed and remaining counts and whether sending is still running.

### 3.7 Sending rules

- **FR-42** The system never sends a marketing message to an address that is suppressed, unsubscribed from the list it is sent through, without consent where the channel and organization require it, marked do-not-contact or invalid, and sends once per person and message.
- **FR-43** Any marketing-purpose email written from a record or a bulk send drops unsubscribed and suppressed recipients before sending and says who was dropped.
- **FR-44** The system honours the quiet hours and identity warm-up of `email-and-communications` and stops a send above its failure threshold.
- **FR-45** A failed scheduled send keeps what was sent, marks the rest failed with the reason and notifies the author; recipients handed over are never sent again.

### 3.8 Campaign sequences

- **FR-46** A user with `MARKETING_CAMPAIGNS_EDIT` defines a campaign's sequence as steps (a message and the days after enrolment it goes out), kept as a flow of `automation-and-notifications` with campaign steps, so waits for an open or click, branches, list changes, field updates and owner notices are also available.
- **FR-47** A user with `MARKETING_CAMPAIGNS_EDIT` enrols leads, contacts, people or a list into a campaign's sequence from a start date with a sender user; the system refuses recipients without an address, unsubscribed or suppressed ones and those already actively enrolled, with a reason each.
- **FR-48** An enrolment is scheduled, in progress, completed or unsubscribed; its end date is the start plus the last step, recalculated when steps change.
- **FR-49** Each step goes out on its day; a step added later reaches every enrolment that has not passed that day, and a removed step is skipped.
- **FR-50** Unsubscribing, a complaint or a hard bounce ends the person's enrolments; pausing the campaign holds them.
- **FR-51** The system offers automation triggers (subscribed, unsubscribed, enrolled, message opened, link clicked, entered a segment) and actions (send a campaign message, enrol, end enrolment, add to or remove from a list).

### 3.9 Tracking

- **FR-52** The system counts opens per recipient from the tracking image of `email-and-communications` and marks opens it judges automatic; open figures are shown as approximate.
- **FR-53** The system sends links through the tracked links of `email-and-communications`, counting clicks per link and recipient, which redirect only to the link's own address.
- **FR-54** The system adds campaign tags (source, channel, campaign, content, keyword) to links pointing to the organization's own domains, and to all links when the message says so.
- **FR-55** A user with `MARKETING_SETTINGS_MANAGE` sets tracking per organization and per message (opens, clicks, parameters; default on for marketing), and nothing is tracked for employees.
- **FR-56** The system records conversions of a recipient within the attribution window (default 30 days): a form submitted, a lead created, a deal won, an order placed with the campaign attribution.
- **FR-57** Opens, clicks, unsubscribes and conversions appear on the person's timeline with the message and campaign.

### 3.10 Results

- **FR-58** Each message shows recipients, sent, delivered, bounced, failed, unique opens, unique clicks, clicks per link on a map of the message, unsubscribes, complaints and conversions, with rates and over time.
- **FR-59** Each campaign rolls up its messages and sequences with leads, deals, quotations, orders, order value, conversion ratios, spend and cost per lead.
- **FR-60** A user with `MARKETING_REPORTS_VIEW` exports a message's recipient results with states and engagement.

### 3.11 Video content

- **FR-61** A user with `MARKETING_CAMPAIGNS_EDIT` keeps videos published on outside video sites (address, publish date, duration, description, image), links them to campaigns and places them in messages as an image linking to the video.
- **FR-62** When a video-site connector of `integration-hub` is connected, the system reads the video's id from its address and refreshes its views, likes, dislikes and comments hourly, every 6 hours or daily as chosen, keeping a daily history; without a connector the figures can be typed.

### 3.12 Send-time optimisation `(advanced)`

- **FR-63** A message can be sent at each recipient's best hour within a window (default 24 hours), learned from their opens and clicks of the last 180 days in their time zone; recipients without history get the scheduled time. `(advanced)`
- **FR-64** Results compare the opens and clicks of optimised recipients with those sent at the scheduled time. `(advanced)`

### 3.13 Experiments and holdout `(advanced)`

- **FR-65** A user with `MARKETING_MESSAGES_EDIT` adds variants of subject, preview text, sender or content, a test share (default 20 %), a winning measure (opens, clicks, conversions or revenue), a decision time and a minimum sample. `(advanced)`
- **FR-66** At the decision time the system sends the variant that leads by a significant margin to the rest of the audience, or the first variant with "no clear winner", and records why. `(advanced)`
- **FR-67** A campaign can keep a holdout share (default off, at most 20 %) of each audience that receives nothing, and results show the lift in conversions and revenue over the holdout. `(advanced)`

### 3.14 Revenue attribution and cost `(advanced)`

- **FR-68** The system attributes leads, deals, quotations, orders and paid invoices to campaigns through the touches of a person and the document flow, with first touch, last touch, linear and position-based models within the window. `(advanced)`
- **FR-69** A campaign shows attributed paid revenue in the organization's currency per model against its costs, with return on spend. `(advanced)`
- **FR-70** A campaign linked to a project adds the tracked time of its tasks at the stored rates to its cost. `(advanced)`

### 3.15 Consent ledger `(advanced)`

- **FR-71** Each recorded consent keeps its proof: the form or page and version, the confirmation message, the network address in hashed form, the text and its language. `(advanced)`
- **FR-72** Each marketing message sent records the consent or basis that allowed it, per channel. `(advanced)`
- **FR-73** A user with `MARKETING_CONSENT_VIEW` exports a person's proof file (consents, withdrawals, proofs and the marketing messages sent under each). `(advanced)`

### 3.16 Campaign assistant `(advanced)`

- **FR-74** With `FEATURE_CAMPAIGNS_ASSISTANT` and an AI provider, a marketer asks for subject lines, preview texts and body variants from a brief in the organization's tone, with a spam-risk note, always as drafts. `(advanced)`
- **FR-75** A marketer describes a segment in a sentence and gets its conditions with the live count to review before saving. `(advanced)`

### 3.17 Settings, roles and real time

- **FR-76** A user with `MARKETING_SETTINGS_MANAGE` sets the default sending identity, own domains, consent rules per channel, approval, tracking defaults, re-permission period, attribution model and window.
- **FR-77** The system seeds the role bundle template "Marketer" with the marketing permissions for `access-control-and-security`.
- **FR-78** Campaign, message and list pages update live while sending and as results arrive, through the platform push channel.

### 3.18 API, MCP and events

- **FR-79** The system exposes every capability through REST with GraphQL reads, cursor paging and idempotency keys on scheduling, sending, enrolling and subscribing.
- **FR-80** The system registers campaigns, messages, lists and segments as record types (saved views, custom fields, reports, automation triggers).
- **FR-81** MCP tools list and read campaigns, preview a segment, draft a message, preview a send (recipients and skips) and schedule it only after confirmation, read results, and read a person's consent history, under the caller's permissions.
- **FR-82** The system publishes events for campaign changes, list subscriptions and withdrawals, enrolments, sends, opens, clicks, unsubscribes and conversions, carrying ids only.

### 3.19 Reports

- **FR-83** The system registers these reports for users with `MARKETING_REPORTS_VIEW`, filterable by organization, campaign and period, and lists them in the platform's report catalogue only for tenants with `FEATURE_CAMPAIGNS` on (with it off the catalogue and report menu show exactly today's entries):

  | Report | Content |
  |---|---|
  | Campaign efficiency | per campaign: leads, deals, quotations, orders, order value, conversion ratios, spend and cost per lead |
  | Message sending status | per message: sent, failed and total recipients, still sending or not, unique opens |
  | Engagement | opens, clicks, unsubscribes, complaints per message, list and day |
  | List growth | subscriptions, confirmations, withdrawals, bounces and members per list over time |
  | Consent register | grants and withdrawals by channel, list, source and basis |
  | Video engagement | views, likes, dislikes and comments per video over time |
  | Attribution | attributed revenue and documents per campaign and model |
  | Experiments | variants, measure, winner, margin and lift over holdout |

## 4. Non-Functional Requirements

- **Performance**: segment count under 2 s at one million contacts per tenant; send planning of 500,000 recipients under
  2 minutes; hand-over of at least 50,000 messages an hour per worker within the identity's limits; tracking redirects
  under 50 ms at the 95th percentile; live counters within 5 s.
- **Volume**: 5 million list members and 200 million engagement events a year per tenant, aggregated after two years.
- **Reliability**: at most one send per person and message, through crash and resume; tracking writes never slow the
  redirect (queued).
- **Security & privacy**: links signed; redirects only to addresses in the message; tracking off for employees; network
  addresses hashed; consent proof kept as long as the consent plus the legal period. Leaving the platform: marketing
  emails and texts to recipients, link checks to the linked hosts, video-site queries through connectors, assistant
  prompts to the tenant's AI provider.
- **Observability**: campaign, message and list changes audited; metrics for planning time, hand-over rate, skips per
  reason, bounce and complaint rates per message.
- **Accessibility and localization**: editors keyboard operable; messages, lists and pages per language; recipients'
  language and time zone used for tokens, dates and schedules.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted; without communications only
  planning and results of past sends remain; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Campaign, campaign cost | The platform's one campaign record (also used by promotions) with code, dates, owner and marketing budget; a recorded spend |
| Subscription list, list member | A list people subscribe to (a contact group); one address's subscription with its state |
| Segment | Saved conditions selecting contacts, people or leads, live or frozen (a rule-based or fixed contact group) |
| Message | A newsletter, campaign email or text with content, audience, schedule and tracking |
| Send | One recipient of one message with its state, skip reason and engagement |
| Tracked link, engagement | A counted link of a message; opens, clicks, unsubscribes and complaints as tracked by communications, and conversions |
| Enrolment | A person's place in a campaign sequence |
| Experiment, holdout | Variants with a winning rule; the share that receives nothing |
| Touch, attribution | A person's contact with a campaign; a document credited to it under a model |
| Consent proof | The evidence behind a consent record (the platform's acceptance evidence) and its use per message |
| Video | An outside video used in campaigns with its engagement figures |

## 6. Out of Scope

- Transport, sending identities, templates storage, tracking image and click redirect, unsubscribe and preference pages,
  suppression at send time, consent records, delivery states, text providers and quiet hours: `email-and-communications`.
- Leads, people, deals and their attribution fields: `crm-leads-and-deals`; web forms, intake and the public-form
  defence: `lead-capture-and-enrichment`.
- Price promotions, coupons and their discount budgets: `pricing-and-promotions`; landing pages and sites: Ever Works
  (landing-page Works); forms on them: `lead-capture-and-enrichment`.
- The flow engine, waits and the assignment engine: `automation-and-notifications`; approvals: `approval-workflows`.
- Video-site connectors: `integration-hub`; the portal shell: `customer-and-supplier-portal`; agent definitions:
  `ai-agents-and-assistants`.

## 7. Acceptance Criteria

- [ ] **AC-1** A campaign's code reaches a lead from a tracked link and is carried to its deal, quotation and order; the
      campaign lists them with order value; the campaign is the same record its promotions use and appears once in the
      menu (FR-9, FR-56).
- [ ] **AC-2** Double opt-in subscribe, confirm, welcome and redirect work; forged links change nothing; the rate limit holds (FR-13, FR-14).
- [ ] **AC-3** Unsubscribing from one list keeps the others; leaving all marketing suppresses the address; bounces and
      complaints update every list; a record email drops unsubscribed recipients (FR-20, FR-22, FR-42).
- [ ] **AC-4** Segments count live, recompute at send time, freeze as snapshots; skips are reported per reason; segments
      and lists appear among the organization's contact groups (FR-26, FR-28).
- [ ] **AC-5** A newsletter tests, checks links, publishes a web version, waits for approval when required, and sends once
      per recipient in their time zone under the hourly cap; a resumed send never repeats a recipient (FR-32, FR-35, FR-36).
- [ ] **AC-6** A text campaign shows parts and cost, skips people without consent and honours quiet hours (FR-40, FR-44).
- [ ] **AC-7** A sequence refuses the cases of FR-47, sends each step on its day, honours a step added later and ends on
      unsubscribe.
- [ ] **AC-8** Opens, clicks, parameters and conversions are recorded, shown on the person's timeline and in results (FR-57).
- [ ] **AC-9** Video figures refresh through a test connector at the chosen frequency and feed the video report (FR-62).
- [ ] **AC-10** Optimised sending uses each recipient's best hour (advanced: send time; FR-63).
- [ ] **AC-11** An experiment picks the winner by the chosen measure and the holdout shows lift (advanced: experiments; FR-65–FR-67).
- [ ] **AC-12** A paid invoice is attributed under each model and return on spend includes tracked time (advanced:
      attribution) (FR-68, FR-69).
- [ ] **AC-13** Every marketing send names the consent that allowed it and a proof file exports (advanced: ledger; FR-72, FR-73).
- [ ] **AC-14** The assistant drafts variants and a segment from a sentence, never sending (advanced: assistant; FR-74, FR-75).
- [ ] **AC-15** The reports of FR-83 show the expected rows for a seeded tenant.
- [ ] **AC-16** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_CAMPAIGNS`; promotions and
      transactional mail unchanged while it is off; every functional requirement has a passing test (FR-2; §4).
- [ ] **AC-17** With `FEATURE_CAMPAIGNS` off, nothing changes: promotion campaigns keep their identifiers, status,
      windows and promotions at checkout; contacts keep their acquisition channel, marketing flag and contact groups;
      the Reports page lists the same reports. With it on, pausing, completing or archiving a marketing campaign leaves
      its promotions applying as before unless a holder of the promotion edit permission applies the change to them, and
      a typed acquisition channel is never overwritten (FR-1, FR-2).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Unknown subscribers become leads with source "newsletter" when they confirm, so every subscriber is a party. Default applied.
- Email marketing needs consent; existing customers may be mailed on legitimate interest only when the organization
  switches it on (default off); texts always need consent. Defaults applied.
- Tracking is on by default for marketing messages and never for employees; opens are shown as approximate. Default applied.
- Approval before sending is off by default. Default applied.
- Attribution defaults to last touch within 30 days. Default applied.
- Ever Works keeps its own campaign Works (a go-to-market pipeline for a product). Whether such a Work links to a
  campaign record here is open. Applied default: no link; a campaign may name the Work's address in its description.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `campaigns`, `campaigns-ui`; core unchanged; campaigns, lists, segments, tracking and consent proof build on the existing records.
- [x] II Tenant/organization scoping — every campaign, list, segment, message, send and event scoped.
- [x] III Both ORMs, additive migrations — new tables on three dialects; satellites beside the campaign and contact group tables, no existing column changed.
- [x] IV Default-off flag; nothing removed — deploy switch and `FEATURE_CAMPAIGNS`; promotions and mail unchanged.
- [x] V Contracts and API first — contracts, REST, public routes and ports before pages.
- [x] VI Permissions, privacy, security — eleven permissions, consent and suppression on every send, signed links, data leaving listed.
- [x] VII Real-time through the event bus — live counters and results through the push channel.
- [x] VIII i18n and accessibility — per-language content and pages; keyboard editors.
- [x] IX Tests accompany the change — per requirement, send idempotency suites, dialect and ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`email-and-communications`](../email-and-communications/spec.md), [`crm-leads-and-deals`](../crm-leads-and-deals/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md), [`record-views-and-search`](../record-views-and-search/spec.md),
  [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md)
- Works with: [`lead-capture-and-enrichment`](../lead-capture-and-enrichment/spec.md), [`pricing-and-promotions`](../pricing-and-promotions/spec.md),
  [`customer-and-supplier-portal`](../customer-and-supplier-portal/spec.md), [`approval-workflows`](../approval-workflows/spec.md)
- Code: `packages/plugins/promotion/src/lib/campaign/`, `packages/core/src/lib/{organization-contact,contact-group,contact-group-member,rule,terms-acceptance,sequence}/`,
  `packages/contracts/src/lib/user.model.ts` (newsletter preference)
