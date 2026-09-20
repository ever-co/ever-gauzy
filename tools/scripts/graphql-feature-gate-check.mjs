#!/usr/bin/env node
/*
 * A flag that gates a fraction of an endpoint is not a flag.
 *
 * `FEATURE_GRAPHQL` is the catalogue's code for "the GraphQL endpoint and its resolvers, under the same
 * guards and permissions as REST" (`packages/core/src/lib/feature/commerce-feature-catalogue.ts`), and
 * it is on by default. An operator who switches it off expects the GraphQL door to be shut. A resolver
 * that does not carry the gate stays open, and nothing about that resolver looks wrong: it compiles, it
 * boots, its schema is complete, its permissions are the ones its routes carry — the only symptom is
 * that a capability the operator switched off is still served, over an endpoint they believe they
 * closed. That state is not hypothetical: this programme shipped it once, with two resolvers carrying
 * the gate and every other resolver not, so the flag gated a fraction of one endpoint.
 *
 * The rule is therefore mechanical, and it is checked mechanically rather than reviewed by eye: every
 * class under the trees this script scans that carries a class-level `@Resolver(` must also carry
 * `@FeatureFlag(` — the code `FeatureFlagGuard` reads from `FEATURE_METADATA` with `getAllAndOverride`
 * over the handler and then the class. A resolver that hosts fields rather than a resource (a plain
 * container class) is held to the same rule as its neighbours, because its fields are served through
 * the same endpoint.
 *
 * **Two trees are scanned, and the second one is the reason this file has a history.** The endpoint is
 * one schema, assembled from the kernel and from every configured plugin, so a plugin resolver left
 * un-gated is exactly as open as a kernel one — and the claim `feature/graphql-feature.code.ts` makes,
 * that "every `@Resolver` this platform ships carries `@FeatureFlag(FEATURE_GRAPHQL)`", was false for
 * the plugin packages while this scan covered the kernel alone: eighty-three resolver classes across
 * sixteen plugin packages carried the decorator nowhere. A check that covers half the surface certifies
 * half the surface, which is the failure this script exists to catch, so both trees are scanned and the
 * count of each is reported.
 *
 * Two things are stated rather than inferred:
 *
 * - **The code is declared once.** Every gate states the shared `FEATURE_GRAPHQL` exported by
 *   `feature/graphql-feature.code.ts`; a resolver whose gate resolves a different code — a literal that
 *   drifted from the catalogue, or a domain code such as `WarehouseFeatures.WAREHOUSE` — is reported
 *   below, because a code no catalogue row carries is resolved by the guard as disabled, which closes
 *   that whole surface for every caller, quietly. That report is information rather than a failure: the
 *   value is the same for a literal, and what an operator's switch depends on is that the gate is there
 *   at all.
 * - **The exceptions are written down.** {@link ALLOWED} is the frozen list of resolvers that predate
 *   this convention and are deliberately not gated by the change that introduced it. An entry is a
 *   record, not a bypass: it needs a reason, and it is reported when the resolver it excuses has since
 *   been gated, so the list cannot quietly outlive the exception it describes.
 *
 * A class may state more than one code, and the decorator writes a single metadata value: the code
 * written first is the one `getAllAndOverride` resolves for every field, and each code written after it
 * is a statement that never runs. That is reported rather than forbidden, because choosing between the
 * platform gate and a domain gate is a real decision on a class that carries both, and because a
 * decision nothing prints is a decision nobody can review.
 *
 * Usage:
 *   node tools/scripts/graphql-feature-gate-check.mjs [repoRoot]
 *
 * Exits 0 when every resolver carries the gate or is on the frozen allow-list, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');

/**
 * The trees this rule is checked over, each with the label its resolvers are reported under.
 *
 * The label prefixes every path below, so a resolver is named by a path that says which tree it was
 * found in. That matters beyond readability: an allow-list key is built the same way, and a key that
 * named a bare relative path would be a key two trees could both produce — which is how an entry ends
 * up excusing a file nobody decided to excuse, the one thing an allow-list must never do.
 */
