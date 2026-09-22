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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TimeOffPolicyController } from './time-off-policy.controller';
import { TimeOffPolicyModule } from './time-off-policy.module';
import { TimeOffPolicyResolver } from './time-off-policy.resolver';
import { TimeOffPolicyService } from './time-off-policy.service';

/**
 * Time off policies over GraphQL.
 *
 * The delivered REST routes serve a policy list twice — `GET /` and the `GET pagination` the
 * controller overrides — one policy, a count the controller inherits, a filing, an edit, and the three
 * lifecycle moves it also inherits. This suite pins the half of the two-protocol doctrine that is easy
 * to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, the list is a
 *   connection with the platform's own cursor codec behind it, and the second spelling of the list is
 *   **not** a second root field;
 * - every field reaches the same `TimeOffPolicyService` method the REST route reaches, with the same
 *   arguments — including the two list routes, whose `data` query parameter this surface has no query
 *   string to bind;
 * - **the guard chain and the permission are the controller’s, read from its own metadata** — including
 *   the four routes that restate `PermissionGuard` over a class that already carries it, and the five
 *   the controller inherits with no permission of their own, which therefore run under the class-level
 *   edit permission;
 * - the count takes no argument and is nullable, because a count is an aggregate a resource may have no
 *   answer for;
 * - every entitlement figure is a number of days carried as an exact decimal, and neither relation the
 *   entity declares is a member, because the read this surface mirrors loads neither.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000010';
const ANNUAL = '00000000-0000-4000-8000-000000000040';
const SICK = '00000000-0000-4000-8000-000000000041';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them.
 *
 * They are stated oldest first on purpose, so an order asserted below is an order the connection
 * applied rather than the order the fixture happened to be written in.
 */
