/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TimeOffBalanceController } from './time-off-balance.controller';
import { TimeOffBalanceModule } from './time-off-balance.module';
import { TimeOffBalanceResolver } from './time-off-balance.resolver';
import { TimeOffBalanceService } from './time-off-balance.service';

/**
 * Leave balances over GraphQL.
 *
 * The delivered REST routes serve two list reads of this resource — the ledger the organization may
 * see and the caller's own — and four operations over the arithmetic that ledger holds: an allocation,
 * a deduction, a reversal and a carry-forward. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, both reads are
 *   connections with the platform's own cursor codec behind them, and the four writes are the four
 *   operations the controller serves and no others;
 * - every field reaches the same `TimeOffBalanceService` method the REST route reaches, with the same
 *   arguments — including the two list fields, whose criterion is built from their own arguments
 *   because the delivered read takes the query DTO the route binds its query string to;
 * - **the caller's own balances are a root field of their own**, because the delivered `GET /me` read
 *   resolves the employee from the credential and the connection protocol has no member that can state
 *   that;
 * - **the carry-forward answer is a count rather than a row**, which is what the delivered write
 *   answers, and the schema says so;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**, read from the controller's own metadata rather than restated here;
 * - a balance is a computed figure — `accrued + carriedForward - taken - carriedOut` — and every
 *   quantity on it is a number of days carried as an exact decimal, never money and never a float.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000010';
const POLICY = '00000000-0000-4000-8000-000000000020';
const EARLIER = '00000000-0000-4000-8000-000000000030';
const LATER = '00000000-0000-4000-8000-000000000031';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them.
 *
 * They are stated oldest year first on purpose, so an order asserted below is an order the connection
 * applied rather than the order the fixture happened to be written in.
 */
