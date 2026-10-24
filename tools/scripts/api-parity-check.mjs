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
 * **The second pass is about scope rather than existence.** A concept served over both protocols is
 * only one concept if both protocols ask the caller for the same thing. This pass reads every REST
 * route's effective `@Permissions(...)` — the handler's own, or the controller's class-level metadata
 * when the handler states none, which is how `getAllAndOverride` resolves it — classifies it into the
 * canonical shape it has (`list`, `byId`, `count`, `create`, `update`, `delete`, `softDelete`,
 * `recover`), does the same for every `@Query`/`@Mutation` field, and refuses a field that states
 * **no** permission where the REST route of the same concept and the same shape states one. That is
 * not hypothetical: seven kernel resolvers once shipped thirty-two write fields that way —
 * `createOrganizationDepartment`, `deleteTag`, `softDeleteUser` and the rest — each the exact
 * operation its REST twin refuses without `ALL_ORG_EDIT`, `ORG_TAGS_DELETE` or `ORG_USERS_EDIT`, and
 * each reachable by any authenticated member of the tenant over the one GraphQL endpoint, while the
 * docstrings above them asserted the routes they mirrored stated no permission. They were fixed by
 * hand; this keeps the shape from coming back. It reads the kernel as well as the plugins, because the
 * endpoint is one schema assembled from both.
 *
 * Two deliberate limits keep the pass honest rather than merely loud:
 *
 *   - **An inherited route counts as the base declares it.** A controller that `extends
 *     CrudController` serves a list, a row, a count and five writes that carry only its class-level
 *     metadata, so those shapes are seeded from the class and then overwritten by any handler the
 *     subclass declares. Without that, every field mirroring an inherited route would be reported.
 *   - **Only "the field asks for nothing" fails.** A field that states a *different* permission from
 *     its route is reported as information: two permissions cannot be ordered by this script, and the
 *     field is not the weaker surface. Whether a stated permission is actually evaluated against the
 *     caller is `declared-permissions-enforced.spec.ts`'s question, not this one.
 *
 * Usage:
 *   node tools/scripts/api-parity-check.mjs [repoRoot]
 *
 * Exits 0 when every concept is served over both protocols or acknowledged, and no GraphQL root field
 * asks for nothing where its REST twin asks for a permission; 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoratedClasses, states } from './decorator-runs.mjs';
import { stripComments } from './subscription-parity-check.mjs';

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
	productVariantMediaItem:
		'One gallery row, the row form of `GET /product-variant-media/:id`; qualified because `productVariantMedia` is the list and GraphQL allows one field per name.',
	stockCountVariance: 'The variance a count found, computed from its lines.',
	availableQuantity: 'How much of a variant is available at a location, computed from its level and the holds against it.',
	productVariantFacets: 'The facet values a variant carries, a projection over its tags and channels.',
	resolvePrice: 'The price that applies to a variant in a context, which is a computation over price rows.',
	resolveTaxRate: 'The tax rate that applies in a context, a computation over rate rows.',
	resolveTaxRegime: 'The regime that applies in a context, a computation over regime rows.',
	calculateTax:
		'What tax applies to a set of lines, a computation over rate rows that stores nothing; REST reaches the same answer through the rate resource’s own calculate sub-route, which is why no controller declares a resource named for it.',
	resolveVendorProductTerm: 'The terms that apply to a vendor’s product, a computation over term rows.',
	taxRateParts: 'The parts of a rate, reached over GraphQL through the rate.',
	taxRegimeRates: 'The rates of a regime, reached over GraphQL through the regime.',
	checkEntitlement: 'Whether a party holds an entitlement, a question about entitlements rather than an entitlement.',
	validateCoupon: 'Whether a coupon applies, a question about coupons rather than a coupon.',
	giftCardBalance: 'The remaining balance of a gift card, a computation over its transactions.',
	orderByNumber: 'An order addressed by its number rather than its id; REST filters the order route by number.',
	cartByToken:
		'A cart addressed by its guest-access token rather than its id; REST serves the same lookup at `GET /carts/by-token`, the token in the `X-Cart-Token` header (never the URL).',
	orderTotals: 'The totals of an order, which the order resource already carries over REST.',
	orderLineInvoicingPosition: 'How far a line has been invoiced, a computation over its invoice links.',
	fulfillmentOutstanding: 'How much of a line is still to ship, a computation over its fulfilments.',
	shippingProfileForVariant: 'The profile that governs a variant, a look-up through the variant’s assignments.',
	shippingOptionsForContext: 'The options eligible in a context, which the option resource cannot answer without the context.',
	shippingRate: 'The price an option quotes for a context, a computation over the option’s price shapes.',
	subscriptionPlanByCode: 'A plan addressed by its code rather than its id; REST filters the plan route by code.',
	upcomingSubscriptionBilling:
		'The next billing of a subscription, a computation over its lines and plan that writes nothing; REST serves it at `/subscriptions/:id/upcoming-billing` on the subscription resource.',
	warehouseBinSubtree: 'Everything under a bin, a walk of the bin hierarchy.',
	warehouseBinContents: 'What a bin holds, derived from the stock ledger.',
	warehouseBinCapacity: 'How much of a bin’s capacity a request would use, a conversion and a comparison.',
	warehouseBinCapacityWarnings: 'The bins whose stated unit is missing, a report over bins.',
	sellerStatement: 'A seller’s statement, an aggregation of that seller’s transactions.',
	sellerBalance: 'What a seller is owed, an aggregation of settlements and payouts.',
	sellerSplitReconciliation: 'Whether the splits of a period reconcile, a check over split rows.',
	searchFacets: 'The facet counts of a search, which REST serves at `/search/facets` on the search resource.'
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
	'product-variant-tags': 'The link between a variant and a tag, reached over GraphQL through the variant.'
};

