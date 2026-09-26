/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, printSchema } from 'graphql';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard } from '../shared/guards';
import { CountryController } from './country.controller';
import { CountryResolver } from './country.resolver';

/**
 * The platform's country master over GraphQL.
 *
 * The delivered REST route serves one read: `GET /api/country`, which answers the whole master and
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
 * - **the row is a code and a name**: the object type carries the ISO 3166-1 alpha-2 code and the name
 *   under the column's own member name `country` rather than a second spelling of it;
 * - the resource is **read-only**, so the schema declares no write input and no mutation, and the
 *   reads the controller does not serve — one row by id, and the count — are root fields it does not
 *   declare either.
 */

const DE = '00000000-0000-4000-8000-000000000201';
const DK = '00000000-0000-4000-8000-000000000202';
const JP = '00000000-0000-4000-8000-000000000203';
const US = '00000000-0000-4000-8000-000000000204';

/**
 * The rows a scripted service answers with, in the order the store happens to return them.
 *
 * The order is deliberately not the order this surface answers in: the delivered list route declares
 * no order of its own, so the connection has to make one, and a suite that fed the rows in sorted
 * would assert nothing about that decision. The four names are chosen so that ordering by code and
 * ordering by name genuinely disagree — `DE` before `DK`, `Denmark` before `Germany` — which is what
 * makes the two sort keys two keys rather than one.
 */