const ROWS = [
	{
		id: EARLIER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		policyId: POLICY,
		year: 2025,
		accrued: 25,
		taken: 25,
		carriedForward: 0,
		carriedOut: 0,
		remaining: 0,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2025-01-05T10:00:00.000Z'),
		updatedAt: new Date('2025-01-05T10:00:00.000Z')
	},
	{
		id: LATER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		policyId: POLICY,
		year: 2026,
		accrued: 20,
		taken: 5,
		carriedForward: 3,
		carriedOut: 0,
		remaining: 18,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const timeOffBalanceService = {
		findAllByFilter: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findMine: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		allocate: jest.fn().mockResolvedValue(ROWS[1]),
		deduct: jest.fn().mockResolvedValue(ROWS[1]),
		reverse: jest.fn().mockResolvedValue(ROWS[1]),
		carryForward: jest.fn().mockResolvedValue({ carried: 2 })
	};

	return {
		timeOffBalanceService,
		resolver: new TimeOffBalanceResolver(timeOffBalanceService as never)
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The type one root field answers with, as the schema states it.
 *
 * Read from the built schema rather than matched as text, because the name of a field is not the name
 * of a *place*: a member of another type may carry the same word, so a text match would decide this
 * assertion from the wrong declaration.
 */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated by name rather than pattern-matched loosely, because the word is not this
 * domain's alone: another domain's surface may carry a field whose name contains the same characters,
 * and a prefix filter would then claim it here.
 */
const OWNED_QUERY_FIELDS = ['myTimeOffBalances', 'timeOffBalances'];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = [
	'allocateTimeOffBalance',
	'carryForwardTimeOffBalances',
	'deductTimeOffBalance',
	'reverseTimeOffBalance'
];

/** The root fields of this domain, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof TimeOffBalanceController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeOffBalanceController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeOffBalanceController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimeOffBalanceResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimeOffBalanceResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffBalanceResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimeOffBalanceResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimeOffBalanceResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TimeOffBalanceResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the organization ledger and the caller’s own balances', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['timeOffBalances', 'myTimeOffBalances'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'allocateTimeOffBalance',
				'deductTimeOffBalance',
				'reverseTimeOffBalance',
				'carryForwardTimeOffBalances'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// This controller does not extend the CRUD base, so there is no count route, no node route and
		// no lifecycle route for a field to mirror — and a field for one would be a capability REST does
		// not serve at all.
		for (const spelling of [
			'timeOffBalance',
			'timeOffBalanceCount',
			'deleteTimeOffBalance',
			'softDeleteTimeOffBalance',
			'recoverTimeOffBalance',
			'timeOffBalancesPagination'
		]) {
			expect(rootFields('Query')).not.toContain(spelling);
			expect(rootFields('Mutation')).not.toContain(spelling);
		}

		// Every field above names a handler that exists on the controller.
		for (const handler of ['findMine', 'findAll', 'allocate', 'deduct', 'reverse', 'carryForward']) {
			expect(typeof handlersOf(TimeOffBalanceController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TimeOffBalanceConnection \{\s*nodes: \[TimeOffBalance!\]!\s*edges: \[TimeOffBalanceEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimeOffBalanceEdge \{\s*node: TimeOffBalance!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimeOffBalanceFilter \{/);
		expect(printed).toMatch(/input TimeOffBalanceSort \{/);
		expect(printed).toMatch(
			/enum TimeOffBalanceSortField \{\s*year\s*accrued\s*taken\s*carriedForward\s*carriedOut\s*remaining\s*createdAt\s*updatedAt\s*\}/
		);
	});

	it('differently names the second read, because the credential is not a filter', () => {
		// `GET /me` resolves the employee from the credential, so there is no member of the connection
		// protocol that could state it — a filter narrows the rows a read returned, and this is another
		// read. The field therefore takes no employee, and the organization is still required because
		// the delivered query DTO requires it.
		expect(fieldArgs('Query', 'myTimeOffBalances')).toEqual([
			'organizationId',
			'policyId',
			'year',
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		expect(fieldArgs('Query', 'myTimeOffBalances')).not.toContain('employeeId');
	});

	it('states the narrowing the delivered read applies, in one order, on both lists', () => {
		expect(fieldArgs('Query', 'timeOffBalances')).toEqual([
			'organizationId',
			'employeeId',
			'policyId',
			'year',
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		expect(fieldArgs('Query', 'timeOffBalances').slice(0, 4)).toEqual([
			'organizationId',
			'employeeId',
			'policyId',
			'year'
		]);
	});

	it('answers the carry-forward with a count rather than a row', () => {
		// The delivered write walks every employee's balance for the policy and writes two rows per
		// employee, so there is no single balance it would be honest to answer instead. The one member
		// of the answer says so.
		expect(fieldType('Mutation', 'carryForwardTimeOffBalances')).toBe('TimeOffCarryForwardResult!');
		expect(typeBody('TimeOffCarryForwardResult')).toMatch(/carried: Int!/);
	});

	it('answers each write with the row the delivered write read back', () => {
		expect(fieldType('Mutation', 'allocateTimeOffBalance')).toBe('TimeOffBalance!');
		expect(fieldType('Mutation', 'deductTimeOffBalance')).toBe('TimeOffBalance!');
		expect(fieldType('Mutation', 'reverseTimeOffBalance')).toBe('TimeOffBalance!');
	});

	it('states the unit of every quantity, and states that none of them is money', () => {
		// A leave balance is a number of days. The entity stores each one as a `numeric(10,2)` column
		// behind a numeric transformer, which is why they are exact decimals: a binary fraction cannot
		// hold half a day, and a ledger that rounds is a ledger that disagrees with itself.
		expect(printed).toContain('**days**');

		const body = typeBody('TimeOffBalance');

		for (const member of ['accrued', 'taken', 'carriedForward', 'carriedOut', 'remaining']) {
			expect(body).toMatch(new RegExp(`\\b${member}: Decimal\\b`));
			expect(body).not.toMatch(new RegExp(`\\b${member}: Float\\b`));
		}

		// The year is a whole number and is not an amount at all.
		expect(body).toMatch(/\byear: Int\b/);
		// No member of this resource is a binary fraction, on the type or on any of its bodies: a day
		// count is an exact quantity, and `Float` is what an exact quantity is never carried as.
		expect(body).not.toMatch(/\bFloat\b/);
		for (const declaration of [
			'AllocateTimeOffBalanceInput',
			'AdjustTimeOffBalanceInput',
			'CarryForwardTimeOffBalanceInput'
		]) {
			expect(inputBody(declaration)).not.toMatch(/\bFloat\b/);
		}
	});

	it('carries the policy the delivered read fills and the employee identifier it does not', () => {
		const body = typeBody('TimeOffBalance');

		// The list read loads the policy beside every row; no read of this resource loads the employee,
		// so the identifier that always travels is what the type carries.
		expect(body).toMatch(/\bpolicy: TimeOffPolicy\b/);
		expect(body).toMatch(/\bpolicyId: ID!/);
		expect(body).toMatch(/\bemployeeId: ID!/);
		expect(body).not.toMatch(/\bemployee:/);
		expect(body).not.toMatch(/\btenant:/);
		expect(body).not.toMatch(/\bisDeleted:/);
	});

	it('declares a filter whose members are the columns the delivered read returns', () => {
		const body = inputBody('TimeOffBalanceFilter');

		expect(body).toMatch(/year: NumberFilter/);
		expect(body).toMatch(/remaining: DecimalFilter/);
		expect(body).toMatch(/employeeId: IDFilter/);
		expect(body).toMatch(/deletedAt: DateTimeFilter/);
		// The policy is not a member: the row carries a policy object there, and the protocol narrows by
		// comparing a value — `policyId` is how a caller asks for one policy's balances.
		expect(body).not.toMatch(/^\s*policy:/m);
	});

	it('declares the four write bodies, each with the members its own operation needs', () => {
		expect(printed).toMatch(/input AllocateTimeOffBalanceInput \{/);
		expect(printed).toMatch(/input AdjustTimeOffBalanceInput \{/);
		expect(printed).toMatch(/input CarryForwardTimeOffBalanceInput \{/);

		// One body serves the deduction and the reversal, because the two operations move the same
		// column by the same amount in the two directions and the delivered service states the same
		// split.
		expect(fieldType('Mutation', 'deductTimeOffBalance')).toBe('TimeOffBalance!');
		expect(printed).toMatch(
			/deductTimeOffBalance\(input: AdjustTimeOffBalanceInput!\): TimeOffBalance!\n/
		);
		expect(printed).toMatch(/reverseTimeOffBalance\(input: AdjustTimeOffBalanceInput!\): TimeOffBalance!\n/);

		// The three identifiers and the year are what the delivered writes address a row by, and the
		// organization is what they verify the employee and the policy against.
		for (const body of ['AllocateTimeOffBalanceInput', 'AdjustTimeOffBalanceInput']) {
			expect(inputBody(body)).toMatch(/organizationId: ID!/);
			expect(inputBody(body)).toMatch(/employeeId: ID!/);
			expect(inputBody(body)).toMatch(/policyId: ID!/);
			expect(inputBody(body)).toMatch(/year: Int!/);
		}

		expect(inputBody('AllocateTimeOffBalanceInput')).toMatch(/accrued: Decimal!/);
		expect(inputBody('AdjustTimeOffBalanceInput')).toMatch(/days: Decimal!/);
		expect(inputBody('CarryForwardTimeOffBalanceInput')).toMatch(/fromYear: Int!/);
		expect(inputBody('CarryForwardTimeOffBalanceInput')).toMatch(/toYear: Int!/);
		expect(inputBody('CarryForwardTimeOffBalanceInput')).toMatch(/maxCarryForwardDays: Decimal/);
		// The tenant is stamped from the credential on every write of this platform, so no body states
		// one.
		expect(inputBody('AllocateTimeOffBalanceInput')).not.toMatch(/tenantId/);
	});
});

describe('TimeOffBalanceResolver — the connection contract', () => {
	it('answers the ledger with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeOffBalanceService } = surfaces();

		const connection = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, and the criterion is the query DTO's own
		// narrowing members built from this field's arguments.
		expect(timeOffBalanceService.findAllByFilter).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			employeeId: undefined,
			policyId: undefined,
			year: undefined
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LATER);
	});

	it('orders by the year the delivered read orders by when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timeOffBalances(ORGANIZATION);

		expect(connection.nodes.map((node) => node.id)).toEqual([LATER, EARLIER]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byYear = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, { year: { eq: 2026 } });
		expect(byYear.nodes.map((node) => node.id)).toEqual([LATER]);

		const byRemaining = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, {
			remaining: { gt: '0' }
		});
		expect(byRemaining.nodes.map((node) => node.id)).toEqual([LATER]);

		const byEmployee = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, {
			employeeId: { in: [EMPLOYEE] }
		});
		expect(byEmployee.totalCount).toBe(2);

		// A relation is not filterable, because the protocol compares a value and the row carries an
		// object there — `policyId` is the member that asks for one policy's balances.
		const error = await resolver
			.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, { policy: { eq: POLICY } })
			.catch((thrown) => thrown);
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byRemaining = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, [
			{ field: 'remaining', direction: 'ASC' }
		]);
		expect(byRemaining.nodes.map((node) => node.id)).toEqual([EARLIER, LATER]);

		// The column is filterable and is deliberately not sortable: the enum states the keys a ledger is
		// read in an order for, and the refusal names what is on offer.
		const error = await resolver
			.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, [
				{ field: 'employeeId', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([LATER]);

		const second = await resolver.timeOffBalances(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ first: 1, after: first.pageInfo.endCursor ?? undefined }
		);

		expect(second.nodes.map((node) => node.id)).toEqual([EARLIER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, 20);
		const last = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([LATER]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering the whole ledger', async () => {
		const { resolver } = surfaces();

		const error = await resolver.timeOffBalances(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});

	it('answers the caller’s own balances through the delivered read of its own', async () => {
		const { resolver, timeOffBalanceService } = surfaces();

		const connection = await resolver.myTimeOffBalances(ORGANIZATION, POLICY, 2026);

		expect(timeOffBalanceService.findMine).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			policyId: POLICY,
			year: 2026
		});
		// The employee is the credential's, and the read that resolves it is the delivered one.
		expect(timeOffBalanceService.findMine.mock.calls[0][0]).not.toHaveProperty('employeeId');
		expect(connection.nodes.map((node) => node.id)).toEqual([LATER, EARLIER]);
	});
});

describe('TimeOffBalanceResolver — one concept, two protocols, the same operations', () => {
	it('sets the accrued days through the same service method the allocate route calls', async () => {
		const { resolver, timeOffBalanceService } = surfaces();

		await resolver.allocateTimeOffBalance({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			policyId: POLICY,
			year: 2026,
			accrued: 20
		});

		expect(timeOffBalanceService.allocate).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			policyId: POLICY,
			year: 2026,
			accrued: 20
		});
	});

	it('spends days through the same service method the deduct route calls', async () => {
		const { resolver, timeOffBalanceService } = surfaces();
		const body = { organizationId: ORGANIZATION, employeeId: EMPLOYEE, policyId: POLICY, year: 2026, days: 2.5 };

		await resolver.deductTimeOffBalance(body);

		expect(timeOffBalanceService.deduct).toHaveBeenCalledWith(body);
	});

	it('gives days back through the same service method the reverse route calls', async () => {
		const { resolver, timeOffBalanceService } = surfaces();
		const body = { organizationId: ORGANIZATION, employeeId: EMPLOYEE, policyId: POLICY, year: 2026, days: 2.5 };

		await resolver.reverseTimeOffBalance(body);

		expect(timeOffBalanceService.reverse).toHaveBeenCalledWith(body);
		// The reversal is the deduction's other direction and not a second implementation of it: both
		// fields hand the one body to the one service, and the service decides the direction.
		expect(timeOffBalanceService.deduct).not.toHaveBeenCalled();
	});

	it('rolls the year over through the same service method the carry-forward route calls', async () => {
		const { resolver, timeOffBalanceService } = surfaces();

		expect(
			await resolver.carryForwardTimeOffBalances({
				organizationId: ORGANIZATION,
				policyId: POLICY,
				fromYear: 2025,
				toYear: 2026
			})
		).toEqual({ carried: 2 });

		expect(timeOffBalanceService.carryForward).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			policyId: POLICY,
			fromYear: 2025,
			toYear: 2026,
			maxCarryForwardDays: undefined
		});
	});

	it('surfaces the delivered refusal of a caller that has no engagement of its own', async () => {
		const { resolver, timeOffBalanceService } = surfaces();
		const refusal = new ForbiddenException('Only an employee has a leave balance');

		timeOffBalanceService.findMine.mockRejectedValueOnce(refusal);

		// The refusal is the delivered read's own and is not restated in the resolver, so it travels
		// unchanged rather than being re-worded into a second answer to the same question.
		await expect(resolver.myTimeOffBalances(ORGANIZATION)).rejects.toBe(refusal);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, timeOffBalanceService } = surfaces();
		const refusal = new Error('INSUFFICIENT_BALANCE: this ledger has 2 days left.');

		timeOffBalanceService.deduct.mockRejectedValueOnce(refusal);

		await expect(
			resolver.deductTimeOffBalance({
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				policyId: POLICY,
				year: 2026,
				days: 5
			})
		).rejects.toBe(refusal);
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
	{ field: 'timeOffBalances', route: 'findAll' },
	{ field: 'myTimeOffBalances', route: 'findMine' },
	{ field: 'allocateTimeOffBalance', route: 'allocate' },
	{ field: 'deductTimeOffBalance', route: 'deduct' },
	{ field: 'reverseTimeOffBalance', route: 'reverse' },
	{ field: 'carryForwardTimeOffBalances', route: 'carryForward' }
];

describe('TimeOffBalanceResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimeOffBalanceController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimeOffBalanceResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffBalanceResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffBalanceController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(TimeOffBalanceController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimeOffBalanceController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimeOffBalanceController, route));
	});

	it('states on each field the permission its own route declares, and never a wider one', () => {
		expect(permissionOfField('timeOffBalances')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.TIME_OFF_VIEW
		]);
		expect(permissionOfField('myTimeOffBalances')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.TIME_OFF_VIEW
		]);
		for (const field of [
			'allocateTimeOffBalance',
			'deductTimeOffBalance',
			'reverseTimeOffBalance',
			'carryForwardTimeOffBalances'
		]) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_EDIT
			]);
		}
	});

	it('holds the four writes to the class-level edit permission their handlers restate', () => {
		// The four write handlers state the same edit permission the class carries, so the comparison
		// above is a real one rather than a field agreeing with a wider class by accident.
		for (const route of ['allocate', 'deduct', 'reverse', 'carryForward']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeOffBalanceController)[route])).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_EDIT
			]);
		}
	});
});

describe('TimeOffBalanceModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimeOffBalanceModule) ?? []) as unknown[];

		expect(providers).toContain(TimeOffBalanceResolver);
		expect(providers).toContain(TimeOffBalanceService);
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
		getHandler: () => (TimeOffBalanceResolver.prototype as never)[field],
		getClass: () => TimeOffBalanceResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimeOffBalanceResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimeOffBalanceResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimeOffBalanceResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeOffBalances')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeOffBalances');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timeOffBalances'))).resolves.toBe(true);
	});
});
