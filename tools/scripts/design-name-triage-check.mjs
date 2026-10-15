#!/usr/bin/env node
/**
 * Gate: every "phantom" design name has a decision, and the decision still matches the composed schema.
 *
 * The platform-extensions design (`17` §3.2's rows) promised root fields by name. An audit of every row against the
 * composed schema (handover 2026-09-20 §7.68) found **81 names in the queries and mutations cells that appeared
 * nowhere in the code at all** — six were triaged by hand (§7.67), the other seventy-five were recorded unclassified
 * because the block mixed two classes needing opposite remedies: a *naming* difference (`createProject` is served as
 * `createOrganizationProject`) is fixed in the design, a *missing capability* (`payrollItems`) is fixed in the code.
 * Owner decision 12 (2026-10-13): **"I want to triage each, but in the end implement all we need really!"**
 *
 * This file is that triage, one row per name, and the gate keeps it true:
 *
 * - `delivered` — the design's own name is served now. The gate fails when it stops being served.
 * - `naming`    — the capability is served under another name (`served`); the design row is amended to it. The gate
 *                 fails when an equivalent is not served, or when the design's name starts being served too (then
 *                 the row is `delivered`, and the duplicate door is a question for the owner).
 * - `retired`   — the design itself retired or rejected the name, or a decision on record refuses it; `served` names
 *                 what answers the need instead (may be empty). The gate fails when the name is served.
 * - `build`     — a missing capability this programme builds. The gate fails when one is served (move it to
 *                 `delivered`), and the count may only shrink: it is pinned at `BUILD_BASELINE`.
 * - `drop`      — clearly not needed; listed for the owner in the PR that recorded it rather than dropped silently.
 *
 * The design documents are not in this repository (`PLATFORM-EXTENSIONS.md`, "Where the design lives"); the amendments
 * the `naming`, `retired` and `drop` rows imply are recorded in `tools/scripts/design-name-triage.md`, which
 * `--write` regenerates from the table below (`--markdown` prints it).
 *
 * Run from the repository root: `node tools/scripts/design-name-triage-check.mjs [--write | --markdown]`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');

/**
 * The number of `build` rows: the missing capabilities not yet served. It may only shrink — a delivered capability
 * moves its row to `delivered` and lowers this number in the same change.
 */
const BUILD_BASELINE = 7;

