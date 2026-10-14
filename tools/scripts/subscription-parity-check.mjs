#!/usr/bin/env node
/**
 * Gate: the GraphQL subscription dimension — what is promised, what is served, and what can actually fire.
 *
 * The platform-extensions design's §3.2 rows promise **86** subscriptions and the composed schema served about
 * **31**, while §3.1's nine parity dimensions leave subscriptions out — so nothing measured the largest undelivered
 * surface in the programme (handover 2026-09-20 §7.65 item 19, §7.68 class 1). **Owner decision 8 (2026-10-13):
 * "Add a gate + build backlog".** This is the gate; the backlog is the `PROMISED` rows the schema does not serve.
 *
 * **Where the promises come from.** The design documents are not in this repository (`PLATFORM-EXTENSIONS.md`), so
 * the list is built from what the code and the programme's records state, and each row says which:
 *
 * - `served`  — every Subscription root field the composed schema serves is a promise kept, and must be listed
 *               here: a new stream is recorded when it lands, so the table stays the whole dimension.
 * - `design`  — names the handover records as promised by §3.2 and served by nothing (§7.65 item 19 and §7.68:
 *               `cartChanged`, `checkoutCompleted`, `sellerChanged`, `orderReturnChanged`, `fulfillmentCreated`,
 *               `pickListChanged`, `integrationSyncCompleted`).
 * - `event`   — derived from the events the plugins already append and stream through `Subscription.events`
 *               (`*_STREAMED_EVENTS`): **every durable aggregate a plugin streams gets a typed field** (or a reason
 *               in `AGGREGATES_WITHOUT_A_FIELD`), because `events(names:)` hands a client an untyped envelope while
 *               a typed field hands it the row. A new aggregate appended to a streamed catalogue fails here until
 *               it has a decision.
 *
 * **What is checked.**
 *
 * 1. Every served Subscription field is a `PROMISED` row (descriptions are stripped first: a description line
 *    reading "never a system of record:" is not a field).
 * 2. Every durable streamed aggregate is covered by a row's `aggregates`, or excused with a reason.
 * 3. **The backlog only shrinks**: the rows the schema does not serve must number exactly `BACKLOG_BASELINE`. More
 *    fails (a promise was added without being built — record it deliberately by raising the baseline in review);
 *    fewer fails too, asking for the baseline to be lowered so it cannot grow back.
 * 4. **A served stream must be able to fire.** A plugin field that streams an in-process event (`eventBus.ofType(X)`)
 *    is silent when nothing outside the resolvers and the suites publishes `X` — bound, typed, gated, and never
 *    delivered. Those are counted against `SILENT_BASELINE`, which only shrinks the same way.
 * 5. A row the design promised and the platform's own subscription doctrine refuses is listed in `REFUSED` with the
 *    reason, never silently dropped; a refused name that becomes served fails.
 *
 * The readers are exported and held to every shape they must read by `subscription-parity-check.test.mjs`
 * (`node --test tools/scripts/subscription-parity-check.test.mjs`): a commented-out publish is not a producer, and a
 * catalogue in any quote style or with `as const` is read — a declaration the reader cannot resolve fails the gate.
 *
 * Run from the repository root: `node tools/scripts/subscription-parity-check.mjs [--list]`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');
const SOURCE_ROOTS = [join(ROOT, 'packages', 'plugins'), join(ROOT, 'packages', 'core', 'src', 'lib')];

/** Promised subscription fields not yet served. Only shrinks (rule 3). */
const BACKLOG_BASELINE = 11;

/** Served plugin streams no producer feeds. Only shrinks (rule 4). */
const SILENT_BASELINE = 6;