const ROWS = [
	{
		id: ANNUAL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Annual leave',
		requiresApproval: true,
		paid: true,
		leaveType: 'ANNUAL',
		maxDaysPerYear: 25,
		allowCarryForward: true,
		maxCarryForwardDays: 5,
		accrualRate: 2.08,
		accrualFrequency: 'MONTHLY',
		isDefault: true,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: SICK,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Sick leave',
		requiresApproval: false,
		paid: true,
		leaveType: 'SICK',
		maxDaysPerYear: 10,
		allowCarryForward: false,
		maxCarryForwardDays: 0,
		accrualRate: 10,
		accrualFrequency: 'ANNUALLY',
		isDefault: false,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const timeOffPolicyService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		timeOffPolicyService,
		resolver: new TimeOffPolicyResolver(timeOffPolicyService as never)
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
 * domain's alone: `timeOffPolicy` is also a member of `TimeOffBalance`, and a prefix filter over the
 * root fields would be one character away from claiming a sibling resource's vocabulary.
 */
const OWNED_QUERY_FIELDS = ['timeOffPolicies', 'timeOffPolicy', 'timeOffPolicyCount'];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = [
	'createTimeOffPolicy',
	'deleteTimeOffPolicy',
	'recoverTimeOffPolicy',
	'softDeleteTimeOffPolicy',
	'updateTimeOffPolicy'
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
function handlersOf(controller: typeof TimeOffPolicyController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeOffPolicyController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeOffPolicyController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimeOffPolicyResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimeOffPolicyResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffPolicyResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimeOffPolicyResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimeOffPolicyResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TimeOffPolicyResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection read, the one-row read and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['timeOffPolicies', 'timeOffPolicy', 'timeOffPolicyCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTimeOffPolicy',
				'updateTimeOffPolicy',
				'deleteTimeOffPolicy',
				'softDeleteTimeOffPolicy',
				'recoverTimeOffPolicy'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// The controller serves its list twice — `GET /` and `GET pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		for (const spelling of ['timeOffPoliciesPagination', 'timeOffPoliciesConnection', 'timeOffPolicyById']) {
			expect(rootFields('Query')).not.toContain(spelling);
		}

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'pagination',
			'findAll',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(TimeOffPolicyController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TimeOffPolicyConnection \{\s*nodes: \[TimeOffPolicy!\]!\s*edges: \[TimeOffPolicyEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimeOffPolicyEdge \{\s*node: TimeOffPolicy!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimeOffPolicyFilter \{/);
		expect(printed).toMatch(/input TimeOffPolicySort \{/);
		expect(printed).toMatch(
			/enum TimeOffPolicySortField \{\s*createdAt\s*updatedAt\s*name\s*leaveType\s*maxDaysPerYear\s*allowCarryForward\s*isDefault\s*requiresApproval\s*paid\s*\}/
		);
	});

	it('answers the count through a nullable field that takes no argument', () => {
		// The inherited `GET count` answers a bare number, which is not a connection and is not the
		// connection's `totalCount`: that total is the count of the rows the connection narrowed to,
		// while the count route counts the caller's own rows. Nullable, because an aggregate the resource
		// has no answer for must not be answered as a fabricated zero; and argument-less, because the
		// route passes its query string through as the store's own `where`, which the connection protocol
		// does not speak.
		expect(fieldType('Query', 'timeOffPolicyCount')).toBe('Int');
		expect(fieldType('Query', 'timeOffPolicyCount')).not.toBe('Int!');
		expect(fieldArgs('Query', 'timeOffPolicyCount')).toEqual([]);
	});

	it('states every connection field’s arguments in one order', () => {
		expect(fieldArgs('Query', 'timeOffPolicies')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
			'withDeleted',
		]);
	});

	it('states the unit of every quantity, and states that none of them is money', () => {
		// An entitlement under a policy is a number of days, or days per accrual period. The entity stores
		// each as a `numeric(10,2)` column behind a numeric transformer, which is why they are exact
		// decimals rather than binary fractions.
		expect(printed).toContain('**days**');

		const body = typeBody('TimeOffPolicy');

		for (const member of ['maxDaysPerYear', 'maxCarryForwardDays', 'accrualRate']) {
			expect(body).toMatch(new RegExp(`\\b${member}: Decimal\\b`));
			expect(body).not.toMatch(new RegExp(`\\b${member}: Float\\b`));
		}

		for (const declaration of ['CreateTimeOffPolicyInput', 'UpdateTimeOffPolicyInput']) {
			expect(inputBody(declaration)).not.toMatch(/\bFloat\b/);
		}
		// No member of this resource is a binary fraction: an entitlement is an exact quantity, and
		// `Float` is what an exact quantity is never carried as.
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('carries neither relation, because the read this surface mirrors loads neither', () => {
		const body = typeBody('TimeOffPolicy');

		// `employees` and `timeOffRequests` are loaded only when a REST caller names them in `relations`,
		// and the list read here names none — so a member for either would be absent from every row this
		// surface answers. The membership is written through the two bodies below rather than read here.
		expect(body).not.toMatch(/^\s*employees:/m);
		expect(body).not.toMatch(/^\s*timeOffRequests:/m);
		expect(body).not.toMatch(/^\s*tenant:/m);

		// The two vocabularies are carried as their values rather than redeclared as schema enums.
		expect(body).toMatch(/\bleaveType: String\b/);
		expect(body).toMatch(/\baccrualFrequency: String\b/);
		expect(printed).not.toMatch(/enum LeaveTypeEnum/);
	});

	it('declares the two write bodies, and states the membership on both', () => {
		expect(printed).toMatch(/input CreateTimeOffPolicyInput \{/);
		expect(printed).toMatch(/input UpdateTimeOffPolicyInput \{/);

		for (const body of ['CreateTimeOffPolicyInput', 'UpdateTimeOffPolicyInput']) {
			expect(inputBody(body)).toMatch(/organizationId: ID!/);
			expect(inputBody(body)).toMatch(/name: String!/);
			expect(inputBody(body)).toMatch(/requiresApproval: Boolean!/);
			expect(inputBody(body)).toMatch(/paid: Boolean!/);
			expect(inputBody(body)).toMatch(/employeeIds: \[ID!\]/);
			// The tenant is stamped from the credential on every write of this platform.
			expect(inputBody(body)).not.toMatch(/tenantId/);
		}

		// The edit identifies the row it edits, and the filing has no row to identify.
		expect(inputBody('UpdateTimeOffPolicyInput')).toMatch(/id: ID!/);
		expect(inputBody('CreateTimeOffPolicyInput')).not.toMatch(/^\s*id:/m);
	});

	it('states the lifecycle writes as three separate fields', () => {
		// Removal, withdrawal and recovery are three operations: a client that could not tell them apart
		// could not tell whether the balances and requests that point at a policy survived its removal.
		expect(printed).toMatch(/deleteTimeOffPolicy\(id: ID!\): Boolean!\n/);
		expect(printed).toMatch(/softDeleteTimeOffPolicy\(id: ID!\): TimeOffPolicy!\n/);
		expect(printed).toMatch(/recoverTimeOffPolicy\(id: ID!\): TimeOffPolicy!\n/);
	});
});

describe('TimeOffPolicyResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		const connection = await resolver.timeOffPolicies(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs: the object that route builds out of its
		// `data` query parameter, with both members at the value that parameter leaves them at.
		expect(timeOffPolicyService.findAll).toHaveBeenCalledWith({ where: undefined, relations: undefined });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SICK);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timeOffPolicies();

		expect(connection.nodes.map((node) => node.id)).toEqual([SICK, ANNUAL]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.timeOffPolicies({ name: { ilike: 'annual%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ANNUAL]);

		const byDefault = await resolver.timeOffPolicies({ isDefault: { eq: true } });
		expect(byDefault.nodes.map((node) => node.id)).toEqual([ANNUAL]);

		const byCarryForward = await resolver.timeOffPolicies({ allowCarryForward: { eq: false } });
		expect(byCarryForward.nodes.map((node) => node.id)).toEqual([SICK]);

		// An entitlement figure is an exact decimal, so a comparison on it is stated as one.
		const byEntitlement = await resolver.timeOffPolicies({ maxDaysPerYear: { gte: '20' } });
		expect(byEntitlement.nodes.map((node) => node.id)).toEqual([ANNUAL]);

		// A relation is not filterable, because the rows carry no relation to narrow by.
		const error = await resolver.timeOffPolicies({ employees: { eq: EMPLOYEE } }).catch((thrown) => thrown);
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.timeOffPolicies(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([ANNUAL, SICK]);

		const byEntitlement = await resolver.timeOffPolicies(undefined, [
			{ field: 'maxDaysPerYear', direction: 'ASC' }
		]);
		expect(byEntitlement.nodes.map((node) => node.id)).toEqual([SICK, ANNUAL]);

		// The column is filterable and is deliberately not sortable: the enum states the keys a policy
		// list is read in an order for, and the refusal names what is on offer.
		const error = await resolver
			.timeOffPolicies(undefined, [{ field: 'accrualRate', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timeOffPolicies(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SICK]);

		const second = await resolver.timeOffPolicies(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ANNUAL]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.timeOffPolicies(undefined, undefined, undefined, 20);
		const last = await resolver.timeOffPolicies(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SICK]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeOffPolicies(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every policy', async () => {
		const { resolver } = surfaces();

		const error = await resolver.timeOffPolicies(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('TimeOffPolicyResolver — one concept, two protocols, the same operations', () => {
	it('reads one policy through the same service method the inherited route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		expect(await resolver.timeOffPolicy(ANNUAL)).toBe(ROWS[0]);
		expect(timeOffPolicyService.findOneByIdString).toHaveBeenCalledWith(ANNUAL);
	});

	it('answers null for a policy that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, timeOffPolicyService } = surfaces();
		timeOffPolicyService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timeOffPolicy(SICK)).toBeNull();
	});

	it('counts through the same service method the inherited count route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		expect(await resolver.timeOffPolicyCount()).toBe(2);
		expect(timeOffPolicyService.countBy).toHaveBeenCalledWith();
	});

	it('files a policy through the same service method the create route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		await resolver.createTimeOffPolicy({
			organizationId: ORGANIZATION,
			name: 'Annual leave',
			requiresApproval: true,
			paid: true,
			leaveType: 'ANNUAL',
			maxDaysPerYear: 25,
			employeeIds: [EMPLOYEE]
		});

		const payload = timeOffPolicyService.create.mock.calls[0][0];
		// The membership is stated as the identifiers the delivered write is written from.
		expect(payload).toEqual({
			organizationId: ORGANIZATION,
			name: 'Annual leave',
			requiresApproval: true,
			paid: true,
			leaveType: 'ANNUAL',
			maxDaysPerYear: 25,
			employees: [{ id: EMPLOYEE }]
		});
	});

	it('edits a policy through the same service method the update route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		await resolver.updateTimeOffPolicy({
			id: ANNUAL,
			organizationId: ORGANIZATION,
			name: 'Annual leave (revised)',
			requiresApproval: false,
			paid: true,
			employeeIds: [EMPLOYEE]
		});

		const [id, payload] = timeOffPolicyService.update.mock.calls[0];
		// The identifier is the write's own argument, which is where the delivered route takes it from.
		expect(id).toBe(ANNUAL);
		expect(payload).toEqual(
			expect.objectContaining({
				organizationId: ORGANIZATION,
				name: 'Annual leave (revised)',
				requiresApproval: false,
				employees: [{ id: EMPLOYEE }]
			})
		);
	});

	it('removes a policy through the same service method the inherited delete route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		expect(await resolver.deleteTimeOffPolicy(ANNUAL)).toBe(true);
		expect(timeOffPolicyService.delete).toHaveBeenCalledWith(ANNUAL);
	});

	it('withdraws a policy through the same service method the inherited soft-remove route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		const withdrawn = await resolver.softDeleteTimeOffPolicy(ANNUAL);

		expect(timeOffPolicyService.softRemove).toHaveBeenCalledWith(ANNUAL);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
	});

	it('restores a policy through the same service method the inherited recovery route calls', async () => {
		const { resolver, timeOffPolicyService } = surfaces();

		expect(await resolver.recoverTimeOffPolicy(ANNUAL)).toBe(ROWS[0]);
		expect(timeOffPolicyService.softRecover).toHaveBeenCalledWith(ANNUAL);
		// Recovery is not a second spelling of the withdrawal: it names the identifier the row kept while
		// it was withdrawn, and it reaches the one method that clears the stamp.
		expect(timeOffPolicyService.softRemove).not.toHaveBeenCalled();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, timeOffPolicyService } = surfaces();
		const refusal = new Error('TIME_OFF_POLICY_STILL_REFERENCED: a balance still points at this policy.');

		timeOffPolicyService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTimeOffPolicy(ANNUAL)).rejects.toBe(refusal);
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
	{ field: 'timeOffPolicies', route: 'findAll' },
	{ field: 'timeOffPolicy', route: 'findById' },
	{ field: 'timeOffPolicyCount', route: 'getCount' },
	{ field: 'createTimeOffPolicy', route: 'create' },
	{ field: 'updateTimeOffPolicy', route: 'update' },
	{ field: 'deleteTimeOffPolicy', route: 'delete' },
	{ field: 'softDeleteTimeOffPolicy', route: 'softRemove' },
	{ field: 'recoverTimeOffPolicy', route: 'softRecover' }
];

describe('TimeOffPolicyResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimeOffPolicyController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimeOffPolicyResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffPolicyResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeOffPolicyController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(TimeOffPolicyController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimeOffPolicyController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimeOffPolicyController, route));
	});

	it('states on each field the permission its own route declares, and never a wider one', () => {
		expect(permissionOfField('timeOffPolicies')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.TIME_OFF_POLICY_VIEW
		]);
		expect(permissionOfField('createTimeOffPolicy')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_POLICY_ADD
		]);
		expect(permissionOfField('updateTimeOffPolicy')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_POLICY_EDIT
		]);
	});

	it('restates on the fields the guard the four delivered handlers restate', () => {
		// `pagination`, `findAll`, `create` and `update` each add `@UseGuards(PermissionGuard)` over a
		// class that already carries it — a restatement rather than a widening, since the guard context
		// creator unions the two lists — and the fields restate it in the same places, so a reader
		// comparing the two surfaces finds the same chain written the same way.
		for (const handler of ['pagination', 'findAll', 'create', 'update']) {
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeOffPolicyController)[handler])).toEqual([
				PermissionGuard
			]);
		}

		for (const field of ['timeOffPolicies', 'createTimeOffPolicy', 'updateTimeOffPolicy']) {
			expect(Reflect.getMetadata('__guards__', fieldsOf(TimeOffPolicyResolver)[field])).toEqual([
				PermissionGuard
			]);
		}

		// The connection folds the paginated spelling of the list into itself, and both routes state the
		// same view permission, so the one field is held to both.
		expect(permissionOfField('timeOffPolicies')).toEqual(
			permissionOfRoute(TimeOffPolicyController, 'pagination')
		);
	});

	it('holds the five inherited routes to the class-level permission they run under', () => {
		// None of the five states a permission of its own, so each runs under the controller's
		// class-level edit permission — which is what its field states, rather than the view permission
		// its read siblings carry.
		for (const [field, route] of [
			['timeOffPolicy', 'findById'],
			['timeOffPolicyCount', 'getCount'],
			['deleteTimeOffPolicy', 'delete'],
			['softDeleteTimeOffPolicy', 'softRemove'],
			['recoverTimeOffPolicy', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeOffPolicyController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeOffPolicyController)[route])).toBeUndefined();
			expect(permissionOfRoute(TimeOffPolicyController, route)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_POLICY_EDIT
			]);
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_OFF_POLICY_EDIT
			]);
		}

		// The node read of this resource really is an edit-permission read, on both surfaces.
		expect(permissionOfField('timeOffPolicy')).not.toEqual([PermissionsEnum.ALL_ORG_VIEW]);
	});
});

describe('TimeOffPolicyModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimeOffPolicyModule) ?? []) as unknown[];

		expect(providers).toContain(TimeOffPolicyResolver);
		expect(providers).toContain(TimeOffPolicyService);
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
		getHandler: () => (TimeOffPolicyResolver.prototype as never)[field],
		getClass: () => TimeOffPolicyResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimeOffPolicyResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the five whose routes state nothing of their own.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimeOffPolicyResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimeOffPolicyResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeOffPolicies')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeOffPolicies');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timeOffPolicies'))).resolves.toBe(true);
	});
});