/**
 * Ledger resources whose direct writes GraphQL deliberately does not mirror.
 *
 * Each is read over both protocols and serves the recoverable withdraw/restore pair on both, while its direct
 * create, update and hard delete have no GraphQL field — the rows are written by the operations that own them,
 * and the specifications refuse to mirror a direct write over a ledger. What REST does with those routes differs
 * and each entry says it: the gift-card ledger refuses them on REST too, while the two usage ledgers keep them
 * on REST as a gated back-office correction. That is a decision, not a gap, and it used to be recorded only in
 * the package's own write-route suite (`promotion/src/lib/graphql/resolvers/write-routes.spec.ts`, `REFUSED`);
 * listing it here makes the gate say so too (R2-G34). An entry fails when no controller declares the resource
 * (stale), and when the package's schema declares a `create`/`update`/`delete` field for it after all.
 */
const LEDGERS = {
	'gift-card-transactions':
		'The append-only ledger of a gift card, written by the card operations (issue, redeem, refund, adjust, void); REST refuses the direct writes too (GIFT_CARD_TRANSACTION_APPEND_ONLY).',
	'promotion-usages':
		'The redemption ledger, written by the checkout and cancellation operations; the direct writes stay REST-only, gated as a back-office correction (06 §7.22).',
	'campaign-budget-usages':
		'The per-value consumption of a campaign budget, maintained by the budget increment inside its transaction; the direct writes stay REST-only, gated (08 §8.3).',
	'order-summaries':
		'The totals history of an order, one row per committed version, appended by the totals writer; append-only (edits answer ORDER_LEDGER_APPEND_ONLY), the direct POST stays REST-only as a gated back-office write (ORDERS_CREATE) (R2-G22).',
	'order-history':
		'The timeline of an order, appended by the operation that causes each entry; append-only (ORDER_LEDGER_APPEND_ONLY), the direct POST stays REST-only as a gated back-office write (ORDERS_CREATE) (R2-G22).',
	'order-transactions':
		'The money ledger of an order, written by the operations that move the money; its one direct write, POST /order-transactions, records an operator’s MANUAL correction and stays REST-only (ORDERS_CREATE, idempotent under order.transaction.manual), edits answer ORDER_LEDGER_APPEND_ONLY (R2-G22).'
};

/**
 * Single write routes GraphQL deliberately does not mirror, on resources whose other writes it does.
 *
 * `LEDGERS` above acknowledges a resource whose direct writes are all REST-only; these are narrower — one route
 * of a resource that GraphQL otherwise writes — so they are named route by route, with the field a mirror would
 * be called (R2-G22, R2-G23). An entry fails when no controller of the package maps the route (stale), and when
 * the package's schema declares the field after all: the acknowledgement would then describe a surface that no
 * longer exists.
 */
