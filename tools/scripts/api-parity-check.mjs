#!/usr/bin/env node
/*
 * One concept, two protocols.
 *
 * The programme's API doctrine is that every concept a package exposes is reachable over REST and
 * over the one GraphQL endpoint, with the same scope on both sides — and that a concept never gets
 * two surfaces that could drift apart. Nothing enforced it. The contract gate checks that each
 * package *has* a controller and *has* resolvers, and that each controller's concept is mentioned
 * somewhere in the package's resolver source, which a name in a comment satisfies. That is how a
 * stock level came to be served over GraphQL as `inventoryLevels` with no REST route at all: the
 * concept was live, the gate was green, and half the surface was simply absent.
 *
 * This script reads both sides statically and compares them by concept:
 *
 *   - REST: every controller's `@Controller('...')` prefix plus the resources it maps.
 *   - GraphQL: every `@Query(...)` root field a package's resolvers declare, and every field of a
 *     `type Query` block in a package's own `.gql` documents.
 *
 * A GraphQL root field is matched against REST by name: `stockTransfers` is `/stock-transfers`, and
 * a field named for one row of a resource (`stockTransfer`) matches the resource it is a row of. A
 * root field that is a *derived* answer rather than a resource — a total, a variance, a search — has
 * no resource to match, and is listed in `DERIVED_ROOT_FIELDS` below with the reason it is one-sided.
 * The list is the point: it is the short, explicit record of what is deliberately served over one
 * protocol only, so a new one-sided concept has to be argued for rather than added quietly.
 *
 * Usage:
 *   node tools/scripts/api-parity-check.mjs [repoRoot]
 *
 * Exits 0 when every concept is served over both protocols or acknowledged, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');
const PLUGINS_DIR = join(ROOT, 'packages', 'plugins');

/**
 * The programme's packages.
 *
 * Frozen deliberately: the gate is about the surface this programme built, and a package added to
 * `packages/plugins` for another feature is not its business.
 */
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

/**
 * Root fields that answer a question rather than expose a resource, with the reason.
 *
 * A resource is a thing with a collection and a row; these are look-ups and computations over the
 * resources around them. Each entry is a decision that this concept is deliberately served over one
 * protocol only — the design reaches the same fact over REST through a query parameter or through
 * the resource's own sub-route. An entry is not a debt: it is the written record that somebody chose
 * it, which is what a one-sided concept should have to produce.
 */
const GRAPHQL_ONLY = {
	collectionBySlug: 'A collection addressed by its slug rather than its id; REST filters the collection route by slug.',
	productPublications: 'A variant’s publications, reached over GraphQL through the variant; REST reaches them through the publication links.',
	productPublication: 'One publication, the row form of the same concept.',
	productVariantPublications: 'The publications of one variant, reached over GraphQL through the variant itself.',
	stockCountVariance: 'The variance a count found, computed from its lines.',
	availableQuantity: 'How much of a variant is available at a location, computed from its level and the holds against it.',
	productVariantFacets: 'The facet values a variant carries, a projection over its tags and channels.',
	resolvePrice: 'The price that applies to a variant in a context, which is a computation over price rows.',
	resolveTaxRate: 'The tax rate that applies in a context, a computation over rate rows.',
	resolveTaxRegime: 'The regime that applies in a context, a computation over regime rows.',
	resolveVendorProductTerm: 'The terms that apply to a vendor’s product, a computation over term rows.',
	taxRateParts: 'The parts of a rate, reached over GraphQL through the rate.',
	taxRegimeRates: 'The rates of a regime, reached over GraphQL through the regime.',
	checkEntitlement: 'Whether a party holds an entitlement, a question about entitlements rather than an entitlement.',
	validateCoupon: 'Whether a coupon applies, a question about coupons rather than a coupon.',
	giftCardBalance: 'The remaining balance of a gift card, a computation over its transactions.',
	orderByNumber: 'An order addressed by its number rather than its id; REST filters the order route by number.',
	orderTotals: 'The totals of an order, which the order resource already carries over REST.',
	orderLineInvoicingPosition: 'How far a line has been invoiced, a computation over its invoice links.',
	fulfillmentOutstanding: 'How much of a line is still to ship, a computation over its fulfilments.',
	shippingProfileForVariant: 'The profile that governs a variant, a look-up through the variant’s assignments.',
	shippingOptionsForContext: 'The options eligible in a context, which the option resource cannot answer without the context.',
	shippingRate: 'The price an option quotes for a context, a computation over the option’s price shapes.',
	subscriptionPlanByCode: 'A plan addressed by its code rather than its id; REST filters the plan route by code.',
	warehouseBinSubtree: 'Everything under a bin, a walk of the bin hierarchy.',
	warehouseBinContents: 'What a bin holds, derived from the stock ledger.',
	warehouseBinCapacity: 'How much of a bin’s capacity a request would use, a conversion and a comparison.',
	warehouseBinCapacityWarnings: 'The bins whose stated unit is missing, a report over bins.',
	sellerStatement: 'A seller’s statement, an aggregation of that seller’s transactions.',
	sellerBalance: 'What a seller is owed, an aggregation of settlements and payouts.',
	sellerSplitReconciliation: 'Whether the splits of a period reconcile, a check over split rows.',
	searchFacets: 'The facet counts of a search, which REST serves at its own facets route.'
};