const TREES = [
	{ label: 'packages/core/src/lib', root: join(ROOT, 'packages', 'core', 'src', 'lib') },
	{ label: 'packages/plugins', root: join(ROOT, 'packages', 'plugins') }
];

/** The class-level resolver decorator, the test for it, and the gate it must be accompanied by. */
const RESOLVER = /^@Resolver\(/gm;
const HAS_RESOLVER = /^@Resolver\(/m;
const FEATURE_FLAG = /@FeatureFlag\(/;

/** Every code one class-level decorator block states, in the order the file states them. */
const FEATURE_FLAG_ARGUMENT = /@FeatureFlag\(\s*([^)]*?)\s*\)/g;

/** The gate as it is meant to be spelled: the shared constant, named rather than repeated. */
const SHARED_CODE = 'FEATURE_GRAPHQL';

/**
 * The resolvers this rule does not hold yet, and why — the short written record of the exception.
 *
 * A file here is one that carries `@Resolver(` and no `@FeatureFlag(`, and is knowingly left that way.
 * The list is keyed by the path this script reports — the tree's label, then the path relative to that
 * tree — and each entry states the reason in the same breath as the file, so nobody has to reconstruct
 * it later.
 *
 * **It holds two entries, and both are reference data rather than tenant data.** The currency and country
 * resolvers are `@Public()`: the platform's delivered routes for them are open, and a `@Public()` handler
 * runs without the tenant guard that establishes the request context the gate reads. A gate installed on
 * them therefore answered "disabled" for *every* caller — observed on a running installation, where the two
 * surfaces were refused to a tenant that has the capability switched on — and the question has no answer
 * for them anyway: both tables are installation-wide and carry no tenancy column, so there is no scope
 * whose rows could disagree. An entry is a decision to leave one resolver outside the switch and belongs
 * here only with a reason of that kind; a resolver over tenant data does not qualify.
 */
const ALLOWED = new Map([
	[
		'packages/core/src/lib/currency/currency.resolver.ts',
		'public reference data with no tenancy column: the gate is tenant-scoped and a @Public() handler has no scope to evaluate it against'
	],
	[
		'packages/core/src/lib/country/country.resolver.ts',
		'public reference data with no tenancy column: the gate is tenant-scoped and a @Public() handler has no scope to evaluate it against'
	]
]);

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** Every `.ts` file under `dir` that is not a spec. */
function sources(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}

	for (const entry of entries) {
		const full = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
			sources(full, out);
		} else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
			// `*.spec.ts` is skipped rather than merely unreported: a suite that declares a throwaway
			// resolver is not a surface this endpoint serves.
			out.push(full);
		}
	}

	return out;
}

/**
 * The resolver classes one file declares, with the decorator block each one carries.
 *
 * A class is read as the text between its own `@Resolver(` line and the `export class` declaration that
 * follows it, so a file that ever declared two resolver classes is checked class for class rather than
 * once for the file.
 *
 * @param source The file's text.
 * @returns {Array<{line: number, name: string, block: string}>} One entry per resolver class.
 */
function resolverClasses(source) {
	const classes = [];

	for (const match of source.matchAll(RESOLVER)) {
		const from = match.index;
		const declaration = source.indexOf('export class', from);
		const block = declaration === -1 ? source.slice(from) : source.slice(from, declaration);
		const name = declaration === -1 ? undefined : /export class (\w+)/.exec(source.slice(declaration))?.[1];

		classes.push({
			line: source.slice(0, from).split('\n').length,
			name: name ?? '(unnamed)',
			block
		});
	}

	return classes;
}

const resolvers = [];
const gated = [];
const ungated = [];
const allowed = [];
const gatedWithOtherCode = [];
const multipleCodes = [];
const staleAllowList = [];
const perTree = new Map(TREES.map((tree) => [tree.label, { checked: 0, gated: 0, allowed: 0, ungated: 0 }]));

