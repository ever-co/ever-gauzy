/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FeatureEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard } from '../shared/guards';
import { StatsModule } from './stats.module';
import { StatsController } from './stats.controller';
import { StatsResolver } from './stats.resolver';
import { StatsService } from './stats.service';
import { StatsGuard } from './stats.guard';
import { GlobalStats } from './stats.types';

/**
 * The platform statistics over GraphQL.
 *
 * The delivered controller serves one route — `GET /api/stats/global`, which answers a document of
 * aggregates computed from the records the other domains own. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - the computed answer is a root field of the one composed schema, and it is a field of its own rather
 *   than a connection over a resource that has no rows: it takes no argument because there is nothing
 *   to narrow, order or page;
 * - the field reaches the same `StatsService.getGlobalStats` the route reaches, and answers the document
 *   that call built — amounts included, unrescaled and unrounded;
 * - **the document is typed member by member rather than carried as free-form JSON**, and the two money
 *   aggregates are exact decimals while the tracked-time duration is the one float;
 * - **the guard chain and the permission are the controller's**: the route is public, declares no
 *   permission and carries `StatsGuard`, and the field mirrors all three;
 * - **the field is gated by the capability the route is gated by**, `FEATURE_OPEN_STATS`, while the
 *   class still states the endpoint's own `FEATURE_GRAPHQL` code for the resolver as a whole.
 */

/** The code the commerce catalogue declares for the endpoint, as the class carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The code the delivered route is gated by, as its own metadata carries it. */
const FEATURE_OPEN_STATS = 'FEATURE_OPEN_STATS';

/**
 * The document the delivered service answers, as the platform's own aggregations produce it: the two
 * amounts as the numbers their sums were parsed into, and the duration as a fraction of an hour.
 */
const DOCUMENT: GlobalStats = {
	tenants: 12,
	employees: 340,
	tasks: 1877,
	teams: 45,
	organizations: 9,
	users: { count: 289, lastMonthActiveUsers: 71 },
	invoices: { count: 1284, amount: 987654.32 },
	payments: { count: 1103, amount: 654321.09 },
	hours: 12500.5
};

/** The resolver, over a scripted service. */
function surfaces() {
	const statsService = { getGlobalStats: jest.fn().mockResolvedValue(DOCUMENT) };

	return {
		statsService,
		resolver: new StatsResolver(statsService as never)
	};
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The concept is the plural — what this surface answers is a set of aggregates rather than one status
 * — so the filter is `stats` and not `stat`, which would also catch every domain's own `…Status`
 * field.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('stats'))
		.sort();
}

