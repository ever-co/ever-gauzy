/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { EmployeeStatisticsModule } from './employee-statistics.module';
import { EmployeeStatisticsResolver } from './employee-statistics.resolver';
import { EmployeeStatisticsService } from './employee-statistics.service';
import {
	AggregatedEmployeeStatisticQuery,
	EmployeeStatisticsHistoryQuery,
	MonthAggregatedEmployeeStatisticsQuery
} from './queries';

/**
 * The employee statistics over GraphQL.
 *
 * The delivered REST routes serve four computed answers and no resource: one organization's aggregate
 * over a range, one employee's twelve-month series, one employee's month-by-month rows, and the
 * individual income and expense lines behind them. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those four answers is a root field of the one composed schema, and none of them is a
 *   connection, a node or a write — because a statistic is derived on the request and has no
 *   identifier, nothing to withdraw and nothing for a client to state;
 * - every field reaches the same service method, or dispatches the same query, that the REST route
 *   reaches, and answers the same calculation;
 * - **the guard chain is the controller's and no field states a permission, because the controller
 *   states none**: a resolver that demanded one would refuse a caller the REST route serves;
 * - **the two projections are the only reshaping**, and each is asserted: an aggregate row's nested
 *   account becomes the identifier the account is read by, and a history line's client row does too;
 * - money is an exact decimal throughout, and never a float.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000063';
const CLIENT = '00000000-0000-4000-8000-000000000064';
const START = new Date('2026-03-01T00:00:00.000Z');
const END = new Date('2026-03-31T23:59:59.000Z');

/** The aggregate the scripted query bus answers with. */
const AGGREGATE = {
	total: { income: 12000.5, expense: 4000.25, bonus: 800, profit: 8000.25 },
	employees: [
		{
			income: 12000.5,
			expense: 4000.25,
			bonus: 800,
			profit: 8000.25,
			employee: { id: EMPLOYEE, user: { id: TENANT, firstName: 'Ada' } }
		}
	],
	chart: [{ dates: 'March 1, 2026', statistics: { income: 400, expense: 100, bonus: 0, profit: 300 } }]
};

/** The history the scripted query bus answers with: one income line and one split expense line. */
const HISTORY = [
	{
		valueDate: START,
		amount: 400,
		notes: 'Retainer',
		isBonus: false,
		client: { id: CLIENT, name: 'Example Co' }
	},
	{
		valueDate: END,
		amount: 50,
		categoryName: 'Software',
		isRecurring: true,
		isSalary: false,
		source: 'org',
		splitExpense: { originalValue: 200, employeeCount: 4 }
	}
];