/** @type {{ name: string, owner: string, source: 'served'|'design'|'event', aggregates?: string[], note?: string }[]} */
const PROMISED = [
	// — Served: the kernel's own streams (core).
	{ name: 'events', owner: 'core/graphql', source: 'served', note: 'every catalogued platform event, selected by name' },
	{ name: 'channelChanged', owner: 'core/channel', source: 'served' },
	{ name: 'regionChanged', owner: 'core/region', source: 'served' },
	{ name: 'contactGroupChanged', owner: 'core/contact-group', source: 'served' },
	{ name: 'eventDeliveryChanged', owner: 'core/event-outbox', source: 'served' },
	{ name: 'operationStepChanged', owner: 'core/operation', source: 'served' },
	{ name: 'operationCompleted', owner: 'core/operation', source: 'served' },
	{ name: 'operationFailed', owner: 'core/operation', source: 'served' },
	{ name: 'webhookDeliveryFailed', owner: 'core/webhook', source: 'served' },
	{ name: 'webhookSubscriptionDisabled', owner: 'core/webhook', source: 'served' },

	// — Served: plugin streams.
	{ name: 'collectionChanged', owner: 'catalog', source: 'served' },
	{ name: 'productPublished', owner: 'catalog', source: 'served' },
	{ name: 'productUnpublished', owner: 'catalog', source: 'served' },
	{ name: 'entitlementChanged', owner: 'entitlement', source: 'served', aggregates: ['entitlement'] },
	{ name: 'entitlementActivated', owner: 'entitlement', source: 'served' },
	{ name: 'entitlementRevoked', owner: 'entitlement', source: 'served' },
	{ name: 'stockLevelChanged', owner: 'inventory', source: 'served' },
	{ name: 'stockLevelLow', owner: 'inventory', source: 'served' },
	{ name: 'stockLevelOutOfStock', owner: 'inventory', source: 'served' },
	{ name: 'stockReservationChanged', owner: 'inventory', source: 'served' },
	{ name: 'stockTransferChanged', owner: 'inventory', source: 'served' },
	{ name: 'paymentAuthorized', owner: 'payment', source: 'served' },
	{ name: 'paymentFailed', owner: 'payment', source: 'served' },
	{ name: 'paymentCanceled', owner: 'payment', source: 'served' },
	{ name: 'paymentCaptured', owner: 'payment', source: 'served' },
	{ name: 'paymentRefunded', owner: 'payment', source: 'served' },
	{ name: 'refundCreated', owner: 'payment', source: 'served' },
	{ name: 'promotionChanged', owner: 'promotion', source: 'served' },
	{ name: 'promotionBudgetExhausted', owner: 'promotion', source: 'served' },
	{ name: 'couponRedeemed', owner: 'promotion', source: 'served' },
	{ name: 'giftCardRedeemed', owner: 'promotion', source: 'served' },

	// — Promised by the design and served by nothing (handover 2026-09-20 §7.65 item 19, §7.68).
	{
		name: 'checkoutCompleted',
		owner: 'order',
		source: 'design',
		note: 'follows `order.placed` (the order catalogue says it "rides `order.placed`")'
	},
	{ name: 'sellerChanged', owner: 'marketplace', source: 'design', aggregates: ['seller'], note: 'follows `seller.*`' },
	{ name: 'orderReturnChanged', owner: 'returns', source: 'design', aggregates: ['return'], note: 'follows `return.*`' },
	{ name: 'fulfillmentCreated', owner: 'fulfillment', source: 'design', note: 'follows `fulfillment.created`' },
	{ name: 'pickListChanged', owner: 'warehouse', source: 'design', note: 'the warehouse plugin publishes no event yet' },
	{
		name: 'integrationSyncCompleted',
		owner: 'core/integration',
		source: 'design',
		note: 'no integration publishes a sync-completed fact yet (§7.68 class 5)'
	},

	// — Derived: a durable aggregate the plugins stream through `events(names:)` with no typed field of its own.
	{ name: 'orderChanged', owner: 'order', source: 'event', aggregates: ['order'], note: 'follows `order.*`' },
	{
		name: 'fulfillmentChanged',
		owner: 'fulfillment',
		source: 'event',
		aggregates: ['fulfillment'],
		note: 'follows `fulfillment.*` (shipped, in transit, delivered, canceled — `fulfillmentCreated` is the first move only)'
	},
	{ name: 'sellerOfferingChanged', owner: 'marketplace', source: 'event', aggregates: ['seller_offering'], note: 'follows `seller_offering.*`' },
	{ name: 'sellerPayoutChanged', owner: 'marketplace', source: 'event', aggregates: ['seller_payout'], note: 'follows `seller_payout.*`' },
	{ name: 'sellerSettlementChanged', owner: 'marketplace', source: 'event', aggregates: ['seller_settlement'], note: 'follows `seller_settlement.*`' },
	{
		name: 'sellerTransactionChanged',
		owner: 'marketplace',
		source: 'event',
		aggregates: ['seller.transaction'],
		note: 'follows `seller.transaction.*` (the ledger)'
	},
	{
		name: 'customerSubscriptionChanged',
		owner: 'subscription',
		source: 'event',
		aggregates: ['subscription'],
		note: 'follows `subscription.*`; the type is `CustomerSubscription`, so the field cannot be `subscriptionChanged` without reading as the root type'
	},
	{
		name: 'entitlementKeyChanged',
		owner: 'entitlement',
		source: 'event',
		aggregates: ['entitlement_key'],
		note: 'follows `entitlement_key.revoked` (`entitlement_key.issued` stays withheld: its payload carries the holder’s e-mail)'
	}
];

