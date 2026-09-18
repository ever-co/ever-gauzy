#!/usr/bin/env node
/*
 * Every capability port is either joined or accounted for.
 *
 * The programme's package-independence rule is that a package needing something another package owns
 * declares a small port of its own and injects it under an optional token, so neither package imports
 * the other. The binding is then the *installation's* to make, in `apps/api/src/plugin-composition.ts`.
 *
 * Optional is the whole point — an installation that has only one of the two packages must still boot,
 * and its consumer must report the capability as unavailable rather than fail. So an unbound port is
 * not a defect by itself, and a check that demanded every port be bound would contradict the design it
 * was written to protect.
 *
 * What *is* a defect is the case this script exists to find: **the installation has both halves and
 * did not join them.** The consuming package is installed, the providing package is installed, the
 * provider service exists — and nothing binds the token, so the feature reports itself unavailable and
 * does nothing, on a deployment that has everything it needs. That state is invisible: the boot is
 * clean, the routes answer, the guard passes, and only the notice in a response body says the feature
 * was skipped.
 *
 * A port whose provider side has never been written is the other honest state, and it cannot be fixed
 * by a binding. Those are listed in `AWAITING_PROVIDER` below, each with what the provider would have
 * to read — the record of what the programme declared and has not yet built. An entry there is a debt
 * with a name, not an excuse: it is what makes the remainder auditable instead of invisible.
 *
 * Usage:
 *   node tools/scripts/port-binding-check.mjs [repoRoot]
 *
 * Exits 0 when every port is bound or accounted for, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');

/**
 * Ports whose provider side does not exist anywhere in the programme.
 *
 * These are not misconfigured installations — there is nothing to bind. Each entry says which package
 * would own the provider and what it would have to read, so the remaining work is enumerated rather
 * than rediscovered. Removing an entry is what happens when its provider is written; the script fails
 * if an entry here turns out to have a provider, because a stale exception is how a list like this
 * stops being true.
 */
const AWAITING_PROVIDER = {
	SUBSCRIPTION_ORDER_GATEWAY: {
		owner: '@gauzy/plugin-order',
		needs: 'Raising the order a billing period produces, and the proration order a mid-period change produces.'
	},
	SELLER_MEMBERSHIP_RESOLVER: {
		owner: 'the installation',
		needs:
			'Which contact is a member of which organization. No membership relation exists in an installation of these packages, so there is nothing to read and no provider can be written here — the guard stays open by construction, and a deployment that installs a contact-membership capability binds it.'
	}
};

/** Tokens that are not cross-package ports: a multi-provider registry inside its own package. */
const NOT_A_PORT = new Set(['SEARCH_PROVIDERS']);

/**
 * The programme's packages.
 *
 * Frozen deliberately. This repository hosts plugin packages for other features as well, and their
 * tokens are their own business — including them would report a set of ports that is mostly other
 * people's and make the remaining-work figure meaningless.
 */
const PACKAGES = new Set([
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
]);

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** Every file under `dir` whose name ends with one of `suffixes`, without entering build output. */
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
			if (['node_modules', 'dist', 'coverage', '.git', '.nx'].includes(entry.name)) continue;
			walk(full, suffixes, out);
		} else if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
			out.push(full);
		}
	}

	return out;
}

/**
 * The two spellings a port token is declared in.
 *
 * A `Symbol` is the common one. The other is a string constant that repeats its own name —
 * `export const SOME_PORT = 'SOME_PORT'` — which several ports use and which a checker that reads only
 * `Symbol` cannot see: two ports were invisible to the first version of this script for exactly that
 * reason, and a blind spot in the checker is indistinguishable from a port that is fine. A string
 * constant whose value differs from its name is not a token, which is what keeps route paths, header
 * names and feature codes out of the list.
 */