/** The resolver, over a scripted service and a scripted query bus. */
function surfaces() {
	const employeeStatisticsService = {
		getStatisticsByEmployeeId: jest.fn().mockResolvedValue({
			expenseStatistics: [0, 100],
			incomeStatistics: [0, 400],
			profitStatistics: [0, 300],
			bonusStatistics: [0, 0]
		})
	};
	const queryBus = {
		execute: jest.fn(async (query: any) => {
			if (query instanceof AggregatedEmployeeStatisticQuery) return AGGREGATE;
			if (query instanceof EmployeeStatisticsHistoryQuery) return HISTORY;
			if (query instanceof MonthAggregatedEmployeeStatisticsQuery) {
				return [{ month: 2, year: 2026, income: 400, expense: 100, expenseWithoutSalary: 100, profit: 300, bonus: 0, directIncomeBonus: 0 }];
			}
			return undefined;
		})
	};

	return {
		employeeStatisticsService,
		queryBus,
		resolver: new EmployeeStatisticsResolver(employeeStatisticsService as never, queryBus as never)
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

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated rather than pattern-matched loosely: nothing else in this schema spells a
 * statistic, and the two names that come closest — `employeeStatisticsAggregate` and
 * `employeeStatisticsSeries` — are both this domain's. What the filter is for is the assertion beside
 * it: a field that stopped being declared would drop out of the list and fail the comparison.
 */
const OWNED_QUERY_FIELDS = [
	'employeeMonthlyStatistics',
	'employeeStatisticsAggregate',
	'employeeStatisticsHistory',
	'employeeStatisticsSeries'
];

/** The root fields of this domain, as they are actually declared. */
function ownedRootFields(): string[] {
	return rootFields('Query')
		.filter((field) => /^(employeeStatistics|employeeMonthlyStatistic)/.test(field))
		.sort();
}

/**
 * One root field's arguments and their types, as the schema states them.
 *
 * Read from the built schema rather than matched as text, so an argument's description — which the
 * domain documents — does not decide whether the assertion holds.
 */
function argTypesOf(field: string): Record<string, string> {
	const root = schema.getType('Query') as
		| { getFields(): Record<string, { args: readonly { name: string; type: { toString(): string } }[] }> }
		| undefined;

	return Object.fromEntries(
		(root?.getFields()?.[field]?.args ?? []).map((argument) => [argument.name, argument.type.toString()])
	);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmployeeStatisticsController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeStatisticsController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeStatisticsController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeStatisticsResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeStatisticsResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeStatisticsResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeStatisticsResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeStatisticsResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeStatisticsResolver — the SDL declares the answers the REST routes serve', () => {
	it('declares one root field per delivered read, and no more', () => {
		expect(ownedRootFields()).toEqual([...OWNED_QUERY_FIELDS].sort());
	});

	it('declares no mutation, because the controller serves no write', () => {
		// The reverse of the gap this delivery exists to close: a mutation here would be a capability
		// REST does not have. The controller serves four `GET` routes and nothing else.
		for (const field of OWNED_QUERY_FIELDS) {
			expect(rootFields('Mutation')).not.toContain(field);
		}

		for (const handler of [
			'findAggregatedByOrganizationId',
			'findAllByEmployeeId',
			'findAggregatedStatisticsByEmployeeId',
			'findEmployeeStatisticsHistory'
		]) {
			expect(typeof handlersOf(EmployeeStatisticsController)[handler]).toBe('function');
		}
	});

	it('declares no connection, no node and no count, because the controller serves none', () => {
		// A statistic is derived on the request: it has no identifier to read one of, no row to page
		// through and no total of its own that is not already a member of the answer.
		for (const spelling of [
			'employeeStatistics',
			'employeeStatistic',
			'employeeStatisticsCount',
			'employeeStatisticsConnection'
		]) {
			expect(rootFields('Query')).not.toContain(spelling);
		}
	});

	it('declares the four computed object types, with money as an exact decimal throughout', () => {
		expect(printed).toMatch(/type EmployeeStatisticsAggregate \{/);
		expect(printed).toMatch(/type EmployeeStatisticTotals \{/);
		expect(printed).toMatch(/type EmployeeStatisticByEmployee \{/);
		expect(printed).toMatch(/type EmployeeStatisticChartPoint \{/);
		expect(printed).toMatch(/type EmployeeStatisticsSeries \{/);
		expect(printed).toMatch(/type EmployeeMonthlyStatistic \{/);
		expect(printed).toMatch(/type EmployeeStatisticsHistoryEntry \{/);
		expect(printed).toMatch(/type EmployeeStatisticsSplitExpense \{/);

		// Every amount is an exact decimal, and no member of any of these types is a float: a total that
		// is off by a hundredth is a total a finance operator has to reconcile by hand.
		for (const body of [
			typeBody('EmployeeStatisticTotals'),
			typeBody('EmployeeStatisticByEmployee'),
			typeBody('EmployeeMonthlyStatistic'),
			typeBody('EmployeeStatisticsSeries'),
			typeBody('EmployeeStatisticsHistoryEntry'),
			typeBody('EmployeeStatisticsSplitExpense')
		]) {
			expect(body).not.toMatch(/:\s*Float\b/);
		}

		expect(typeBody('EmployeeStatisticTotals')).toMatch(/income: Decimal!/);
		expect(typeBody('EmployeeStatisticsSeries')).toMatch(/expenseStatistics: \[Decimal!\]!/);
		// A count is a whole number, and a calendar position is an `Int` rather than a quantity.
		expect(typeBody('EmployeeStatisticsSplitExpense')).toMatch(/employeeCount: Int!/);
		expect(typeBody('EmployeeMonthlyStatistic')).toMatch(/month: Int!/);
		expect(typeBody('EmployeeMonthlyStatistic')).toMatch(/year: Int!/);
	});

	it('carries no account object and no client object, only the identifiers they are read by', () => {
		// An aggregate row's delivered answer nests the account, but the read behind it selects four
		// columns of that account; a `User` member here would be a partially filled account.
		expect(typeBody('EmployeeStatisticByEmployee')).toMatch(/employeeId: ID!/);
		expect(typeBody('EmployeeStatisticByEmployee')).not.toMatch(/\bemployee:/);
		expect(typeBody('EmployeeStatisticByEmployee')).not.toMatch(/\buser:/);

		expect(typeBody('EmployeeStatisticsHistoryEntry')).toMatch(/clientId: ID/);
		expect(typeBody('EmployeeStatisticsHistoryEntry')).not.toMatch(/\bclient:/);
	});

	it('states on each field the arguments its own route binds, and no other', () => {
		const root = schema.getType('Query') as
			| { getFields(): Record<string, { args: readonly { name: string }[] }> }
			| undefined;
		const argsOf = (field: string): string[] =>
			(root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);

		expect(argsOf('employeeStatisticsAggregate')).toEqual(['organizationId', 'startDate', 'endDate']);
		expect(argsOf('employeeStatisticsSeries')).toEqual(['employeeId', 'valueDate']);
		expect(argsOf('employeeMonthlyStatistics')).toEqual([
			'employeeId',
			'startDate',
			'endDate',
			'organizationId'
		]);
		expect(argsOf('employeeStatisticsHistory')).toEqual([
			'employeeId',
			'type',
			'startDate',
			'endDate',
			'organizationId'
		]);

		// The organization is required exactly where the delivered read cannot answer without it: the
		// aggregate resolves its roster through it, and the other two only narrow by it. The range's two
		// ends are optional everywhere, because the delivered handlers default them.
		expect(argTypesOf('employeeStatisticsAggregate')).toEqual({
			organizationId: 'ID!',
			startDate: 'DateTime',
			endDate: 'DateTime'
		});
		expect(argTypesOf('employeeMonthlyStatistics')).toEqual({
			employeeId: 'ID!',
			startDate: 'DateTime',
			endDate: 'DateTime',
			organizationId: 'ID'
		});
		expect(argTypesOf('employeeStatisticsHistory')).toEqual({
			employeeId: 'ID!',
			type: 'String!',
			startDate: 'DateTime',
			endDate: 'DateTime',
			organizationId: 'ID'
		});
	});
});

describe('EmployeeStatisticsResolver — one concept, two protocols, the same operations', () => {
	it('answers the aggregate through the query the delivered route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		const answer = await resolver.employeeStatisticsAggregate(ORGANIZATION, START, END);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(AggregatedEmployeeStatisticQuery);
		expect(query.input).toEqual({ organizationId: ORGANIZATION, startDate: START, endDate: END });

		// The total and the chart are the delivered calculation's own.
		expect(answer.total).toEqual(AGGREGATE.total);
		expect(answer.chart).toEqual(AGGREGATE.chart);

		// The one projection: the nested account becomes the identifier the account is read by.
		expect(answer.employees).toEqual([
			{
				employeeId: EMPLOYEE,
				income: AGGREGATE.employees[0].income,
				expense: AGGREGATE.employees[0].expense,
				bonus: AGGREGATE.employees[0].bonus,
				profit: AGGREGATE.employees[0].profit
			}
		]);
		expect(JSON.stringify(answer.employees)).not.toContain('firstName');
	});

	it('answers the twelve-month series through the same service method the route calls', async () => {
		const { resolver, employeeStatisticsService } = surfaces();

		const series = await resolver.employeeStatisticsSeries(EMPLOYEE, START);

		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE, {
			valueDate: START
		});
		expect(series.incomeStatistics).toEqual([0, 400]);
	});

	it('states no options at all when the caller states no date, rather than an empty object', async () => {
		const { resolver, employeeStatisticsService } = surfaces();

		await resolver.employeeStatisticsSeries(EMPLOYEE);

		// The delivered method calls `toString()` on the date before it reads anything, so an empty
		// options object is a `TypeError` rather than "no date" — and what the route sends when its
		// `data` parameter carries none is nothing at all.
		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE, undefined);
	});

	it('answers the monthly rows through the query the delivered route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		const rows = await resolver.employeeMonthlyStatistics(EMPLOYEE, START, END, ORGANIZATION);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(MonthAggregatedEmployeeStatisticsQuery);
		expect(query.input).toEqual({
			employeeId: EMPLOYEE,
			startDate: START,
			endDate: END,
			organizationId: ORGANIZATION
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].month).toBe(2);
	});

	it('answers the history through the query the delivered route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		const lines = await resolver.employeeStatisticsHistory(EMPLOYEE, 'INCOME', START, END, ORGANIZATION);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(EmployeeStatisticsHistoryQuery);
		expect(query.input).toEqual({
			employeeId: EMPLOYEE,
			type: 'INCOME',
			startDate: START,
			endDate: END,
			organizationId: ORGANIZATION
		});
		expect(lines).toHaveLength(2);
	});

	it('reshapes a history line’s client row into the identifier it is read by', async () => {
		const { resolver } = surfaces();

		const [income, expense] = await resolver.employeeStatisticsHistory(EMPLOYEE, 'EXPENSES');

		// The client is present on an income line and absent on an expense line, which is what the
		// delivered answer says and what the nullable member states.
		expect(income.clientId).toBe(CLIENT);
		expect(expense.clientId).toBeUndefined();
		expect(JSON.stringify(income)).not.toContain('Example Co');

		// Everything else the delivered line carries travels unchanged, split expense included.
		expect(expense.splitExpense).toEqual({ originalValue: 200, employeeCount: 4 });
		expect(expense.source).toBe('org');
	});

	it('answers an empty list for a source the delivered handler does not recognise', async () => {
		const { resolver, queryBus } = surfaces();
		queryBus.execute.mockResolvedValueOnce([]);

		expect(await resolver.employeeStatisticsHistory(EMPLOYEE, 'NOT_A_SOURCE')).toEqual([]);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeStatisticsAggregate', route: 'findAggregatedByOrganizationId' },
	{ field: 'employeeStatisticsSeries', route: 'findAllByEmployeeId' },
	{ field: 'employeeMonthlyStatistics', route: 'findAggregatedStatisticsByEmployeeId' },
	{ field: 'employeeStatisticsHistory', route: 'findEmployeeStatisticsHistory' }
];

describe('EmployeeStatisticsResolver — the guard stack is the route’s and the permission is its absence', () => {
	it('states the tenant guard on the class and no permission anywhere, as the controller does', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeStatisticsController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeStatisticsResolver) ?? [];

		// The delivered controller scopes these reads to the caller's tenant and states no permission on
		// the class or on any handler: the tenant is the scope, and the four reads are facts about rows
		// the caller's own tenant already holds.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeStatisticsController)).toBeUndefined();
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeStatisticsResolver)).toBeUndefined();
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(EmployeeStatisticsController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(EmployeeStatisticsController, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeStatisticsController, route));
	});

	it('states no permission on any field, because no route states one', () => {
		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', fieldsOf(EmployeeStatisticsResolver)[field])).toBeUndefined();
		}
	});
});

describe('EmployeeStatisticsModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeStatisticsModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeStatisticsResolver);
		expect(providers).toContain(EmployeeStatisticsService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is
		// the service and the query bus its three dispatches resolve through.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeStatisticsModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeStatisticsService);
		expect(exported.map((entry) => (entry as { name?: string })?.name)).toEqual(
			expect.arrayContaining(['CqrsModule'])
		);
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
		getHandler: () => (EmployeeStatisticsResolver.prototype as never)[field],
		getClass: () => EmployeeStatisticsResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeStatisticsResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeStatisticsResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeStatisticsResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('employeeStatisticsAggregate'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeStatisticsAggregate');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeStatisticsAggregate'))).resolves.toBe(true);
	});
});
