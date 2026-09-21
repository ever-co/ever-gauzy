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
 * **The second pass is about scope rather than existence, and it is the one with teeth.** A concept
 * served over both protocols is only one concept if both protocols ask the caller for the same thing.
 * This pass reads every REST route's effective `@Permissions(...)` — the handler's own, or the
 * controller's class-level metadata when the handler states none — classifies it into the canonical
 * shape it has (`list`, `byId`, `count`, `create`, `update`, `delete`, `softDelete`, `recover`),
 * does the same for every `@Query`/`@Mutation` field, and refuses a field that states **no**
 * permission where the REST route of the same concept and the same shape states one. That is not a
 * hypothetical: seven core resolvers shipped thirty-two write fields that way — `createOrganization‐
 * Department`, `deleteTag`, `createUserOrganization`, `softDeleteUser` and the rest — each of them
 * the exact operation its REST twin refuses without `ALL_ORG_EDIT`, `ORG_TAGS_DELETE` or
 * `ORG_USERS_EDIT`, and each of them reachable by any authenticated member of the tenant over the one
 * GraphQL endpoint. Every one of those fields carried a docstring asserting that the route it
 * mirrored was inherited from the CRUD base and stated no permission; the controllers declared those
 * routes themselves, with a permission. Prose could not see that and a reviewer did not, so it is
 * mechanical now.
 *
 * Two deliberate limits keep the pass honest rather than merely loud:
 *
 *   - **An inherited route counts as the base declares it.** A controller that `extends
 *     CrudController` really does serve a list, a row, a count and five writes that carry only its
 *     class-level metadata, so those shapes are seeded from the class and are then overwritten by any
 *     handler the subclass declares. Without that, every field mirroring an inherited route is
 *     reported, which is a false alarm that teaches a reader to ignore the true ones.
 *   - **Only "the field asks for nothing" fails.** A field that states a *different* permission from
 *     its route — `approvalPolicy` states the edit permission because the row route it mirrors runs
 *     under the controller's class-level edit permission — is reported as information, because the
 *     two permissions cannot be ordered by this script and the field is not the weaker surface.
 *
 * Usage:
 *   node tools/scripts/api-parity-check.mjs [repoRoot]
 *
 * Exits 0 when every concept is served over both protocols or acknowledged, and every GraphQL field
 * asks for at least what its REST twin asks for; 1 otherwise.
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
		//
		// A route decorator may carry an **array** of paths — `@Get(['/search/facets', '/facets'])` is
		// how a route that moved keeps answering at the address a published client already calls — and
		// every path in it is a resource this controller serves. Reading only the first quoted string
		// made the second address invisible: the `/facets` acknowledgement in `REST_ONLY` below went
		// stale the moment that route gained its new spelling, and the gate reported a deliberate
		// one-sided resource as a name nothing declares. Each path is read separately instead.
		for (const match of source.matchAll(/@(?:Get|Post|Put|Patch|Delete)\(\s*(\[[^\]]*\]|['"`][^'"`]+['"`])/g)) {
			for (const path of match[1].matchAll(/['"`]([^'"`]+)['"`]/g)) {
				const resource = path[1]
					.split('/')
					.filter((segment) => segment && !segment.startsWith(':'))
					.join('-');

				if (resource) resources.add(resource);
			}
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

/**
 * The schema source a package contributes.
 *
 * This platform is schema-first: a resolver's `@Query`/`@Mutation` decorator names a field that must
 * already exist in the composed schema, and a field the schema does not declare is never served. So a
 * package's resolvers and its schema document are two halves of one surface, and a package that ships
 * the first without the second has a GraphQL surface that is declared, type-checks, appears in every
 * static reading of the source — and does not exist at runtime. One package shipped exactly that: a
 * plugin whose `extensions` carried a single entity resolver and no schema at all, with eleven query
 * resolvers that nothing could ever call.
 *
 * The document is read as text: a `.gql` file, or a TypeScript module whose name says schema or which
 * builds its document with `gql`. Both spellings are in use here.
 *
 * @param dir The package directory.
 * @returns {string} Everything the package contributes to the composed schema.
 */
function schemaSourceOf(dir) {
	const files = walk(dir, (name) => name.endsWith('.gql'))
		.concat(
			walk(dir, (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')).filter(
				(file) => /schema/i.test(file) || /(?:export\s+const\s+\w+\s*=\s*gql|from\s+['"]graphql-tag['"])/.test(read(file))
			)
		);

	return files.map(read).join('\n');
}

/**
 * The trees the permission-parity pass reads.
 *
 * Both, and not only the sixteen commerce packages: the endpoint is one schema assembled from the
 * kernel and every configured plugin, so a kernel resolver that asks for less than its own controller
 * is exactly as open as a plugin one — and the thirty-two fields this pass was written for were all
 * in the kernel.
 */
const PERMISSION_TREES = [
	join(ROOT, 'packages', 'core', 'src', 'lib'),
	join(ROOT, 'packages', 'plugins')
];

/** The eight shapes a resource route and a root field are compared in. */
const CRUD_BASE_SHAPES = ['list', 'byId', 'count', 'create', 'update', 'delete', 'softDelete', 'recover'];

/** How many parentheses a line opens, net of the ones it closes. */
function parenthesisBalance(line) {
	let depth = 0;

	for (const character of line) {
		if (character === '(') depth++;
		else if (character === ')') depth--;
	}

	return depth;
}

/**
 * Splits a source file into the decorators above its class and the decorators above each member.
 *
 * Read line by line rather than with one regular expression, because a decorator here legitimately
 * spans several lines — `@Permissions(PermissionsEnum.A, PermissionsEnum.B)` wraps, and `@Query(() =>
 * X, { name: 'y' })` carries parentheses of its own. A member is recognised at one tab of
 * indentation, which is this repository's convention for a class member, and the decorator run above
 * it survives the JSDoc block and the blank lines between them.
 *
 * @param source The file's text.
 * @returns The class-level decorators, the members with their own decorators, and the class
 * declaration line, which is where `extends CrudController` is read from.
 */
function decoratedMembers(source) {
	const lines = source.split(/\r?\n/);
	const classLevel = [];
	const members = [];
	let pending = [];
	let buffer = null;
	let seenClass = false;
	let declaration = '';

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const trimmed = line.trim();

		if (buffer) {
			buffer.text += `\n${line}`;
			buffer.depth += parenthesisBalance(line);

			if (buffer.depth <= 0) {
				(seenClass ? pending : classLevel).push(buffer.text.trim());
				buffer = null;
			}

			continue;
		}

		if (trimmed.startsWith('@')) {
			const depth = parenthesisBalance(line);

			if (depth > 0) buffer = { text: line, depth };
			else (seenClass ? pending : classLevel).push(trimmed);

			continue;
		}

		if (/^export\s+(?:abstract\s+)?class\s+\w+/.test(trimmed)) {
			seenClass = true;
			declaration = trimmed;
			pending = [];
			continue;
		}

		const isComment = trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

		if (seenClass && pending.length > 0 && !isComment) {
			const named = /^(?:public\s+|private\s+|protected\s+|readonly\s+|async\s+|static\s+)*([A-Za-z_]\w*)\s*[(<:]/.exec(trimmed);

			members.push({ name: named ? named[1] : '(anonymous)', decorators: pending, line: index + 1 });
			pending = [];
		} else if (!isComment && pending.length > 0) {
			pending = [];
		}
	}

	return { classLevel, members, declaration };
}

/**
 * The permissions one decorator run states.
 *
 * The identifiers are read rather than resolved: a permission may be written `PermissionsEnum.X`, or
 * as a member of a package's own frozen tuple (`CART_PERMISSIONS`), and the comparison this pass
 * makes is between two spellings of the same constant on two surfaces of one concept.
 *
 * @param decorators The decorator run.
 * @returns The permission identifiers, as a set.
 */
function permissionsStated(decorators) {
	const stated = new Set();

	for (const decorator of decorators) {
		if (!decorator.startsWith('@Permissions')) continue;

		for (const match of decorator.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) stated.add(match[1]);
	}

	return stated;
}

/** The class-level `@UseGuards(...)` of a decorator run, as one string. */
function guardsStated(decorators) {
	return decorators.filter((decorator) => decorator.startsWith('@UseGuards')).join(',');
}

/**
 * The canonical shape of one REST route, or null when it has none.
 *
 * Only the eight shapes a GraphQL root field can be matched to are classified. A route with a path of
 * its own — `/employee/:employeeId`, `/approval/:id` — answers a question this pass cannot pair with
 * a field name, and is left to the concept pass above.
 *
 * @param verb The HTTP verb.
 * @param path The decorator's path argument, as written.
 * @returns The shape, or null.
 */
function restRouteShape(verb, path) {
	const route = (path || '').replace(/^['"`]|['"`]$/g, '').replace(/^\/|\/$/g, '');

	if (verb === 'Get') {
		if (route === '') return 'list';
		if (route === 'count') return 'count';
		if (/^:[A-Za-z_]\w*$/.test(route)) return 'byId';
		return null;
	}

	if (verb === 'Post') return route === '' ? 'create' : null;

	if (verb === 'Put' || verb === 'Patch') {
		if (/^:[A-Za-z_]\w*$/.test(route)) return 'update';
		if (/^:[A-Za-z_]\w*\/recover$/.test(route)) return 'recover';
		return null;
	}

	if (verb === 'Delete') {
		if (/^:[A-Za-z_]\w*$/.test(route)) return 'delete';
		if (/^:[A-Za-z_]\w*\/soft$/.test(route)) return 'softDelete';
		return null;
	}

	return null;
}

/**
 * The canonical shape of one GraphQL root field, and the concept it names.
 *
 * A query is either a count (`tagTypeCount`) or a read of the resource itself, which is matched
 * against both REST reads because the plural and the singular spelling of a field mirror the list and
 * the row route respectively and a name alone does not say which. A mutation is named by its verb,
 * which is what says which write it is.
 *
 * @param kind `Query` or `Mutation`.
 * @param name The field name.
 * @returns The shape and the concept, or null when the field is not one of the eight.
 */
function graphqlFieldShape(kind, name) {
	if (kind === 'Query') {
		if (/Count$/.test(name)) return { shape: 'count', concept: name.slice(0, -'Count'.length) };
		return { shape: 'read', concept: name };
	}

	const verb = /^(createMany|create|updateMany|update|deleteMany|delete|removeMany|remove|softDelete|softRemove|recover|restore)([A-Z]\w*)$/.exec(name);

	if (!verb) return null;

	const shape =
		verb[1] === 'softDelete' || verb[1] === 'softRemove'
			? 'softDelete'
			: verb[1] === 'recover' || verb[1] === 'restore'
				? 'recover'
				: verb[1].startsWith('create')
					? 'create'
					: verb[1].startsWith('update')
						? 'update'
						: 'delete';

	return { shape, concept: verb[2].charAt(0).toLowerCase() + verb[2].slice(1) };
}

/**
 * Every REST resource's routes, by shape, with the permission each one effectively requires.
 *
 * @returns A map of resource name to `{ shapes, tenantGuard, files }`.
 */
function restRoutesByShape() {
	const resources = new Map();
	const HTTP_ROUTE = /^@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/;

	for (const tree of PERMISSION_TREES) {
		for (const file of walk(tree, (name) => name.endsWith('.controller.ts'))) {
			const source = read(file);
			const { classLevel, members, declaration } = decoratedMembers(source);
			const prefix = /@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/.exec(source);
			const resource = prefix ? prefix[1].split('/').filter(Boolean)[0] : null;

			if (!resource) continue;

			const classPermissions = permissionsStated(classLevel);
			const entry = resources.get(resource) ?? { shapes: new Map(), tenantGuard: false, files: new Set() };

			entry.files.add(relative(ROOT, file));
			if (/TenantPermissionGuard/.test(guardsStated(classLevel))) entry.tenantGuard = true;

			// The base's own routes first, so a handler the subclass declares overwrites them below.
			if (/extends\s+(?:CrudController|CrudFactory)/.test(declaration)) {
				for (const shape of CRUD_BASE_SHAPES) {
					if (!entry.shapes.has(shape)) entry.shapes.set(shape, new Set(classPermissions));
				}
			}

			for (const member of members) {
				const route = member.decorators.find((decorator) => HTTP_ROUTE.test(decorator));

				if (!route) continue;

				const [, verb, argument] = HTTP_ROUTE.exec(route);
				const shape = restRouteShape(verb, argument.trim());

				if (!shape) continue;

				const own = permissionsStated(member.decorators);

				entry.shapes.set(shape, own.size > 0 ? own : new Set(classPermissions));
			}

			resources.set(resource, entry);
		}
	}

	return resources;
}

/**
 * Compares every GraphQL root field's permission with the REST route of the same concept and shape.
 *
 * @param resources The REST side, as {@link restRoutesByShape} read it.
 * @returns `{ failures, differences, compared }`.
 */
function permissionParity(resources) {
	const failures = [];
	const differences = [];
	const GQL_FIELD = /^@(Query|Mutation)\(/;
	let compared = 0;

	for (const tree of PERMISSION_TREES) {
		for (const file of walk(tree, (name) => name.endsWith('.resolver.ts'))) {
			const source = read(file);

			if (!/^@Resolver\(/m.test(source)) continue;

			const { classLevel, members } = decoratedMembers(source);
			const classPermissions = permissionsStated(classLevel);
			const where = relative(ROOT, file);

			for (const member of members) {
				const declared = member.decorators.find((decorator) => GQL_FIELD.test(decorator));

				if (!declared) continue;

				const kind = GQL_FIELD.exec(declared)[1];
				const name = fieldNameOfDecorator(declared, member.name);
				const own = permissionsStated(member.decorators);
				const effective = own.size > 0 ? own : classPermissions;
				const shaped = graphqlFieldShape(kind, name);

				if (!shaped) continue;

				const kebab = kebabCase(shaped.concept);
				const candidates = new Set([
					kebab,
					...plurals(kebab),
					kebabCase(singular(shaped.concept)),
					...plurals(kebabCase(singular(shaped.concept)))
				]);
				const matched = [...candidates].find((candidate) => resources.has(candidate));

				if (!matched) continue;

				const shapes = resources.get(matched).shapes;
				const restShapes =
					shaped.shape === 'read'
						? ['list', 'byId'].filter((shape) => shapes.has(shape))
						: shapes.has(shaped.shape)
							? [shaped.shape]
							: [];

				if (restShapes.length === 0) continue;

				// The weakest route of the matching shapes is the floor a field must not sit below. A
				// plural field may mirror the list and a singular one the row, and nothing in the name
				// says which, so the field is held to the lesser of the two rather than to the greater:
				// holding it to the greater would report a correct field as a defect.
				let floor = null;

				for (const shape of restShapes) {
					const stated = shapes.get(shape);
					if (floor === null || stated.size < floor.size) floor = stated;
				}

				if (!floor || floor.size === 0) continue;

				compared++;

				if (effective.size === 0) {
					failures.push({
						file: where,
						line: member.line,
						kind,
						name,
						shape: shaped.shape,
						resource: matched,
						required: [...floor]
					});
					continue;
				}

				if ([...floor].every((permission) => !effective.has(permission))) {
					differences.push({
						file: where,
						line: member.line,
						kind,
						name,
						resource: matched,
						required: [...floor],
						stated: [...effective]
					});
				}
			}
		}
	}

	return { failures, differences, compared };
}

/**
 * The field name a `@Query`/`@Mutation` decorator declares.
 *
 * @param decorator The decorator text.
 * @param member The method name, which is the field when the decorator names none.
 * @returns The field name.
 */
function fieldNameOfDecorator(decorator, member) {
	const named = /name:\s*['"`]([A-Za-z_]\w*)['"`]/.exec(decorator);

	if (named) return named[1];

	const literal = /^@\w+\(\s*['"`]([A-Za-z_]\w*)['"`]/.exec(decorator);

	return literal ? literal[1] : member;
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
	const resolverFiles = walk(dir, (name) => name.endsWith('.resolver.ts'));

	// A resolver whose field the schema does not declare is a field nothing can call.
	if (resolverFiles.length > 0) {
		const pluginSource = walk(dir, (name) => name.endsWith('.plugin.ts')).map(read).join('\n');
		const schema = schemaSourceOf(dir);

		problems.push(
			...[
				!/extensions\s*:\s*\{[\s\S]{0,400}?schema\s*:/.test(pluginSource)
					? {
							package: name,
							kind: 'no-schema',
							detail: `${resolverFiles.length} resolver file(s) and no schema extension in the plugin metadata, so none of their fields can be served`
						}
					: null,
				schema.trim().length === 0
					? {
							package: name,
							kind: 'no-schema',
							detail: 'resolvers are declared and the package contributes no schema document at all'
						}
					: null,
				...[...fields.keys()]
					.filter((field) => !new RegExp(`\\b${field}\\b`).test(schema))
					.map((field) => ({
						package: name,
						kind: 'field-not-declared',
						detail: `the resolver declares ${field} and the package's schema document does not`
					}))
			].filter(Boolean)
		);
	}

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

// ---------------------------------------------------------------------------------------------
// Scope parity: what each protocol asks the caller for.
// ---------------------------------------------------------------------------------------------

const restResources = restRoutesByShape();
const { failures: underGuarded, differences, compared } = permissionParity(restResources);

console.log('');
console.log('Permission parity — the same scope over both protocols');
console.log('=====================================================');
console.log('');
console.log(`  ${restResources.size} REST resource(s) read, ${compared} GraphQL root field(s) matched to a permissioned route`);
console.log('');

if (underGuarded.length === 0) {
	console.log('  OK — no GraphQL root field is served with less permission than the REST route it mirrors');
} else {
	console.log(`  ${underGuarded.length} GraphQL root field(s) ask the caller for nothing where their REST route asks for a permission:`);
	for (const entry of underGuarded) {
		console.log(
			`    ${entry.file}:${entry.line}  ${entry.kind} ${entry.name} [${entry.shape}]` +
				` → /${entry.resource} requires ${entry.required.join(', ')}`
		);
	}
}

if (differences.length) {
	console.log('');
	console.log(
		`  ${differences.length} field(s) state a permission their route does not (information, not a failure —` +
			' two permissions cannot be ordered here, and the field is not the weaker surface):'
	);
	for (const entry of differences) {
		console.log(
			`    ${entry.file}:${entry.line}  ${entry.kind} ${entry.name} → /${entry.resource}` +
				` requires ${entry.required.join(', ')}; the field requires ${entry.stated.join(', ')}`
		);
	}
}

console.log('');
const failed = problems.length > 0 || stale.length > 0 || underGuarded.length > 0;
console.log(failed ? 'api parity check: FAILED' : 'api parity check: PASSED');

process.exit(failed ? 1 : 0);