/**
 * REST resources that are deliberately one-sided, with the reason.
 *
 * These are the links between two aggregates — a product and a channel, a variant and a tag — which
 * GraphQL models as fields on the aggregate they belong to rather than as roots of their own, because
 * a link has no independent existence to expose. REST addresses them as resources of their own
 * because a route cannot express a field of a field.
 */
const REST_ONLY = {
	'product-channels': 'The link between a product and a channel, reached over GraphQL through the product.',
	'product-variant-channels': 'The link between a variant and a channel, reached over GraphQL through the variant.',
	'product-variant-tags': 'The link between a variant and a tag, reached over GraphQL through the variant.',
	facets: 'The search facet counts, served over GraphQL as its own root field of the same concept.'
};

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** Every file under `dir` whose name matches `test`, walked without following into build output. */
function walk(dir, test, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}

	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
			walk(full, test, out);
		} else if (entry.isFile() && test(entry.name)) {
			out.push(full);
		}
	}

	return out;
}

/** `order-returns` → `orderReturns`, `sellers` → `sellers`. */
function camelCase(value) {
	return value.replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase());
}

/** `orderReturns` → `order-returns`. */
function kebabCase(value) {
	return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The singular of a plural resource name, for matching a field named for one row. */
function singular(value) {
	if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
	if (value.endsWith('ses')) return value.slice(0, -2);
	if (value.endsWith('s')) return value.slice(0, -1);
	return value;
}

/** The plural of a resource name, in both of the spellings this platform uses. */
function plurals(value) {
	const forms = [`${value}s`, `${value}es`];
	if (value.endsWith('y')) forms.push(`${value.slice(0, -1)}ies`);
	return forms;
}

/**
 * The REST resources a package's controllers declare.
 *
 * A controller's prefix is its resource. A controller with no prefix maps its routes at the root,
 * which is how the search package serves several resources from one class, so its method-level
 * routes are read as resources of their own.
 *
 * @param dir The package directory.
 * @returns {{resources: Set<string>, files: number}} The resource names, without a leading slash.
 */
function restResourcesOf(dir) {
	const resources = new Set();
	const controllers = walk(dir, (name) => name.endsWith('.controller.ts'));

	for (const file of controllers) {
		const source = read(file);
		const prefix = /@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/.exec(source);
		const bare = /@Controller\(\s*\)/.test(source);

		if (prefix && !bare) {
			const first = prefix[1].split('/').filter(Boolean)[0];
			if (first) resources.add(first);
			continue;
		}

		// No prefix: the whole route minus its parameters is the resource, because one class serving
		// several resources has nothing else to say which is which.
		for (const match of source.matchAll(/@(?:Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
			const resource = match[1]
				.split('/')
				.filter((segment) => segment && !segment.startsWith(':'))
				.join('-');

			if (resource) resources.add(resource);
		}
	}

	return { resources, files: controllers.length };
}

/**
 * The GraphQL root query fields a package declares.
 *
 * Three spellings are read, because all three are in use and a checker that reads one of them
 * reports every resolver written the other way as a missing surface — which is worse than no check,
 * since a false report is what teaches a reader to ignore the true ones:
 *
 *   `@Query('stockTransfers')`                     the field name is the decorator's argument;
 *   `@Query(() => X, { name: 'stockTransfers' })`  the field name is in the options object;
 *   `@Query(() => X)` followed by `stockTransfers(` the field name is the method's own name.
 *
 * A `.gql` document's `type Query` block is read too, because the kernel-shaped capabilities declare
 * their root fields in the document rather than in a decorator.
 *
 * @param dir The package directory.
 * @returns {{fields: Map<string, string>, files: number}} Field name → the file that declares it.
 */
function graphqlRootFieldsOf(dir) {
	const fields = new Map();
	const resolvers = walk(dir, (name) => name.endsWith('.resolver.ts'));
	const documents = walk(dir, (name) => name.endsWith('.gql'));

	for (const file of resolvers) {
		const source = read(file);
		const where = relative(ROOT, file);

		for (let index = source.indexOf('@Query('); index !== -1; index = source.indexOf('@Query(', index + 1)) {
			const open = index + '@Query'.length;
			const close = matchingParenthesis(source, open);

			if (close === -1) continue;

			const argument = source.slice(open + 1, close);
			const named = /name:\s*['"`]([A-Za-z_]\w*)['"`]/.exec(argument);

			if (named) {
				fields.set(named[1], where);
				continue;
			}

			const literal = /^\s*['"`]([A-Za-z_]\w*)['"`]/.exec(argument);

			if (literal) {
				fields.set(literal[1], where);
				continue;
			}

			// No name anywhere: the field is the method the decorator sits on.
			const method = /^\s*(?:\/\/[^\n]*\n\s*)*(?:public\s+|async\s+)*([A-Za-z_]\w*)\s*[(<]/.exec(source.slice(close + 1));

			if (method) fields.set(method[1], where);
		}
	}

	for (const file of documents) {
		const source = read(file);
		const block = /type\s+Query\s*\{([\s\S]*?)\n\}/.exec(source);

		if (!block) continue;

		for (const match of block[1].matchAll(/^\s*([A-Za-z_]\w*)\s*(?:\(|:)/gm)) {
			if (!fields.has(match[1])) fields.set(match[1], relative(ROOT, file));
		}
	}

	return { fields, files: resolvers.length + documents.length };
}

/**
 * The index of the parenthesis that closes the one at `open`, or -1.
 *
 * Read by counting rather than by a regular expression, because the arguments of a `@Query` hold an
 * arrow function and therefore parentheses of their own — which is exactly where a pattern like
 * `[^)]*` stops, and why the first version of this check reported half the surface as missing.
 *
 * @param source The file's text.
 * @param open The index of the opening parenthesis.
 * @returns The index of its match, or -1 when the text is unbalanced.
 */
function matchingParenthesis(source, open) {
	let depth = 0;

	for (let index = open; index < source.length; index++) {
		const character = source[index];
		if (character === '(') depth++;
		else if (character === ')') {
			depth--;
			if (depth === 0) return index;
		}
	}

	return -1;
}

const problems = [];
const acknowledged = [];
const oneSided = [];
const children = [];
const declaredFields = new Set();
const declaredResources = new Set();
const summary = [];

for (const name of PACKAGES) {
	const dir = join(PLUGINS_DIR, name);

	let exists = true;
	try {
		exists = statSync(dir).isDirectory();
	} catch {
		exists = false;
	}

	if (!exists) {
		problems.push({ package: name, kind: 'missing', detail: 'the package directory does not exist' });
		continue;
	}

	const { resources, files: controllerFiles } = restResourcesOf(dir);
	const { fields, files: graphqlFiles } = graphqlRootFieldsOf(dir);

	for (const field of fields.keys()) declaredFields.add(field);

	// Every declared GraphQL root field needs a REST counterpart of the same concept.
	for (const [field, file] of fields) {
		const kebab = kebabCase(field);
		// `taxCategory` matches `/tax-categories`; `stockTransfer` matches `/stock-transfers`; and a
		// resource named for a row matches its collection.
		const candidates = new Set([
			kebab,
			...plurals(kebab),
			kebabCase(singular(field)),
			...plurals(kebabCase(singular(field)))
		]);
		const matched = [...candidates].find((candidate) => resources.has(candidate));

		if (matched) continue;

		if (GRAPHQL_ONLY[field]) {
			acknowledged.push({ package: name, field, reason: GRAPHQL_ONLY[field] });
			continue;
		}

		problems.push({
			package: name,
			kind: 'graphql-only',
			detail: `${field} is served over GraphQL (${file}) and no controller declares a REST resource for it`
		});
	}

	// And every top-level REST resource needs a GraphQL root field of the same concept. A resource
	// that begins with the name of another resource of the same package is a child of it — a line of
	// an order, an address of an order — and GraphQL reaches it through the parent rather than as a
	// root of its own, which is what a graph is for. The parent has to be a *different* resource:
	// deriving the stems from the resources themselves would make every multi-word resource its own
	// parent, which is how the first version of this check reported the product's channel links as
	// children of a `product` resource that does not exist.
	const fieldNames = [...fields.keys()];
	const parentsOf = (resource) =>
		[...resources].filter(
			(other) =>
				other !== resource &&
				(resource.startsWith(`${other}-`) || resource.startsWith(`${singular(other)}-`))
		);

	for (const resource of resources) {
		const camel = camelCase(resource);
		const candidates = [camel, camelCase(singular(resource)), singular(camel)];
		if (candidates.some((candidate) => fieldNames.includes(candidate))) continue;

		const parents = parentsOf(resource);
		if (parents.length) {
			children.push(`${resource} → ${parents.join(' / ')}`);
			continue;
		}

		if (REST_ONLY[resource]) {
			oneSided.push({ package: name, resource, reason: REST_ONLY[resource] });
			continue;
		}

		problems.push({
			package: name,
			kind: 'rest-only',
			detail: `/${resource} is served over REST and no resolver declares a GraphQL root field for it`
		});
	}

	summary.push({
		name,
		controllers: controllerFiles,
		graphqlFiles,
		resources: resources.size,
		fields: fields.size
	});

	for (const resource of resources) declaredResources.add(resource);
}

// An acknowledgement that names a field or a resource nothing declares is stale — a typo, or a
// concept that has since been renamed or removed. It is reported rather than ignored, because a stale
// exception is how an allow-list quietly becomes a place to hide things. An acknowledgement that
// turned out not to be needed is reported separately: the entry is merely redundant, which is worth
// knowing but is not a failure.
const acknowledgedFields = new Set(acknowledged.map((entry) => entry.field));
const staleFields = Object.keys(GRAPHQL_ONLY).filter((field) => !declaredFields.has(field));
const redundantFields = Object.keys(GRAPHQL_ONLY).filter(
	(field) => declaredFields.has(field) && !acknowledgedFields.has(field)
);

const oneSidedResources = new Set(oneSided.map((entry) => entry.resource));
const staleResources = Object.keys(REST_ONLY).filter(
	(resource) => !declaredResources.has(resource) || !oneSidedResources.has(resource)
);

const stale = [
	...staleFields.map((field) => `GraphQL field \`${field}\``),
	...staleResources.map((resource) => `REST resource /${resource}`)
];

console.log('');
console.log('API parity — one concept, two protocols');
console.log('======================================');
console.log('');

for (const entry of summary) {
	console.log(
		`  ${entry.name.padEnd(14)} ${String(entry.resources).padStart(3)} REST resource(s), ` +
			`${String(entry.fields).padStart(3)} GraphQL root field(s)`
	);
}

console.log('');
console.log(`  ${acknowledged.length} root field(s) acknowledged as derived rather than resources:`);
for (const entry of acknowledged) {
	console.log(`    ${entry.field.padEnd(24)} ${entry.package} — ${entry.reason}`);
}

if (children.length) {
	console.log('');
	console.log(`  ${children.length} REST resource(s) are children of another resource, reached over GraphQL through the parent:`);
	console.log(`    ${children.join(', ')}`);
}

console.log('');
console.log(`  ${oneSided.length} REST resource(s) acknowledged as deliberately one-sided:`);
for (const entry of oneSided) {
	console.log(`    ${`/${entry.resource}`.padEnd(28)} ${entry.package} — ${entry.reason}`);
}

if (stale.length) {
	console.log('');
	console.log(`  ${stale.length} acknowledgement(s) name something no package declares:`);
	for (const entry of stale) console.log(`    ${entry}`);
}

if (redundantFields.length) {
	console.log('');
	console.log(`  ${redundantFields.length} acknowledgement(s) turned out not to be needed, because the field has a REST resource:`);
	for (const field of redundantFields) console.log(`    ${field}`);
}

console.log('');
if (problems.length === 0) {
	console.log('  OK — every top-level concept is served over both protocols, or acknowledged as one-sided');
} else {
	console.log(`  ${problems.length} concept(s) served over one protocol only:`);
	for (const problem of problems) {
		console.log(`    [${problem.kind}] ${problem.package}: ${problem.detail}`);
	}
}

console.log('');
const failed = problems.length > 0 || stale.length > 0;
console.log(failed ? 'api parity check: FAILED' : 'api parity check: PASSED');

process.exit(failed ? 1 : 0);
