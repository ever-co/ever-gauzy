# Feature Specification: Helpdesk portal and knowledge base

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `helpdesk-portal-and-knowledge-base`
**Branch**: `feat/helpdesk-portal-and-knowledge-base`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_DOCUMENTS` (existing: help articles are pages of the Documents hub) and
`FEATURE_HELPDESK_PORTAL` (tenant feature, default off: audiences, public read API and feeds, customer ticket pages,
ratings) · customer ticket pages also need `FEATURE_HELPDESK` and `FEATURE_CUSTOMER_PORTAL` · the answer assistant needs
`FEATURE_HELP_CENTER_ASSISTANT`, community questions `FEATURE_HELP_COMMUNITY` (both default off)

---

## 1. Overview

Today the help centre is an internal knowledge base: help centres and categories in a tree, articles with rich content,
drafts, a private flag, authors, tags, versions and duplicates, edited by staff with the help-centre permission. Once the
Documents hub is on, its page leads to the hub, which already holds pages, versions, links, sharing and a search and
embedding pipeline; nothing is public, readers cannot say whether an article helped, and tickets cannot cite it. This
feature gives help articles **one home, the Documents hub**: an organization's help centre is its **help space** (one existing space
of the hub, marked as the help space), its categories are folders and its articles are pages, each in its own language (the existing articles are carried over once). Articles gain a
published lifecycle, an audience (everyone, customers, agents), slugs whose former addresses keep answering, excerpts,
pins, feedback, views and citations; ranked search with synonyms and further sources through the Documents search, and
related articles for agents and customers. The organization's **public help site** is an Ever Works site, or any other
app, built from the help centre's public read API and feeds. Signed-in customers read customer articles in the portal,
raise tickets from a form that suggests articles while they type, follow and answer them, see their organisation's
tickets when they manage it, and **rate** the support they got from the portal, an email or a small built-in rating
page. Customer organisations are the platform's organisations and people, with portal members from
`customer-and-supplier-portal`. Clients: the Documents hub and helpdesk pages of the Gauzy web app, the signed-in portal,
help sites through the read API, the MCP server, the API and SDKs.

**Advanced capabilities.** An **answer assistant** answers a visitor's question from the articles they may read,
shows its sources and hands a still-open question to a ticket with what was tried. **Knowledge gaps** are found from
searches without results, unhelpful votes and tickets no article matched, grouped into topics with a drafted article to
review. Articles have **variants per product release and per language**, and translations are **flagged stale** when
their source changes. **Community questions** let customers help each other, and agents turn a good thread into an
article. A **low rating starts a recovery** with the team lead. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a help centre serving everyone, **when** the organization's Ever Works help site reads the public read API,
  **then** it gets pinned categories, featured articles and the most read articles of the last 30 days to show on its
  home; agents-only and customers-only articles never appear.
- **Given** a visitor of that site typing "reset password", **when** the site calls the public search, **then** the
  article "Resetting your password" ranks first because its title matches; **when** they mark it helpful, **then** its
  helpful share rises and their vote is kept once per browser and day.
- **Given** a signed-in customer on **New ticket**, **when** they type the subject "Invoice shows wrong VAT", **then**
  three articles are suggested; **when** they open one and choose "Solved", **then** no ticket is created and a
  deflection is counted; otherwise the ticket is created with the type's customer fields and records the article seen.
- **Given** an agent's reply on that ticket, **when** the customer opens My tickets, **then** the ticket shows "Waiting
  for you" with the conversation, attachments and the expected first response; **when** they answer, **then** the
  ticket reopens and the agent is notified.
- **Given** a ticket entering done, **when** the rating email arrives, **then** a click on four stars records the rating
  and opens a page for a reason and a comment; the rating shows on the ticket, the contact and the agent's figures.
- **Given** Ana, administrator of the customer Ruiz Logistics, **when** she opens Company requests, **then** she sees every
  ticket of her colleagues and the organisation's open, overdue and average resolution figures.
- **Given** an author editing an article in the Documents hub, **when** they rename its slug and publish, **then** the
  read API answers the old slug with the new address, so the help site redirects, and agents see how many tickets cite
  it.
- **Given** the assistant on, **when** a visitor asks "can I pay by bank transfer?", **then** it answers from the article
  "Payment methods" with a link, and "I still need help" opens a ticket carrying the question and the answer.
  `(advanced)`
- **Given** 40 searches for "export timesheet" without results this week, **when** an author opens Knowledge gaps,
  **then** the topic is listed with examples and a drafted article to review. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a customer opening the number of another customer's ticket, **then** the answer is `404`.
- **Given** a guest when guest tickets are off, **then** "New request" asks them to sign in; with "hide new request"
  on, the button is not shown to anyone.
- **Given** a customer-side write to a field the template keeps closed, **then** `400` names the field and nothing is saved.
- **Given** a rating link used twice, **then** the second time shows the recorded rating; an expired link offers to sign in.
- **Given** an article cited by tickets, **when** an author deletes it, **then** they are asked to archive instead; an
  archived article stays readable by agents from those tickets and tells customers it is no longer available.
- **Given** a category deleted with 12 articles, **then** the summary says 12 articles move to General, and General
  cannot be deleted.
- **Given** an outside search source that times out, **then** its group is left out after 5 seconds and other results show.
- **Given** a burst of votes or questions from one network address, **then** requests beyond the limits answer `429`.
- **Given** `FEATURE_HELPDESK_PORTAL` off, **then** public help routes and customer ticket routes answer `404` and the
  help centre behaves as today (internal pages of the Documents hub, or the existing help-centre page while the hub is
  off).

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system gates the help audiences, the public read API and feeds, customer ticket pages, ratings and their MCP tools with `FEATURE_HELPDESK_PORTAL`, customer ticket pages also with `FEATURE_HELPDESK` and `FEATURE_CUSTOMER_PORTAL`; off, they answer `404`.
- **FR-2** The system keeps the existing help-centre routes, tables, permissions, versions, duplicates and seeded content working as today and its page leading to the Documents hub when the hub is on; there the existing articles are carried once into help spaces as pages with their versions, every category level kept. The former rows are left as they are and stay readable and writable through the existing routes: a change written through them is carried to the article's page as a new version, and a change on the page is written back to the row's title and content, so each article stays one article and nothing is locked; existing articles keep the visibility they have today (the internal readers who see them today, private ones staying private; none public) until a person changes their audience.
- **FR-3** The system uses the ticket service of `helpdesk-tickets` for every customer read and write of a ticket and shows only what its customer view returns.
- **FR-4** The system only adds routes, fields and enum values; nothing existing is renamed, repurposed or removed.

### 3.2 Help centre and public help site

- **FR-5** A user with `HELP_CENTER_SETTINGS_MANAGE` sets per organization which audiences the help centre serves (off, signed-in customers, everyone), which existing space of the hub is its help space (one per organization) and, for signed-in customers, whether the portal's help page opens on articles or on their tickets; a public help site's greeting, header links and footer belong to that site. Marking a space changes nothing for its other pages and folders: help fields, help rights and help rules (General, audience caps, slugs, delete summaries) apply only to the help centre's own pages and folders.
- **FR-6** A user with `HELP_CENTER_SETTINGS_MANAGE` sets the portal branding (brand name, logo, favicon, colours, banner from a preset or an image, defaulting to the organization's brand colour and logo) that the whole signed-in portal uses, previews an unsaved draft through a staff-only preview address and publishes it.
- **FR-7** The portal address keeps the signed-in help (customer and everyone articles, search, tickets) and links to the organization's public help site; the public read API answers guests even while portal sign-in is off.
- **FR-8** The public read API gives a help site its home data: pinned categories, featured articles (pinned, else the most read of the last 30 days, filled with the newest) and the categories with their article counts; the site renders the home.
- **FR-9** The system publishes a feed of the published articles for everyone (newest first, as JSON and RSS) that help sites and other apps read; an outside news feed on a help site is the site's own.
- **FR-10** The read API answers an article's or category's former slugs after a slug change, move or merge with its current address, so a help site redirects them; redirects from other old addresses are set on the site.
- **FR-11** The signed-in portal's help page shows the last 10 articles and tickets the member opened, kept in their browser; a public help site keeps its visitors' recent articles itself.
- **FR-12** The signed-in portal follows the member's light, dark or system theme choice; a public help site's theme is the site's.
- **FR-13** A new help space starts with a General category and two sample articles (raising a ticket, resetting a password) as drafts.

### 3.3 Categories

- **FR-14** A user with `ORG_HELP_CENTER_EDIT` keeps categories as folders of the help space, nested as deep as the existing help-centre tree allows (the read API's home data shows the first two levels), with name, slug, description, icon and colour, ordered by position.
- **FR-15** A user with `ORG_HELP_CENTER_EDIT` merges a category into another (articles and subcategories move, the former slug keeps answering) and moves chosen articles between categories.
- **FR-16** Deleting a category shows a summary of what moves and moves its articles to the help space's General category, which cannot be deleted or renamed away.
- **FR-17** A category shows its audience derived from its articles (everyone, customers, agents or mixed) and may set an audience cap: an article inside it is never broader than the cap, and moving an article into a capped category narrows it, never widens it.
- **FR-18** A user with `HELP_CENTER_PUBLISH` pins categories to the home data of the read API in an order.

### 3.4 Articles and editor

- **FR-19** An article is a page of the help space holding title, slug (unique per help space, from the title by default), excerpt (up to 300 characters), rich content, category (its folder), authors, owner, tags, language, status (draft, published, archived), audience and dates of publication, last update and last review.
- **FR-20** A user with `ORG_HELP_CENTER_EDIT` writes and saves drafts in the Documents editor with its versions and restore; a user with `HELP_CENTER_PUBLISH` publishes now or at a date, unpublishes to draft and archives.
- **FR-21** Archiving removes an article from lists, search and its category, keeps it readable by agents and its citations, and restoring returns it as a draft.
- **FR-22** A user with `HELP_CENTER_PUBLISH` pins articles to the home data of the read API in an order and orders articles inside a category by position; position never changes search ranking.
- **FR-23** A user with `ORG_HELP_CENTER_EDIT` archives, deletes, moves or changes the audience of up to 200 selected articles at once, with a result per article.
- **FR-24** The system refuses deleting an article cited by tickets unless the user confirms after seeing the count, and offers archiving first.
- **FR-25** The system sanitises article content on save and on render and serves embedded files only through the platform's file routes.

### 3.5 Access

- **FR-26** Each article has an audience: everyone (published publicly, guests included), customers (signed-in portal members of the organization's customers) or agents (internal readers of the help space).
- **FR-27** Every list, count, search result, suggestion, feed, read API answer, Markdown twin, list of related articles and assistant answer contains only articles the reader's audience allows; an article outside it answers `404`.
- **FR-28** A user with `HELP_CENTER_SETTINGS_MANAGE` lets guests vote on articles (default on) and raise tickets through the web form channel's submission endpoint (default off) and hides "New request" everywhere when asked.

### 3.6 Article page and feedback

- **FR-29** The read API gives an article with title, last update, contents and the headings for a table of contents, attachments, related articles (same category first, then similar text), the category path and its feedback endpoint; the signed-in portal shows customer and everyone articles this way with feedback buttons.
- **FR-30** Each published article has a plain-text Markdown twin, and the signed-in portal a "copy as Markdown" action; articles carry search-engine title, description and canonical address; agents-only and customers-only articles are never in the public read API, feed or Markdown.
- **FR-31** A reader marks an article helpful or not helpful through the Documents feedback, optionally with a reason and a comment when not helpful; one vote per signed-in reader or per browser and day for guests, at most 30 votes per network address an hour.
- **FR-32** The system counts views per article and day in the Documents view statistics (unique per reader and day apart), excluding staff previews, and counts views coming from search, the ticket form and the assistant apart from its search log and citations.
- **FR-33** Authors see per article views, helpful share, feedback comments, citing tickets and searches that led to it, for a chosen period.

### 3.7 Search

- **FR-34** Article search ranks published articles of the reader's audience and language through the Documents search (word and meaning matches), boosting title, headings, excerpt and tags with field weights a user with `HELP_CENTER_SETTINGS_MANAGE` can change, falling back to word matching without an embeddings provider, and answers within 300 ms while typing (debounced).
- **FR-35** A user with `HELP_CENTER_SETTINGS_MANAGE` keeps synonym sets and ignored words per language that search applies.
- **FR-36** A user with `HELP_CENTER_SETTINGS_MANAGE` adds search sources: platform record types the reader may read (for example published wiki pages) and outside search addresses on an allow-list (address, query parameter, where results, titles, descriptions and links sit in the answer), fetched through the platform's safe outbound fetch; results show grouped by source.
- **FR-37** The system suggests related articles for a ticket from its subject and first message: to agents on the ticket page with "insert link", and to customers while typing a ticket subject.
- **FR-38** The system keeps the help pages in the Documents index current on every change, reindexes them after an upgrade or when it finds pages missing, and lets a user with `HELP_CENTER_SETTINGS_MANAGE` rebuild it with progress.
- **FR-39** The system logs each search (text, audience, language, result count, top article and score, article opened, ticket raised within an hour) for 180 days without the reader's identity for guests.

### 3.8 Customer tickets in the portal

- **FR-40** The portal's Tickets area lists a member's tickets (requested by them or copying them) and, for holders of "company requests", every ticket of the active customer, with customer-facing status labels, priority, kind of request, last update and unread mark.
- **FR-41** Ticket lists offer filters by status, priority, kind of request and date, sorting, export of the visible columns and saved views per member, separate from agents' views.
- **FR-42** A member with "raise tickets" raises a ticket from a form built from the customer-selectable templates and their customer fields, with subject, description and attachments within the channel's limits, recorded with the portal channel, the entry page and the articles seen.
- **FR-43** The form suggests up to 5 articles while the subject is typed; choosing "Solved" ends without a ticket and counts a deflection.
- **FR-44** A member in several customers picks which one a ticket belongs to; a member of one customer gets it set; the active customer is preselected.
- **FR-45** The ticket page shows the customer-visible conversation as chat bubbles or an email list (choice kept in the browser), the status with its customer label, priority, kind of request, customer fields, attachments, the expected first response and, when the ticket arrived outside working hours, the organization's outside-hours message.
- **FR-46** A member with "reply" answers with sanitised rich text and attachments; an answer on a waiting or done ticket reopens it under the status rules of `helpdesk-tickets`, and on a closed ticket starts its follow-up.
- **FR-47** A member closes their own ticket as solved, which moves it to done with a notice to the assignee.
- **FR-48** A guest who raised a ticket by web form follows and answers it through the follow-up link, a small built-in page showing only the customer view of that ticket, without signing in.
- **FR-49** Ticket pages and lists update within 2 seconds when an agent replies or changes the ticket.
- **FR-50** A member with "company requests" sees an organisation page with the customer's open, overdue and done tickets and average first response and resolution over a period, from the service-level figures of `helpdesk-sla-routing-and-analytics`.

### 3.9 Satisfaction ratings

- **FR-51** A user with `HELPDESK_RATINGS_MANAGE` sets when a rating is requested (entering done by default, or chosen statuses, never at creation), the rating options shown per score band per language, and the link validity (default 14 days).
- **FR-52** The system emails the requester a rating request in their language when a ticket reaches the chosen status, once per resolution, never for merged, spam or agent-raised tickets without a requester address.
- **FR-53** A requester rates 1 to 5 stars from the email (a click on a star opens the rating page with that score selected, and pressing Send records it; opening the link alone, as a mail scanner does, records nothing), from the small built-in rating page of the rating link or from the ticket page, then may add options and a comment; a rating is final for that resolution, and a reopened and resolved ticket can be rated again.
- **FR-54** The system can hold auto-close of a done ticket until it is rated or N days pass (default off).
- **FR-55** Ratings show on the ticket, in the requester panel, on the contact's and customer's pages and in agents' and teams' figures, and serve the dashboards and reports of `helpdesk-sla-routing-and-analytics`.
- **FR-56** A user with `HELPDESK_RATINGS_VIEW` lists ratings with filters (period, score, agent, team, kind of request, customer, with comment) and exports them.

### 3.10 Customer organisations, people and membership roles

- **FR-57** The help centre treats the platform's organisations as customer organisations (logo, website domain, country, phone, email, primary person, members) and their people as contacts, with several emails and phones per person.
- **FR-58** A ticket from a person who belongs to exactly one customer gets that customer; with several, the portal asks and an agent may pick any.
- **FR-59** The system adds ticket and article rights to the portal's membership roles: purchasers and approvers get own tickets, raise, reply, rate and customer articles; viewers read their own tickets and customer articles; administrators also get company requests; the organization can switch whether administrators may invite and manage members (both default on).
- **FR-60** A customer administrator invites colleagues with suggestions from the customer's people and website domain (public email domains from a list the organization can edit never match), changes their membership role, removes them and cancels invitations, under the member rules of `customer-and-supplier-portal`.
- **FR-61** The customer page shows tabs for people, tickets and ticket figures; the person page shows their tickets, customers and the ratings they gave; both offer "give portal access".
- **FR-62** Deleting a customer or a person asks whether to keep their tickets (default) or trash them with it.
- **FR-63** A user with `HELP_CENTER_SETTINGS_MANAGE` lets every member of chosen customers see their organisation's tickets in one action that runs as a background operation with a progress banner.

### 3.11 Articles at work

- **FR-64** An agent inserts an article link or its text into a reply from the composer, which records a citation as a link between the article and the ticket; the article shows its citing tickets to agents.
- **FR-65** An agent creates an article draft from a resolved ticket with the question and the agents' answers prefilled, linked back to the ticket.
- **FR-66** The system lets the assistant and AI responders of `helpdesk-tickets` read only published articles of the customer's audience when they draft for customers.

### 3.12 Answer assistant `(advanced)`

- **FR-67** With `FEATURE_HELP_CENTER_ASSISTANT` and an AI provider of the tenant, a visitor asks a question in the search box of a help site or the portal and gets an answer in their language from published articles of their audience only, citing each article used with a link. `(advanced)`
- **FR-68** The assistant says it cannot answer when its confidence is below the organization's threshold (default 0.7) and never states a step that is not in its sources. `(advanced)`
- **FR-69** "I still need help" opens the ticket form, or for guests the web form, carrying the question, the answer and the sources, which agents see on the ticket. `(advanced)`
- **FR-70** Each answer keeps sources, confidence and the visitor's feedback, and its cost in the platform's AI usage; guests ask at most 10 questions an hour; use counts against the organization's monthly AI budget for the help centre. `(advanced)`

### 3.13 Knowledge gaps `(advanced)`

- **FR-71** A nightly job groups into topics, by meaning similarity from the Documents search, searches without results, searches followed by a ticket, not-helpful votes and tickets whose subject matched no article above 0.5. `(advanced)`
- **FR-72** A user with `HELP_CENTER_ANALYTICS_VIEW` sees topics with 7-day and 30-day volume, trend and examples, assigns one to an author, dismisses it or asks for a draft article written from the topic's resolved tickets and articles, saved as a draft with its sources. `(advanced)`
- **FR-73** A topic closes when a published article matches it, and the topic's volume after publication is shown. `(advanced)`

### 3.14 Release and language variants `(advanced)`

- **FR-74** An article can have translations; editing the source after a translation's last confirmation flags the translation stale with the changed sections until a translator updates or confirms it. `(advanced)`
- **FR-75** Readers get their language's translation, else the source with a notice; a stale translation shows "may be out of date" when the organization says so. `(advanced)`
- **FR-76** An article can state the product releases it applies to; the read API and the signed-in portal offer the releases for a picker and give each reader the variant for their release. `(advanced)`
- **FR-77** Starting a new release copies chosen articles as drafts for that release, and authors see per release which articles are reviewed. `(advanced)`

### 3.15 Community questions `(advanced)`

- **FR-78** With `FEATURE_HELP_COMMUNITY`, signed-in members post questions for everyone or for customers, answer others in the question's comments and vote with reactions; posts wait for moderation when the organization says so; the read API gives published threads to help sites. `(advanced)`
- **FR-79** The asker or an agent accepts an answer; agents' answers are marked; a user with `HELP_COMMUNITY_MODERATE` hides, edits or closes posts and handles reports. `(advanced)`
- **FR-80** An agent converts a thread into an article draft (question as title, accepted answer as content, link back) or into a ticket for the asker. `(advanced)`
- **FR-81** Posts are sanitised and limited to 5 an hour per member. `(advanced)`

### 3.16 Rating recovery `(advanced)`

- **FR-82** A rating at or below the organization's threshold (default 2 stars) notifies the team lead, creates a follow-up task for them on the ticket and fires the automation trigger "low rating received". `(advanced)`

### 3.17 API, MCP, events

- **FR-83** The system exposes every capability through REST (GraphQL reads for articles and ratings), public read routes and feeds that help sites (Ever Works sites with their integration token included) and any other app use, public transaction routes (feedback, view beacon, assistant question, rating, guest follow-up), and portal routes for signed-in help and customer tickets.
- **FR-84** The system publishes events for article published, archived and changed, feedback given, rating received, deflection counted and gap opened, carrying ids only, so a help site can rebuild on change.
- **FR-85** MCP tools search articles (by audience), read an article, draft an article (draft only), list knowledge gaps, list ratings and read a ticket's rating, under the caller's permissions.
- **FR-86** The system registers help articles (as Documents pages) and ratings for saved views, reports and automation triggers (article published, not-helpful vote, rating received).

### 3.18 Reports

- **FR-87** The system adds these reports to the platform's report catalogue in the "Support" category for users with `HELP_CENTER_ANALYTICS_VIEW` (ratings for `HELPDESK_RATINGS_VIEW`), filterable by help space, language and period, listed only for tenants with `FEATURE_HELPDESK_PORTAL` on (with it off the catalogue and report menu show exactly today's entries):

  | Report | Content |
  |---|---|
  | Article performance | views, helpful share, feedback, citations, searches leading to each article |
  | Search analysis | per ticket subject, the article search would return and its score, and whether the ticket cited it |
  | Searches without results | queries, counts, trend, audience |
  | Deflection | suggestions shown, articles opened, "solved" answers, tickets raised after viewing |
  | Rating responses | requests sent, response rate, score distribution and options by channel |
  | Knowledge gaps | topics, volume, state, time to a published article |

## 4. Non-Functional Requirements

- **Performance**: public read API and feed answers under 150 ms at the 95th percentile and cacheable for guests (60 s,
  with validators); signed-in help and ticket pages first paint under 1.2 s; search under 300 ms at the 95th percentile
  at 50,000 articles per tenant; suggestions within 400 ms of a pause in typing; ticket list under 300 ms at 20,000
  tickets per customer; assistant answer within 8 s at the 95th percentile.
- **Volume**: 50,000 articles and 10 million searches a year per tenant; 2 million rating requests a year.
- **Security & privacy**: audiences enforced in every read; customer ticket data only through the ticket service's customer
  view; rating and follow-up links single-purpose and bound to one ticket; outside search addresses allow-listed,
  fetched without credentials and never to private networks unless the deployment allows; guests identified only by a
  hashed browser key. Leaving the platform: rating request emails, assistant prompts to the tenant's AI provider,
  queries to allowed outside sources, published everyone articles read by help sites.
- **Observability**: article lifecycle changes and setting changes audited; metrics for search latency, zero-result
  share, deflections, rating response rate, assistant cost.
- **Accessibility and localization**: signed-in help, ticket, rating and follow-up pages keyboard operable, headings
  navigable, new messages announced; strings, emails and synonyms per language.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted; without an embeddings provider,
  search falls back to the Documents word matching; without a help site the read API and feed still answer; OpenAPI
  additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Help space, category | The one space of the Documents hub an organization marks as its help centre; its folders as categories with slug, cap and pins; each article page carries its language |
| Article | A page of a help space with status, audience, slug, excerpt, pins, counters and variants |
| Article feedback, views | A reader's vote and daily view counts, kept by the Documents hub |
| Citation | A link between an article and a ticket that used it |
| Search log, synonym set, search source | A recorded search; words treated alike; a further place search looks |
| Former slug | An address an article or category had before, answered with its current one |
| Rating request, rating, rating option | The emailed ask with its rating link; the score with options and comment; the configured reasons |
| Knowledge gap | A topic of unanswered demand with its signals and state |
| Assistant answer | A visitor's question and the answer with sources |
| Community question, answer | A member's public question; the answers are its comments |

## 6. Out of Scope

- Tickets, statuses, channels, the web form, follow-up links, notices and the ticket service: `helpdesk-tickets`.
- Service-level figures, outside-hours mark, dashboards and the satisfaction report: `helpdesk-sla-routing-and-analytics`.
- Portal sign-in, accounts, members, roles, the menu and party switching: `customer-and-supplier-portal`.
- Organisations, people and their memberships: `crm-leads-and-deals`; organization branding: `organization-setup`.
- The Documents hub, wiki spaces, page versions, routes, feedback and view statistics: `documents-and-wiki` and the docs
  plugin; public help sites and their pages: Ever Works; hosted forms and the public-form defence:
  `lead-capture-and-enrichment`; agent drafts: `helpdesk-tickets`; agent definitions, runs and AI budgets:
  `ai-agents-and-assistants`; saved views: `record-views-and-search`.

## 7. Acceptance Criteria

- [ ] **AC-1** The read API and feed give a help site pinned and popular articles, categories and search; agents-only and
      customers-only articles never reach guests or an integration token in any list, search, suggestion, feed, Markdown
      twin or address; the existing articles arrive once in the organization's help space with the visibility they have
      today (none public), and the existing help-centre routes and page keep working (FR-2, FR-8, FR-9, FR-18).
- [ ] **AC-2** Publish, schedule, unpublish, archive and restore follow FR-20 and FR-21; a renamed slug keeps answering
      with the new address; a cited article asks before deletion; bulk actions report per article.
- [ ] **AC-3** Category merge, move and delete with summary to General behave as FR-15 to FR-17.
- [ ] **AC-4** Feedback and views count as FR-31 and FR-32 with limits; authors see FR-33 figures.
- [ ] **AC-5** Search ranks a title match first, applies synonyms, groups outside sources, survives a source timeout and
      rebuilds its index with progress (FR-34–FR-36).
- [ ] **AC-6** A customer raises a ticket with suggestions and template fields, deflects one, answers and reopens one,
      closes one as solved; an administrator sees company requests and figures; another customer's ticket answers `404` (FR-42, FR-46).
- [ ] **AC-7** A rating request goes once per resolution; a score chosen in the email records once the requester sends it from the rating page, and a link only opened records nothing; the rating is final and reaches the
      ticket, contact, agent figures and helpdesk dashboards (FR-52, FR-53).
- [ ] **AC-8** Organisation suggestions exclude public email domains; the bulk "company requests" action reports progress (FR-58, FR-63).
- [ ] **AC-9** An agent inserts an article and the citation appears on the article; an article drafted from a ticket links back (FR-64, FR-65).
- [ ] **AC-10** The assistant answers with sources from the reader's audience, refuses below the threshold and hands over
      with context (advanced: answer assistant; FR-67, FR-68).
- [ ] **AC-11** Seeded zero-result searches form a topic with a drafted article; publishing a matching article closes it
      (advanced: gaps; FR-71, FR-73).
- [ ] **AC-12** Editing a source flags its translations stale; a release picker shows the right variant (advanced:
      variants) (FR-74–FR-76).
- [ ] **AC-13** A community thread is answered, accepted and converted into an article draft (advanced: community; FR-78–FR-80).
- [ ] **AC-14** A two-star rating creates the team lead's task and fires the trigger (advanced: recovery; FR-82).
- [ ] **AC-15** The reports of FR-87 show the expected rows for a seeded tenant.
- [ ] **AC-16** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_HELPDESK_PORTAL`; the internal help
      centre unchanged while it is off; every functional requirement has a passing test (FR-1; §4).
