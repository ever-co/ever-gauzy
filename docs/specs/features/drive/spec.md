# Feature Specification: Drive (files and folders of the Documents hub)

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `drive`
**Branch**: `feat/drive`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_DRIVE` (tenant feature, default off; requires `FEATURE_DOCUMENTS`). Public links and network-drive access additionally need the deployment switches `GAUZY_DRIVE_PUBLIC_LINKS_ENABLED` and `GAUZY_DRIVE_WEBDAV_ENABLED` (each off unless exactly `true`).

---

## 1. Overview

The Documents hub already keeps an organization's files, folders and pages in **one tree**: files are uploaded by drag and drop with progress and a content-type check, moved, renamed, replaced, previewed (PDF, images, video, audio, text, office formats as extracted text), shared with people and teams at view, comment or edit, linked to business records, searched by name and content, favorited, archived and recovered, and fed to the AI knowledge pipeline with OCR and a human review step. This feature completes the hub as the platform's **drive**, for the Angular app, Ever Teams (same API, its screens in the Ever Teams spec `workspace-collaboration-clients`), the MCP server and the SDKs: resumable and folder uploads, link items, inherited folder sharing with upload and manage levels, guests and **public links** (password, expiry, download limits, file requests), **file versions**, a **trash** that lists what was archived (archive stays the way into the trash, and deleting stays possible only from it) with delete forever and purge, server-side recents and a home view, quotas per person and per team space with reservations, files panels on every record, zip downloads, a network-drive endpoint, and a port through which editor apps (sheets, slides) register their file kinds. Files, folders and pages remain rows of the same documents tree with one sharing model, one versions model and one trash: `documents-and-wiki` owns what pages do, this spec owns what files and folders do.

**Advanced capabilities.** People can **ask their files** a question and get an answer with citations built only from what they may read at that moment; classification **suggests where to file** a document and which **retention label** applies; **exact and near duplicates** are found and merged without breaking the records that point at them; public links can require the recipient's **acknowledgement**, stamp a **watermark** and keep a signed **download proof**; a **legal hold** freezes a folder against every destructive path; and every drive action is an MCP tool with a preview, so an agent can tidy a folder under the same permissions as its user.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee on a train, **when** a 900 MB video upload is cut halfway and the connection returns, **then** the upload resumes from the last received part and the file appears once, with one entry in its activity.
- **Given** a folder dropped from the desktop with sub-folders, **when** the upload ends, **then** the same structure exists in the target folder and a summary lists what was skipped (hidden files) or refused (type, size, quota).
- **Given** a manager who shares the folder "Contracts" with the Sales team at view, **when** a contract is added to it later, **then** every Sales member can open it without a new share, and the file's access panel says "from Contracts".
- **Given** a sub-folder "Contracts / Board" that the owner restricts, **when** Sales members browse "Contracts", **then** "Board" is not listed for them while the owner and the people shared on "Board" itself still see it.
- **Given** a folder shared at upload level with a colleague, **when** the colleague adds files, **then** they can read and replace their own files but cannot rename, move or delete anyone else's.
- **Given** an owner who creates a public link to a folder with a password and a 7-day expiry, **when** an outside accountant opens it and enters the password, **then** they see the folder's files with previews and download buttons, and nothing else of the platform; after 7 days the link shows "This link is no longer available".
- **Given** a file request link on "Invoices received", **when** a supplier uploads two PDFs, **then** they land in the folder marked as guest uploads, the owner gets an inbox notice, and the files stay out of AI knowledge until a reviewer approves them.
- **Given** a contract replaced three times, **when** its owner opens Versions, **then** four versions are listed with uploader, date and size; they preview version 2, name it "signed", and restore it, which adds version 5.
- **Given** a folder its owner archived, **when** the owner opens Trash, **then** it is listed with its original place, who archived it and when (and the days left where the organization empties the trash automatically); restoring it brings back its contents, shares and links.
- **Given** an employee who opened a file on their phone in Ever Teams, **when** they open Home in the browser, **then** that file is first in Recent.
- **Given** a user at 82 % of their personal quota, **when** they upload, **then** the upload succeeds and they get one notice "82 % of your storage used" with a link to the storage breakdown (largest files first).
- **Given** an invoice record, **when** a user drops a scan on its files panel, **then** the scan is stored in drive, linked to the invoice, readable by everyone who may read the invoice, and listed under "Attached to records".
- **Given** a user who asks the "Policies" folder "how many days of notice does a resignation need?", **when** the answer comes back, **then** it quotes the passage and cites the handbook file and page it came from, and a colleague without access to the HR folder asking the same question gets no citation from it. `(advanced)`
- **Given** a scanned lease uploaded to the root, **when** classification marks it "Contract", **then** the file shows "Suggested: move to Contracts, label Keep 10 years" with Accept and Dismiss. `(advanced)`
- **Given** a folder holding the same brochure four times under different names, **when** the owner opens Duplicates, **then** the four are one group with the bytes reclaimable; "Keep this one" trashes the others and moves their record links to the kept file. `(advanced)`
- **Given** a link to an offer that asks for acknowledgement and a watermark, **when** the recipient confirms their name with the code mailed to them and downloads, **then** the PDF carries their address, the date and the link reference on every page, and the owner can export the signed download receipt. `(advanced)`
- **Given** a legal hold on "Litigation 2026", **when** anyone tries to delete forever, empty the trash, prune versions or let a retention label trash a file in it, **then** the action is refused naming the hold. `(advanced)`
- **Given** a desktop user who mounts the drive with a personal token, **when** they save a file into a team space from their file manager, **then** it appears in the web tree with a new version and the usual activity.

### 2.2 Edge cases & failures

- **Given** two people uploading a file of the same name into one folder at once from the app, **when** both finish, **then** one keeps the name and the other is saved as "name (2)" unless they chose "replace", which makes a version.
- **Given** an upload that would exceed the person's or the space's quota, **when** it is started, **then** it is refused before any byte is stored, naming the quota that is full; a resumable upload reserves its size first.
- **Given** a person without manage level on a file, **when** they try to share it or create a link, **then** they are refused with `403`; a person who cannot read it gets `404`.
- **Given** a manager who tries to share at edit while holding view, **when** they save, **then** it is refused: nobody grants more than they hold.
- **Given** a public link with a wrong password tried five times in 15 minutes, **when** a sixth try arrives, **then** it answers "too many attempts" with the retry time, whatever the password.
- **Given** a link whose file was trashed, whose creator was deactivated, or whose download limit is reached, **when** it is opened, **then** it shows the same "no longer available" page; the owner's link list says why.
- **Given** a file in the trash, **when** someone opens a record it was attached to, **then** the panel shows it as "in trash" to those who may restore it and hides it from others.
- **Given** a purge job interrupted halfway, **when** it runs again, **then** it continues without error and no stored bytes are left without a row, nor rows without bytes.
- **Given** a network-drive client that locks a file, **when** a web user replaces it, **then** the replace waits for or is refused by the lock as the protocol says, and the lock expires after its timeout.
- **Given** a tenant that switched `FEATURE_DRIVE` off after use, **when** users browse Documents, **then** they see the hub as before; links stop answering; versions, trash rows and labels stay stored and come back when it is switched on again.
- **Given** an editor app (sheets) not installed in a deployment, **when** someone opens a sheet file, **then** it downloads as its last saved copy and keeps its sharing, versions and trash.
- **Given** an archive or an HTML file, **when** it is previewed, **then** the archive lists its entries without extracting them and the HTML is shown as text; nothing uploaded runs in the reader's browser.

## 3. Functional Requirements

### 3.1 Scope, flags and the one tree

- **FR-1** The system keeps every file, folder, link item and page as a row of the one documents tree, with one sharing model, one versions model, one trash and one search; drive behaviour applies to files, folders and link items, page content stays with `documents-and-wiki`.
- **FR-2** The system answers `404 DRIVE_DISABLED` on every route this spec adds while `FEATURE_DRIVE` is off for the tenant, hides drive menu entries, and leaves the Documents hub as today (a replaced file is overwritten in place).
- **FR-3** The system registers public link routes only when `GAUZY_DRIVE_PUBLIC_LINKS_ENABLED` is exactly `true` and the network-drive endpoint only when `GAUZY_DRIVE_WEBDAV_ENABLED` is exactly `true`.
- **FR-4** The system keeps every existing Documents endpoint, field, permission, route and limit working unchanged.

### 3.2 Upload and organize

- **FR-5** A user with `DOCS_CREATE` can upload a file resumably in parts: the upload names its size, sends parts in any order, can ask which bytes the server holds and continue after a lost connection; an unfinished upload expires after 24 hours and its parts are removed.
- **FR-6** The system checks a completed resumable upload exactly as a single upload today (type by content, size, quota, digest) and allows files up to the drive limit (default 5 GiB) instead of the single-request limit.
- **FR-7** A user can upload a folder with its sub-folders; the system recreates the structure, skips hidden entries and answers one result per item.
- **FR-8** When an uploaded, moved or copied item meets a sibling of the same name, the user chooses keep both (the new one is numbered "name (2)"), replace (files only: the new bytes become a version) or skip; an API call that names no choice behaves as today (both items kept under the names given), and the app's dialog proposes keep both.
- **FR-9** A user with `DOCS_CREATE` can save a web address as a link item with a title and description; opening it goes to the address after an "external site" notice; link items are never previewed, downloaded or zipped.
- **FR-10** The New menu offers folder, page, file upload, folder upload, link and one entry per file kind an editor app registered; choosing a kind creates a blank file of that kind in the current folder and opens it.
- **FR-11** A user can copy a file (new bytes counted against quota) or a folder with its contents; a copy of more than 500 items runs in the background with progress and a result list.
- **FR-12** A user with `DOCS_MANAGE` or the owner can transfer ownership of an item they own to another employee of the organization; the new owner gets manage level and an inbox notice.

### 3.3 Sharing and permissions

- **FR-13** The system offers five share levels: view, comment, upload (folders only: add items and change one's own), edit, and manage (edit plus share, links and settings); existing view, comment and edit shares keep their meaning, including archiving and deleting where they allow it today.
- **FR-14** The system applies a share on a folder to everything inside it, including items added later; a person's access is the highest of the folder-chain shares, their own shares, their space and ownership, and the same rule governs lists, counts, search, previews, exports, record panels, links and AI retrieval.
- **FR-15** A user with manage level can restrict a folder or file so it stops inheriting shares from above; owner, managers and the item's own shares keep access; removing the restriction restores inheritance.
- **FR-16** The system lets a person with manage level share and change shares; nobody can grant a level above their own; only the owner or `DOCS_MANAGE` can change a manager's share.
- **FR-17** A user with manage level and `DRIVE_LINK_CREATE` can share with an email address outside the organization; the recipient gets a message with a link that asks for a one-time code sent to that address, and the invitation expires (default 14 days).
- **FR-18** A share can carry an expiry date and a message; the system ends it at expiry and tells the recipient at share time through the inbox (and by email when they choose).
- **FR-19** The system lists "Shared with me" per person: items shared with them or their teams, newest share first, filterable by sharer and kind, excluding items they own.
- **FR-20** The system shows each item's access panel: owner, space, inherited shares with the folder they come from, own shares, external recipients and links, each removable by those allowed.

### 3.4 Public links and file requests

- **FR-21** A user with manage level and `DRIVE_LINK_CREATE` can create links to a file, folder or page: view (with or without download), upload only (a file request) or view and upload, each with an optional password, an expiry (default 30 days, at most 365, or none when the tenant allows), a maximum of downloads and a label.
- **FR-22** The system shows a link page with the item read-only and nothing else of the platform: a file's preview, a folder's browsable contents with previews and per-file download, or a page in the read-only reader of `documents-and-wiki`; restricted items inside a linked folder are not shown.
- **FR-23** The system checks a link's password on the server, refuses a sixth wrong attempt within 15 minutes per link and network address with `429` and the retry time, and stores no password in readable form.
- **FR-24** The system answers one "no longer available" page for expired, revoked, exhausted or suspended links and links whose item is trashed; the owner's link list states the reason.
- **FR-25** The system suspends the links of a deactivated creator until a manager of the item confirms them, and ends all links of a tenant at once when public links are switched off.
- **FR-26** A file request accepts files with the uploader's name and optional email, runs the upload checks, counts them against the folder's quota, marks them as guest uploads pending review, keeps them out of AI knowledge until approved and tells the folder's owner.
- **FR-27** The system records views, downloads and uploads per link (time, network address hash, file) and shows counts and last access; the owner can ask to be told of the first access.
- **FR-28** A user with `DRIVE_SETTINGS_MANAGE` can set the link policy per organization: links allowed or not, password required, longest expiry, file requests allowed, external sharing limited to listed email domains.
- **FR-29** A link can ask the recipient to confirm their name (and, for a named recipient, a one-time code) before download; the system stores the confirmation with the file's digest as a download receipt. `(advanced)`
- **FR-30** A link can stamp previews and downloads of PDF and image files with a visible watermark naming the recipient (or "public link"), the date and the link reference, and serve no unmarked copy. `(advanced)`
- **FR-31** The owner can export a link's receipts as a file carrying a signature the platform can verify later, proving which file version was delivered to whom and when. `(advanced)`

### 3.5 Previews and thumbnails

- **FR-32** The system keeps today's previews and adds: code and text with syntax colours, CSV and TSV as a table (first 1,000 rows), archive entry lists without extraction, and office and open-document formats rendered with their layout when the deployment configured a document conversion service (extracted text otherwise, as today).
- **FR-33** The system previews files of every size it previews today; a user with `DRIVE_SETTINGS_MANAGE` can set a preview cap per organization (none by default), beyond which download is offered instead.
- **FR-34** The system shows thumbnails for images, PDF first pages, video first frames (with the conversion service) and registered file kinds that provide one, in the grid view and the record panels.
- **FR-35** The system never runs uploaded content in the reader's browser: script-capable types are shown as text or offered as download with a safe disposition.

### 3.6 File versions

- **FR-36** The system keeps the previous bytes of a file as a version each time it is replaced (upload, replace on name collision, network drive save, editor app save), numbered, with uploader, time, size, digest and source.
- **FR-37** A user who can read a file can list, preview and download its versions; a user with edit can restore a version (which adds a new version on top) and name or pin a version.
- **FR-38** A user with manage level can delete one version other than the current one.
- **FR-39** The system keeps every version younger than 30 days, the newest 50 and every pinned version, prunes the rest daily, and lets `DRIVE_SETTINGS_MANAGE` change both numbers per organization.
- **FR-40** The system counts version bytes against quota and extracts, indexes and classifies only the current version.

### 3.7 Trash, retention and holds

- **FR-41** The system lists the trash: every archived item the person may read, as the archived list shows them today (archiving moves an item and its contents to the trash, as today), with a filter for the items they archived and those archived in spaces and folders they manage, and with original place, who archived, when and, where the organization empties the trash automatically, the days left; archiving stays the only way into the trash and deleting stays allowed only for archived items.
- **FR-42** A user who may unarchive an item today can restore it from the trash with its contents, shares and links in its original folder, or at the top of its space when that folder is gone, saying so.
- **FR-43** A user who may delete an archived item today (`DOCS_DELETE` with write access to it) can delete forever from the trash, and empty their trash, after a confirmation; an organization can limit this to manage level and `DOCS_MANAGE` (setting, off by default); the items leave the trash at once, holders of `DOCS_DELETE` can still recover them into the trash as today until a purge, and a purge then removes rows, versions and stored bytes for good.
- **FR-44** The system purges items deleted forever only where an organization set a purge period (7 to 365 days; none by default, so deleted items stay recoverable as today), daily, in batches, idempotently; it never purges an archived item nobody deleted, except where the organization chose to empty the trash automatically after a period (off by default), which deletes forever the archived items older than that period.
- **FR-45** A user with `DRIVE_RETENTION_MANAGE` can define retention labels (keep for a period from creation, last change or labelling; at the end do nothing, ask for review or move to trash) and apply them to items, folders passing them to their contents. `(advanced)`
- **FR-46** The system refuses deleting forever, purging, version pruning and emptying the trash for a labelled item before its keep-until date, and runs the label's end action on time with an inbox item to the owner. `(advanced)`
- **FR-47** The system suggests a destination folder and a retention label for a classified file from its category's defaults; the suggestion is shown for acceptance, applied automatically only where the category says so, and every automatic filing is logged and undoable for 7 days. `(advanced)`
- **FR-48** With the access-control plugin's legal holds, a hold on a file or folder blocks deleting forever, purge, version pruning, retention end actions and moving items out of the held folder, and shows a hold badge; releasing the hold lifts the block. `(advanced)`
- **FR-49** The system answers privacy requests of the access-control plugin for files a person owns or uploaded: found, exported with their bytes, reassigned or deleted as the request decides, never while held.

### 3.8 Home, recents and favourites

- **FR-50** The system records per person the items they open or change (at most once a minute per item), lists their latest 200 drive items in Recent in every client without deleting any earlier visit (recent visits of tasks, projects and other records are left as they are), and lets them remove one or clear the list.
- **FR-51** The system offers a Home view with Recent, Favourites, Shared with me and, per space the person belongs to, the latest changes; favourites stay the platform's existing favourites.
- **FR-52** The system remembers per person the list or grid view, sort and kind filter of each view on the server.

### 3.9 Search and asking

- **FR-53** The system adds filters to today's name and content search: kind, file type, owner, changed between, size range, folder (with its sub-folders), shared with me, label and guest uploads.
- **FR-54** A user can ask a question of a folder, a space or a selection in the platform's assistant chat, opened already limited to that scope, and get an answer with citations (file, page or sheet, passage); the system builds it only from items the asker may read at that moment, uses the knowledge index where an item is in it and the extracted text otherwise, and shows "no answer found" rather than guess. `(advanced)`
- **FR-55** The system lists exact duplicates (same bytes) and near duplicates (extracted text at least 90 % alike) per folder or space with reclaimable bytes; "keep this one" trashes the others and moves their record links, favourites and page references to the kept file. `(advanced)`

### 3.10 Quotas, storage and reservations

- **FR-56** The system enforces quotas per organization (set by the operator, as today), per person (a default per organization and overrides per person) and per team space; 0 means unlimited.
- **FR-57** The system counts against the owner's quota the current bytes, versions and trash of files they own in their personal space, and against a team space the files in it; shared files count once, for their owner or space; files other features keep outside the Documents hub (screenshots, recorded media, image assets, candidate documents) are not counted.
- **FR-58** The system refuses an upload, copy, restore or version that would exceed a quota with `DRIVE_QUOTA_EXCEEDED` naming it, and sends one inbox notice at 80 % and at 95 %.
- **FR-59** Each person sees their usage and quota; a user with `DRIVE_SETTINGS_MANAGE` sees usage per person and space, by file type, and the 100 largest files.
- **FR-60** Another feature can reserve bytes for an owner before writing (a meeting recording, an import) for up to 24 hours; reservations count against quota, become usage when written and lapse at expiry.
- **FR-61** A user with `DOCS_MANAGE` can import the files under a path of the configured storage, or of a storage target of the integration hub, into a folder after a preview listing what will be created; a second run creates nothing twice. The organization documents uploaded on the earlier organization documents page are imported the same way, once, into an "Organization documents" folder of the organization space, so they stay reachable now that the page leads to the Documents hub; the earlier rows stay unchanged.

### 3.11 Team spaces

- **FR-62** The system shows files and folders in team spaces alongside pages, with a space quota and space managers (the team's managers and people shared at manage on the space).
- **FR-63** Files in a team space belong to the space for quota and stay when their uploader leaves the team or the organization; a personal file of a deactivated employee is offered to their manager after 30 days.

### 3.12 Files on records

- **FR-64** Every record type that registers the files panel shows it on its page: list, upload into drive, attach an existing file the user can read, attach from an outside file store through the integration hub, open, detach; the panels on tasks, projects, employees, contacts and invoices keep working.
- **FR-65** A file uploaded from a record panel is readable by everyone who may read the record unless the file is restricted; changing or deleting it needs edit on the file or on the record.
- **FR-66** The system offers "Attached to records": record types, then records, then their files, showing only files and records the person may read.
- **FR-67** A user with `DRIVE_SETTINGS_MANAGE` can limit per record type the number of files, their types and whether outside users (portal, guests) may upload; attaching the same bytes twice to a record links the file once.
- **FR-68** A record type can offer "create from this file" (an expense from a receipt, a bill from a supplier invoice); the drive shows it on matching files and links the file to the record created.
- **FR-69** The system lets a user attach a file by web address (fetched through the platform's egress guard, within the size limit) and take a photo from the device camera on a phone browser.

### 3.13 Downloads and bulk

- **FR-70** A user can download a folder or a selection as a zip; beyond 100 items or 200 MB it is built in the background with progress pushed live and a download valid 24 hours; pages are included as Markdown and link items are listed in a manifest.
- **FR-71** Bulk move, copy, share, label, download, favourite and trash act on up to 200 items with one result per item.

### 3.14 Network drive, clients and keyboard

- **FR-72** A user with `DRIVE_WEBDAV_USE` can mount Home, Shared with me and their team spaces over the standard web-folder protocol (RFC 4918 classes 1 and 2) with a personal API token; reads, writes, moves, locks and deletes follow drive rules (deletes go to the trash, writes make versions, quotas apply).
- **FR-73** A user with `DRIVE_SETTINGS_MANAGE` can switch network-drive access off or to read-only per organization; pages and link items are not listed over it unless the organization exposes pages as read-only Markdown files.
- **FR-74** The drive pages of the Angular app work at phone width (upload from camera, share, preview).
- **FR-75** The drive offers keyboard shortcuts for search, upload, new, share, rename, delete, favourite and open trash, and a shortcut help shown by `?`.

### 3.15 Editor apps

- **FR-76** A plugin can register a file kind with a name, an icon, the file types it opens, whether it creates blank files, how it produces a downloadable copy, its text for search, an optional thumbnail and the client route that opens it; drive offers it in New and "Open with" and stores its files as ordinary files with every drive behaviour.
- **FR-77** Without the registering plugin, a file of that kind downloads as its last saved copy and keeps sharing, versions, trash, search and record links.
- **FR-78** Other features (mail, chat, meetings) store files through drive: a saved mail attachment lands in the person's "Saved from mail" folder, a meeting recording in the meeting's folder, each with the usual checks.

### 3.16 Activity, notifications, events

- **FR-79** The system records uploads, versions, shares, restrictions, links (created, changed, revoked, accessed), moves, labels, holds, trash, restore and delete forever in the item's activity and in the audit trail.
- **FR-80** The system sends inbox entries for: shared with me, external share accepted, file request received, first link access (opt-in), quota at 80 % and 95 %, retention end action due, and a suggestion awaiting review.
- **FR-81** Lists, trees, Home, Trash and record panels update live through the platform's real-time channel.
- **FR-82** The system appends drive facts to the event outbox (file uploaded, version added, shared, link created, link accessed, trashed, restored, purged) for automations and webhooks.

### 3.17 Agents and MCP

- **FR-83** The MCP server offers drive tools under the user's permissions: list a folder, search, read a file's metadata and text, upload from text or base64 (at most 10 MB), move, copy, share, create a link, list and restore versions, trash and restore, find duplicates, and search a folder or space for cited passages to answer from; listing, searching and reading are the existing document tools with file filters, not a second set. `(advanced)`
- **FR-84** Sharing, link, restore and trash tools answer a preview of their effect unless called with the preview's confirmation; deleting forever and emptying the trash are not offered to agents; agents create public links only where the organization allows it. `(advanced)`

### 3.18 Reports

- **FR-85** The system registers report definitions: storage by file type and largest files, usage per person and space against quota, external sharing (active links with expiry, password and last access), file requests received, trash due for purge, duplicates and reclaimable bytes, and retention due.
- **FR-86** The system keeps public links to documents created before this feature through the platform's shared-link routes working: each keeps its token, opens as today, is listed with the item's links, and its author and the organization's managers can copy it again as today; with `FEATURE_DRIVE` off those routes create and list document links as today.

## 4. Non-Functional Requirements

- **Performance**: folder list P95 < 300 ms at 1 million items per tenant and 5,000 in one folder; inherited access adds at most one indexed lookup per folder level (depth ≤ 32); a 1 GB resumable upload sustains the client's bandwidth with 8 MiB parts; zip downloads stream without holding the archive in memory; public link pages P95 < 500 ms warm.
- **Data volume**: up to 10 million files and 50 TB per tenant on object storage; 200 versions per file; 1,000 links per item.
- **Concurrency**: replace and version writes take a per-file lock; quota checks are serialised per charged scope (the team space, the person and the organization a write counts against) so two uploads, by the same owner or by two owners into one team space, cannot both pass the last free bytes.
- **Reliability**: no stored bytes without a row and no row without bytes after any crash (sweeps reconcile); purge, pruning and retention jobs are idempotent and resumable.
- **Security & privacy**: link tokens are 32 random bytes and stored hashed; passwords hashed with a slow hash; link pages send no referrer, are not indexed by search engines and are rate limited per address; guest uploads go through the same type, size and content checks; what leaves the platform: link pages and downloads to their holders, share emails and codes to recipients, file text to the configured AI provider for asking and classification, files to the configured conversion service for previews.
- **Auditability**: every share, link, access, hold and permanent deletion is in the audit trail with actor and before and after.
- **Accessibility and localization**: keyboard operable tree, lists and dialogs, labelled controls, strings in every shipped locale, sizes and dates in the person's locale.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; multi-tenant cloud and self-hosted single tenant; local disk and object storage providers; additive OpenAPI changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Document` (existing) | A folder, file, link item or page of the tree; gains owner, restriction, retention label and editor kind |
| `DocumentShare` (existing) | A grant to a person or team on an item; gains upload and manage levels, expiry and message, and applies down folders |
| Restriction | An item's choice to stop inheriting shares from its folders |
| `DocumentVersion` (existing) | A page snapshot today; also a stored earlier copy of a file, numbered, nameable and pinnable |
| Public link | A tokenised link to an item for people without an account, kept as one of the platform's shared links: level, password, expiry, limits, receipt options |
| `DocumentLinkAccess` | One view, download, upload or acknowledgement through a link; the download receipt |
| `DocumentUploadSession` | A resumable upload in progress |
| Trash | The archived items of the tree, listed with where they were, who archived them and when |
| Recent visit | A person's recent open or change of an item, kept in the platform's recent-visit list |
| `DocumentRetentionLabel` | A named keep-for rule with an end action |
| `DocumentStorageReservation` | Bytes held for an owner before a write |
| `DocumentQuotaOverride` | A quota for one person or team space |
| Zip download | A background zip of a folder or selection, run as a platform operation |
| `DocumentDavLock` | A network-drive lock |
| File kind | An editor app's registered type of file (sheet, deck) |
| Duplicate group | Files with the same bytes or nearly the same text (computed) |

