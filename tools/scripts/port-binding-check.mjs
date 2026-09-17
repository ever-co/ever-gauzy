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
	CART_STOCK_AVAILABILITY: {
		owner: '@gauzy/plugin-inventory',
		needs: 'A stock port over the level and hold services: how much of a variant is available at a location.'
	},
	WAREHOUSE_STOCK_LEDGER: {
		owner: '@gauzy/plugin-inventory',
		needs: 'The ledger port the warehouse reads bin contents from and writes every physical move back through.'
	},
	WAREHOUSE_FULFILLMENT: {
		owner: '@gauzy/plugin-fulfillment',
		needs: 'A read of the shipment lines a pick list is derived from.'
	},
	RETURNS_STOCK_LEDGER: {
		owner: '@gauzy/plugin-inventory',
		needs: 'The same ledger port, for the movements a return puts back into stock.'
	},
	RETURNS_REFUND_GATEWAY: {
		owner: '@gauzy/plugin-payment',
		needs:
			'A refund entry point whose answer is the refund id rather than the row, and which accepts the claim path that names no payment.'
	},
	RETURNS_ORDER_FULFILLMENT: {
		owner: '@gauzy/plugin-order',
		needs: 'How much of an order line has been fulfilled, so a return cannot exceed what was sent.'
	},
	RETURNS_SHIPMENT_GATEWAY: {
		owner: '@gauzy/plugin-fulfillment',
		needs: 'Creating the outbound shipment a return or an exchange travels on.'
	},
	PURCHASING_INVENTORY: {
		owner: '@gauzy/plugin-inventory',
		needs: 'The receiving side of the ledger: the put-away a goods receipt writes.'
	},
	PURCHASING_APPROVAL: {
		owner: '@gauzy/plugin-purchasing',
		needs: 'A facade over the kernel approval service, so a purchase order above its threshold is routed rather than confirmed.'
	},
	SUBSCRIPTION_CATALOG: {
		owner: '@gauzy/plugin-catalog',
		needs: 'A read of which products and variants may be subscribed to, which the catalogue does not currently record.'
	},
	SUBSCRIPTION_PRICING: {
		owner: '@gauzy/plugin-pricing',
		needs: 'The recurring price of a variant for a billing period and a currency.'
	},
	SUBSCRIPTION_ORDER_GATEWAY: {
		owner: '@gauzy/plugin-order',
		needs: 'Raising the order a billing period produces, and the proration order a mid-period change produces.'
	},
	SUBSCRIPTION_INSTRUMENTS: {
		owner: '@gauzy/plugin-payment',
		needs: 'Which stored instrument may be charged, which the payment package does not currently store.'
	}
};

/** Tokens that are not cross-package ports: a multi-provider registry inside its own package. */
const NOT_A_PORT = new Set(['SEARCH_PROVIDERS']);

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

const DECLARATION = /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*Symbol\s*\(/g;
const BINDING = /provide:\s*([A-Z][A-Z0-9_]*)/g;
const INJECTION = /@Inject\(\s*([A-Z][A-Z0-9_]*)\s*\)/g;

/** Every port token the plugin packages declare, with the file and package that declares it. */
function declaredPorts() {
	const ports = new Map();
	const files = walk(join(ROOT, 'packages', 'plugins'), ['.types.ts', '.tokens.ts']);

	for (const file of files) {
		const source = read(file);
		const owner = relative(join(ROOT, 'packages', 'plugins'), file).split(/[\\/]/)[0];

		for (const match of source.matchAll(DECLARATION)) {
			const token = match[1];
			if (NOT_A_PORT.has(token)) continue;
			ports.set(token, { token, declaredBy: owner, file: relative(ROOT, file), injections: 0 });
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

const ports = declaredPorts();
const bindings = boundPorts(ports);

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

const failed = problems.length > 0 || written.length > 0;
console.log(failed ? 'port binding check: FAILED' : 'port binding check: PASSED');

process.exit(failed ? 1 : 0);