for (const tree of TREES) {
	const found = perTree.get(tree.label);

	for (const file of sources(tree.root)) {
		const source = read(file);
		if (!HAS_RESOLVER.test(source)) continue;

		const where = `${tree.label}/${relative(tree.root, file).split('\\').join('/')}`;

		for (const { line, name, block } of resolverClasses(source)) {
			resolvers.push({ file: where, line, name });
			found.checked++;

			if (FEATURE_FLAG.test(block)) {
				gated.push({ file: where, line });
				found.gated++;

				// The decorator writes one metadata value and the guard resolves the first one it finds,
				// so the code stated first is the code that gates every field of this class. The codes
				// after it are read only to be reported: each of them is a statement that never runs.
				const stated = [...block.matchAll(FEATURE_FLAG_ARGUMENT)].map((match) => match[1]);

				if (stated[0] !== SHARED_CODE) {
					gatedWithOtherCode.push({ file: where, line, argument: stated[0] });
				}

				if (stated.length > 1) {
					multipleCodes.push({ file: where, line, resolved: stated[0], others: stated.slice(1) });
				}

				if (ALLOWED.has(where)) staleAllowList.push(where);
			} else if (ALLOWED.has(where)) {
				allowed.push({ file: where, reason: ALLOWED.get(where) });
				found.allowed++;
			} else {
				ungated.push({ file: where, line, name });
				found.ungated++;
			}
		}
	}
}

const failed = ungated.length > 0;
const labels = TREES.map((tree) => tree.label);

console.log('');
console.log('GraphQL feature gate — every resolver behind the catalogue’s own code');
console.log('===================================================================');
console.log('');
console.log(`  ${resolvers.length} resolver class(es) over ${labels.join(' and ')}`);
for (const [label, found] of perTree) {
	console.log(
		`    ${label}: ${found.checked} checked, ${found.gated} carry the gate, ${found.allowed} on the frozen allow-list`
	);
}
console.log(
	`  ${gated.length} carry the gate, ${gated.length - gatedWithOtherCode.length} of them through the shared ${SHARED_CODE} constant`
);
console.log(`  ${allowed.length} predate the convention and are on the frozen allow-list`);
console.log(`  ${ungated.length} carry no gate and no reason, which is the defect this check exists for`);
console.log('');

if (ungated.length) {
	console.log('  Un-gated resolvers — a capability the flag does not reach:');
	for (const entry of ungated) {
		console.log(`    ${entry.file}:${entry.line}  → ${entry.name}`);
	}
	console.log('');
}

if (allowed.length) {
	console.log('  Allowed exceptions — written down with their reason:');
	for (const entry of allowed) {
		console.log(`    ${entry.file}`);
		console.log(`        ${entry.reason}`);
	}
	console.log('');
}

if (gatedWithOtherCode.length) {
	console.log(
		`  ${gatedWithOtherCode.length} gate(s) resolve a code other than the shared ${SHARED_CODE} constant (information, not a failure):`
	);
	for (const entry of gatedWithOtherCode) {
		console.log(`    ${entry.file}:${entry.line}  → @FeatureFlag(${entry.argument})`);
	}
	console.log('');
}

if (multipleCodes.length) {
	console.log(
		`  ${multipleCodes.length} resolver class(es) state more than one code, and only the first is resolved (information, not a failure):`
	);
	for (const entry of multipleCodes) {
		console.log(`    ${entry.file}:${entry.line}  → @FeatureFlag(${entry.resolved}) is read`);
		console.log(`        the code(s) beside it, which never run: ${entry.others.join(', ')}`);
	}
	console.log('');
}

if (staleAllowList.length) {
	console.log('  Allow-list entries whose resolver now carries the gate (information, not a failure):');
	for (const file of staleAllowList) {
		console.log(`    ${file}  → the entry can be dropped`);
	}
	console.log('');
}

console.log(
	failed
		? `graphql feature gate check: FAILED — ${ungated.length} un-gated resolver(s)`
		: `graphql feature gate check: PASSED — ${gated.length} of ${resolvers.length} resolver(s) gated, ${allowed.length} allow-listed`
);

process.exit(failed ? 1 : 0);