/** Names a promise covered and the platform's own subscription doctrine refuses, with the reason. */
const REFUSED = new Map([
	[
		'cartChanged',
		'design-promised (§7.65 item 19) and refused by the kernel’s subscription doctrine: `commerce_cart.updated` is in ' +
			'`NON_SUBSCRIBABLE_EVENT_NAMES` (subscription-catalogue.ts) — "a stream that fires on every cart keystroke … is a ' +
			'load generator rather than an integration". A completed cart is `checkoutCompleted`. Owner to confirm.'
	]
]);

/** Durable aggregates a plugin streams that deliberately get no typed field, with the reason. */
const AGGREGATES_WITHOUT_A_FIELD = new Map([]);

// ————————————————————————————————————————————————————————————————————————————————————————————————————————————
// The readers. Pure functions over source text, exported so `subscription-parity-check.test.mjs` can hold each one
// to the shapes it must read — a reader that silently skips a shape is how a gate stops measuring.

/**
 * Source text with its comments removed, so a commented-out call is not read as a call.
 *
 * Strings are kept intact — a `//` inside a quoted URL is not a comment — by walking the text once.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
	let out = '';
	let quote = null;
	for (let index = 0; index < source.length; index++) {
		const character = source[index];
		const next = source[index + 1];
		if (quote) {
			out += character;
			if (character === '\\') {
				out += next ?? '';
				index++;
			} else if (character === quote) {
				quote = null;
			}
			continue;
		}
		if (character === "'" || character === '"' || character === '`') {
			quote = character;
			out += character;
			continue;
		}
		if (character === '/' && next === '/') {
			while (index < source.length && source[index] !== '\n') index++;
			out += '\n';
			continue;
		}
		if (character === '/' && next === '*') {
			const end = source.indexOf('*/', index + 2);
			const comment = source.slice(index, end < 0 ? source.length : end + 2);
			out += comment.replace(/[^\n]/g, ' ');
			index = end < 0 ? source.length : end + 1;
			continue;
		}
		out += character;
	}
	return out;
}