const REST_ONLY_ROUTES = [
	{
		resource: 'order-change-actions',
		method: 'Post',
		path: '',
		field: 'createOrderChangeAction',
		reason: 'An action is created with its change — `requestOrderEdit(input.actions)` / `POST /orders/:id/changes` — and amended or retired over both protocols; the standalone create stays a gated REST back-office write (ORDERS_CREATE).'
	},
	{
		resource: 'order-claims',
		method: 'Post',
		path: ':id/close',
		field: 'closeOrderClaim',
		reason: '10-orders-payments-and-returns-spec §12.6 makes CLAIM_RESOLVE the only writer of claim state and §12.1 gives CLOSED to it (`approveOrderClaim`); 06 §7.14 declares no close route — pinned by the returns write-route suite (`REFUSED`).'
	},
	{
		resource: 'order-exchanges',
		method: 'Post',
		path: ':id/close',
		field: 'closeOrderExchange',
		reason: '10-orders-payments-and-returns-spec §12.6 makes EXCHANGE_RESOLVE the only writer of exchange state and §12.2 gives CLOSED to it once the difference settled (`approveOrderExchange`); 06 §7.14 declares no close route — pinned by the returns write-route suite (`REFUSED`).'
	}
];

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
 * The source of the controller that serves a resource, without its comments, or the empty string.
 *
 * Comments are stripped before anything is matched, so a route that was commented out reads as absent
 * rather than as mapped (Greptile, #10901) — the reading `subscription-parity-check.mjs` gives a
 * commented-out producer.
 *
 * @param dir The package directory.
 * @param resource The resource, without a leading slash.
 * @returns {string} The controller's text, without comments.
 */
function controllerSourceOf(dir, resource) {
	for (const file of walk(dir, (name) => name.endsWith('.controller.ts'))) {
		const source = stripComments(read(file));
		const prefix = /@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/.exec(source);

		if (prefix && prefix[1].split('/').filter(Boolean)[0] === resource) return source;
	}

	return '';
}

/**
 * Whether a controller maps a route: `@Post()` for the collection, `@Post(':id/close')` for a sub-route.
 *
 * @param source The controller's text.
 * @param method The decorator, `Post`, `Put`, `Delete` or `Patch`.
 * @param path The path below the resource, empty for the collection.
 * @returns {boolean} Whether the decorator is there.
 */
function mapsRoute(source, method, path) {
	const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, (character) => `\\${character}`);
	const pattern = path
		? new RegExp(`@${method}\\(\\s*['"\`]${escaped}['"\`]\\s*\\)`)
		: new RegExp(`@${method}\\(\\s*(?:['"\`]['"\`])?\\s*\\)`);

	return pattern.test(source);
}

/**
 * Whether a schema document defines a field: its name followed by its arguments or by its type.
 *
 * A field with no arguments — `closeOrderClaim: Boolean!` — is a field too, so both `(` and `:` count
 * (CodeRabbit, #10901). The ledger rule and the single-route rule both read fields this way.
 *
 * @param schema The package's schema source.
 * @param field The field name.
 * @returns {boolean} Whether the document defines it.
 */
function definesField(schema, field) {
	return new RegExp(`\\b${field}\\s*[(:]`).test(schema);
}

// ---------------------------------------------------------------------------------------------
// The permission-parity pass: the readers.
// ---------------------------------------------------------------------------------------------

/**
 * The trees the permission-parity pass reads.
 *
 * Both, and not only the programme's packages: the endpoint is one schema assembled from the kernel
 * and every configured plugin, so a kernel resolver that asks for less than its own controller is
 * exactly as open as a plugin one.
 */
const PERMISSION_TREES = [join(ROOT, 'packages', 'core', 'src', 'lib'), join(ROOT, 'packages', 'plugins')];

/** The shapes `CrudController` and `CrudFactory` serve on a subclass's behalf, with its class-level metadata. */
const CRUD_BASE_SHAPES = ['list', 'byId', 'count', 'create', 'update', 'delete', 'softDelete', 'recover'];

/** A REST route decorator, with its verb and its argument. */
const HTTP_ROUTE = /^@(Get|Post|Put|Patch|Delete)\(([\s\S]*)\)$/;