## 6. Out of Scope

- Page editing, page versions as a reading experience, templates, wiki spaces and public sites: `documents-and-wiki`.
- The grid and slide editors and their co-editing: `spreadsheets`, `presentations` (they register file kinds here).
- Drive screens in Ever Teams web, desktop and mobile, offline files and a native sync client: the Ever Teams spec `workspace-collaboration-clients`.
- General record sharing, role-based record rules, retention per record type, privacy requests and the legal hold register: `access-control-and-security` (drive honours them).
- Outside file stores as attachment sources, storage and backup targets: `integration-hub`.
- Mail attachments as messages, chat attachments in conversations: `mail`, `chat-messaging` (they store through drive).
- The customer help centre: `helpdesk-portal-and-knowledge-base`.

## 7. Acceptance Criteria

- [ ] **AC-1** A 1 GB file uploads resumably across a dropped connection and a folder uploads with its structure (FR-5–FR-8).
- [ ] **AC-2** A folder share reaches files added later; a restricted sub-folder is hidden from inherited sharers; an upload level sharer cannot change others' files; nobody grants above their level (FR-13–FR-16).
- [ ] **AC-3** An outside email recipient opens a shared folder with a one-time code; the invitation expires (FR-17).
- [ ] **AC-4** A password link with expiry and download limit works, rate limits wrong passwords and stops on each end reason with one page; a file request lands guest uploads pending review (FR-21–FR-27).
- [ ] **AC-5** Acknowledgement, watermark and signed receipt export work on one link and the receipt verifies (FR-29–FR-31).
- [ ] **AC-6** Replace keeps versions; restore, name, pin and delete a version; pruning keeps the pinned ones (FR-36–FR-40).
- [ ] **AC-7** Trash lists archived items, restores them in place, deletes forever (recoverable by `DOCS_DELETE` until a purge) and purges after the period an organization set, never while none is set; an archived item nobody deleted is never purged unless automatic emptying is set; a labelled or held file is refused each destructive action (FR-41–FR-48).
- [ ] **AC-8** Recent is the same in the Angular app and through the API used by Ever Teams (FR-50).
- [ ] **AC-9** Ask a folder answers with citations and never cites an unreadable file (FR-54).
- [ ] **AC-10** Duplicates are grouped and merged with record links moved (FR-55); filing suggestions appear and undo (FR-47).
- [ ] **AC-11** Quotas per person and space refuse over-quota writes, warn at 80 % and 95 %, and count reservations (FR-56–FR-60).
- [ ] **AC-12** A record panel upload is readable by the record's readers; "Attached to records" lists only readable items (FR-64–FR-66).
- [ ] **AC-13** A zip of 1,000 files builds in the background with live progress (FR-70).
- [ ] **AC-14** A WebDAV client mounts, saves a version, deletes to trash and honours locks and read-only mode (FR-72, FR-73).
- [ ] **AC-15** A registered test file kind appears in New and Open with, and downloads without its plugin (FR-76, FR-77).
- [ ] **AC-16** MCP drive tools return previews before sharing, linking, restoring or trashing (FR-83, FR-84).
- [ ] **AC-17** The reports of FR-85 return figures matching the drive's own counters.
- [ ] **AC-18** With `FEATURE_DRIVE` off nothing changes; with the deployment switches off the link and network routes do not exist (FR-2, FR-73).
- [ ] **AC-19** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-20** With `FEATURE_DRIVE` on and the drive settings at their defaults: nothing deleted is purged, previews have no size cap, everyone who may archive, unarchive, delete or recover an item today still may, the archived list shows every item it showed, an upload or move naming no collision choice behaves as before, and recent visits of other records are untouched (FR-33, FR-43, FR-50, FR-65).
- [ ] **AC-21** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-2, FR-4).

