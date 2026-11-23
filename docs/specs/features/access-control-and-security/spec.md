# Feature Specification: Access control and security

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `access-control-and-security`
**Branch**: `feat/access-control-and-security`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_ADVANCED_ACCESS` (tenant feature, default off) · the plugin loads only when
`GAUZY_ADVANCED_ACCESS_ENABLED` is exactly `true` · record-level rules also behind `FEATURE_ACCESS_RECORD_RULES`,
directory sign-in and provisioning behind `FEATURE_ACCESS_DIRECTORY`, personal-data requests and retention behind
`FEATURE_ACCESS_PRIVACY` (all default off). With the flags off, sign-in, roles and permissions behave exactly as today.

---

## 1. Overview

Today a tenant has eight built-in roles and its own custom roles; each user holds one role (plus membership roles on
teams and projects), and a role is a set of permission switches seeded by migration. A developer can hide a property
from callers without a permission; "own, team or all" is hard-coded per module; only documents and saved reports can be
shared. People sign in with a password, an email code, social providers or, behind deployment flags, directory
providers; two-factor sign-in uses an authenticator app with recovery codes; tenants have API key pairs, personal tokens
behind a flag and OAuth applications; an activity log is written by explicit calls in some modules; a user can delete
their account and a tenant can export everything.

This feature completes access control **on the existing roles and permissions, never beside them**. **Role bundles** add
roles and permissions to a user's role and **access profiles** apply a whole set-up at once; administrators define
**field-level permissions** (hidden, masked, read-only) on any field and **record-level rules** (own, assigned, team,
reporting line, values, conditions) and **sharing** on any registered record type; every user has a **user type**
(internal, portal, agent). **Sign-in policies** enforce second factors, passwords, sessions, networks and hours;
tenants configure their own **identity providers** and **directory provisioning**; any feature can send **one-time
codes**; **API keys** carry scopes, expiry, networks and limits. A **complete audit trail** records changes, sign-ins,
exports, prints, access changes and reads of sensitive fields, and **personal-data export and erasure** work with
**retention rules** per record type. The feature owns the platform's one model for sharing records and reports, one
retention model that every feature registers its records and logs with, and one list of connected outside clients.
Clients: the Angular app (Settings → Security, share dialog, audit tab, my security), the sign-in pages, the MCP server,
the API and SDKs.

**Advanced capabilities.** A **permission simulator** answers "what can this person see and do, and why",
and every change shows **who gains or loses what** before it is saved. **Access reviews** run as campaigns with
reviewers and automatic revocation. The whole access set-up is **policy as code**: versioned, diffed, dry-run and
rolled back. **Just-in-time elevation** grants a bundle for hours with approval and expiry. **AI agents are first-class
principals** with a sponsor, scoped permissions, budgets and a kill switch. **Passkeys** sign people in without
passwords. **Anomaly alerts** flag unusual sign-ins and bulk exports. The audit trail is **tamper-evident**, and
**residency and retention policies** per record type govern where data is stored and which processors may receive it.
These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator, **when** they create the bundle "Accountant" (role Viewer plus invoice and expense permissions) and assign it to Ana, whose role is Employee, **then** within 5 seconds Ana's menus and API calls allow what both grant; removing it withdraws it as fast.
- **Given** a record rule on deals "Sales person: own or assigned; Sales manager: reporting line", **when** a sales person opens the deals list, **then** they see only their deals with exact counts and pages, and a manager sees their reports' deals; an administrator sees all.
- **Given** a field rule "cost price hidden for Sales person" on items and order lines, **then** the field is absent from lists, forms, exports, reports, print, search, API and MCP for that role, a filter on it answers `403`, and a write to it answers `403` naming the field.
- **Given** a contact Ana may read, **when** she shares it read-only with Ben until Friday, **then** Ben gets an inbox notice, reads it until Friday, and loses access afterwards; the contact's shares tab lists the share.
- **Given** a sign-in policy "administrators: second factor required, 7 days grace, passkey or authenticator app", **when** an administrator without a factor signs in on day 3, **then** they are asked to enroll and may postpone; **when** they sign in on day 8 still without a factor, **then** they must enroll before continuing; **when** they register a passkey, **then** later sign-ins need no password.
- **Given** a SAML identity provider for `acme.com` set to enforce, **when** a user types `ana@acme.com` on the sign-in page, **then** they are sent to the provider, created on first sign-in with the profile mapped from their groups, and can no longer use a password; **when** the directory deactivates her through provisioning, **then** her sessions and keys stop within a minute.
- **Given** a support engineer eligible for "Administrator (elevated)", **when** they request it for 2 hours with a reason and an approver approves, **then** it is active at once with a banner and remaining time, every action is marked elevated, and it ends by itself.
- **Given** an "Invoice chaser" agent principal with a collections bundle and a budget of 200 writes a day, **when** it reaches 160, **then** its sponsor is notified; at 200 its writes answer `429` naming the budget.
- **Given** an administrator who asks "why can Ben see invoice INV-042?", **then** the simulator answers "read: allowed — role Manager grants invoice view; record rule 'Finance team' matches through team Finance; field 'margin' hidden by field rule 'Margins'".
- **Given** an exported policy file with a changed record rule, **when** it is imported as a dry run, **then** the diff shows "37 users lose read on 1,204 contacts" and nothing changes until it is applied as version 12; applying version 11 again rolls it back.
- **Given** a quarterly review campaign, **when** managers confirm or revoke their reports' bundles and keys, **then** revocations apply at once, unanswered items are escalated at the due date, and a signed-off report is kept.
- **Given** a contact who asks for their data through the public form, **when** they confirm the emailed code, **then** a handler sees a preview, and the contact receives a package link valid 7 days; **given** an erasure request, **then** confirmed invoices are kept with the person's fields pseudonymized and everything else is anonymised or deleted with a step log.
- **Given** a user exporting 50,000 contacts at 03:00 from a new country, **then** security administrators and the user get an alert, and the policy can end the session or ask for a second factor.

### 2.2 Edge cases & failures

- **Given** a change that would leave no active user able to manage roles and policies, **then** it is refused naming the reason; break-glass accounts are exempt from directory enforcement and network lists.
- **Given** a record outside the reader's rules, **then** a read by id answers `404`; a record they can read but not edit answers `403` on write.
- **Given** two administrators editing the same rule, **then** the second save answers `409` with the current version.
- **Given** an elevation that expires during a request, **then** the request completes under the access it started with and the next one is refused.
- **Given** a one-time code guessed wrongly three times, **then** it is invalidated and new codes for that recipient wait for the rate window; the answer never reveals whether the recipient exists.
- **Given** a provisioning batch of 500 users where 3 fail, **then** 497 are applied and the 3 are reported with reasons.
- **Given** an identity provider that is down, **then** users of an enforced domain see "your sign-in provider is unavailable"; break-glass administrators can still sign in.
- **Given** an erasure request on a record under legal hold, **then** that record is kept, the step says why, and the request completes for the rest.
- **Given** a scoped key used for a route outside its scopes or from an address outside its list, **then** the call answers `403` and an audit event records it.
- **Given** the feature off after use, **then** bundles, rules, policies and shares stop applying at once, and roles, permissions and sign-in work as before the feature.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_ADVANCED_ACCESS_ENABLED` is exactly `true` and gates every route, GraphQL field, menu entry and MCP tool with `FEATURE_ADVANCED_ACCESS` (record rules also `FEATURE_ACCESS_RECORD_RULES`, directory `FEATURE_ACCESS_DIRECTORY`, privacy `FEATURE_ACCESS_PRIVACY`); off, they answer `404` and are hidden.
- **FR-2** The system keeps built-in and custom roles, per-role permissions, membership roles, seeded grants and every permission check unchanged; it only adds to a user's permissions (bundles, elevations) or narrows them (credential scopes, user type ceilings, agent principals) as this spec states.
- **FR-3** The system keeps password and email-code sign-in, social providers, the directory sign-in plugins, two-factor sign-in, the sessions list, tenant key pairs, personal tokens, OAuth applications, the activity log and account deletion working as today.
- **FR-4** The system stops applying bundles, rules, shares and policies at once when the feature is turned off, keeps their data inert, and never locks anyone out by being turned off.
- **FR-5** The system refuses any change made through this feature (bundles, profiles, rules, user types, sign-in policies, identity providers) that would leave a tenant without an active user able to manage roles and policies; the existing role, permission and user edits keep exactly today's checks.
- **FR-6** The system exposes every capability through REST with GraphQL reads, in the OpenAPI document.