/** A GraphQL root field decorator, with its kind. */
const GRAPHQL_ROOT_FIELD = /^@(Query|Mutation)\(/;

/** A path relative to the root, with forward slashes on every platform. */
function shown(file) {
	return relative(ROOT, file).split(sep).join('/');
}

/**
 * The permissions a decorator run states.
 *
 * The identifiers are read rather than resolved: a permission may be written `PermissionsEnum.X`, or
 * as a member of a package's own frozen tuple, and the comparison this pass makes is between two
 * spellings of the same constant on two surfaces of one concept.
 *
 * @param {string[]} decorators The decorator run.
 * @returns {Set<string>} The permission identifiers.
 */
function permissionsStated(decorators) {
	const stated = new Set();

	for (const decorator of decorators) {
		if (!decorator.startsWith('@Permissions(')) continue;

		for (const match of decorator.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) stated.add(match[1]);
	}

	return stated;
}

/**
 * The paths one route decorator's argument names: none for `@Get()`, one for `@Get(':id')`, every one
 * of `@Get(['/pagination', '/'])` — a route that answers at two addresses answers at both.
 *
 * @param {string} argument The decorator's argument, as written.
 * @returns {string[]} The paths, without quotes; `['']` when the decorator names none.
 */
function routePaths(argument) {
	const paths = [...argument.matchAll(/(['"`])([^'"`]*)\1/g)].map((match) => match[2]);

	return paths.length > 0 ? paths : [''];
}

/**
 * The canonical shape of one REST route, or null when it has none.
 *
 * Only the eight shapes a GraphQL root field can be matched to are classified. A route with a path of
 * its own — `/employee/:employeeId`, `/approval/:id` — answers a question this pass cannot pair with
 * a field name, and is left to the concept pass.
 *
 * @param {string} verb The HTTP verb.
 * @param {string} path The route's path below the controller's prefix.
 * @returns {string | null} The shape.
 */
function restRouteShape(verb, path) {
	const route = path.replace(/^\/|\/$/g, '');
	const byId = /^:[A-Za-z_]\w*$/;

	if (verb === 'Get') {
		if (route === '') return 'list';
		if (route === 'count') return 'count';
		return byId.test(route) ? 'byId' : null;
	}

	if (verb === 'Post') return route === '' ? 'create' : null;

	if (verb === 'Put' || verb === 'Patch') {
		if (byId.test(route)) return 'update';
		return /^:[A-Za-z_]\w*\/recover$/.test(route) ? 'recover' : null;
	}

	if (verb === 'Delete') {
		if (byId.test(route)) return 'delete';
		return /^:[A-Za-z_]\w*\/soft$/.test(route) ? 'softDelete' : null;
	}

	return null;
}

/**
 * The canonical shape of one GraphQL root field, and the concept it names.
 *
 * A query is either a count (`tagTypeCount`) or a read of the resource itself, which is matched
 * against both REST reads, because the plural and the singular spelling of a field mirror the list and
 * the row route respectively and a name alone does not say which. A mutation is named by its verb.
 *
 * @param {string} kind `Query` or `Mutation`.
 * @param {string} name The field name.
 * @returns {{ shape: string, concept: string } | null} Null when the field is not one of the eight.
 */
function graphqlFieldShape(kind, name) {
	if (kind === 'Query') {
		if (/Count$/.test(name)) return { shape: 'count', concept: name.slice(0, -'Count'.length) };
		return { shape: 'read', concept: name };
	}

	const verb =
		/^(createMany|create|updateMany|update|deleteMany|delete|removeMany|remove|softDelete|softRemove|recover|restore)([A-Z]\w*)$/.exec(
			name
		);

	if (!verb) return null;

	let shape = 'delete';

	if (verb[1] === 'softDelete' || verb[1] === 'softRemove') shape = 'softDelete';
	else if (verb[1] === 'recover' || verb[1] === 'restore') shape = 'recover';
	else if (verb[1].startsWith('create')) shape = 'create';
	else if (verb[1].startsWith('update')) shape = 'update';

	return { shape, concept: verb[2].charAt(0).toLowerCase() + verb[2].slice(1) };
}

/**
 * The field name a `@Query`/`@Mutation` decorator declares: `{ name: 'x' }`, a leading string, or the
 * method's own name when the decorator names none.
 *
 * @param {string} decorator The decorator text.
 * @param {string} member The method name.
 * @returns {string} The field name.
 */
function fieldNameOfDecorator(decorator, member) {
	const named = /name:\s*['"`]([A-Za-z_]\w*)['"`]/.exec(decorator);

	if (named) return named[1];

	const literal = /^@\w+\(\s*['"`]([A-Za-z_]\w*)['"`]/.exec(decorator);

	return literal ? literal[1] : member;
}

/**
 * Every REST resource's routes, by shape, with the permission each one effectively requires.
 *
 * @returns {Map<string, Map<string, Set<string>>>} Resource name (the prefix's segments, parameters left out) to shape
 *   to the permissions the route resolves to.
 */
function restRoutesByShape() {
	const resources = new Map();

	for (const tree of PERMISSION_TREES) {
		for (const file of walk(tree, (name) => name.endsWith('.controller.ts'))) {
			for (const declared of decoratedClasses(read(file))) {
				const controller = declared.decorators.find((decorator) => decorator.startsWith('@Controller('));
				const prefix = controller ? /^@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)$/.exec(controller) : null;
				// The whole prefix minus its parameters: `users/:userId/plugins` serves a user's plugins, and
				// reading only its first segment would file that controller's list under `/users`.
				const resource = prefix
					? prefix[1]
							.split('/')
							.filter((segment) => segment && !segment.startsWith(':'))
							.join('-')
					: null;

				if (!resource) continue;

				const classPermissions = permissionsStated(declared.decorators);
				const shapes = resources.get(resource) ?? new Map();

				// The base's own routes first, so a handler the subclass declares overwrites them below.
				if (/\bextends\s+(?:CrudController|CrudFactory)\b/.test(declared.declaration)) {
					for (const shape of CRUD_BASE_SHAPES) {
						if (!shapes.has(shape)) shapes.set(shape, new Set(classPermissions));
					}
				}

				for (const member of declared.members) {
					const route = member.decorators.map((decorator) => HTTP_ROUTE.exec(decorator)).find(Boolean);

					if (!route) continue;

					const own = permissionsStated(member.decorators);

					for (const path of routePaths(route[2])) {
						const shape = restRouteShape(route[1], path);

						if (shape) shapes.set(shape, own.size > 0 ? own : new Set(classPermissions));
					}
				}

				resources.set(resource, shapes);
			}
		}
	}

	return resources;
}

/**
 * Compares every GraphQL root field's permission with the REST route of the same concept and shape.
 *
 * @param {Map<string, Map<string, Set<string>>>} resources The REST side, as {@link restRoutesByShape} read it.
 * @returns {{ failures: object[], differences: object[], compared: number }}
 */
function permissionParity(resources) {
	const failures = [];
	const differences = [];
	let compared = 0;

	for (const tree of PERMISSION_TREES) {
		for (const file of walk(tree, (name) => name.endsWith('.resolver.ts'))) {
			for (const declared of decoratedClasses(read(file))) {
				if (!states(declared.decorators, 'Resolver')) continue;

				const classPermissions = permissionsStated(declared.decorators);

				for (const member of declared.members) {
					const field = member.decorators.find((decorator) => GRAPHQL_ROOT_FIELD.test(decorator));

					if (!field) continue;

					const kind = GRAPHQL_ROOT_FIELD.exec(field)[1];
					const name = fieldNameOfDecorator(field, member.name);
					const own = permissionsStated(member.decorators);
					const effective = own.size > 0 ? own : classPermissions;
					const shaped = graphqlFieldShape(kind, name);

					if (!shaped) continue;

					const kebab = kebabCase(shaped.concept);
					const single = kebabCase(singular(shaped.concept));
					const candidates = new Set([kebab, ...plurals(kebab), single, ...plurals(single)]);
					const matched = [...candidates].find((candidate) => resources.has(candidate));

					if (!matched) continue;

					const shapes = resources.get(matched);
					const restShapes =
						shaped.shape === 'read'
							? ['list', 'byId'].filter((shape) => shapes.has(shape))
							: shapes.has(shaped.shape)
								? [shaped.shape]
								: [];

					if (restShapes.length === 0) continue;

					// A plural field may mirror the list and a singular one the row, and nothing in the name
					// says which, so the field is held to the route that asks for the least: when either REST
					// read states no permission, a field that states none is not the weaker surface.
					if (restShapes.some((shape) => shapes.get(shape).size === 0)) continue;

					const floor = shapes.get(restShapes[0]);

					compared++;

					if (effective.size === 0) {
						failures.push({
							file: shown(file),
							line: member.line,
							kind,
							name,
							shape: shaped.shape,
							resource: matched,
							required: [...floor]
						});
						continue;
					}

					if (restShapes.every((shape) => [...shapes.get(shape)].every((p) => !effective.has(p)))) {
						differences.push({
							file: shown(file),
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
	}

	return { failures, differences, compared };
}

const problems = [];
const acknowledged = [];
const restOnlyRoutes = [];
const oneSided = [];
const children = [];
const declaredFields = new Set();
const declaredResources = new Set();
const summary = [];

for (const name of PACKAGES) {
	const dir = join(PLUGINS_DIR, name);

	let exists;
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

	// A ledger whose direct writes GraphQL is said not to mirror must not have grown such a field: the
	// acknowledgement would then describe a surface that no longer exists.
	const ledgersHere = [...resources].filter((resource) => LEDGERS[resource]);
	if (ledgersHere.length) {
		const schema = schemaSourceOf(dir);

		for (const resource of ledgersHere) {
			const type = camelCase(singular(resource)).replace(/^./, (first) => first.toUpperCase());
			const writes = ['create', 'update', 'delete']
				.map((verb) => `${verb}${type}`)
				.filter((field) => definesField(schema, field));

			if (writes.length) {
				problems.push({
					package: name,
					kind: 'ledger-write',
					detail: `/${resource} is acknowledged as a ledger GraphQL does not write, and the schema declares ${writes.join(', ')}`
				});
			}
		}
	}

	// A single route acknowledged as REST-only must still be mapped, and must not have grown its mirror.
	for (const entry of REST_ONLY_ROUTES.filter(({ resource }) => resources.has(resource))) {
		const route = `${entry.method.toUpperCase()} /${entry.resource}${entry.path ? `/${entry.path}` : ''}`;

		if (!mapsRoute(controllerSourceOf(dir, entry.resource), entry.method, entry.path)) {
			problems.push({
				package: name,
				kind: 'stale-route',
				detail: `${route} is acknowledged as REST-only and no controller of the package maps it`
			});
			continue;
		}

		if (definesField(stripComments(schemaSourceOf(dir)), entry.field)) {
			problems.push({
				package: name,
				kind: 'route-mirrored',
				detail: `${route} is acknowledged as REST-only, and the schema declares ${entry.field}`
			});
			continue;
		}

		restOnlyRoutes.push({ package: name, route, field: entry.field, reason: entry.reason });
	}

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

const staleLedgers = Object.keys(LEDGERS).filter((resource) => !declaredResources.has(resource));
const staleRoutes = REST_ONLY_ROUTES.filter(({ resource }) => !declaredResources.has(resource));

const stale = [
	...staleFields.map((field) => `GraphQL field \`${field}\``),
	...staleResources.map((resource) => `REST resource /${resource}`),
	...staleLedgers.map((resource) => `ledger /${resource}`),
	...staleRoutes.map(
		({ resource, method, path }) => `REST route ${method.toUpperCase()} /${resource}${path ? `/${path}` : ''}`
	)
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

console.log('');
console.log(
	`  ${Object.keys(LEDGERS).length} ledger resource(s) read and withdrawn/restored on both protocols, their direct writes not mirrored over GraphQL:`
);
for (const [resource, reason] of Object.entries(LEDGERS)) {
	console.log(`    ${`/${resource}`.padEnd(28)} ${reason}`);
}

console.log('');
console.log(`  ${restOnlyRoutes.length} REST write route(s) on GraphQL-written resources, deliberately not mirrored:`);
for (const entry of restOnlyRoutes) {
	console.log(`    ${entry.route.padEnd(34)} ${entry.package} — (no ${entry.field}) ${entry.reason}`);
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
// Permission parity: what each protocol asks the caller for.
// ---------------------------------------------------------------------------------------------

const restResources = restRoutesByShape();
const { failures: underGuarded, differences, compared } = permissionParity(restResources);

console.log('');
console.log('Permission parity — the same scope over both protocols');
console.log('=====================================================');
console.log('');
console.log(
	`  ${restResources.size} REST resource(s) read, ${compared} GraphQL root field(s) matched to a permissioned route`
);
console.log('');

if (underGuarded.length === 0) {
	console.log('  OK — no GraphQL root field asks for nothing where the REST route it mirrors asks for a permission');
} else {
	console.log(
		`  ${underGuarded.length} GraphQL root field(s) ask the caller for nothing where their REST route asks for a permission:`
	);
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
