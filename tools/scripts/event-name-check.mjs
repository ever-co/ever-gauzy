#!/usr/bin/env node
/**
 * Gate: every durable event name is `<aggregate>.<past-tense-verb>`, with a snake_case aggregate.
 *
 * An event name is an API contract: a webhook subscriber configures it, a queue dashboard groups by it,
 * and a delivery record stores it. The doctrine names the aggregate segment after the *table* the fact
 * is about — `contact_group.changed`, `event_delivery.changed`, `commerce_cart.abandoned` — and every
 * one of those tables is snake_case, so an event name that spells its aggregate the way the *package*
 * folder is spelled (`seller-offering.created`) names one concept two ways and cannot be derived from
 * the table it describes.
 *
 * The check reads the quoted event names the plugins and the kernel record, which is where a durable
 * event actually gets its name: `name: '<event>'` on an outbox append, `emit(row, '<event>')`, and the
 * name catalogues a plugin keeps. A dotted string that is a file name, an import path, a settings key
 * or an idempotency scope is not an event and is left alone — those have their own conventions in the
 * doctrine's §9 tables, and conflating them is how a gate starts failing on things it never meant to
 * check.
 *
 * Run from the repository root: `node tools/scripts/event-name-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const ROOTS = [join(ROOT, 'packages', 'plugins'), join(ROOT, 'packages', 'core', 'src', 'lib')];

/**
 * How an event name is written where it is recorded.
 *
 * Each of these is a *producer* rather than a mention: the first two are how a row is appended to the
 * outbox, and the third is a name catalogue — a plugin's own list of the names it emits, such as
 * `CHANNEL_EVENT_NAMES = { CHANNEL_CHANGED: 'channel.changed' }` — which is what a rename has to keep
 * in step with.
 *
 * The catalogue is read through its own declaration rather than through any `SCREAMING_KEY: 'dotted'`
 * member, because that shape is everywhere: a widget registry spells its entries `time-tracking.tasks`
 * and a dashboard's ids are not event names. Only a constant *named* for events holds events.
 */
const PRODUCERS = [
	/\bname:\s*'([^']+)'/g,
	/\bemit\(\s*[^,)]+,\s*'([^']+)'/g,
	/\bemit\(\s*[^,)]+,\s*[^,)]+,\s*'([^']+)'/g
];

/** The bodies of the event-name catalogues a file declares. */
function eventCatalogues(source) {
	const bodies = [];

	for (const catalogue of source.matchAll(/export const \w*EVENT\w*\s*=\s*\{([\s\S]*?)\n\}/g)) {
		bodies.push(catalogue[1]);
	}

	return bodies;
}

/** Names that are not events, with the reason each is exempt. */
const NOT_EVENTS = new Map([
	['event-outbox.dispatch', 'a queue job name, which the doctrine spells kebab-case'],
	['event-outbox.dispatch.schedule', 'a schedule name, which follows the job it fires']
]);

/** Every `.ts` file under a directory, skipping build output and suites. */
function sourceFiles(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			sourceFiles(full, found);
		} else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
			found.push(full);
		}
	}
	return found;
}

const offenders = [];
const seen = new Map();

for (const file of ROOTS.flatMap((root) => sourceFiles(root))) {
	const source = readFileSync(file, 'utf8');
	const path = relative(ROOT, file).split('\\').join('/');

	/** Every place this file records a name, as `[name, offset]`. */
	const recorded = [];

	for (const pattern of PRODUCERS) {
		for (const match of source.matchAll(pattern)) {
			recorded.push([match[1], match.index]);
		}
	}

	for (const catalogue of eventCatalogues(source)) {
		for (const match of catalogue.matchAll(/'([^']+)'/g)) {
			recorded.push([match[1], source.indexOf(catalogue) + match.index]);
		}
	}

	for (const [name, offset] of recorded) {
		// A durable event name has an aggregate and a verb: `seller_offering.created`. Anything with no
		// dot at all is a different kind of string (`name: 'Default Approval Policy'` in a seeder).
		if (!/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/.test(name)) continue;

		seen.set(name, (seen.get(name) ?? 0) + 1);

		if (NOT_EVENTS.has(name)) continue;

		const segment = name.split('.')[0];
		if (!/-/.test(segment)) continue;

		const line = source.slice(0, offset).split('\n').length;
		offenders.push(`${path}:${line} -> \`${name}\`: the aggregate is spelled \`${segment.replace(/-/g, '_')}\``);
	}
}

if (offenders.length > 0) {
	console.error('FAILED — event names whose aggregate segment is not the table it names:');
	for (const offender of offenders) console.error(`  ${offender}`);
	console.error('');
	console.error(`The doctrine (§9.4) spells the aggregate in snake_case, because it names the table.`);
	process.exit(1);
}

const hyphenated = [...seen.keys()].filter((name) => /-/.test(name.split('.')[0]));
console.log(
	`PASSED — ${seen.size} event name(s) recorded across the plugins and the kernel all spell their ` +
		`aggregate in snake_case` +
		(hyphenated.length > 0
			? `, with ${hyphenated.length} exempt: ${hyphenated.map((name) => `\`${name}\``).join(', ')}.`
			: ', and none needed an exemption.')
);
