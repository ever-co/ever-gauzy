/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, printSchema } from 'graphql';
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { CurrencyController } from './currency.controller';
import { CurrencyResolver } from './currency.resolver';

/**
 * The platform's currency master over GraphQL.
 *
 * The delivered REST route serves one read: `GET /api/currency`, which answers the whole master and
 * asks the caller for nothing — the controller carries the platform's `Public()` marker, declares no
 * guard and states no permission. This suite pins the half of the two-protocol doctrine that is easy
 * to get quietly wrong:
 *
 * - the one capability the route serves is a root field of the one composed schema, and it is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - the field reaches the same service call the REST route reaches, with the route's own absence of
 *   narrowing, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and the permission is the controller's** — which here means
 *   neither surface carries either, and both carry the controller's own public marker;
 * - **a currency is a code and a count is a count**: the object type carries the ISO 4217 code and the
 *   currency's name as `String`, the minor-unit exponent as `Int` and the cash-rounding step as the
 *   platform's exact-decimal scalar — never a `Float` and never a pre-formatted amount;
 * - the resource is **read-only**, so the schema declares no write input and no mutation, and the
 *   reads the controller does not serve — one row by id, and the count — are root fields it does not
 *   declare either.
 */

const USD = '00000000-0000-4000-8000-000000000101';
const JPY = '00000000-0000-4000-8000-000000000102';
const CHF = '00000000-0000-4000-8000-000000000103';
const XAU = '00000000-0000-4000-8000-000000000104';

/**
 * The rows a scripted service answers with, in the order the store happens to return them.
 *
 * The order is deliberately not the order this surface answers in: the delivered list route declares
 * no order of its own, so the connection has to make one, and a suite that fed the rows in sorted
 * would assert nothing about that decision. The four rows are also the four shapes the master really
 * holds — a two-decimal tender currency, a zero-decimal one, one written with a suffix symbol and a
 * cash-rounding step, and a retired metal code that can never be tendered.
 */