### 3.2 Roles, bundles and profiles

- **FR-7** A user with `CHANGE_ROLES_PERMISSIONS` can describe and deactivate custom roles; deactivating a role still held as a user's role lists those users and, when the tenant setting `access.roles.refuseDeactivateInUse` is on, is refused while any hold it (off by default: the deactivation goes through after the list is shown); the existing role routes keep today's create, update and delete behaviour, and built-in roles cannot be deleted, as today.
- **FR-8** The system shows for each role its users, bundles, profiles, field and record rules, page gates, invitations and keys that reference it.
- **FR-9** A user with `CHANGE_ROLES_PERMISSIONS` can edit permissions as a matrix per record type (rows: roles and bundles; columns: view, create, edit, delete, approve, print, export, import, share), each cell switching the permissions the type's registration maps to it; every change is audited with before and after.
- **FR-10** A user with `CHANGE_ROLES_PERMISSIONS` can reset a role to the permissions the platform and its plugins ship for it, after a preview of the difference.
- **FR-11** A user with `ACCESS_BUNDLES_MANAGE` can define custom permission keys (name and description per language) that form actions, workflow transitions, field rules, record rules, page gates and report sharing can require; reserved and existing names are refused.
- **FR-12** A user with `ACCESS_BUNDLES_MANAGE` can define role bundles (roles plus extra permissions) and assign them to users for the tenant or one organization, with an optional validity window; a user's permissions are the union of their role and their active bundles, effective within 5 seconds.
- **FR-13** A user with `ACCESS_BUNDLES_MANAGE` can disable a bundle, which withdraws it from every holder at once, and mark a bundle "eligible only" so it is held only through elevation.
- **FR-14** A user with `ACCESS_PROFILES_MANAGE` can define access profiles: user type, role, bundles, organizations and teams, page gates, sign-in policy and default language and time zone, applied at invitation, at provisioning and to chosen users after a preview; a profile's landing page and menu arrangement are its layer of the navigation layout of `platform-administration`.
- **FR-15** The system applies a changed profile to the users linked to it after a preview of who gains or loses which permissions; unlinking a user keeps their current set-up.
- **FR-16** A user with `ACCESS_PROFILES_MANAGE` can set per role or profile which roles, bundles and profiles its holders may grant in invitations and user edits; without a setting today's rule applies (own level or lower).
- **FR-17** A user with `ACCESS_PROFILES_MANAGE` can hide areas and pages of the apps per role, bundle, profile or user type; hiding never grants or removes record access, and a link to a hidden page shows "not available".
- **FR-18** A user with `ACCESS_PROFILES_MANAGE` can restrict a role to email domains or identity providers; landing pages per role or profile are set in the navigation layout of `platform-administration`, which never lands a user on a page hidden from them (FR-17).
- **FR-19** The system lets features and regional packs ship role bundle templates (accountant, sales person, sales manager, tax auditor and others) that a tenant installs on demand without changing its roles.
- **FR-20** The system answers each user's effective access (permissions, user type, gates, elevation, administrator and manager flags) through one route that every client uses to show or hide features.
- **FR-21** A user with `ORG_USERS_EDIT` can deactivate a user (the user's existing active switch; sessions and keys end at once), force a password change at next sign-in and set language and time zone, with profile defaults applied to new users.

### 3.3 Field-level permissions

- **FR-22** A user with `ACCESS_FIELD_RULES_MANAGE` can set, on any standard or custom field of a registered record type and for audiences (roles, bundles, profiles, user types, users), the access hidden, masked, read-only or editable, optionally only when a condition on the record holds.
- **FR-23** The system leaves a hidden field out of every surface (forms, lists, exports, reports, print, search snippets, timelines, REST, GraphQL, MCP and webhooks of the user's credentials) and refuses filters and sorts on it with `403`.
- **FR-24** The system shows a masked field as present with its value replaced (fully or keeping a declared part, such as the last four characters); a user with the reveal right sees it on demand and the read is audited.
- **FR-25** The system refuses a write to a read-only field with `403` naming the field, and forms show it read-only.
- **FR-26** The system applies the most restrictive of field rules, permission-gated properties and custom field permissions; line fields follow the rules of their document.
- **FR-27** A user with `ACCESS_FIELD_RULES_MANAGE` can mark fields of any type as sensitive; every read of a sensitive field (detail, reveal, export column, print) is audited.

### 3.4 Record-level rules

- **FR-28** A user with `ACCESS_RECORD_RULES_MANAGE` can define rules on any record type whose registration supports them, each with an audience, rights (read, edit, delete, print, export, share) and a scope: own, assigned, team (records owned by or assigned to members of the user's teams or projects), reporting line, organization, values of a field (with tree descendants), a condition on the record, or all.
- **FR-29** The system restricts a type for an audience once it has a rule for it: members see only records matched by at least one of their rules; types without rules behave as today; super admins and administrators are exempt unless the rule applies to them.
- **FR-30** A user with `ACCESS_RECORD_RULES_MANAGE` can restrict a user to values of a master record (a warehouse, department, project, customer segment), applying to every record type that references it or to chosen types, with options to include descendants, to show records where the value is empty, and to pre-fill the value on new records.
- **FR-31** The system applies rules in the database query of lists, counts, totals, detail reads, exports, reports, print, search, reference pickers, timelines, GraphQL and MCP, so pages and counts stay exact; a reference picker may offer records the user can only select, without reading them, when the rule grants "select".
- **FR-32** The system answers `404` for a record the reader's rules exclude and `403` for an action the rules do not grant on a record they can read.
- **FR-33** The system uses the reporting line from HR records when they exist and the managers of the user's teams otherwise.
- **FR-34** The system lists the types that do not support rules and refuses rules on them; rule changes reach every server within 5 seconds.

### 3.5 Sharing and web-view links

- **FR-35** A user with `ACCESS_RECORD_SHARE` and the share right on a record can share it with users, teams or roles for read, edit or read and re-share, with an optional expiry and message; recipients get an inbox notice. This is the one way records are shared with people, teams and roles: report definitions and dashboards of `report-builder-and-dashboards` are shared the same way.
- **FR-36** The system adds shares to the rules and to the record scope the recipient's permissions give (such as seeing only one's own records or no private projects), so a shared record becomes readable to its recipient; a share stays within the tenant, the organizations the recipient belongs to and the portal ceiling (FR-41, FR-42), never grants more than the sharer holds, applies field rules to shared records, and ends at its expiry.
- **FR-37** A user with `ACCESS_PROFILES_MANAGE` can switch sharing off per tenant or per record type; each record lists its shares and its owner or a user with the share right can revoke them.
- **FR-38** A user with `ACCESS_PUBLIC_LINKS_CREATE` can create a signed read-only link to a record that works without sign-in, with an optional expiry (the dialog proposes 14 days; a link without expiry stays possible as today unless the tenant sets a maximum, a setting that is off by default), revocable, optionally requiring an emailed code for a named recipient, with view count and last view; it shows only the fields the type marks public, never more than the creator can read. These links are the platform's existing public record links, which gain optional expiry, revocation, codes and view counts; links created before keep working with their stored token unchanged (only links created with the feature on also store a token hash), the existing ways of creating a link keep today's permission checks and options, and a link's author and the organization's managers can copy it again as today.
- **FR-39** The system renders a web-view link with the record type's portal template when print templates are loaded, otherwise a read-only field layout, and lists the existing invoice, estimate and saved-report links in the same link register without changing them.

### 3.6 User types and portal users

- **FR-40** The system gives every user a type: internal (every existing user), portal (people of a customer or supplier) or agent (an AI agent); a user with `ACCESS_USER_TYPES_MANAGE` can change it, which ends the user's sessions.
- **FR-41** The system binds each portal user to a party and limits them to the portal role's rights on that party's records; no role, bundle, rule or share takes them beyond it, and internal routes answer `403`.
- **FR-42** A user with `ACCESS_USER_TYPES_MANAGE` can set for portal and agent users the record types and rights possible at all (a ceiling), checked before roles and rules.
- **FR-43** The system sends invitations with an access profile and user type, binds a portal invitation to its party, and refuses a profile the inviter may not grant.

### 3.7 Sign-in policies

- **FR-44** A user with `ACCESS_SIGN_IN_POLICIES_MANAGE` can set sign-in policies for the tenant with overrides per organization, profile, role or user type: allowed methods, second factor (off, optional, required with grace days) and allowed factors, password rules, lockout, sessions, networks and sign-in hours; the most specific policy applies. An organization's existing "require two-factor" switch stays in force: a policy can require a second factor where the switch is off, never make it optional where it is on.
- **FR-45** The system asks a user subject to a required second factor to enroll at each sign-in during the grace period (counted from the first sign-in at which the requirement applies to them) and lets them postpone enrollment until it ends; once the grace period has ended, it lets them continue only after enrolling.
- **FR-46** A user can register passkeys (built-in or external authenticators), name and remove them, and use one as second factor or to sign in without a password when the policy allows; an administrator can remove a user's passkeys. `(advanced)`
- **FR-47** The system offers email codes and, when a text message channel exists, text codes as second factors, alongside the authenticator app and recovery codes of today.
- **FR-48** The system asks for a fresh second factor (within 10 minutes) before role, bundle, rule and policy changes, key creation, exports above the policy's row threshold, privacy approvals, elevation approvals and impersonation, for the users whose sign-in policy turns this step-up on (off by default; impersonation always asks for it, FR-79); without it these actions work as today.
- **FR-49** The system can let a user skip the second factor on a device for a set number of days when the policy allows it (default off).
- **FR-50** The system enforces the password rules a policy sets: minimum length (8 to 128, default 8 as today), optional character classes, refusal of commonly used passwords from a list shipped with the platform and of passwords containing the user's name or email, reuse of the last N, expiry after N days (default none), and signing out every session after a change; each rule beyond the length is off until the policy turns it on, and without a policy today's password rules apply.
- **FR-51** The system lets the policy set account lockout (failures, window, block time) as the parameters of today's attempt limiting, which keeps counting failures, reset-link validity and requests per hour, and sign-ups per hour per network address.
- **FR-52** The system enforces idle timeout, absolute session lifetime and at most N concurrent sessions (signing out the oldest or refusing the new one) when a policy sets them; without one, sessions last as today; users list and end their sessions as today, and administrators end a user's sessions.
- **FR-53** The system refuses sign-in and token refresh from outside a policy's network allow-list (IPv4 and IPv6 ranges), or asks for a second factor there when the policy says so, and outside its sign-in hours in the organization's time zone.
- **FR-54** The system tells a refused user in general terms what their organization requires and records the detailed reason in the audit trail.

### 3.8 Social, identity providers and directories

- **FR-55** The sign-in page offers only the methods and providers the tenant allows, and after the email is typed sends users of a domain bound to an identity provider there.
- **FR-56** A user with `ACCESS_IDENTITY_PROVIDERS_MANAGE` can choose which social providers of the platform the tenant offers, whether each may create accounts, and whether an account is linked by verified email; until a choice is saved, every sign-in method and provider of today is offered and behaves as today.
- **FR-57** A user with `ACCESS_IDENTITY_PROVIDERS_MANAGE` can configure OpenID Connect and SAML 2.0 providers per tenant (metadata, certificates, attribute mapping for email, names, phone, department and groups), bind them to email domains and enforce them, which turns password and email code off for those domains except for break-glass accounts.
- **FR-58** The system creates a user at first sign-in through a provider with the profile mapped from their groups, or only signs in existing users when the provider says so, and on every sign-in adds and removes the bundles its group mapping manages without touching others.
- **FR-59** The system offers a SCIM 2.0 provisioning endpoint per provider with its own token for users and groups; deactivation or deletion deactivates the user and ends sessions and keys within a minute; each batch reports results per operation.
- **FR-60** With directory sign-in, a self-hosted tenant can authenticate against an LDAP directory over TLS (search base and filter, attribute and group mapping) and sync it hourly to create, update and deactivate users, or sign in existing users only.
- **FR-61** The system keeps the deployment-wide directory plugins working; a tenant's own provider wins for its domains. Where tenants sign in through Ever ID, a company's identity provider is configured once in Ever Platform's company sign-in and this feature maps the identity it receives; tenant providers of this feature serve installations without Ever ID. A user linked through a social provider and a tenant provider is one user.
- **FR-62** A user with `ACCESS_IDENTITY_PROVIDERS_MANAGE` can test a connection and a sign-in, and read each sync's counts and errors; a sync carries on past failed entries.

### 3.9 One-time codes

- **FR-63** The system lets any feature issue a one-time code for a purpose and a recipient (email address or phone number) with a length of 6 to 8 digits (default 6), a validity (default 10 minutes), a maximum of attempts (default 3) and a message per purpose and language.
- **FR-64** The system stores only a keyed hash of each code, takes the same time to answer right and wrong codes, invalidates a recipient's pending codes of the same purpose when a new one is issued, and consumes a code on success.
- **FR-65** The system limits codes per recipient, purpose, network address and tenant (default 5 per recipient per hour, 100 per tenant per minute), answering `429` with the retry time and never revealing whether a recipient exists.
- **FR-66** The system sends codes by email, by text message when a text channel exists, and offers to guests only purposes declared public (portal sign-in, privacy requests, protected links); the existing email sign-in code, email change code, invitation codes and team join codes keep their own flows, and every kind of code shares today's attempt limiting.

### 3.10 API keys and applications

- **FR-67** Every user keeps creating personal API keys (the platform's existing personal tokens) for themselves as today, without a permission and with today's expiry choices (90 days, one year or never); a user with `ACCESS_API_KEYS_OWN` can add to their own keys, and a user with `ACCESS_API_KEYS_MANAGE` can create keys for any user or agent principal, with scopes (permissions chosen by record type and right, or read-only), organizations, a network allow-list and a rate per minute; the secret is shown once. A tenant setting (off by default) can require an expiry and set a maximum (for example 365 days) for keys created after it is turned on.
- **FR-68** The system never lets a key exceed its owner's current access: narrowing the owner narrows the key, and deactivating the owner stops it.
- **FR-69** The system rotates a key with an overlap window (default 24 hours), shows last use, address and count, revokes at once, warns the owner 14 and 3 days before expiry, and answers `429` over the key's rate.
- **FR-70** A user with `ACCESS_API_KEYS_MANAGE` can attach scopes, organizations, networks and rates to existing tenant key pairs and personal tokens; the personal token deployment flag keeps its meaning.
- **FR-71** A user with `ACCESS_API_KEYS_MANAGE` can limit an OAuth application to user types, roles and organizations and set its consent policy; each user sees in one list the applications they granted access to and the MCP clients connected in their name, and revokes them; this list is the platform's only register of connected outside clients.

### 3.11 Agents as principals `(advanced)`

- **FR-72** A user with `ACCESS_AGENTS_MANAGE` can make an agent principal: the user of an agent employee (type agent), whose manager on the agent's existing profile is the sponsor accountable for it, with a role and bundles, rules like any user and an expiry; it cannot sign in interactively and acts only through scoped keys or application credentials. `(advanced)`
- **FR-73** The system enforces the budgets `ai-agents-and-assistants` keeps for each agent: requests per minute, writes per day, records per bulk action, exported rows per day and documents confirmed per day; over budget answers `429` naming it, and the sponsor is notified at 80 % and 100 %. Without that feature an agent principal has no budget. `(advanced)`
- **FR-74** The system sends an agent's deletes, confirmations above an amount, access changes and exports above a threshold to a person's approval as an elevation request unless its bundle grants them explicitly. `(advanced)`
- **FR-75** The sponsor or a user with `ACCESS_AGENTS_MANAGE` can suspend an agent principal at once (keys stop, running calls are refused) and lists agents with usage against budgets. `(advanced)`

### 3.12 Elevation and impersonation

- **FR-76** A user with `ACCESS_ELEVATION_REQUEST` can request a bundle they are eligible for, for a duration up to the bundle's maximum (default 4 hours), with a reason and optional ticket reference. `(advanced)`
- **FR-77** The system sends the request to the approval engine when loaded (else to holders of `ACCESS_ELEVATION_APPROVE`) through their inbox, never lets requesters approve their own request, activates an approved elevation at once with a banner showing remaining time, lets the holder end it early and ends it by itself. `(advanced)`
- **FR-78** The system marks every action taken during an elevation with the elevation in the audit trail. `(advanced)`
- **FR-79** A user with `ACCESS_IMPERSONATE` can, after a fresh second factor and a reason, act as a user of lower rank of the same tenant for at most 60 minutes, read-only unless write mode is approved, under a visible banner; the target is notified when the tenant says so; super admins and holders of `ACCESS_IMPERSONATE` cannot be impersonated.
- **FR-80** The system records impersonated actions as "actor as target" and designates break-glass accounts (passkey required, exempt from enforcement and network lists) whose every use alerts all administrators.

### 3.13 Audit trail

- **FR-81** The system records audit events for sign-in and sign-out (success, failure and reason, method, factor, address, device), session ends, password and factor changes, every role, permission, bundle, profile, rule, share, link and policy change with before and after, credential creation, first use from a new address, rotation and revocation, elevations, impersonation, exports and report downloads (filters, columns, rows), prints, private file downloads, reads of sensitive fields, privacy requests and directory syncs.
- **FR-82** For tenants with the feature on, the system records creates, updates (fields before and after) and deletes in the platform's activity log for every registered record type that does not write it yet, so every type has one history; types that already write it keep doing so unchanged, and the audit reads the activity log beside its own events.
- **FR-83** A user with `ACCESS_AUDIT_VIEW` can search the audit across records by time, actor (person, agent, system, impersonator), category, record type, record, organization and address, open before and after, and with `ACCESS_AUDIT_EXPORT` export the result as CSV.
- **FR-84** The system gives each record an audit tab (changes, shares, links, sensitive reads, prints, exports that included it) and compares the record between two moments field by field.
- **FR-85** Each user can read their own sign-in history, active sessions and the applications they granted.
- **FR-86** A user with `ACCESS_AUDIT_VIEW` can turn on the platform's request log per key, application or agent (route, status, duration, never bodies), sampled or full, for at most 30 days at a time.
- **FR-87** The system keeps audit events append-only, deletes them only by retention (defaults for the events this feature writes: sign-in and request logs 180 days, sensitive reads 3 years, access, elevation and privacy events 7 years, each changeable as a kind of FR-98), and suspends deletion under a legal hold. Activity log entries and request log entries that the platform writes today are kept as today, without a time limit, unless a user with `PRIVACY_POLICIES_MANAGE` sets a retention policy for them. Exports, prints, report runs and deliveries keep their details in their own feature's log; the audit records one event per entry and shows the details from that log.
- **FR-88** The system seals each day's events with a fingerprint chained to the previous day and reports any altered or missing event; events removed by retention (FR-87) are removed per sealed day, category and organization, recorded, and reported as removed by retention rather than missing, so the seal still verifies; exports carry the seal proofs. `(advanced)`
- **FR-89** The system can stream audit events to the tenant's webhook or storage target through the integration hub.
- **FR-90** The system raises alerts to holders of `ACCESS_SECURITY_ALERTS_VIEW` and to the user for sign-ins from a new country or an impossible journey, bursts of failures, exports or downloads far above the user's usual volume (default ten times), mass deletes and sign-ins outside hours, and can end the session or ask for a second factor when the policy says so. `(advanced)`

### 3.14 Personal data, retention and files

- **FR-91** The system keeps a registry where each feature declares where personal data of a subject (user, employee, contact person, candidate, supplier contact) lives, how to find, export, anonymise and delete it, and what it must keep by law; this feature declares the platform's own types.
- **FR-92** A user can request a copy of their data from their profile; a contact person or candidate can through a public form confirmed by a one-time code; a user with `PRIVACY_REQUESTS_MANAGE` can file a request for someone.
- **FR-93** The system delivers a data copy as a package of machine-readable files per record type with a readable summary and the subject's own files, by a link valid 7 days.
- **FR-94** The system verifies an erasure request, shows a handler a preview of every record found with its action (delete, anonymise, keep with reason), sends it for approval (approval engine when loaded, else `PRIVACY_REQUESTS_MANAGE`), deactivates the subject's account first and executes in logged steps.
- **FR-95** The system keeps records under legal retention (confirmed invoices, payroll, tax records) with the subject's fields pseudonymized, and anonymises or deletes the rest as declared; a legal hold keeps a record whatever the request.
- **FR-96** The system gives each request a due date (default 30 days), reminds handlers 7 and 2 days before, reports overdue requests and notifies the requester at completion.
- **FR-97** The system keeps the existing self-service account deletion working as today; a tenant setting (off by default) turns it into an erasure request handled through FR-94 when privacy is on; account deletion requests are listed in the privacy request queue either way, so erasure requests have one queue.
- **FR-98** A user with `PRIVACY_POLICIES_MANAGE` can set retention per record type, log kind and organization (keep for a period after an anchor such as creation, closing, end of employment or last activity, then delete, anonymise, archive or purge), see a dry run of counts per action, and place legal holds on records or types; policies run daily. This is the platform's one retention model: every feature declares the records and logs it keeps with a default period (the recycle bin, report runs, job, error and health logs, communication bodies and events, AI runs, audit categories), one daily run applies them and respects legal holds, and without a policy the declared default applies. Records and logs the platform keeps today (soft-deleted records, the activity log, the request log) are declared with the default "keep as today": nothing of them is deleted, anonymised or archived until a user with `PRIVACY_POLICIES_MANAGE` sets a policy for them after its dry run.
- **FR-99** A user with `PRIVACY_POLICIES_MANAGE` can set per record type where its files are stored and which regions the processors receiving its data may be in (AI providers, email providers, integrations, webhooks); a send outside them is refused or reduced to the permitted fields, and logged. `(advanced)`
- **FR-100** A user with `ACCESS_SECURITY_SETTINGS_MANAGE` can narrow the allowed upload types and sizes within the platform's safe list, strip image metadata, choose which record types accept uploads from portal users and guests, who may make files public, keep files private by default and protect attachments of confirmed documents from deletion; each of these settings starts at today's behaviour, so uploads, public files and attachment deletion work as today until it is changed.
- **FR-101** A user with `ACCESS_SECURITY_SETTINGS_MANAGE` (on cloud, the operator) can publish the instance's security contact file at the standard well-known address with contacts, policy link, languages and expiry.

### 3.15 Simulator, reviews and policies as code `(advanced)`

- **FR-102** A user with `ACCESS_SIMULATE` can choose a person, or a combination of user type, role, bundles and profile, and optionally a record, and see for each right on a record type or record whether it is allowed and why: role, bundle, elevation, ceiling, rule matched or missing, share, field rules, key scope and sign-in policy. `(advanced)`
- **FR-103** The system shows, before a role, bundle, profile, field rule, record rule or policy change is saved, which users gain or lose which rights and how many records per type become visible or hidden. `(advanced)`
- **FR-104** A user with `ACCESS_REVIEWS_MANAGE` can run review campaigns over organizations, roles, bundles, keys and agent principals, with reviewers (each user's manager, bundle owners or named people) and a due date; reviewers keep or revoke each item with a comment; revocations apply at once, unanswered items are escalated and revoked at the due date when the campaign says so, and a signed-off report is kept. `(advanced)`
- **FR-105** A user with `ACCESS_POLICIES_MANAGE` can export the tenant's access set-up (role permissions, bundles, profiles, field and record rules, gates, sign-in policies) as a versioned file, import a file as a dry run that shows the diff and its impact, apply it as a new version with a note, and roll back by applying an earlier version. `(advanced)`
- **FR-106** The system offers MCP tools to read one's access, simulate, explain a refusal, request elevation, list one's review items and read a record's audit, under the caller's permissions; access changes are not offered to agent principals. `(advanced)`
- **FR-107** The system pushes a change of a user's access to their open clients within 5 seconds (menus and pages refresh) and alerts to security administrators in real time. `(advanced)`

### 3.16 Reports

- **FR-108** The system produces these reports for users with `ACCESS_AUDIT_VIEW`, filterable by organization and period, exportable as CSV:

  | Report | Content |
  |---|---|
  | Permitted records | per user and record type, the count and list of records they can read and why |
  | Rights matrix | users × record types × rights, with the source of each right |
  | Privileged access | who holds administrator-level permissions, through which role, bundle or elevation |
  | Sharing and links | live shares and web-view links with owner, audience, rights, expiry and views |
  | Sign-ins | successes, failures, methods, factors, countries and alerts per period |
  | Dormant accounts and keys | users and keys unused for 90 days, keys near expiry |
  | Privacy requests | requests with state, due date, handler and outcome |

## 4. Non-Functional Requirements

- **Performance**: resolving a user's effective permissions adds under 2 ms at the 95th percentile (cached, refreshed within 5 s of a change); record rules add at most 20 % to a list query at one million records with the documented indexes; policy checks add under 100 ms to a sign-in; the simulator answers a person and type in under 1 s.
- **Reliability**: no change or outage of an identity provider can lock out break-glass accounts; provisioning and retention runs resume; audit writes never fail the action they record (they are written with it or retried from the outbox).
- **Security & privacy**: secrets of providers encrypted at rest, codes and tokens hashed, signatures and replays checked, network metadata fetched only from allowed addresses. Leaving the platform: codes by email and text, provisioning answers to the tenant's directory, audit streams to the tenant's target, data copies to the verified subject.
- **Observability**: every access-relevant change and refusal audited; metrics for sign-in outcomes, refusals per rule, code sends and failures, provisioning results, alert counts.
- **Accessibility and localization**: matrix, rule builders and simulator keyboard operable and screen-reader labelled; every message and code template per language.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted (LDAP and private networks on self-hosted); OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Role bundle, bundle assignment | Roles and permissions added to a user's role, held for a tenant or organization and a period |
| Access profile | A named set-up (user type, role, bundles, organizations, gates, policy, defaults) applied to users |
| Custom permission | A permission key a tenant defines for its own rules and actions |
| User type | Internal, portal or agent, with its ceiling |
| Field rule | Hidden, masked, read-only or editable access to a field for an audience |
| Record rule, user restriction | Which records of a type an audience may read or change; a user's limitation to values of a master |
| Record share, web-view link | A record granted to people, teams or roles; a signed read-only link to it |
| Sign-in policy | Methods, factors, passwords, lockout, sessions, networks and hours for an audience |
| Passkey | A registered authenticator of a user |
| Identity provider, directory sync | A tenant's OpenID Connect, SAML or LDAP source and its provisioning runs |
| One-time code | A short-lived code for a purpose and recipient |
| Credential policy | Scopes, organizations, networks, rate and expiry of a key or application |
| Agent principal | An agent's identity with sponsor, permissions and budgets |
| Elevation, impersonation | A time-boxed approved bundle; acting as another user |
| Audit event, daily seal | One recorded fact; the chained fingerprint of a day |
| Security alert | An anomaly raised for review |
| Review campaign, review item | A recertification run and each decision in it |
| Policy version | A versioned snapshot of the access set-up |
| Privacy request, retention policy, legal hold, residency policy | Data copy or erasure for a subject; keeping rules per type; a stop on deletion; where data may live and go |

## 6. Out of Scope

- Portal pages, menus and the party's document lists: `customer-and-supplier-portal` (it uses user types, codes and ceilings from this spec).
- Invitation pages, setup wizard and onboarding: `platform-administration` (invitations carry profiles from this spec).
- Webhook transport and connected accounts: `integration-hub`; text message transport: `email-and-communications`.
- Agent definitions, tools, knowledge, agent budgets and AI cost limits: `ai-agents-and-assistants`.
- Report definitions and dashboards themselves: `report-builder-and-dashboards` (it applies the rules and field rules of this spec and shares through FR-35).
- Menu arrangement, landing pages and the usage counting store: `platform-administration` (its menus never show a page FR-17 hides).
- HR's own sensitive access log and personal data groups: `hr-core-lifecycle` (read by the audit and registered for privacy here).

## 7. Acceptance Criteria

- [ ] **AC-1** A bundle and a profile give a user the union of permissions within 5 seconds; disabling the bundle withdraws it; with `access.roles.refuseDeactivateInUse` on, deactivating a role in use is refused, and with it off (the default) the holders are listed and the deactivation goes through; the last role manager cannot be removed (FR-7, FR-12, FR-13, FR-15).
- [ ] **AC-2** The matrix switches the right permissions, logs before and after, and resets a role with a preview (FR-9, FR-10).
- [ ] **AC-3** A hidden field is absent on every surface; a masked field reveals with an audited read; a read-only field refuses writes (FR-22, FR-23, FR-25, FR-27).
- [ ] **AC-4** Own, team, reporting-line, values and condition rules return exact pages and counts on PostgreSQL, MySQL and SQLite; an excluded record answers `404` (FR-28, FR-31, FR-33).
- [ ] **AC-5** A share and a web-view link work until expiry and revocation and never show more than the creator may read (FR-35–FR-38).
- [ ] **AC-6** A portal user reaches only their party's records within the ceiling (FR-41, FR-42).
- [ ] **AC-7** Second-factor enforcement with grace, password rules, lockout, session limits, networks and hours behave as set; refusals are explained and audited (FR-44, FR-50, FR-51).
- [ ] **AC-8** OpenID Connect and SAML sign-in with domain discovery, group mapping and enforcement; SCIM deactivation ends sessions within a minute; LDAP sync on a self-hosted test directory (FR-57–FR-60).
- [ ] **AC-9** One-time codes honour length, validity, attempts, invalidation and rate limits with equal-time answers (FR-63, FR-64, FR-66).
- [ ] **AC-10** A scoped key is refused outside its scopes, organizations and networks, rotates with overlap and never exceeds its owner (FR-68–FR-70).
- [ ] **AC-11** The audit explorer finds sign-ins, changes, exports, prints and sensitive reads; daily seals detect an altered row (advanced: tamper evidence; FR-84, FR-88).
- [ ] **AC-12** A data copy and an erasure run end to end with legal retention respected and a step log; retention dry run and run agree (FR-92, FR-95, FR-98).
- [ ] **AC-13** The simulator explains an allowed and a refused read, and a rule change previews its impact (advanced: simulator; FR-102, FR-103).
- [ ] **AC-14** A review campaign revokes on decision and at the due date and keeps its report (advanced: access reviews; FR-104).
- [ ] **AC-15** A policy file round-trips, dry-runs with impact, applies as a version and rolls back (advanced: policies as code; FR-105).
- [ ] **AC-16** An elevation is approved, active, marked in the audit and expires (advanced: just-in-time access; FR-76–FR-78).
- [ ] **AC-17** An agent principal hits its budget, needs approval for a delete and stops when suspended (advanced: agents as principals; FR-73–FR-75).
- [ ] **AC-18** A passkey signs a user in without a password; an export ten times the usual raises an alert (advanced: passkeys, anomalies; FR-46, FR-90).
- [ ] **AC-19** A residency policy refuses a send to a processor outside the allowed regions (advanced: residency; FR-99).
- [ ] **AC-20** The reports of FR-108 show the expected rows for a seeded tenant.
- [ ] **AC-21** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_ADVANCED_ACCESS`; nothing changes while the flag is off; every functional requirement has a passing test (FR-1; §4).
- [ ] **AC-22** With the feature on and no policy, rule or setting saved, sign-in, password rules, sessions, personal tokens (including tokens that never expire), public links (copy again, no expiry), self-service account deletion and the activity and request logs behave exactly as today, and no existing record or log entry is deleted by the retention runner (FR-3, FR-87, FR-97).
- [ ] **AC-23** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Administrators exempt from record rules by default: proposed default yes, per rule "applies to administrators".
- Text codes need a text channel: proposed default, offered only when `email-and-communications` provides one; no SMS provider code in this feature.
- LDAP on cloud tenants: proposed default, self-hosted only; cloud tenants use SAML, OpenID Connect and SCIM.
- Unanswered review items at the due date: proposed default, escalate and keep; revoke only when the campaign says so.
- Impersonation target notice: proposed default on.
- Audit retention defaults (FR-87): proposed as stated; regional packs may lengthen them.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `advanced-access`; core gains optional slots (authorization state, list-query scope, field policy, sign-in policy, upload policy, audit sink) and builds on its public links, activity log, personal tokens, social accounts and request log.
- [x] II Tenant/organization scoping — every table scoped; rules narrow inside the tenant and organization filters, never replace them.
- [x] III Both ORMs, additive migrations — plugin migrations on three dialects; core tables gain nullable columns only.
- [x] IV Default-off flag; nothing removed — deploy switch plus tenant features; roles, permissions and sign-in unchanged when off.
- [x] V Contracts and API first — contracts, REST, GraphQL reads, SCIM and the in-process ports before UI.
- [x] VI Permissions, privacy, security — 24 new keys, step-up, hashed codes and tokens, encrypted provider secrets, audit.
- [x] VII Real-time through the event bus — outbox events and realtime hints for access refresh and alerts.
- [x] VIII i18n and accessibility — messages and templates per language; keyboard rule builders and simulator.
- [x] IX Tests accompany the change — unit, dialect, ORM parity, e2e per surface, protocol conformance tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md) (record type registry, list-query hook, field metadata), [`record-views-and-search`](../record-views-and-search/spec.md), [`approval-workflows`](../approval-workflows/spec.md), [`business-document-engine`](../business-document-engine/spec.md)
- Used by: [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md), [`accounting-foundation`](../accounting-foundation/spec.md), [`organization-setup`](../organization-setup/spec.md), [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md), `customer-and-supplier-portal`
- Code: `packages/core/src/lib/role/`, `role-permission/`, `api/visible-with.decorator.ts`, `api/field-visibility.service.ts`, `auth/` (`two-factor/`, `user-session/`, `user-api-token/`, `oauth-client/`, `social-account/`, `login-attempt.service.ts`), `tenant-api-key/`, `shared-entity/`, `activity-log/`, `api-call-log/`, `account-deletion/`, `invite/`, `core/file-storage/helpers/upload-security.ts`
