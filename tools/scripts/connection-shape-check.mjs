#!/usr/bin/env node
/**
 * Gate: the GraphQL list surface follows the connection contract the doctrine states.
 *
 * The doctrine's §3.1 parity table requires that a list root field be the REST list route's counterpart:
 * *"Read many — a connection query supporting the same filters, the same sort keys, the same relation
 * loading and the same soft-delete visibility as the REST list route"*, and *"Count — `totalCount` on the
 * connection"*. Three rules follow, and none of them held across the whole surface when this gate was
 * written:
 *
 *   1. **A list root field returns a connection**, not a bare array. A bare array cannot be paged,
 *      filtered or counted, so the client that has the REST list has no counterpart to move to — which is
 *      the whole point of the parity requirement.
 *   2. **A connection carries `nodes`, `edges`, `totalCount` and a non-null `pageInfo`.** The older shape
 *      spelled the count `total` and left `pageInfo` nullable; a client that branches on `totalCount`
 *      reads nothing from those, and one that pages through a nullable `pageInfo` has to defend against a
 *      boundary it can never actually meet.
 *   3. **A count root field is nullable.** REST answers a bare number and a count that cannot be null
 *      cannot express "not counted" — which is what the doctrine says a `count` query is for.
 *
 * Both halves of the surface are read from the composed SDL, which is what the endpoint serves.
 *
 * **The three lists below are the baseline, and they are the point of this gate rather than an exception to
 * it.** A field that answers a bare array is in one of them, with the reason it is there: it is one of this
 * programme's own list reads that has not been converted yet, it is a computed answer that has no page to
 * walk, or it is the platform's own field whose clients already read it. Naming every one of them is what
 * makes the remainder countable and keeps a *new* one from appearing unnoticed — and each conversion is a
 * line removed from these lists. A name that no longer violates its rule is reported as stale, so the wave
 * that lands it has to take it out rather than leaving the list describing a state that has moved on.
 *
 * The connection-shape baseline is empty: every `*Connection` type in the composed schema is canonical, so
 * a new one that is not fails here rather than being added to a list.
 *
 * Run from the repository root: `node tools/scripts/connection-shape-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');

/** The SDL, with descriptions removed: a description's lines are indented like a field's. */
const schema = readFileSync(SDL, 'utf8')
	.replace(/"""(?:[\s\S]*?)"""/g, '')
	.replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '')
	.replace(/^[ \t]*#.*$/gm, '');

/**
 * List root fields this programme introduced that still answer a bare array.
 *
 * **Empty, and that is the point of keeping it.** The last name, `stockLevels`, left when its service grew a
 * paged read — a window, an order and a count on one predicate — so a list root field that answers an array
 * now fails this gate outright instead of being named here. The list stays because removing it would remove
 * the stale-entry check with it: the next wave that needs an exemption gets the same accounting for free.
 */
const PROGRAMME_BARE_ARRAYS = new Set([]);

/**
 * List root fields whose answer is **computed** rather than read: a resolution over a context, an
 * aggregation, or the bounded components of one parent row.
 *
 * The rule above exists because a client that has a REST list route needs its counterpart over GraphQL —
 * the same filters, the same paging, the same count. These fields have no such route. `resolveTaxRate`
 * answers "which rates apply here", `searchFacets` answers "how many of each", and `taxRateParts` answers
 * "what is this one rate made of": each is a question about a context or a parent, answered by a service
 * that computes it, and none of them has a row set that could be paged, counted or resumed from a cursor.
 * Dressing one as a connection would put a `totalCount` and a `pageInfo` on a field that can honour
 * neither, which is a worse lie than a bare array.
 *
 * They are named here for the same reason the other two lists are: the exemption is visible and
 * reviewable, and a field that stops being a computed answer has to leave this list to be caught.
 */
const COMPUTED_ANSWERS = new Set([
	// A resolution: which rates apply to this destination, direction and category.
	'resolveTaxRate',
	// A resolution: what a variant costs in this context, per currency and quantity band.
	'resolvePrice',
	// The components of one parent row, bounded by that row's own composition.
	'taxRateParts',
	'taxRegimeRates',
	// A resolution: which delivery options a cart may choose, each with its reason.
	'shippingOptionsForContext',
	// An aggregation over a search: the ranked completions for a prefix, and the bucket counts.
	'searchSuggest',
	'searchFacets',
	// An aggregation over one seller's settlements.
	'sellerSplitReconciliation',
	// The capacity breaches of one bin's contents.
	'warehouseBinCapacityWarnings',
]);

/**
 * List root fields that predate this programme and answer a bare array.
 *
 * **These are not this branch's to change.** Each is served by the platform's own application today, so a
 * field that started returning a connection instead of a list is a breaking change to a surface somebody
 * else's client reads — which is the owner's decision, not a branch's. They are named here so the rule can
 * be enforced everywhere else, and so the exemption is visible rather than implied by a count.
 */
const PLATFORM_BARE_ARRAYS = new Set([
	'addressRoles', 'splitExpensesByEmployee', 'mySplitExpenses', 'featureToggleDefinitions',
	'myIncomes', 'unitCategories', 'units', 'organizationContactsByEmployee',
	'organizationProjectsByEmployee', 'organizationStrategicInitiativesByProject', 'paymentTerms', 'myRolePermissions',
]);

/**
 * Connection types that still spell their count `total` rather than `totalCount`, or leave `pageInfo`
 * nullable, or carry no `edges`.
 *
 * **Empty, and that is the point of keeping it.** The wave that converted the last thirteen — the four of
 * pricing, the four of ordering, the three of fulfilment and the two of the cart — took every entry out, so
 * a connection that departs from the canonical shape now fails this gate outright instead of being named
 * here. The list stays because removing it would remove the stale-entry check with it: the next wave that
 * needs an exemption gets the same accounting for free, and a name left in it after its conversion is
 * reported rather than quietly tolerated.
 */
const LEGACY_CONNECTIONS = new Set([]);

/** The body of `type <name> { … }`, or null when the schema declares no such type. */
function typeBody(name) {
	const start = schema.search(new RegExp(`^type\\s+${name}\\b[^{]*\\{`, 'm'));
	if (start === -1) return null;

	const open = schema.indexOf('{', start);
	let depth = 0;

	for (let index = open; index < schema.length; index++) {
		if (schema[index] === '{') depth++;
		else if (schema[index] === '}') {
			depth--;
			if (depth === 0) return schema.slice(open + 1, index);
		}
	}

	return null;
}

/** The fields a type declares at depth 0, with their type text. */
function fieldsOf(body) {
	const found = [];
	let braces = 0;
	let parens = 0;

	for (const line of body.split('\n')) {
		if (braces === 0 && parens === 0) {
			const field = /^\s*([A-Za-z_]\w*)\s*(\([\s\S]*?\))?\s*:\s*(.+?)\s*$/.exec(line);

			if (field) found.push({ name: field[1], type: field[3] });
		}

		for (const character of line) {
			if (character === '{') braces++;
			else if (character === '}') braces--;
			else if (character === '(') parens++;
			else if (character === ')') parens--;
		}
	}

	return found;
}

const failures = [];
const stale = [];
const queryFields = fieldsOf(typeBody('Query') ?? '');

// 1. A list root field is a connection.
for (const field of queryFields) {
	if (!/^\[/.test(field.type)) continue;

	if (
		!COMPUTED_ANSWERS.has(field.name) &&
		!PROGRAMME_BARE_ARRAYS.has(field.name) &&
		!PLATFORM_BARE_ARRAYS.has(field.name)
	) {
		failures.push(
			`Query.${field.name} -> returns \`${field.type}\`, a bare array; a list root field returns a connection`
		);
	}
}

// 3. A count root field is nullable.
//
// The name is what decides, and it ends with `Count` rather than starting with one: `countries` is a
// connection over countries, and a rule that read the prefix would have called it a count.
for (const field of queryFields) {
	const isCount = field.name === 'count' || /Count$/.test(field.name);

	if (!isCount || !field.type.endsWith('!')) continue;

	failures.push(`Query.${field.name} -> returns \`${field.type}\`; a count is nullable, because REST's bare number is`);
}

// 2. A connection is the canonical shape.
const connections = [...schema.matchAll(/^type\s+([A-Za-z_]\w*Connection)\b[^{]*\{/gm)].map((block) => block[1]);

for (const name of connections) {
	const body = typeBody(name);
	if (!body) continue;

	const fields = new Map(fieldsOf(body).map((field) => [field.name, field.type]));
	const missing = ['nodes', 'edges', 'totalCount', 'pageInfo'].filter((member) => !fields.has(member));
	const nullablePageInfo = fields.has('pageInfo') && !fields.get('pageInfo').endsWith('!');
	const carriesOldCount = fields.has('total') && !fields.has('totalCount');

	if (missing.length === 0 && !nullablePageInfo && !carriesOldCount) {
		if (LEGACY_CONNECTIONS.has(name)) {
			stale.push(`${name} is the canonical shape now — take it out of LEGACY_CONNECTIONS`);
		}
		continue;
	}

	if (!LEGACY_CONNECTIONS.has(name)) {
		failures.push(
			`${name} -> ${
				missing.length ? `missing ${missing.join(', ')}` : nullablePageInfo ? 'pageInfo is nullable' : 'spells the count `total`'
			}`
		);
	}
}

for (const name of [...COMPUTED_ANSWERS, ...PROGRAMME_BARE_ARRAYS, ...PLATFORM_BARE_ARRAYS]) {
	if (!queryFields.some((field) => field.name === name && /^\[/.test(field.type))) {
		const list = COMPUTED_ANSWERS.has(name)
			? 'COMPUTED_ANSWERS'
			: PROGRAMME_BARE_ARRAYS.has(name)
				? 'PROGRAMME_BARE_ARRAYS'
				: 'PLATFORM_BARE_ARRAYS';

		stale.push(`Query.${name} no longer returns a bare array — take it out of ${list}`);
	}
}

if (failures.length > 0) {
	console.error('FAILED — the list surface departs from the connection contract:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('A list root field returns a connection; a connection carries nodes, edges, totalCount');
	console.error('and a non-null pageInfo; a count is nullable. A field that cannot follow the rule is named in');
	console.error('one of the three lists at the top of this file, with the reason it is exempt.');
	process.exit(1);
}

if (stale.length > 0) {
	console.error('FAILED — the baseline describes a surface that has moved on:');
	for (const entry of stale) console.error(`  ${entry}`);
	console.error('');
	console.error('Remove each entry from the list it is in, so the gate keeps measuring what is left.');
	process.exit(1);
}

console.log(
	`PASSED — ${queryFields.length} root field(s) read: ${PROGRAMME_BARE_ARRAYS.size} list field(s) of this ` +
		`programme still answer a bare array, ${COMPUTED_ANSWERS.size} are computed answers that have no page to ` +
		`walk, and ${PLATFORM_BARE_ARRAYS.size} predate the programme — each named in the baseline. All ` +
		`${connections.length} connection type(s) are the canonical shape, and every other list field is a connection.`
);