const ROWS = [
	{
		id: USD,
		isoCode: 'USD',
		currency: 'US Dollar',
		decimalPlaces: 2,
		symbol: '$',
		symbolPosition: 'PREFIX',
		symbolSpace: false,
		roundingMode: 'HALF_UP',
		roundingIncrement: 0,
		isTender: true,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: XAU,
		isoCode: 'XAU',
		currency: 'Gold',
		decimalPlaces: 0,
		symbol: null,
		symbolPosition: 'PREFIX',
		symbolSpace: false,
		roundingMode: 'NONE',
		roundingIncrement: 0,
		isTender: false,
		isActive: false,
		isArchived: false,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: CHF,
		isoCode: 'CHF',
		currency: 'Swiss Franc',
		decimalPlaces: 2,
		symbol: 'CHF',
		symbolPosition: 'SUFFIX',
		symbolSpace: true,
		roundingMode: 'HALF_EVEN',
		roundingIncrement: 0.05,
		isTender: true,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: JPY,
		isoCode: 'JPY',
		currency: 'Japanese Yen',
		decimalPlaces: 0,
		symbol: '¥',
		symbolPosition: 'PREFIX',
		symbolSpace: false,
		roundingMode: 'HALF_UP',
		roundingIncrement: 0,
		isTender: true,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const currencyService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length })
	};

	return {
		currencyService,
		resolver: new CurrencyResolver(currencyService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The root fields this domain contributes to `Query`: the ones named for its concept. */
function ownedQueryFields(): string[] {
	return rootFields('Query')
		.filter((field) => /(currency|currencies)$/i.test(field))
		.sort();
}

/**
 * The mutations a write on this concept would be spelled as.
 *
 * The absence of a mutation is asserted over these spellings rather than over every root field that
 * contains the word, because a root field of another domain can contain it without being a write here.
 */
function writeSpellings(): string[] {
	return rootFields('Mutation').filter((field) =>
		/^(create|update|delete|softDelete|recover|archive|set)(Currency|Currencies)$/i.test(field)
	);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CurrencyController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CurrencyController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof CurrencyController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = CurrencyResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('CurrencyResolver — the SDL declares the capabilities the REST route serves', () => {
	it('declares the currency connection, which is the whole read surface', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['currencies']));
	});

	it('declares the read the controller serves, and no more', () => {
		// The controller declares one handler of its own — `findAll`, bound to `GET /` — and inherits
		// none, because it is not mounted on the CRUD base. So one root field is the whole surface.
		expect(ownedQueryFields()).toEqual(['currencies']);
	});

	it('declares no mutation, because the controller serves no write route', () => {
		// The resource is read-only: no route of it writes, so a mutation here would be a capability the
		// REST surface does not have.
		expect(writeSpellings()).toEqual([]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type CurrencyConnection \{\s*nodes: \[Currency!\]!\s*edges: \[CurrencyEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CurrencyEdge \{\s*node: Currency!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CurrencyFilter \{/);
		expect(printed).toMatch(/input CurrencySort \{/);
		expect(printed).toMatch(/enum CurrencySortField \{\s*createdAt\s*updatedAt\s*isoCode\s*currency\s*\}/);
	});

	it('carries the code as a code, the decimals as a count and the step as an exact decimal', () => {
		const body = typeBody('Currency');

		expect(body).toMatch(/isoCode: String!/);
		expect(body).toMatch(/currency: String!/);
		// A currency is a three-letter code, not an amount: the one member here that is a quantity is
		// the cash-rounding step, and the column behind it is `numeric(20,6)`.
		expect(body).toMatch(/decimalPlaces: Int!/);
		expect(body).toMatch(/roundingIncrement: Decimal!/);
		expect(body).not.toMatch(/isoCode: Float/);
		expect(body).not.toMatch(/decimalPlaces: Float/);
		expect(body).not.toMatch(/decimalPlaces: Decimal/);
		expect(body).not.toMatch(/roundingIncrement: Float/);
		// The two vocabularies the money layer owns are carried as their values rather than declared
		// here, where a second declaration would diverge from the entity's own typing.
		expect(body).toMatch(/symbolPosition: String!/);
		expect(body).toMatch(/roundingMode: String!/);
		expect(printed).not.toMatch(/enum MoneySymbolPosition/);
		expect(printed).not.toMatch(/enum RoundingMode/);
		// Only the symbol is genuinely optional: every other formatting column is NOT NULL with a
		// default, and the row the store answers always carries it.
		expect(body).toMatch(/symbol: String\n/);
		expect(body).not.toMatch(/symbol: String!/);
		expect(body).toMatch(/isTender: Boolean!/);
	});

	it('carries no tenancy member, because a currency is not a tenant row', () => {
		const body = typeBody('Currency');

		// The table has no such column: a currency's decimal places and symbol are properties of the
		// currency, not of whoever is looking at it.
		expect(body).not.toContain('tenantId');
		expect(body).not.toContain('organizationId');
	});

	it('carries no withdrawal mark, because no delivered route writes one', () => {
		const body = typeBody('Currency');

		// Withdrawing and restoring are not routes of this resource, so a `deletedAt` member would be
		// absent on every row this surface can answer.
		expect(body).not.toContain('deletedAt');
		expect(body).not.toContain('createdByUserId');
	});

	it('declares no write input, because the resource is read-only', () => {
		expect(printed).not.toMatch(/input CreateCurrencyInput/);
		expect(printed).not.toMatch(/input UpdateCurrencyInput/);
	});

	it('declares no root field the controller has no route for', () => {
		// No `GET /:id` and no `GET /count` on the controller, so neither a node field nor a count
		// field is declared: an argument that cannot be honoured is worse than no field at all.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['currency', 'currencyCount']));
		expect(printed).not.toMatch(/currencyCount/);
		expect(printed).not.toMatch(/currenciesByIsoCode|currencyByIsoCode/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered read answers the master's live rows and takes no options at all, so the
		// connection offers `withDeleted` no more than the route does.
		expect(printed).not.toMatch(/currencies\([^)]*withDeleted/);
	});
});

describe('CurrencyResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, currencyService } = surfaces();

		const connection = await resolver.currencies(undefined, undefined, undefined, 20);

		// The read is the route's own: no options, no relations and no narrowing it does not state.
		expect(currencyService.findAll).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(4);
		expect(connection.totalCount).toBe(4);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[3].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CHF);
	});

	it('orders by the ISO code when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.currencies();

		// The delivered list declares no order of its own, so this is the connection's decision: the
		// code is the row's identity, and the identifier behind it is what makes the walk total.
		expect(connection.nodes.map((node) => node.isoCode)).toEqual(['CHF', 'JPY', 'USD', 'XAU']);
	});

	it('narrows by the code, by the granularity and by the flags the filter declares', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.currencies({ isoCode: { eq: 'JPY' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([JPY]);

		const byGranularity = await resolver.currencies({ decimalPlaces: { eq: 0 } });
		expect(byGranularity.nodes.map((node) => node.isoCode).sort()).toEqual(['JPY', 'XAU']);

		// The two flags the table's own composite indexes are declared for: what is still in use, and
		// what can be tendered at all.
		const tender = await resolver.currencies({ isTender: { eq: false } });
		expect(tender.nodes.map((node) => node.id)).toEqual([XAU]);

		const retired = await resolver.currencies({ isActive: { eq: false } });
		expect(retired.nodes.map((node) => node.id)).toEqual([XAU]);

		// A currency the master has no symbol for is the one an amount is rendered without one, which
		// is what `isNull` states and what an `eq` never matches.
		const symbolLess = await resolver.currencies({ symbol: { isNull: true } });
		expect(symbolLess.nodes.map((node) => node.id)).toEqual([XAU]);
	});

	it('compares the cash-rounding step through the decimal family the filter declares', async () => {
		const { resolver } = surfaces();

		const rounded = await resolver.currencies({ roundingIncrement: { gt: '0' } });

		expect(rounded.nodes.map((node) => node.isoCode)).toEqual(['CHF']);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.currencies(undefined, [{ field: 'currency', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.isoCode)).toEqual(['XAU', 'JPY', 'CHF', 'USD']);

		const byCodeDescending = await resolver.currencies(undefined, [{ field: 'isoCode', direction: 'DESC' }]);
		expect(byCodeDescending.nodes.map((node) => node.isoCode)).toEqual(['XAU', 'USD', 'JPY', 'CHF']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.currencies(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.isoCode)).toEqual(['CHF']);

		const second = await resolver.currencies(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.isoCode)).toEqual(['JPY']);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.currencies(undefined, undefined, undefined, 20);

		const last = await resolver.currencies(undefined, undefined, { last: 1, before: all.edges[1].cursor });

		expect(last.nodes.map((node) => node.isoCode)).toEqual(['CHF']);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.currencies(undefined, [{ field: 'symbol', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.currencies({ deletedAt: { eq: '2026-01-01' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.currencies(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('refuses a page larger than the protocol allows', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.currencies(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1000)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CurrencyResolver — one resource, two protocols, the same read', () => {
	it('reads the master through the same service method the REST route calls', async () => {
		const { resolver, currencyService } = surfaces();

		const connection = await resolver.currencies();

		expect(connection.totalCount).toBe(ROWS.length);
		expect(currencyService.findAll).toHaveBeenCalledTimes(1);
	});

	it('answers a master with no rows as an empty connection rather than as a refusal', async () => {
		const { resolver, currencyService } = surfaces();
		currencyService.findAll.mockResolvedValueOnce({ items: [], total: 0 });

		const connection = await resolver.currencies();

		expect(connection.nodes).toEqual([]);
		expect(connection.edges).toEqual([]);
		expect(connection.totalCount).toBe(0);
		expect(connection.pageInfo.startCursor).toBeNull();
		expect(connection.pageInfo.endCursor).toBeNull();
	});

	it('does not turn a failed read into an empty master', async () => {
		const { resolver, currencyService } = surfaces();
		const failure = new Error('CURRENCY_MASTER_UNREADABLE: the store refused the read.');

		currencyService.findAll.mockRejectedValueOnce(failure);

		// An empty connection means "this platform uses no currencies", which is never the answer to a
		// store that could not be read — so the failure reaches the caller.
		await expect(resolver.currencies()).rejects.toBe(failure);
	});
});

describe('CurrencyResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, which is not at all', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', CurrencyResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', CurrencyController) ?? [];

		// The delivered route is public reference data: the controller declares no guard, so a guard
		// here would refuse a caller REST serves. Neither chain exists, which is the parity.
		expect(controllerGuards).toEqual([]);
		expect(resolverGuards).toEqual([]);
	});

	it('states the controller’s own public marker, because the openness is the controller’s declaration', () => {
		// The route is open by declaration rather than by omission — the controller carries the
		// platform's marker for it — so the resolver states the same marker rather than leaving a
		// reader to infer the decision from a decorator that is not there.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, CurrencyController)).toBe(true);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, CurrencyResolver)).toBe(true);
	});

	it('states no permission on the class and none on the field, because the route states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CurrencyController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CurrencyResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CurrencyController)['findAll'])).toBeUndefined();
		expect(permissionOfField('currencies')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s guard chain and permission', () => {
		const routes: Array<[string, string]> = [['currencies', 'findAll']];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(CurrencyController, handler)])
		);

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handler is asserted to be there before the two readings are compared.
			expect(typeof handlersOf(CurrencyController)[handler]).toBe('function');
			expect(guardsOfRoute(CurrencyController, handler)).toEqual([]);
		}

		// Both readings are `undefined`, which is the answer here rather than an empty assertion: this
		// resource is mounted without a permission, so a field that acquired one would be the
		// asymmetry the two-protocol rule forbids.
		expect(stated).toEqual(expected);
	});
});