- [ ] **AC-17** With `FEATURE_HELPDESK_PORTAL` off nothing changes: the help-centre routes, page and redirect, the
      Documents hub and the Reports page behave as today. With it on, an imported article is still edited through the
      existing help-centre routes (the change reaches its page, and a page change reaches the row), no legacy row is
      locked or altered by the import, a nested category keeps every level, and the other pages and folders of the
      marked space keep their rights and delete behaviour (FR-1, FR-2).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Existing articles keep today's visibility after they are carried into the Documents hub; nothing becomes public until a
  person chooses it. Default applied.
- Without a help site, the public help centre is the read API and feed only; no fallback pages are rendered. Default
  applied.
- A welcome ticket is created by the helpdesk setup assistant, not by the help centre seed. Default applied.
- Guest voting on, guest tickets off, ratings requested on entering done, recovery threshold 2 stars. Defaults applied.

## 9. Constitution Gates

- [x] I Plugin-first — extends the `docs` and `helpdesk` plugins and their UIs (the Documents hub and `helpdesk-ui`); the
      existing knowledge-base plugin only offers an export and keeps articles in step, its routes unchanged; no new
      plugin.
- [x] II Tenant/organization scoping — every article, vote, rating and log scoped; customer reads scoped to the session's party.
- [x] III Both ORMs, additive migrations — new columns and tables on three dialects; nothing dropped.
- [x] IV Default-off flag; nothing removed — `FEATURE_HELPDESK_PORTAL` and two sub-features; internal help centre unchanged.
- [x] V Contracts and API first — contracts, REST, public and portal routes before pages.
- [x] VI Permissions, privacy, security — new permissions, audiences in every read, sanitised content, allow-listed sources.
- [x] VII Real-time through the event bus — ticket pages live through the push channel; article events on the outbox.
- [x] VIII i18n and accessibility — per-language content, strings and emails; keyboard and screen-reader support.
- [x] IX Tests accompany the change — per requirement, audience contract tests, dialect and ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`documents-and-wiki`](../documents-and-wiki/spec.md), [`helpdesk-tickets`](../helpdesk-tickets/spec.md),
  [`helpdesk-sla-routing-and-analytics`](../helpdesk-sla-routing-and-analytics/spec.md),
  [`customer-and-supplier-portal`](../customer-and-supplier-portal/spec.md), [`record-views-and-search`](../record-views-and-search/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`automation-and-notifications`](../automation-and-notifications/spec.md)
- Code: `packages/plugins/docs/src/lib/{entities,knowledge,import}/`, `packages/plugins/knowledge-base/src/lib/`,
  `apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts`, `packages/core/src/lib/{shared-entity,comment,reaction}/`