## 8. Open Questions

- Default share levels for employees creating public links: proposed `DRIVE_LINK_CREATE` for managers and admins only, employees by tenant choice.
- Office previews need a document conversion service: proposed an optional deployment-provided service (none on cloud until the operator picks one), extracted text otherwise.
- The access link register of `access-control-and-security` should list drive links through the source drive offers (proposed: yes, read-only there, managed here).
- Personal files of leavers: proposed offer to the manager after 30 days, never deleted automatically.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/docs` and `docs-ui`; no new file store; editor apps plug in.
- [x] II Tenant/organization scoping — every new row carries tenant and organization; public routes resolve them from the link only.
- [x] III Both ORMs, additive migrations — new columns and tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_DRIVE` and two deployment switches off; today's behaviour kept.
- [x] V Contracts and API first — every capability is an endpoint in `@gauzy/contracts` before UI.
- [x] VI Permissions, privacy, security — new keys, hashed tokens and passwords, rate limits, guest upload checks.
- [x] VII Real-time through the event bus — outbox facts and the platform channel; no private push.
- [x] VIII i18n and accessibility — strings in every locale; keyboard operable.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on existing Docs behaviour:

| Requirement | Existing behaviour it extends |
| --- | --- |
| FR-1, FR-4 | the documents tree of [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md) (FR-1–FR-3, FR-15) |
| FR-5–FR-8 | today's upload checks (type sniffing, size, organization quota, digest with duplicate advisory) |
| FR-13–FR-20 | the view, comment and edit shares and the organization, team and private spaces (docs-collaboration FR-1, FR-2) |
| FR-18, FR-80 | the Docs notifications and the Inbox of docs-collaboration FR-10, FR-11 |
| FR-21–FR-27 | the platform's shared links (one public link per token, read without signing in) |
| FR-22 | the page reader of [`../documents-and-wiki/spec.md`](../documents-and-wiki/spec.md) |
| FR-26, FR-47 | the review circuit-breaker and classification of the AI knowledge pipeline and email capture |
| FR-36–FR-40 | page versions and the file replace route; FR-40 keeps the extraction pipeline on the current bytes |
| FR-41–FR-44 | today's archive as the trash (it cascades to contents), delete allowed only on archived items, and recover of a deleted item into the trash; [`../comments-and-trash/plan.md`](../comments-and-trash/plan.md) trash conventions |
| FR-50 | the platform's per-employee recent visits, already kept for tasks and projects |
| FR-52 | the employee settings that already keep task view choices |
| FR-54 | the assistant chat's documents tools with cited retrieval and its access filter |
| FR-55 | the content digest every upload already computes for its duplicate notice |
| FR-11, FR-61, FR-70 | the platform's operation runtime for long and resumable work, and the folder export of docs-collaboration FR-19 |
| FR-61 | the organization documents page, which leads to the Documents hub once Documents is on |
| FR-83 | the docs tools of [`../mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md) |

- Contracts used: [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) (one-time codes, audit, legal holds, privacy requests, record access), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md) (global search, palette, timeline), [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md) (record type registry), [`../integration-hub/spec.md`](../integration-hub/spec.md) (file picker, storage targets), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md) (report definitions), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md) (outbox triggers).
- Consumers: `documents-and-wiki`, `spreadsheets`, `presentations`, `meetings`, `mail`, `chat-messaging`, the Ever Teams spec `workspace-collaboration-clients`.