const ROWS = [
	{
		id: US,
		isoCode: 'US',
		country: 'United States',
		isActive: true,
		isArchived: true,
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: JP,
		isoCode: 'JP',
		country: 'Japan',
		isActive: false,
		isArchived: false,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: DK,
		isoCode: 'DK',
		country: 'Denmark',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: DE,
		isoCode: 'DE',
		country: 'Germany',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const countryService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length })
	};

	return {
		countryService,
		resolver: new CountryResolver(countryService as never)
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

/**
 * The root fields this domain contributes to `Query`: the ones named for its concept, as a suffix.
 *
 * A suffix rather than a substring, because a root field of another domain can contain the word
 * without being one of this domain's — `replaceRegionCountries` is the geography's own operation.
 */
function ownedQueryFields(): string[] {
	return rootFields('Query')
		.filter((field) => /(country|countries)$/i.test(field))
		.sort();
}

/**
 * The mutations a write on this concept would be spelled as.
 *
 * The absence of a mutation is asserted over these spellings rather than over every root field that
 * contains the word, for the same reason: `replaceRegionCountries` is not a write to this master.
 */
function writeSpellings(): string[] {
	return rootFields('Mutation').filter((field) =>
		/^(create|update|delete|softDelete|recover|archive|set)(Country|Countries)$/i.test(field)
	);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CountryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CountryController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof CountryController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = CountryResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('CountryResolver — the SDL declares the capabilities the REST route serves', () => {
	it('declares the country connection, which is the whole read surface', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['countries']));
	});

	it('declares the read the controller serves, and no more', () => {
		// The controller declares one handler of its own — `findAll`, bound to `GET /` — and inherits
		// none, because it is not mounted on the CRUD base. So one root field is the whole surface.
		expect(ownedQueryFields()).toEqual(['countries']);
	});

	it('declares no mutation, because the controller serves no write route', () => {
		// The resource is read-only: no route of it writes, so a mutation here would be a capability the
		// REST surface does not have.
		expect(writeSpellings()).toEqual([]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type CountryConnection \{\s*nodes: \[Country!\]!\s*edges: \[CountryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CountryEdge \{\s*node: Country!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CountryFilter \{/);
		expect(printed).toMatch(/input CountrySort \{/);
		expect(printed).toMatch(/enum CountrySortField \{\s*createdAt\s*updatedAt\s*isoCode\s*country\s*\}/);
	});

	it('carries the code and the name, under the column’s own member names', () => {
		const body = typeBody('Country');

		expect(body).toMatch(/isoCode: String!/);
		// The column is `country` and the REST surface answers `country`, so a `name` member here would
		// be a second spelling of one fact — and the two would have to be kept in step by hand.
		expect(body).toMatch(/country: String!/);
		expect(body).not.toMatch(/\bname: /);
		expect(body).not.toMatch(/isoCode: Float|country: Float/);
	});

	it('carries no tenancy member, because a country is not a tenant row', () => {
		const body = typeBody('Country');

		// The table has no such column: a country's code and name are properties of the country, not of
		// whoever is looking at it.
		expect(body).not.toContain('tenantId');
		expect(body).not.toContain('organizationId');
	});

	it('carries no withdrawal mark, because no delivered route writes one', () => {
		const body = typeBody('Country');

		// Withdrawing and restoring are not routes of this resource, so a `deletedAt` member would be
		// absent on every row this surface can answer.
		expect(body).not.toContain('deletedAt');
		expect(body).not.toContain('createdByUserId');
	});

	it('declares no write input, because the resource is read-only', () => {
		expect(printed).not.toMatch(/input CreateCountryInput/);
		expect(printed).not.toMatch(/input UpdateCountryInput/);
	});

	it('declares no root field the controller has no route for', () => {
		// No `GET /:id` and no `GET /count` on the controller, so neither a node field nor a count
		// field is declared: an argument that cannot be honoured is worse than no field at all.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['country', 'countryCount']));
		expect(printed).not.toMatch(/countryCount/);
		expect(printed).not.toMatch(/countriesByIsoCode|countryByIsoCode/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered read answers the master's live rows and takes no options at all, so the
		// connection offers `withDeleted` no more than the route does.
		expect(printed).toMatch(/countries\([^)]*withDeleted/);
	});
});

describe('CountryResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, countryService } = surfaces();

		const connection = await resolver.countries(undefined, undefined, undefined, 20);

		// The read is the route's own: no options, no relations and no narrowing it does not state.
		expect(countryService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(4);
		expect(connection.totalCount).toBe(4);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[3].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(DE);
	});

	it('orders by the ISO code when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.countries();

		// The delivered list declares no order of its own, so this is the connection's decision: the
		// code is the row's identity, and the identifier behind it is what makes the walk total.
		expect(connection.nodes.map((node) => node.isoCode)).toEqual(['DE', 'DK', 'JP', 'US']);
	});

	it('narrows by the code, by the name and by the flags the filter declares', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.countries({ isoCode: { eq: 'JP' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([JP]);

		// The name is a filter rather than a second root field, and it is the one a searcher reaches a
		// country by when they do not know the code.
		const byName = await resolver.countries({ country: { ilike: '%united%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([US]);

		const byCodes = await resolver.countries({ isoCode: { in: ['DE', 'DK'] } });
		expect(byCodes.nodes.map((node) => node.isoCode).sort()).toEqual(['DE', 'DK']);

		// The two lifecycle flags are columns of this row, and "what is still in use?" is the question
		// the master is opened to answer.
		const retired = await resolver.countries({ isActive: { eq: false } });
		expect(retired.nodes.map((node) => node.id)).toEqual([JP]);

		const archived = await resolver.countries({ isArchived: { eq: true } });
		expect(archived.nodes.map((node) => node.id)).toEqual([US]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		// The two keys are genuinely two: the code order and the name order disagree on this data.
		const byName = await resolver.countries(undefined, [{ field: 'country', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.isoCode)).toEqual(['DK', 'DE', 'JP', 'US']);

		const byCodeDescending = await resolver.countries(undefined, [{ field: 'isoCode', direction: 'DESC' }]);
		expect(byCodeDescending.nodes.map((node) => node.isoCode)).toEqual(['US', 'JP', 'DK', 'DE']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.countries(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.isoCode)).toEqual(['DE']);

		const second = await resolver.countries(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.isoCode)).toEqual(['DK']);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.countries(undefined, undefined, undefined, 20);

		const last = await resolver.countries(undefined, undefined, { last: 1, before: all.edges[1].cursor });

		expect(last.nodes.map((node) => node.isoCode)).toEqual(['DE']);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.countries(undefined, [{ field: 'isActive', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `name` is the spelling this surface deliberately does not carry: the row's member is
		// `country`, which is the column's own name and the one REST answers.
		const error = await resolver.countries({ name: { eq: 'Japan' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.countries(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('refuses a page larger than the protocol allows', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.countries(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1000)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CountryResolver — one resource, two protocols, the same read', () => {
	it('reads the master through the same service method the REST route calls', async () => {
		const { resolver, countryService } = surfaces();

		const connection = await resolver.countries();

		expect(connection.totalCount).toBe(ROWS.length);
		expect(countryService.findAll).toHaveBeenCalledTimes(1);
	});

	it('answers a master with no rows as an empty connection rather than as a refusal', async () => {
		const { resolver, countryService } = surfaces();
		countryService.findAll.mockResolvedValueOnce({ items: [], total: 0 });

		const connection = await resolver.countries();

		expect(connection.nodes).toEqual([]);
		expect(connection.edges).toEqual([]);
		expect(connection.totalCount).toBe(0);
		expect(connection.pageInfo.startCursor).toBeNull();
		expect(connection.pageInfo.endCursor).toBeNull();
	});

	it('does not turn a failed read into an empty master', async () => {
		const { resolver, countryService } = surfaces();
		const failure = new Error('COUNTRY_MASTER_UNREADABLE: the store refused the read.');

		countryService.findAll.mockRejectedValueOnce(failure);

		// An empty connection means "this platform knows no countries", which is never the answer to a
		// store that could not be read — so the failure reaches the caller.
		await expect(resolver.countries()).rejects.toBe(failure);
	});
});

describe('CountryResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and carries no gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', CountryResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', CountryController) ?? [];

		// The delivered route is public reference data: the controller declares no guard, so no guard
		// belongs here — a scope guard would refuse a caller REST serves, and the *gate* is refused for a
		// different reason: it is tenant-scoped, a `@Public()` handler runs without the tenant context it
		// reads, and a country is installation-wide data whose table has no tenancy column at all. The
		// exemption is recorded, with this reason, in the check that holds the rule for every other
		// resolver (`tools/scripts/graphql-feature-gate-check.mjs`).
		expect(controllerGuards).toEqual([]);
		expect(resolverGuards).toEqual([]);
	});

	it('states the controller’s own public marker, because the openness is the controller’s declaration', () => {
		// The route is open by declaration rather than by omission — the controller carries the
		// platform's marker for it — so the resolver states the same marker rather than leaving a
		// reader to infer the decision from a decorator that is not there.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, CountryController)).toBe(true);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, CountryResolver)).toBe(true);
	});

	it('states no permission on the class and none on the field, because the route states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CountryController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CountryResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CountryController)['findAll'])).toBeUndefined();
		expect(permissionOfField('countries')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s guard chain and permission', () => {
		const routes: Array<[string, string]> = [['countries', 'findAll']];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(CountryController, handler)])
		);

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handler is asserted to be there before the two readings are compared.
			expect(typeof handlersOf(CountryController)[handler]).toBe('function');
			expect(guardsOfRoute(CountryController, handler)).toEqual([]);
		}

		// Both readings are `undefined`, which is the answer here rather than an empty assertion: this
		// resource is mounted without a permission, so a field that acquired one would be the
		// asymmetry the two-protocol rule forbids.
		expect(stated).toEqual(expected);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (CountryResolver.prototype as never)[field],
		getClass: () => CountryResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CountryResolver — why this surface carries no feature gate', () => {
	it('declares no capability on the class, because the question has no answer for reference data', () => {
		// A country is installation-wide: the row carries no tenant and the table no tenancy column, so
		// there is no scope whose rows could give a different answer — and the gate reads the caller's
		// scope, which a public handler does not establish.
		expect(Reflect.getMetadata(FEATURE_METADATA, CountryResolver)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', CountryResolver) ?? []).not.toContain(FeatureFlagGuard);
	});

	it('is still refused by the gate when the gate is asked with the scope it reads — the behaviour the exemption exists for', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('countries')).catch((thrown) => thrown);

		// A `@Public()` handler runs without the tenant guard that establishes the context the gate reads,
		// so a gate installed here answered "disabled" for every caller — including the tenants that have
		// the capability switched on. That is the observation this case pins, and the reason the exemption
		// is recorded rather than the decorator being restored.
		//
		// The exemption removed the class-level `@FeatureFlag`, so a gate installed here would find no code to ask
		// about, and since c9a64fdc27 the guard refuses a target that names none without asking: nothing was named
		// that could be enabled. (It used to ask the catalogue about `undefined`, an answer that depended on how each
		// ORM treats an undefined criterion.) Both halves are stated — that the shared code is *not* what this surface
		// is gated by, and that the guard still refuses — because it is the refusal below, not the code, that states
		// what the exemption is for.
		expect(featureService.isFeatureEnabled).not.toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(featureService.isFeatureEnabled).not.toHaveBeenCalled();
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('is refused by an installed gate even where the capability would resolve on, because the surface names no code', async () => {
		const { guard, featureService } = gate(true);

		await expect(guard.canActivate(graphqlContext('countries'))).rejects.toBeInstanceOf(NotFoundException);
		expect(featureService.isFeatureEnabled).not.toHaveBeenCalled();
	});
});
