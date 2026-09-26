#!/usr/bin/env node
/*
 * A guard is only as good as the grant behind it.
 *
 * A plugin package declares its permission values in one map and contributes them to the platform
 * catalogue in one array, and its controllers guard their routes with a key from that map:
 *
 *   `@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)`
 *   `@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))`
 *
 * The compiler checks the *key*: a package that guards a route with a value its map does not define
 * fails the build. Nothing checks the *contribution*. A key that is used but never listed in the
 * package's contribution array is a value that is unioned into no catalogue, granted to no role and
 * therefore refused to every caller — the route is unreachable, the build is green, the boot is
 * clean, and the only symptom is a 403 on a request that should have succeeded. That is not
 * hypothetical: this programme shipped exactly that state once, and it was found by hand.
 *
 * The check is deliberately one-directional. A contributed value no route uses is reported as
 * information rather than as a failure, because a permission may legitimately exist for a route that
 * is not written yet or for a guard that is not a decorator.
 *
 * ## The second half: a flag is only switchable if it is seeded
 *
 * The same shape of gap exists one layer over. A plugin declares its feature codes in a
 * `*.features.ts` contribution, and `@FeatureFlag(...)` gates a route on one of them — but what makes
 * a code *exist* for an installation is the row the seed migration writes, and that migration seeds
 * `COMMERCE_CATALOGUE` in `packages/core/src/lib/feature/commerce-feature-catalogue.ts`. A code a
 * package contributes and the catalogue does not list is a flag with no row: nothing can switch it,
 * so the capability behind it is permanently whatever the absent row defaults to, and again the build
 * is green and the boot is clean. That is not hypothetical either — `FEATURE_MARKETPLACE_PAYOUTS` was
 * in exactly that state, and `FEATURE_SELLER_PAYOUT_SCHEDULER` declared a dependency on it.
 *
 * A `dependsOn` naming a code nothing declares anywhere is the same fault seen from the other end and
 * is reported with it.
 *
 * Usage:
 *   node tools/scripts/permission-contribution-check.mjs [repoRoot]
 *
 * Exits 0 when every used permission value is contributed and every contributed feature code is
 * seeded, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');
const PLUGINS = join(ROOT, 'packages', 'plugins');

/** The programme's packages. */
const PACKAGES = [
	'catalog',
	'pricing',
	'tax',
	'inventory',
	'warehouse',
	'cart',
	'order',
	'payment',
	'promotion',
	'fulfillment',
	'returns',
	'subscription',
	'purchasing',
	'entitlement',
	'marketplace',
	'search'
];

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** Every file under `dir` whose name ends with one of `suffixes`. */
function walk(dir, suffixes, out = []) {
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
			walk(full, suffixes, out);
		} else if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
			out.push(full);
		}
	}

	return out;
}

/**
 * The permission-value maps a package declares.
 *
 * Both spellings in use are read: `export const <NAME>_PERMISSION_VALUES = { KEY: 'KEY' } as const`
 * and `export const SomePermission = { KEY: 'KEY' } as const`. A map is recognised by its entries
 * rather than by its name, so a package that calls it something else is still covered.
 *
 * A key's **value** is read as well, and it decides whether the package has to contribute anything.
 * `KEY: 'KEY'` declares a value of the package's own, which the catalogue has to be told about;
 * `KEY: PermissionsEnum.SOMETHING` **reuses a platform code**, and reuse is a deliberate choice — the
 * warehouse package guards packing and manifests on the fulfilment domain's own codes rather than
 * minting a second pair that would double every role that ships anything. A reused key is grantable
 * the moment the platform seeds the code it names, so it needs no contribution from this package.
 * Reading only the keys is how an earlier version of this check reported twenty-eight guards as
 * ungradable that were perfectly reachable.
 *
 * @param source The package's `*.permissions.ts` text.
 * @returns {Map<string, {keys: Set<string>, reused: Set<string>, literals: Map<string, string>}>}
 * Map name → its keys, the keys that reuse a platform code, and the literal each remaining key holds.
 */