const SYMBOL_DECLARATION = /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*Symbol\s*\(/g;
const STRING_DECLARATION = /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*'([A-Z][A-Z0-9_]*)'\s*;/g;

const BINDING = /provide:\s*([A-Z][A-Z0-9_]*)/g;
const INJECTION = /@Inject\(\s*([A-Z][A-Z0-9_]*)\s*\)/g;

/**
 * The identifiers the application actually injects.
 *
 * This is what separates a token from a constant that merely looks like one. A package also declares
 * self-named string constants for things that are not injections at all — an error code, a notice, a
 * domain-event name — and every one of them matches the string-token spelling. What makes a constant
 * a *token* is that something asks the container for it, so the declarations are filtered by the
 * `@Inject(...)` sites rather than by their shape.
 *
 * @returns {Set<string>} The injected identifiers.
 */
function injectedTokens() {
	const tokens = new Set();
	const files = [...walk(join(ROOT, 'apps'), ['.ts']), ...walk(join(ROOT, 'packages'), ['.ts'])].filter(
		(file) => !file.endsWith('.spec.ts')
	);

	for (const file of files) {
		for (const match of read(file).matchAll(INJECTION)) tokens.add(match[1]);
	}

	return tokens;
}

/** Every port token the plugin packages declare and something injects, with where it is declared. */
function declaredPorts(injected) {
	const ports = new Map();
	const files = walk(join(ROOT, 'packages', 'plugins'), ['.ts']).filter((file) => !file.endsWith('.spec.ts'));

	for (const file of files) {
		const source = read(file);
		const owner = relative(join(ROOT, 'packages', 'plugins'), file).split(/[\\/]/)[0];

		const declare = (token) => {
			if (NOT_A_PORT.has(token) || !injected.has(token) || !PACKAGES.has(owner)) return;
			ports.set(token, { token, declaredBy: owner, file: relative(ROOT, file), injections: 0 });
		};

		for (const match of source.matchAll(SYMBOL_DECLARATION)) declare(match[1]);

		for (const match of source.matchAll(STRING_DECLARATION)) {
			if (match[1] === match[2]) declare(match[1]);
		}
	}

	return ports;
}

/**
 * Where each token is bound and how many places inject it.
 *
 * A binding is a `provide:` anywhere in the application or the packages, because the composition
 * module is where the installation decides and a package may legitimately bind a token it also
 * consumes.
 *
 * @param ports The declared ports, mutated with the counts and the binding sites.
 * @returns {Map<string, string>} Token → the file that binds it.
 */
function boundPorts(ports) {
	const bindings = new Map();
	const scope = [
		...walk(join(ROOT, 'apps'), ['.ts']),
		...walk(join(ROOT, 'packages'), ['.ts'])
	].filter((file) => !file.endsWith('.spec.ts'));

	for (const file of scope) {
		const source = read(file);

		for (const match of source.matchAll(BINDING)) {
			const token = match[1];
			if (!ports.has(token) || bindings.has(token)) continue;
			bindings.set(token, relative(ROOT, file));
		}

		for (const match of source.matchAll(INJECTION)) {
			const port = ports.get(match[1]);
			if (port) port.injections++;
		}
	}

	return bindings;
}

const ports = declaredPorts(injectedTokens());
const bindings = boundPorts(ports);

/**
 * Whether the module a binding lives in is actually loaded.
 *
 * A `provide:` line is a promise the application only keeps if something asks for the module. The
 * plugin list is what the loader reads, so a composition module that no entry names is a file that
 * never runs and a set of ports that stay unbound — and nothing static complains, because an
 * unreferenced module is perfectly valid TypeScript. This check was written after exactly that
 * happened: the composition point was committed without the line that registers it, and the bindings
 * below were reported as bound by a version of this script that read the file and never asked whether
 * the application would.
 *
 * @returns {Set<string>} The module class names the plugin list registers.
 */
function registeredModules() {
	const source = read(join(ROOT, 'apps', 'api', 'src', 'plugins.ts'));
	const names = new Set();

	for (const match of source.matchAll(/\b([A-Z]\w*(?:Module|Plugin))\b/g)) names.add(match[1]);

	return names;
}

const registered = registeredModules();
const unloaded = [];

for (const [token, site] of bindings) {
	const absolute = join(ROOT, site);

	// Only a binding that lives inside the application has to be registered there; one a package
	// declares is reached through that package's module, which the plugin list already names.
	if (!/^apps[\\/]/.test(site)) continue;

	const declaration = /export\s+class\s+([A-Z]\w*)/.exec(read(absolute));

	if (declaration && !registered.has(declaration[1])) {
		unloaded.push({ token, site, module: declaration[1] });
	}
}

const bound = [];
const awaiting = [];
const problems = [];

for (const port of [...ports.values()].sort((left, right) => left.token.localeCompare(right.token))) {
	const site = bindings.get(port.token);

	if (site) {
		bound.push({ ...port, site });
		continue;
	}

	if (AWAITING_PROVIDER[port.token]) {
		awaiting.push({ ...port, ...AWAITING_PROVIDER[port.token] });
		continue;
	}

	problems.push(port);
}

// An entry whose provider now exists is stale: the port can be bound, so saying otherwise would hide
// a capability the installation is one line away from having.
const written = Object.keys(AWAITING_PROVIDER).filter((token) => bindings.has(token));

console.log('');
console.log('Capability ports — joined, or accounted for');
console.log('===========================================');
console.log('');
console.log(`  ${ports.size} port(s) declared across the packages`);
console.log(`  ${bound.length} bound`);
console.log(`  ${awaiting.length} awaiting a provider that does not exist yet`);
console.log('');

if (bound.length) {
	console.log('  Bound:');
	for (const port of bound) {
		console.log(`    ${port.token.padEnd(30)} ${port.site}`);
	}
	console.log('');
}

if (awaiting.length) {
	console.log('  Awaiting a provider — declared and consumed, with nothing to bind:');
	for (const port of awaiting) {
		console.log(`    ${port.token.padEnd(30)} ${port.injections} injection site(s), provider would live in ${port.owner}`);
		console.log(`      ${port.needs}`);
	}
	console.log('');
}

if (problems.length) {
	console.log(`  ${problems.length} port(s) unbound with neither a binding nor an entry:`);
	for (const port of problems) {
		console.log(`    ${port.token.padEnd(30)} declared by ${port.declaredBy} (${port.file}), ${port.injections} injection site(s)`);
	}
	console.log('');
}

if (written.length) {
	console.log(`  ${written.length} entry/entries in the awaiting list now have a binding, so they are stale:`);
	for (const token of written) console.log(`    ${token} → ${bindings.get(token)}`);
	console.log('');
}

if (unloaded.length) {
	console.log(`  ${unloaded.length} binding(s) live in a module the plugin list never registers, so nothing loads them:`);
	for (const entry of unloaded) console.log(`    ${entry.token} → ${entry.module} (${entry.site})`);
	console.log('');
}

const failed = problems.length > 0 || written.length > 0 || unloaded.length > 0;
console.log(failed ? 'port binding check: FAILED' : 'port binding check: PASSED');

process.exit(failed ? 1 : 0);