/** The printed body of one declaration, so a member it must not carry can be asserted absent. */
function declaredBody(kind: 'type' | 'input', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The member names one declaration carries, read off its printed body rather than off a description:
 * a doc comment is part of the printed type, so a member is asserted absent by its name and never by
 * the words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...declaredBody('type', name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one class, as functions, inherited ones included — the controller's and the resolver's alike. */
function handlersOf(owner: object): Record<string, object> {
	return (owner as { prototype: Record<string, object> }).prototype;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: object, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: object, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	return Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(StatsResolver)[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(StatsResolver)[field]) ?? [];
}

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
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
		getHandler: () => (StatsResolver.prototype as never)[field],
		getClass: () => StatsResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('StatsResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the computed statistics field', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['globalStats']));
	});

	it('declares one read field and no mutation, because the controller serves one read route', () => {
		// The resource has no table, no identifier and no lifecycle of its own, so the controller has no
		// write route and this surface states no mutation. The plural is the filter: `stat` would also
		// catch every domain's own `…Status` field.
		expect(ownedRootFields('Query')).toEqual(['globalStats']);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares the document member by member, in the order the delivered one states them', () => {
		// The document is typed rather than carried as free-form JSON: every member is built by name by
		// the delivered method, so a `JSON` member would record nothing and could drift unnoticed.
		expect(memberNames('GlobalStats')).toEqual([
			'tenants',
			'employees',
			'tasks',
			'teams',
			'organizations',
			'users',
			'invoices',
			'payments',
			'hours'
		]);
		expect(printed).toMatch(/globalStats: GlobalStats!/);
	});

	it('declares the three nested aggregates the document is built from', () => {
		expect(printed).toMatch(/type GlobalStats \{[\s\S]*?users: UserStats!/);
		expect(printed).toMatch(/type GlobalStats \{[\s\S]*?invoices: InvoiceStats!/);
		expect(printed).toMatch(/type GlobalStats \{[\s\S]*?payments: PaymentStats!/);
		expect(memberNames('UserStats')).toEqual(['count', 'lastMonthActiveUsers']);
		expect(memberNames('InvoiceStats')).toEqual(['count', 'amount']);
		expect(memberNames('PaymentStats')).toEqual(['count', 'amount']);
	});

	it('carries the two money aggregates as exact decimals and the duration as a float', () => {
		// An aggregate of money is money: a sum of a `numeric` column is an exact decimal, and a filter
		// or a client computation over it must not round.
		expect(declaredBody('type', 'InvoiceStats')).toMatch(/amount: Decimal!/);
		expect(declaredBody('type', 'PaymentStats')).toMatch(/amount: Decimal!/);
		for (const name of ['InvoiceStats', 'PaymentStats']) {
			expect(declaredBody('type', name)).not.toMatch(/amount: Float/);
		}
		// The tracked time is a duration rather than an amount, the delivered method divides seconds by
		// 3600, and a duration genuinely has a fractional part that rounding would lose.
		expect(declaredBody('type', 'GlobalStats')).toMatch(/hours: Float!/);
		// A count is a whole number of rows the store answered with.
		expect(declaredBody('type', 'GlobalStats')).toMatch(/tenants: Int!/);
		expect(declaredBody('type', 'UserStats')).toMatch(/lastMonthActiveUsers: Int!/);
	});

	it('declares no argument, because a document of totals has nothing to narrow or page', () => {
		expect(fieldArgs('Query', 'globalStats')).toEqual([]);
		expect(printed).not.toMatch(/globalStats\(/);
	});

	it('declares no node field and no count field, because the resource has no rows to address', () => {
		// There is no identifier to read one document by and no route that counts documents: the totals
		// are the members of the one document.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['stats', 'globalStatsCount']));
		expect(printed).not.toMatch(/globalStatsCount/);
	});

	it('gives the document no identifier and no timestamps', () => {
		// Nothing is stored, so a member every member of the surface would have to invent is not declared.
		for (const name of ['GlobalStats', 'UserStats', 'InvoiceStats', 'PaymentStats']) {
			expect(memberNames(name)).not.toContain('id');
			expect(memberNames(name)).not.toContain('createdAt');
			expect(memberNames(name)).not.toContain('updatedAt');
		}
	});
});

describe('StatsResolver — the computed answer is the route’s own', () => {
	it('reads the document through the same service method the route calls', async () => {
		const { resolver, statsService } = surfaces();

		const answer = await resolver.globalStats();

		expect(statsService.getGlobalStats).toHaveBeenCalledWith();
		expect(answer).toBe(DOCUMENT);
	});

	it('answers the members the service answered, unchanged', async () => {
		const { resolver } = surfaces();

		const answer = await resolver.globalStats();

		// Nothing on this surface rescales, rounds or reformats an aggregate: the sums travel as the
		// platform's own aggregations produced them, which is what makes a client's arithmetic and the
		// platform's agree.
		expect(answer.invoices.amount).toBe(987654.32);
		expect(answer.payments.amount).toBe(654321.09);
		expect(answer.hours).toBe(12500.5);
		expect(answer.users).toEqual({ count: 289, lastMonthActiveUsers: 71 });
	});
});

describe('StatsResolver — the guard stack and the permission are the controller’s', () => {
	it('mirrors the public marker the controller carries', () => {
		// The route asks for no credential — the aggregate is the installation's own total, published by
		// an operator who asked for it — and the field states the same marker rather than leaving it off,
		// so the openness is readable as this resource's decision.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, StatsController)).toBe(true);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, StatsResolver)).toBe(true);
	});

	it('states no permission and no authorization guard, because the controller states neither', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StatsController)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', StatsController) ?? []).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StatsResolver)).toBeUndefined();
		expect(permissionOfField('globalStats')).toBeUndefined();
		expect(permissionOfRoute(StatsController, 'getGlobalStats')).toBeUndefined();
		// The one guard the resolver carries on the class is the endpoint's capability, and it is an
		// addition rather than a substitution: there was nothing of the controller's own to replace.
		expect(Reflect.getMetadata('__guards__', StatsResolver)).toEqual([FeatureFlagGuard]);
	});

	it('carries on the field the guard the route’s own handler carries', () => {
		// The delivered route runs under `StatsGuard`; the field mirrors it, and the two guards it then
		// runs under read the same capability code, so they agree.
		expect(guardsOfHandler(StatsController, 'getGlobalStats')).toEqual([StatsGuard]);
		expect(guardsOfField('globalStats')).toEqual(guardsOfHandler(StatsController, 'getGlobalStats'));
	});
});

describe('StatsResolver — a capability that is switched off is not served', () => {
	it('declares the endpoint capability on the class, as every resolver of this platform does', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, StatsResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', StatsResolver)).toContain(FeatureFlagGuard);
	});

	it('gates the field by the capability its own route is gated by', () => {
		// A field may not be wider than the route it mirrors: the delivered route is gated by
		// `FEATURE_OPEN_STATS`, so the field states that code, and the guard reads a field's own
		// statement before the class's. The code is the catalogue's own enum member rather than a literal.
		expect(Reflect.getMetadata(FEATURE_METADATA, handlersOf(StatsResolver)['globalStats'])).toBe(
			FeatureEnum.FEATURE_OPEN_STATS
		);
	});

	it('refuses the field when the capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('globalStats')).catch((thrown) => thrown);

		// The code the guard resolved is the route's own, which is what the field declared — not a second
		// copy of it and not the endpoint's code, which the class states for the resolver as a whole.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FeatureEnum.FEATURE_OPEN_STATS);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('globalStats');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('globalStats'))).resolves.toBe(true);
	});
});

describe('StatsModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, StatsModule) ?? []) as unknown[];

		expect(providers).toContain(StatsResolver);
		expect(providers).toContain(StatsService);
	});

	it('exports the service the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, StatsModule) ?? []) as unknown[];

		expect(exported).toContain(StatsService);
	});
});