function valueMaps(source) {
	const maps = new Map();

	for (const match of source.matchAll(/export\s+const\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*\{([\s\S]*?)\n\}\s*as\s+const/g)) {
		const entry = { keys: new Set(), reused: new Set(), literals: new Map() };

		for (const line of match[2].matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*([^,\n]+)/gm)) {
			const key = line[1];
			const value = line[2].trim();

			entry.keys.add(key);

			if (/\w+\.[A-Z][A-Z0-9_]*/.test(value)) {
				entry.reused.add(key);
				continue;
			}

			const literal = /^['"`]([^'"`]+)['"`]$/.exec(value);
			if (literal) entry.literals.set(key, literal[1]);
		}

		if (entry.keys.size) maps.set(match[1], entry);
	}

	return maps;
}

/**
 * The values a package contributes to the platform catalogue.
 *
 * A contribution's value is either a key of one of the package's own maps or a literal, and both are
 * recorded so a literal contribution can be matched against a literal use.
 *
 * @param source The package's `*.permissions.ts` text.
 * @returns {{byMap: Map<string, Set<string>>, literals: Set<string>}} The contributed values.
 */
function contributedValues(source) {
	const byMap = new Map();
	const literals = new Set();
	const array = /export\s+const\s+[A-Za-z_]\w*\s*(?::[^=]+)?=\s*\[([\s\S]*?)\n\];/.exec(source);

	if (!array) return { byMap, literals };

	for (const entry of array[1].matchAll(/value:\s*([^,\n]+)/g)) {
		const expression = entry[1].trim();
		const member = /^([A-Za-z_]\w*)\.([A-Z][A-Z0-9_]*)$/.exec(expression);

		if (member) {
			if (!byMap.has(member[1])) byMap.set(member[1], new Set());
			byMap.get(member[1]).add(member[2]);
			continue;
		}

		const literal = /^['"`]([A-Z][A-Z0-9_]*)['"`]$/.exec(expression);
		if (literal) literals.add(literal[1]);
	}

	return { byMap, literals };
}

/**
 * Every permission value a package's handlers guard on.
 *
 * Read from inside `@Permissions(...)` only. The decorator's arguments are found by balancing
 * parentheses rather than by a pattern, because they hold call expressions of their own.
 *
 * @param files The package's non-spec source files.
 * @returns {Array<{map: string, key: string, file: string}>} The uses.
 */
function usedValues(files) {
	const uses = [];

	for (const file of files) {
		const source = read(file);
		const where = relative(ROOT, file);

		for (let index = source.indexOf('@Permissions('); index !== -1; index = source.indexOf('@Permissions(', index + 1)) {
			const open = index + '@Permissions'.length;
			let depth = 0;
			let close = -1;

			for (let cursor = open; cursor < source.length; cursor++) {
				if (source[cursor] === '(') depth++;
				else if (source[cursor] === ')') {
					depth--;
					if (depth === 0) {
						close = cursor;
						break;
					}
				}
			}

			if (close === -1) continue;

			for (const member of source.slice(open, close).matchAll(/([A-Za-z_]\w*)\.([A-Z][A-Z0-9_]*)/g)) {
				uses.push({ map: member[1], key: member[2], file: where });
			}
		}
	}

	return uses;
}

const problems = [];
const unused = [];
const summary = [];

for (const name of PACKAGES) {
	const dir = join(PLUGINS, name);
	const permissionFiles = walk(dir, ['.permissions.ts']);

	if (!permissionFiles.length) {
		problems.push({ package: name, detail: 'declares no *.permissions.ts' });
		continue;
	}

	const maps = new Map();
	const contributedByMap = new Map();
	const contributedLiterals = new Set();

	for (const file of permissionFiles) {
		const source = read(file);

		for (const [mapName, entry] of valueMaps(source)) maps.set(mapName, entry);

		const { byMap, literals } = contributedValues(source);
		for (const [mapName, keys] of byMap) {
			if (!contributedByMap.has(mapName)) contributedByMap.set(mapName, new Set());
			for (const key of keys) contributedByMap.get(mapName).add(key);
		}
		for (const literal of literals) contributedLiterals.add(literal);
	}

	const sources = walk(dir, ['.ts']).filter((file) => !file.endsWith('.spec.ts'));
	const uses = usedValues(sources);

	// Only uses of this package's own maps are checked: a package guarding on a value another package
	// contributes is a different question, and answering it here would report cross-package uses as
	// missing from a catalogue they were never meant to be in.
	let checked = 0;
	let reusedCount = 0;

	for (const [mapName, entry] of maps) reusedCount += entry.reused.size;

	for (const use of uses) {
		const map = maps.get(use.map);
		if (!map) continue;
		checked++;

		// A key that reuses a platform code is granted by the platform's own seed.
		if (map.reused.has(use.key)) continue;
		if (contributedByMap.get(use.map)?.has(use.key)) continue;
		if (contributedLiterals.has(use.key)) continue;
		if (map.literals.has(use.key) && contributedLiterals.has(map.literals.get(use.key))) continue;

		problems.push({
			package: name,
			detail: `guards a route with ${use.map}.${use.key}, which the package neither contributes nor maps to a platform code — no role can be granted it (${use.file})`
		});
	}

	const usedKeys = new Set(uses.filter((use) => maps.has(use.map)).map((use) => `${use.map}.${use.key}`));

	for (const [mapName, keys] of contributedByMap) {
		for (const key of keys) {
			if (usedKeys.has(`${mapName}.${key}`)) continue;
			unused.push({ package: name, value: `${mapName}.${key}` });
		}
	}

	summary.push({
		name,
		maps: maps.size,
		guards: checked,
		// A contribution names its value either through the package's map or as a literal, and both
		// are contributions: counting only the first reported nine packages as contributing nothing.
		contributed:
			[...contributedByMap.values()].reduce((total, keys) => total + keys.size, 0) + contributedLiterals.size,
		reused: reusedCount
	});
}

/**
 * Every feature code a plugin contributes, and the file that contributes it.
 *
 * @returns The codes, keyed by the file that declares them.
 */
function contributedFeatureCodes() {
	const codes = new Map();

	const walk = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

			const full = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(full);
				continue;
			}

			if (!entry.name.endsWith('.features.ts')) continue;

			const source = readFileSync(full, 'utf8');

			for (const match of source.matchAll(/code:\s*'([A-Z0-9_]+)'/g)) {
				if (!codes.has(match[1])) codes.set(match[1], relative(ROOT, full).split('\\').join('/'));
			}
		}
	};

	walk(PLUGINS);

	return codes;
}