/** The string literals of an array body, in any quote style. */
function literalsOf(body) {
	return [...body.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((match) => match[2]);
}

/**
 * The durable event names the plugins stream, and every declaration the reader could not resolve.
 *
 * A catalogue is `export const <NAME>_STREAMED_EVENTS … = [ … ]` with or without a type annotation or `as const`,
 * and any quote style. Every `declareStreamedEvents(catalogue, consumer, ...names)` call must hand over string
 * literals or spreads of catalogues read here: a call this reader cannot resolve is reported, never skipped, so a
 * new way of declaring names cannot walk past the promised-field check.
 *
 * @param {Map<string, string>} sources file → text
 * @returns {{ names: { name: string, file: string }[], unreadable: string[] }}
 */
export function readStreamedCatalogues(sources) {
	const names = [];
	const catalogues = new Map();
	const unreadable = [];

	for (const [file, raw] of sources) {
		const source = stripComments(raw);
		for (const match of source.matchAll(/export\s+const\s+(\w+_STREAMED_EVENTS)\b[^=]*=\s*\[([\s\S]*?)\]/g)) {
			const literals = literalsOf(match[2]);
			catalogues.set(match[1], literals);
			for (const name of literals) names.push({ name, file });
			// A member that is not a string literal — a constant (`ORDER_EVENTS.PLACED`), a spread — cannot be read
			// here, and a name this reader cannot see is an aggregate the promised-field check never asks about.
			const rest = match[2].replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '').replace(/[\s,]/g, '');
			if (rest !== '') unreadable.push(`${file}: ${match[1]} holds a member that is not a string literal (${rest.slice(0, 60)})`);
		}
	}

	for (const [file, raw] of sources) {
		const source = stripComments(raw);
		for (const call of source.matchAll(/\bdeclareStreamedEvents\s*\(([^)]*)\)/g)) {
			if (/function\s+declareStreamedEvents/.test(source.slice(Math.max(0, call.index - 40), call.index + 30))) continue;
			const args = call[1].split(',').slice(2).map((arg) => arg.trim()).filter(Boolean);
			for (const arg of args) {
				const spread = /^\.\.\.\s*(\w+)$/.exec(arg);
				const literal = /^(['"`])([^'"`]+)\1$/.exec(arg);
				if (literal) names.push({ name: literal[2], file });
				else if (!(spread && catalogues.has(spread[1]))) unreadable.push(`${file}: declareStreamedEvents(…, ${arg})`);
			}
		}
	}

	return { names, unreadable };
}

/**
 * The in-process events a subscription resolver streams that nothing publishes.
 *
 * A producer is a source file that is neither a resolver nor a suite and **publishes the event it constructs**:
 * `publish(new X(…))`, `publish(X.from(…))`, or a variable built from `new X(` / `X.from(` that the same file then
 * hands to `publish(`. Comments are stripped first, so a commented-out publish is not a producer.
 *
 * @param {Map<string, string>} sources file → text
 * @returns {string[]} `file: Event` for every silent stream
 */
export function findSilentStreams(sources) {
	const stripped = new Map([...sources].map(([file, source]) => [file, stripComments(source)]));
	const silent = [];

	/** The argument text of every `publish(…)` call in a source, read to its matching parenthesis. */
	const publishArguments = (source) => {
		const found = [];
		for (const call of source.matchAll(/\bpublish\s*\(/g)) {
			let depth = 1;
			let index = call.index + call[0].length;
			const begin = index;
			for (; index < source.length && depth > 0; index++) {
				if (source[index] === '(') depth++;
				else if (source[index] === ')') depth--;
			}
			found.push(source.slice(begin, index - 1));
		}
		return found;
	};

	/** The local names an event goes by in one source: its own, and any `import { Event as Local }` alias. */
	const localNamesOf = (source, event) => {
		const local = new Set([event]);
		for (const statement of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
			for (const member of statement[1].split(',')) {
				const [imported, alias] = member.trim().split(/\s+as\s+/);
				if (imported === event && alias) local.add(alias.trim());
			}
		}
		return [...local];
	};

	const publishes = (source, event) => {
		const handed = publishArguments(source);
		for (const name of localNamesOf(source, event)) {
			const construction = `(?:new\\s+${name}\\s*\\(|\\b${name}\\.from\\s*\\()`;
			if (handed.some((argument) => new RegExp(construction).test(argument))) return true;
			// `const event = X.from(row); … publish(event)`: a variable built from the event and handed to a publish.
			const assigned = new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:await\\s+)?${construction}`, 'g');
			for (const assignment of source.matchAll(assigned)) {
				if (handed.some((argument) => new RegExp(`^\\s*${assignment[1]}\\b`).test(argument))) return true;
			}
		}
		return false;
	};

	for (const [file, source] of stripped) {
		if (!/@Subscription\(/.test(source)) continue;
		// The event's identity is the name it is exported under; the resolver may know it by an alias
		// (`import { WidgetChangedEvent as Changed }`), and it is the alias the stream is built with.
		const imported = new Map();
		for (const statement of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
			for (const member of statement[1].split(',')) {
				const [name, alias] = member.trim().split(/\s+as\s+/);
				if (/^[A-Z]\w*Event$/.test(name)) imported.set(name, (alias ?? name).trim());
			}
		}
		const body = source.replace(/import[\s\S]*?;\r?\n/g, '');
		for (const [event, local] of imported) {
			// Only an event the resolver hands to a stream (an argument, not a type annotation) is one it delivers.
			if (!new RegExp(`[(,]\\s*${local}\\s*[,)]`).test(body)) continue;
			const produced = [...stripped].some(
				([other, otherSource]) => other !== file && !/\.resolver\.ts$/.test(other) && publishes(otherSource, event)
			);
			if (!produced) silent.push(`${relative(ROOT, file).replace(/\\/g, '/')}: ${event}`);
		}
	}

	return silent;
}

/**
 * The Subscription root fields an SDL serves, read with every description removed.
 *
 * @param {string} sdl
 * @returns {string[]}
 */
export function readServedSubscriptions(sdl) {
	const schema = sdl.replace(/"""[\s\S]*?"""/g, '').replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '');
	const fields = [];
	let inside = false;
	for (const line of schema.split(/\r?\n/)) {
		if (/^type Subscription \{/.test(line)) {
			inside = true;
			continue;
		}
		if (inside && /^\}/.test(line)) break;
		const field = inside ? /^ {2}([A-Za-z_]\w*)\s*[(:]/.exec(line) : null;
		if (field) fields.push(field[1]);
	}
	return fields;
}

/** Every `.ts` source under a directory, suites and build output skipped. */
function sources(directory, found = []) {
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === 'dist' || entry === 'migrations') continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) sources(path, found);
		else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) found.push(path);
	}
	return found;
}

const aggregateOf = (name) => name.split('.').slice(0, -1).join('.');

// ————————————————————————————————————————————————————————————————————————————————————————————————————————————

function main() {
	const files = SOURCE_ROOTS.flatMap((root) => sources(root));
	const text = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));

	const { names: streamedNames, unreadable } = readStreamedCatalogues(text);
	const streamedAggregates = [...new Set(streamedNames.map((entry) => aggregateOf(entry.name)))].sort();
	const silent = findSilentStreams(text);
	const served = readServedSubscriptions(readFileSync(SDL, 'utf8'));
	const promisedNames = new Set(PROMISED.map((row) => row.name));
	const failures = [];

	for (const declaration of unreadable) {
		failures.push(`a streamed-event declaration this gate cannot read: ${relative(ROOT, declaration).replace(/\\/g, '/')} — state the names in a *_STREAMED_EVENTS catalogue`);
	}

	const duplicates = PROMISED.map((row) => row.name).filter((name, index, all) => all.indexOf(name) !== index);
	for (const name of duplicates) failures.push(`${name} is promised twice`);

	for (const name of served) {
		if (REFUSED.has(name)) failures.push(`${name} is served and recorded as refused — take it out of REFUSED and promise it`);
		else if (!promisedNames.has(name)) failures.push(`Subscription.${name} is served and not recorded in PROMISED — add its row`);
	}

	for (const row of PROMISED) {
		if (row.source === 'served' && !served.includes(row.name)) {
			failures.push(`${row.name} is recorded as served and the composed schema does not serve it`);
		}
		if (REFUSED.has(row.name)) failures.push(`${row.name} is both promised and refused`);
	}

	const covered = new Set(PROMISED.flatMap((row) => row.aggregates ?? []));
	for (const aggregate of streamedAggregates) {
		if (!covered.has(aggregate) && !AGGREGATES_WITHOUT_A_FIELD.has(aggregate)) {
			const example = streamedNames.find((entry) => aggregateOf(entry.name) === aggregate);
			failures.push(
				`the durable aggregate \`${aggregate}\` is streamed (${example.name}, ${relative(ROOT, example.file).replace(/\\/g, '/')}) ` +
					'and no promised field covers it — promise a typed field or record why not in AGGREGATES_WITHOUT_A_FIELD'
			);
		}
	}
	for (const aggregate of AGGREGATES_WITHOUT_A_FIELD.keys()) {
		if (!streamedAggregates.includes(aggregate)) failures.push(`AGGREGATES_WITHOUT_A_FIELD names \`${aggregate}\`, which nothing streams any more`);
	}

	const backlog = PROMISED.filter((row) => !served.includes(row.name));
	if (backlog.length > BACKLOG_BASELINE) {
		failures.push(`${backlog.length} promised subscriptions are not served and the baseline is ${BACKLOG_BASELINE}: the backlog only shrinks`);
	} else if (backlog.length < BACKLOG_BASELINE) {
		failures.push(`the backlog shrank to ${backlog.length} — lower BACKLOG_BASELINE to ${backlog.length} so it cannot grow back`);
	}

	if (silent.length > SILENT_BASELINE) {
		failures.push(`${silent.length} served streams have no producer and the baseline is ${SILENT_BASELINE}:\n    ${silent.join('\n    ')}`);
	} else if (silent.length < SILENT_BASELINE) {
		failures.push(`only ${silent.length} served stream(s) are silent now — lower SILENT_BASELINE to ${silent.length}`);
	}

	if (process.argv.includes('--list')) {
		console.log(`served (${served.length}): ${served.join(', ')}`);
		console.log(`backlog (${backlog.length}): ${backlog.map((row) => `${row.name} [${row.owner}, ${row.source}]`).join(', ')}`);
		console.log(`refused (${REFUSED.size}): ${[...REFUSED.keys()].join(', ')}`);
		console.log(`silent (${silent.length}):\n  ${silent.join('\n  ')}`);
		console.log(`streamed durable aggregates (${streamedAggregates.length}): ${streamedAggregates.join(', ')}`);
	}

	if (failures.length > 0) {
		console.error('FAILED — the subscription dimension moved:');
		for (const failure of failures) console.error(`  ${failure}`);
		process.exit(1);
	}

	console.log(
		`PASSED — ${PROMISED.length} subscription(s) promised (${PROMISED.filter((row) => row.source === 'served').length} served, ` +
			`${PROMISED.filter((row) => row.source === 'design').length} named by the design, ${PROMISED.filter((row) => row.source === 'event').length} derived from ` +
			`${streamedAggregates.length} streamed durable aggregates); ${served.length} served, ${backlog.length} in the backlog ` +
			`(baseline ${BACKLOG_BASELINE}, only shrinks), ${silent.length} served stream(s) with no producer (baseline ${SILENT_BASELINE}), ` +
			`${REFUSED.size} refused with a reason.`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