/** @type {{ name: string, kind: 'Query'|'Mutation', decision: 'delivered'|'naming'|'retired'|'build'|'drop', served: string[], note: string }[]} */
const TRIAGE = [
	// — The six triaged by hand in §7.67 (old handover §7.65 item 7).
	{ name: 'acceptOrderQuote', kind: 'Mutation', decision: 'delivered', served: [], note: 'pe/a3-order (§7.75)' },
	{ name: 'declineOrderQuote', kind: 'Mutation', decision: 'delivered', served: [], note: 'pe/a3-order (§7.75)' },
	{ name: 'generateOrderInvoice', kind: 'Mutation', decision: 'delivered', served: [], note: 'pe/a3-order (§7.75)' },
	{ name: 'requestOrderApproval', kind: 'Mutation', decision: 'delivered', served: [], note: 'pe/a3-order (§7.75)' },
	{ name: 'sendOrderQuote', kind: 'Mutation', decision: 'delivered', served: [], note: 'pe/a3-order (§7.75)' },
	{
		name: 'approveSeller',
		kind: 'Mutation',
		decision: 'naming',
		served: ['activateSeller'],
		note: 'the explicit approval after every verification passed is `activate` (§7.76, item 7 closed)'
	},

	// — Delivered under the design's own name since the §7.68 audit.
	{ name: 'acceptTerms', kind: 'Mutation', decision: 'delivered', served: [], note: 'terms-acceptance surface' },
	{ name: 'addTeamMember', kind: 'Mutation', decision: 'delivered', served: [], note: 'organization team membership' },
	{ name: 'bulkCreateTenantRoles', kind: 'Mutation', decision: 'delivered', served: [], note: 'mirrors `POST /roles/bulk`' },
	{ name: 'createReportCategory', kind: 'Mutation', decision: 'delivered', served: [], note: 'report categories' },
	{ name: 'deleteReportCategory', kind: 'Mutation', decision: 'delivered', served: [], note: 'report categories' },
	{ name: 'updateReportCategory', kind: 'Mutation', decision: 'delivered', served: [], note: 'report categories' },
	{ name: 'emailResets', kind: 'Query', decision: 'delivered', served: [], note: 'email reset requests' },
	{ name: 'invoiceByToken', kind: 'Query', decision: 'delivered', served: [], note: 'public invoice link' },
	{ name: 'invoiceStatistics', kind: 'Query', decision: 'delivered', served: [], note: 'invoice statistics' },
	{
		name: 'payrollItems',
		kind: 'Query',
		decision: 'delivered',
		served: [],
		note: '§7.68 named it the one with "no served equivalent at all"; served now'
	},
	{ name: 'updatePayrollItem', kind: 'Mutation', decision: 'delivered', served: [], note: 'payroll items' },
	{ name: 'reportMenuItems', kind: 'Query', decision: 'delivered', served: [], note: '§7.68: only `updateReportMenu` was served then' },
	{ name: 'revokeTenantApiKey', kind: 'Mutation', decision: 'delivered', served: [], note: 'tenant API keys' },
	{ name: 'updateTenantApiKey', kind: 'Mutation', decision: 'delivered', served: [], note: 'tenant API keys' },
	{ name: 'softDeleteTask', kind: 'Mutation', decision: 'delivered', served: [], note: 'the soft-delete pair' },
	{ name: 'taskByNumber', kind: 'Query', decision: 'delivered', served: [], note: 'task by its project number' },
	{ name: 'termsAcceptances', kind: 'Query', decision: 'delivered', served: [], note: 'terms-acceptance surface' },

	// — Naming: the platform's resources carry the REST-aligned `Organization*` names (§7.68 class 4).
	{ name: 'createDepartment', kind: 'Mutation', decision: 'naming', served: ['createOrganizationDepartment'], note: 'REST `/organization-department`' },
	{ name: 'updateDepartment', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationDepartment'], note: 'REST `/organization-department`' },
	{ name: 'deleteDepartment', kind: 'Mutation', decision: 'naming', served: ['deleteOrganizationDepartment'], note: 'REST `/organization-department`' },
	{ name: 'createProject', kind: 'Mutation', decision: 'naming', served: ['createOrganizationProject'], note: 'REST `/organization-projects`' },
	{ name: 'updateProject', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationProject'], note: 'REST `/organization-projects`' },
	{ name: 'deleteProject', kind: 'Mutation', decision: 'naming', served: ['deleteOrganizationProject'], note: 'REST `/organization-projects`' },
	{ name: 'softDeleteProject', kind: 'Mutation', decision: 'naming', served: ['softDeleteOrganizationProject'], note: 'the soft-delete pair' },
	{ name: 'projectModules', kind: 'Query', decision: 'naming', served: ['organizationProjectModules'], note: 'REST `/organization-project-modules`' },
	{ name: 'createProjectModule', kind: 'Mutation', decision: 'naming', served: ['createOrganizationProjectModule'], note: 'REST `/organization-project-modules`' },
	{ name: 'updateProjectModule', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationProjectModule'], note: 'REST `/organization-project-modules`' },
	{ name: 'deleteProjectModule', kind: 'Mutation', decision: 'naming', served: ['deleteOrganizationProjectModule'], note: 'REST `/organization-project-modules`' },
	{ name: 'createSprint', kind: 'Mutation', decision: 'naming', served: ['createOrganizationSprint'], note: 'REST `/organization-sprint`' },
	{ name: 'updateSprint', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationSprint'], note: 'REST `/organization-sprint`' },
	{ name: 'deleteSprint', kind: 'Mutation', decision: 'naming', served: ['deleteOrganizationSprint'], note: 'REST `/organization-sprint`' },
	{ name: 'createTeam', kind: 'Mutation', decision: 'naming', served: ['createOrganizationTeam'], note: 'REST `/organization-team`' },
	{ name: 'updateTeam', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationTeam'], note: 'REST `/organization-team`' },
	{ name: 'updateTeamMember', kind: 'Mutation', decision: 'naming', served: ['updateOrganizationTeamEmployee'], note: 'a member is an organization-team employee row' },
	{ name: 'removeTeamMember', kind: 'Mutation', decision: 'naming', served: ['deleteOrganizationTeamEmployee'], note: 'a member is an organization-team employee row' },
	{ name: 'teamJoinRequests', kind: 'Query', decision: 'naming', served: ['organizationTeamJoinRequests'], note: 'REST `/organization-team-join`' },
	{ name: 'createTeamJoinRequest', kind: 'Mutation', decision: 'naming', served: ['createOrganizationTeamJoinRequest'], note: 'REST `/organization-team-join`' },
	{ name: 'acceptTeamJoinRequest', kind: 'Mutation', decision: 'naming', served: ['acceptOrganizationTeamJoinRequest'], note: 'REST `/organization-team-join`' },
	{
		name: 'createRecurringExpense',
		kind: 'Mutation',
		decision: 'naming',
		served: ['createOrganizationRecurringExpense', 'createEmployeeRecurringExpense'],
		note: 'two resources: the organization and the employee recurring expense'
	},
	{
		name: 'updateRecurringExpense',
		kind: 'Mutation',
		decision: 'naming',
		served: ['updateOrganizationRecurringExpense', 'updateEmployeeRecurringExpense'],
		note: 'two resources: the organization and the employee recurring expense'
	},
	{
		name: 'deleteRecurringExpense',
		kind: 'Mutation',
		decision: 'naming',
		served: ['deleteOrganizationRecurringExpense', 'deleteEmployeeRecurringExpense'],
		note: 'two resources: the organization and the employee recurring expense'
	},

	// — Naming: served under the delivered route's own vocabulary.
	{ name: 'authorizedUser', kind: 'Query', decision: 'naming', served: ['me'], note: 'the authenticated caller' },
	{ name: 'confirmEmailReset', kind: 'Mutation', decision: 'naming', served: ['verifyEmailReset'], note: 'REST `POST /email-reset/verify-change-email`' },
	{ name: 'createTenantApiKey', kind: 'Mutation', decision: 'naming', served: ['generateTenantApiKeyPair'], note: 'a key is generated as a pair, shown once' },
	{ name: 'createTimeLog', kind: 'Mutation', decision: 'naming', served: ['addManualTime'], note: '§7.68: a time log a person files is manual time' },
	{ name: 'updateTimeLog', kind: 'Mutation', decision: 'naming', served: ['updateManualTime'], note: '§7.68' },
	{ name: 'customSmtp', kind: 'Query', decision: 'naming', served: ['customSmtpSetting'], note: 'REST `/smtp`' },
	{ name: 'updateCustomSmtp', kind: 'Mutation', decision: 'naming', served: ['updateSmtpSetting'], note: 'REST `/smtp`' },
	{ name: 'importHistory', kind: 'Query', decision: 'naming', served: ['importHistories'], note: 'the import ledger is a list' },
	{ name: 'invoiceHighest', kind: 'Query', decision: 'naming', served: ['highestInvoiceNumber'], note: 'REST `GET /invoices/highest`' },
	{ name: 'convertInvoiceToEstimate', kind: 'Mutation', decision: 'naming', served: ['updateInvoiceEstimate'], note: 'REST `PUT /invoices/:id/estimate` flips `isEstimate`' },
	{ name: 'sendEmailHistory', kind: 'Mutation', decision: 'naming', served: ['resendEmailHistory'], note: 'an email history row is re-sent' },
	{ name: 'timesheetStatistics', kind: 'Query', decision: 'naming', served: ['timeTrackingCounts', 'timeTrackingMembers', 'timeTrackingProjects', 'timeTrackingTasks', 'timeTrackingManualTimes', 'timeTrackingTimeSlots', 'timeTrackingActivities'], note: 'REST `/timesheet/statistics/*` is a family, served one field per route' },
	{ name: 'createIntegration', kind: 'Mutation', decision: 'naming', served: ['createIntegrationTenant'], note: 'an integration is configured per tenant; the `integration` catalogue is seeded, read-only' },
	{ name: 'updateIntegration', kind: 'Mutation', decision: 'naming', served: ['updateIntegrationTenant'], note: 'as `createIntegration`' },
	{ name: 'deleteIntegration', kind: 'Mutation', decision: 'naming', served: ['deleteIntegrationTenant'], note: 'as `createIntegration`' },
	{ name: 'updateIntegrationEntitySetting', kind: 'Mutation', decision: 'naming', served: ['updateIntegrationEntitySettings'], note: 'the route writes the set' },
	{ name: 'integrationEntitySettingTied', kind: 'Query', decision: 'naming', served: ['integrationEntitySettings'], note: 'tied rows are read as `IntegrationEntitySetting.tiedEntities`; REST has no read route of its own' },
	{ name: 'authorizePayment', kind: 'Mutation', decision: 'naming', served: ['authorizePaymentSession'], note: 'payment reconnaissance (§7.68)' },
	{ name: 'cancelPayment', kind: 'Mutation', decision: 'naming', served: ['voidPaymentSession'], note: '§3.6: `POST /payments/:id/cancel` is `voidPaymentSession`' },
	{ name: 'billSubscriptionNow', kind: 'Mutation', decision: 'naming', served: ['billSubscription'], note: 'REST `POST /subscriptions/:id/bill`' },
	{ name: 'swapSubscriptionPlan', kind: 'Mutation', decision: 'naming', served: ['changeSubscriptionPlan'], note: 'REST `POST /subscriptions/:id/plan`' },
	{ name: 'createStockAdjustment', kind: 'Mutation', decision: 'naming', served: ['adjustStock'], note: 'REST `POST /stock-adjustments` drafts; `applyStockAdjustment` applies' },
	{
		name: 'markEmployeeNotificationRead',
		kind: 'Mutation',
		decision: 'naming',
		served: ['updateEmployeeNotification', 'markAllEmployeeNotificationsAsRead'],
		note: 'one notification: `updateEmployeeNotification` with `isRead`/`readAt`; all of the caller’s: the mark-all route'
	},
	{
		name: 'deleteSellerOffering',
		kind: 'Mutation',
		decision: 'naming',
		served: ['withdrawSellerOffering', 'softDeleteSellerOffering'],
		note: 'an offering is withdrawn, never erased (§7.65 item 5, `8eaaa273c81`): `DELETE /seller-offerings/:id` withdraws'
	},

	// — Retired or rejected by the design itself (§7.68 class 3).
	{ name: 'createShippingLabel', kind: 'Mutation', decision: 'retired', served: ['requestFulfillmentLabel'], note: 'design-retired; a carrier label is requested for a shipment' },
	{ name: 'setProductVariantPrice', kind: 'Mutation', decision: 'retired', served: ['updateProductVariantPrice', 'bulkUpsertProductPrices'], note: 'design-retired' },

	// — Missing capabilities: neither surface serves them.
	{ name: 'bulkCreateExpenses', kind: 'Mutation', decision: 'build', served: [], note: 'no `POST /expense/bulk` either; build both surfaces on the bulk kernel (`BulkOperation`/`BulkExecutor`)' },
	{ name: 'bulkCreateOrganizations', kind: 'Mutation', decision: 'build', served: [], note: 'no REST bulk route either' },
	{ name: 'bulkCreateTags', kind: 'Mutation', decision: 'build', served: [], note: 'no REST bulk route either' },
	{ name: 'bulkCreateTasks', kind: 'Mutation', decision: 'build', served: [], note: 'no REST bulk route either' },
	{ name: 'bulkCreateTimeLogs', kind: 'Mutation', decision: 'build', served: [], note: 'no REST bulk route either; `addManualTime` one at a time' },
	{ name: 'bulkCreateUsers', kind: 'Mutation', decision: 'build', served: [], note: 'no REST bulk route either; `createEmployeesBulk` covers employees only' },
	{ name: 'upcomingSubscriptionBilling', kind: 'Query', decision: 'build', served: [], note: 'a preview of the next billing; no REST route either' },

	// — Not needed.
	{
		name: 'markEntitySubscriptionRead',
		kind: 'Mutation',
		decision: 'drop',
		served: [],
		note: 'an entity subscription carries no read state (the read state is the notification’s, see `markEmployeeNotificationRead`)'
	}
];

/**
 * How many names the §7.68 audit found unserved anywhere in the code. Every one of them keeps a row: a row removed
 * from the table would let a design promise disappear without a decision, and nothing else would notice.
 */
const AUDITED_NAMES = 81;

/**
 * Where the human-readable copy of this table lives; the gate refuses a copy that has drifted from the table. The
 * same page is published from `ever-co/ever-gauzy-docs` (`PUBLISHED`): refresh that copy from `--markdown` when the
 * table changes.
 */
const MARKDOWN = join(ROOT, 'tools', 'scripts', 'design-name-triage.md');

/** The published copy, in `ever-co/ever-gauzy-docs` (the hostname is left to the docs: no Ever host in code here). */
const PUBLISHED = 'website/docs/platform-extensions/design-name-triage.md';

const schema = readFileSync(SDL, 'utf8').replace(/"""[\s\S]*?"""/g, '');

/** The root fields the composed schema serves, by root type. */
const served = new Map();
let root = null;
for (const line of schema.split(/\r?\n/)) {
	const header = /^type (Query|Mutation|Subscription) \{/.exec(line);
	if (header) {
		root = header[1];
		continue;
	}
	if (/^\}/.test(line)) {
		root = null;
		continue;
	}
	const field = /^ {2}([A-Za-z_]\w*)\s*[(:]/.exec(line);
	if (root && field) served.set(field[1], root);
}

const count = (decision) => TRIAGE.filter((row) => row.decision === decision).length;
const code = (name) => `\`${name}\``;

/**
 * The human-readable copy of the table: prose wrapped at 80 columns, then one table row per name.
 *
 * @returns The whole of `tools/scripts/design-name-triage.md`.
 */
function renderMarkdown() {
	const backlog = TRIAGE.filter((row) => row.decision === 'build').map((row) => code(row.name));
	const dropped = TRIAGE.filter((row) => row.decision === 'drop');
	const action = {
		delivered: 'nothing: the design row is right',
		naming: 'amend the design row to the served name',
		retired: 'mark the design row n-a (retired)',
		build: 'build (REST + GraphQL), then `delivered`',
		drop: 'drop from the design (listed for the owner)'
	};
	const wrap = (text) => {
		const lines = [];
		let line = '';
		for (const word of text.split(/\s+/).filter(Boolean)) {
			if (line !== '' && line.length + 1 + word.length > 80) {
				lines.push(line);
				line = word;
			} else {
				line = line === '' ? word : `${line} ${word}`;
			}
		}
		if (line !== '') lines.push(line);
		return lines.join('\n');
	};

	const paragraphs = [
		'# Platform extensions — the phantom design names, triaged',
		wrap(
			'**What this is.** The platform-extensions design (`17` §3.2) promised GraphQL root fields by name. ' +
				'The audit of every row against the composed schema (handover 2026-09-20 §7.68) found ' +
				`**${AUDITED_NAMES} names in the queries and mutations cells that appeared nowhere in the code** — ` +
				'six triaged by hand in §7.67, the rest recorded unclassified because the block mixed a *naming* ' +
				'class (fixed in the design) with a *missing* class (fixed in the code). **Owner decision 12 ' +
				'(2026-10-13): "I want to triage each, but in the end implement all we need really!"**'
		),
		wrap(
			'**Method.** Each name is measured against `packages/core/src/lib/graphql/schema/schema.graphql`: ' +
				'served under its own name → `delivered`; the capability served under another root field of the ' +
				'same kind (checked by reading the delivered route and field, not by name similarity) → `naming`; ' +
				'retired or rejected by the design itself → `retired`; served by neither REST nor GraphQL → `build`; ' +
				'not a concept of this platform → `drop`.'
		),
		wrap(
			'**This page is generated** from the table in `tools/scripts/design-name-triage-check.mjs` ' +
				'(`node tools/scripts/design-name-triage-check.mjs --write`), and the gate — which CI runs in ' +
				'`static-checks.yml` — fails when the page and the table differ, when a `delivered` name stops being ' +
				'served, when an equivalent is not served as the same kind, when a name that is not `delivered` ' +
				`becomes served, when one of the ${AUDITED_NAMES} rows disappears, and when the build backlog grows.`
		),
		wrap(
			'**Where it lives.** The gate checks `tools/scripts/design-name-triage.md` in `ever-co/ever-gauzy`; ' +
				`the documentation site publishes the same page from \`ever-co/ever-gauzy-docs\` (\`${PUBLISHED}\`), ` +
				'and `node tools/scripts/design-name-triage-check.mjs --markdown` prints it.'
		),
		wrap(
			`**Totals:** ${TRIAGE.length} names — **${count('delivered')} delivered**, ` +
				`**${count('naming')} served under another name**, **${count('retired')} retired**, ` +
				`**${count('build')} to build**, **${count('drop')} dropped**.`
		),
		wrap(
			'**Design-doc amendments (pending: the design documents are not in this repository).** Every ' +
				'`naming` row: replace the design name with the served one in `17` §3.2 (and in Appendix A’s ' +
				'derived counts). Every `retired` row: mark it `(n-a — retired)` beside its replacement. Every ' +
				'`drop` row: remove it, with the reason given.'
		),
		wrap(
			`**To build (the backlog the gate counts, ${backlog.length}):** ${backlog.join(', ') || 'none'}.`
		),
		wrap(
			`**Dropped, for the owner to confirm (${dropped.length}):** ` +
				(dropped.map((row) => `${code(row.name)} — ${row.note}`).join('; ') || 'none') +
				'.'
		)
	];

	const table = [
		'| # | design name | kind | class | served equivalent | decision / note |',
		'|---|---|---|---|---|---|',
		...TRIAGE.map((row, index) => {
			const equivalent = row.decision === 'delivered' ? code(row.name) : row.served.map(code).join(', ') || '—';
			return `| ${index + 1} | ${code(row.name)} | ${row.kind} | ${row.decision} | ${equivalent} | ${action[row.decision]} — ${row.note} |`;
		})
	];

	return `${paragraphs.join('\n\n')}\n\n${table.join('\n')}\n`;
}

if (process.argv.includes('--markdown')) {
	process.stdout.write(renderMarkdown());
	process.exit(0);
}

if (process.argv.includes('--write')) {
	writeFileSync(MARKDOWN, renderMarkdown());
	console.log(`wrote ${relative(ROOT, MARKDOWN)}`);
	process.exit(0);
}

const failures = [];
const seen = new Set();

if (TRIAGE.length !== AUDITED_NAMES) {
	failures.push(
		`${TRIAGE.length} names are triaged and the audit found ${AUDITED_NAMES}: every audited name keeps its row ` +
			'(a delivered or renamed one stays, with its decision)'
	);
}

for (const row of TRIAGE) {
	if (seen.has(row.name)) failures.push(`${row.name} is triaged twice`);
	seen.add(row.name);

	const isServed = served.has(row.name);

	if (row.decision === 'delivered') {
		if (!isServed) failures.push(`${row.name} is recorded as delivered and the composed schema does not serve it`);
		else if (served.get(row.name) !== row.kind) failures.push(`${row.name} is served as a ${served.get(row.name)}, recorded as a ${row.kind}`);
		continue;
	}

	if (isServed) {
		failures.push(
			row.decision === 'build'
				? `${row.name} is served now — move its row to \`delivered\` and lower BUILD_BASELINE`
				: `${row.name} is recorded as \`${row.decision}\` and the composed schema serves it — re-triage the row`
		);
	}

	if (row.decision === 'naming' && row.served.length === 0) failures.push(`${row.name} is \`naming\` but names no served equivalent`);

	for (const equivalent of row.served) {
		if (!served.has(equivalent)) {
			failures.push(`${row.name}: its served equivalent \`${equivalent}\` is not served`);
		} else if (served.get(equivalent) !== row.kind) {
			// A caller of the design's mutation cannot use a query in its place, and the reverse.
			failures.push(`${row.name} is a ${row.kind} and its equivalent \`${equivalent}\` is served as a ${served.get(equivalent)}`);
		}
	}

	if (row.note.trim() === '') failures.push(`${row.name} carries no reason`);
}

const backlog = TRIAGE.filter((row) => row.decision === 'build');

if (backlog.length > BUILD_BASELINE) {
	failures.push(
		`${backlog.length} names are recorded to build and the baseline is ${BUILD_BASELINE}: the backlog may only shrink`
	);
} else if (backlog.length < BUILD_BASELINE) {
	failures.push(`the backlog shrank to ${backlog.length} — lower BUILD_BASELINE to ${backlog.length} so it cannot grow back`);
}

let committed = null;
try {
	committed = readFileSync(MARKDOWN, 'utf8').replace(/\r\n/g, '\n');
} catch {
	failures.push(`${relative(ROOT, MARKDOWN)} is missing — run with --write`);
}
if (committed !== null && committed !== renderMarkdown()) {
	failures.push(`${relative(ROOT, MARKDOWN)} differs from the table — run \`node tools/scripts/design-name-triage-check.mjs --write\``);
}

if (failures.length > 0) {
	console.error('FAILED — the design-name triage no longer matches the composed schema:');
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}

console.log(
	`PASSED — ${TRIAGE.length} design name(s) triaged against the composed schema: ${count('delivered')} delivered, ` +
		`${count('naming')} served under another name, ${count('retired')} retired, ${count('build')} to build ` +
		`(baseline ${BUILD_BASELINE}, only shrinks), ${count('drop')} dropped; the published table matches.`
);