/**
 * Every code the `dependsOn` of a contributed feature names.
 *
 * @returns The codes, keyed by the file that names them.
 */
function dependedFeatureCodes() {
	const codes = new Map();

	const walk = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

			const full = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(full);
				continue;
			}

			if (!entry.name.endsWith('.features.ts')) continue;

			const source = readFileSync(full, 'utf8');

			for (const block of source.matchAll(/dependsOn:\s*\[([^\]]*)\]/g)) {
				for (const match of block[1].matchAll(/'([A-Z0-9_]+)'/g)) {
					if (!codes.has(match[1])) codes.set(match[1], relative(ROOT, full).split('\\').join('/'));
				}
			}
		}
	};

	walk(PLUGINS);

	return codes;
}

const CATALOGUE = join(ROOT, 'packages', 'core', 'src', 'lib', 'feature', 'commerce-feature-catalogue.ts');
const seededCodes = new Set(
	[...readFileSync(CATALOGUE, 'utf8').matchAll(/code:\s*'([A-Z0-9_]+)'/g)].map((match) => match[1])
);
const contributedFeatures = contributedFeatureCodes();
const dependedFeatures = dependedFeatureCodes();
const unseeded = [...contributedFeatures].filter(([code]) => !seededCodes.has(code));
const undeclaredDependencies = [...dependedFeatures].filter(
	([code]) => !seededCodes.has(code) && !contributedFeatures.has(code)
);

for (const [code, where] of unseeded) {
	problems.push({
		package: 'feature catalogue',
		detail: `${code} is contributed by ${where} and is in no catalogue entry, so the seed writes no row for it`
	});
}

for (const [code, where] of undeclaredDependencies) {
	problems.push({
		package: 'feature catalogue',
		detail: `${where} depends on ${code}, which nothing declares`
	});
}

console.log('');
console.log('Permission contributions — a guard only as good as its grant');
console.log('============================================================');
console.log('');

for (const entry of summary) {
	console.log(
		`  ${entry.name.padEnd(14)} ${String(entry.contributed).padStart(3)} of its own value(s), ` +
			`${String(entry.reused).padStart(2)} reusing a platform code, ` +
			`${String(entry.guards).padStart(3)} guard reference(s)`
	);
}

if (unused.length) {
	console.log('');
	console.log(`  ${unused.length} contributed value(s) no route guards on (information, not a failure):`);
	for (const entry of unused) console.log(`    ${entry.package.padEnd(14)} ${entry.value}`);
}

console.log('');
console.log(
	`  feature codes  ${String(contributedFeatures.size).padStart(3)} contributed by a package, ` +
		`${String(seededCodes.size).padStart(3)} seeded by the catalogue`
);

console.log('');
if (problems.length === 0) {
	console.log('  OK — every value a handler guards on is contributed, so every one of them can be granted');
	console.log('  OK — every feature code a package contributes is seeded, so every one of them can be switched');
} else {
	console.log(`  ${problems.length} contribution(s) that cannot be reached:`);
	for (const problem of problems) console.log(`    ${problem.package}: ${problem.detail}`);
}

console.log('');
console.log(problems.length === 0 ? 'contribution check: PASSED' : 'contribution check: FAILED');

process.exit(problems.length === 0 ? 0 : 1);
