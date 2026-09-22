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
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentResolver } from './organization-department.resolver';
import {
	OrganizationDepartmentEditByEmployeeCommand,
	OrganizationDepartmentUpdateCommand
} from './commands';

/**
 * The organization department over GraphQL.
 *
 * The delivered REST routes serve a department list, one department, a count, one employee's
 * departments, the creation, the edit, the employee assignment, the removal, the soft removal and
 * the recovery. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the two list
 *   reads are connections with the platform's own cursor codec behind them, so a cursor obtained
 *   over REST resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — and because the controller states no permission on the class, that parity is the
 *   controller's per-route pair restated on exactly the six fields whose routes state it, and nothing
 *   at all on the four reads whose routes state nothing;
 * - the columns the delivered reads can produce are what the object type carries, and the three
 *   many-to-many pivots are neither members nor filters because the list read joins none of them;
 * - the paginated spelling of the list folds into the connection and contributes no root field, and
 *   its own permission is a fact about that route rather than about the connection.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const DEPARTMENT = '00000000-0000-4000-8000-000000000010';
const OTHER_DEPARTMENT = '00000000-0000-4000-8000-000000000011';
const EMPLOYEE = '00000000-0000-4000-8000-000000000060';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: OTHER_DEPARTMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Zephyr Lab',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: DEPARTMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme Workshop',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationDepartmentService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		findByEmployee: jest.fn().mockResolvedValue([ROWS[1]]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[1]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };

	return {
		organizationDepartmentService,
		commandBus,
		resolver: new OrganizationDepartmentResolver(
			organizationDepartmentService as never,
			commandBus as never
		)
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
 * The composed schema, as text: this domain's own documents plus the kernel's, which is the same set
 * the boot loader composes for a domain whose SDL references the shared scalars, the shared filter
 * operators and the shared page input.
 */
function composedSchema(): string {
	const directories = [join(__dirname, 'schema'), join(__dirname, '..', 'graphql', 'schema')];

	const documents = directories.flatMap((directory) =>
		readdirSync(directory)
			.filter((name) => name.endsWith('.gql'))
			.map((name) => readFileSync(join(directory, name), 'utf8'))
	);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** One object or input type's members, as this schema declares them. */
function membersOf(name: string): string[] {
	const type = schema.getType(name) as unknown as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The values one enum declares, as a client reads them. */
function valuesOf(name: string): string[] {
	const type = schema.getType(name) as unknown as { getValues(): { name: string }[] } | undefined;

	return (type?.getValues() ?? []).map((value) => value.name);
}

/** One root field, as the schema declares it. */
function rootField(
	operation: 'Query' | 'Mutation',
	field: string
): { type: unknown; args: readonly { name: string }[] } {
	const root = schema.getType(operation) as unknown as
		| { getFields(): Record<string, { type: unknown; args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields() ?? {})[field];
}

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as unknown as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, for the same reason. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The members of the filter input that name a field, which are the ones the evaluator must accept. */
function filterMembers(): string[] {
	return membersOf('OrganizationDepartmentFilter').filter((member) => !['and', 'or', 'not'].includes(member));
}

/** The `Allowed: …` list a refusal carries, which is the evaluator's own declaration of its fields. */
function allowedByRefusal(error: unknown): string[] {
	const allowed = String((error as Error).message).match(/Allowed: (.*)\.$/)?.[1] ?? '';

	return allowed.split(', ').sort();
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationDepartmentController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file. The controller states no class-level
 * permission at all, so a route that states none resolves to nothing rather than to an empty list.
 */
function permissionOfRoute(controller: typeof OrganizationDepartmentController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationDepartmentController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof OrganizationDepartmentResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(OrganizationDepartmentResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationDepartmentResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', OrganizationDepartmentResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(OrganizationDepartmentResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('OrganizationDepartmentResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the employee read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationDepartments',
				'organizationDepartment',
				'organizationDepartmentCount',
				'organizationDepartmentsByEmployee'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationDepartment',
				'updateOrganizationDepartment',
				'deleteOrganizationDepartment',
				'softDeleteOrganizationDepartment',
				'recoverOrganizationDepartment',
				'updateOrganizationDepartmentByEmployee'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer
		// one question, so the surface states it once: a second root field for the paginated spelling
		// would be a second surface that could disagree with this one.
		expect(rootFields('Query').sort()).toEqual([
			'organizationDepartment',
			'organizationDepartmentCount',
			'organizationDepartments',
			'organizationDepartmentsByEmployee'
		]);
		expect(rootFields('Mutation').sort()).toEqual([
			'createOrganizationDepartment',
			'deleteOrganizationDepartment',
			'recoverOrganizationDepartment',
			'softDeleteOrganizationDepartment',
			'updateOrganizationDepartment',
			'updateOrganizationDepartmentByEmployee'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationDepartmentConnection \{\s*nodes: \[OrganizationDepartment!\]!\s*edges: \[OrganizationDepartmentEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationDepartmentEdge \{\s*node: OrganizationDepartment!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationDepartmentFilter \{/);
		expect(printed).toMatch(/input OrganizationDepartmentSort \{/);
		expect(printed).toMatch(/enum OrganizationDepartmentSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('carries the row’s own column and the base columns, and none of the three pivots', () => {
		const body = typeBody('OrganizationDepartment');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		expect(body).toMatch(/archivedAt: DateTime/);
		expect(body).toMatch(/isActive: Boolean/);
		expect(body).toMatch(/isArchived: Boolean/);
		// The three many-to-many pivots are neither carried as fields nor named by a column of this
		// row, so there is nothing an identifier member could stand for either.
		for (const pivot of ['members', 'tags', 'candidates']) {
			expect(body).not.toMatch(new RegExp(`\\b${pivot}:`));
			expect(body).not.toMatch(new RegExp(`\\b${pivot}Id:`));
		}
		// Nothing on this row is money and nothing is fractional, so no member is a Decimal or a Float.
		expect(body).not.toContain('Decimal');
		expect(body).not.toContain('Float');
	});

	it('answers the count through a nullable Int that states no argument', () => {
		const count = rootField('Query', 'organizationDepartmentCount');

		expect(String(count.type)).toBe('Int');
		// The count route passes its query string through as the store's own `where`, which this
		// surface cannot hand to that call, so the count states no filter it could not honour.
		expect(count.args).toHaveLength(0);
		expect(printed).not.toMatch(/organizationDepartmentCount\(/);
	});

	it('answers one employee’s departments through a root field of its own and not through a members filter', () => {
		const field = rootField('Query', 'organizationDepartmentsByEmployee');

		expect(String(field.type)).toBe('OrganizationDepartmentConnection!');
		// The delivered route states the employee as a path segment and carries no query string, so
		// the field states the employee and no other argument.
		expect(field.args.map((argument) => argument.name)).toEqual(['employeeId']);
		// The pivot that read joins is not a filter on the connection: the list read joins none of it,
		// so a filter on it would select nothing at all.
		expect(filterMembers()).not.toContain('members');
	});

	it('states the write inputs the mutations take, with the relations named by identifier', () => {
		const create = inputBody('CreateOrganizationDepartmentInput');
		const update = inputBody('UpdateOrganizationDepartmentInput');
		const byEmployee = inputBody('UpdateOrganizationDepartmentByEmployeeInput');

		expect(create).toMatch(/name: String!/);
		// The column is nullable and the create route validates nothing, so the organization is stated
		// without a `!`: a field that required it would refuse a caller the REST route serves.
		expect(create).toMatch(/organizationId: ID/);
		expect(create).not.toMatch(/organizationId: ID!/);
		expect(create).toMatch(/memberIds: \[ID!\]/);
		expect(create).toMatch(/tagIds: \[ID!\]/);
		// No member names the tenant, because the tenant comes from the credential on every write here.
		expect(create).not.toContain('tenantId');

		expect(update).toMatch(/id: ID!/);
		// The delivered edit writes through the create path with the identifier merged in, so a member
		// the caller leaves out is left as it is — and the input says so by stating none of them.
		expect(update).toMatch(/name: String/);
		expect(update).not.toMatch(/name: String!/);

		// The employee assignment is the employee domain's own operation, and its payload is the one
		// the delivered handler reads.
		expect(byEmployee).toMatch(/organizationId: ID!/);
		expect(byEmployee).toMatch(/memberId: ID!/);
		expect(byEmployee).toMatch(/addedEntityIds: \[ID!\]/);
		expect(byEmployee).toMatch(/removedEntityIds: \[ID!\]/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/organizationDepartments\([^)]*withDeleted/);
		// The paginated spelling is the same rows under the same filters: it is the connection and not
		// a root field of its own.
		expect(rootFields('Query')).not.toContain('organizationDepartmentPagination');
	});
});

describe('OrganizationDepartmentResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		const connection = await resolver.organizationDepartments(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing: the
		// controller destructures `findInput`, `relations` and `order` out of an absent `data` and hands
		// the three over undefined.
		expect(organizationDepartmentService.findAll).toHaveBeenCalledWith({
			where: undefined,
			order: undefined,
			relations: undefined
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(DEPARTMENT);
	});

	it('orders by name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationDepartments();

		expect(connection.nodes.map((node) => node.id)).toEqual([DEPARTMENT, OTHER_DEPARTMENT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationDepartments({ name: { ilike: 'acm%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([DEPARTMENT]);

		const byOrganization = await resolver.organizationDepartments({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.nodes.map((node) => node.id)).toEqual([DEPARTMENT, OTHER_DEPARTMENT]);

		const byFlag = await resolver.organizationDepartments({ isArchived: { eq: false } });
		expect(byFlag.totalCount).toBe(2);

		const byAbsence = await resolver.organizationDepartments({ isArchived: { isNull: true } });
		expect(byAbsence.totalCount).toBe(0);
	});

	it('declares exactly the filter members the evaluator accepts, member for member', async () => {
		// The connection's allow-list and the filter input are two renderings of one declaration, and
		// the evaluator's own refusal names the members it accepts — so the two are compared rather
		// than either being restated here.
		const { resolver } = surfaces();

		const refusal = await resolver
			.organizationDepartments({ workshops: { eq: DEPARTMENT } })
			.catch((thrown) => thrown);

		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
		expect(allowedByRefusal(refusal)).toEqual([...filterMembers()].sort());
	});

	it('declares exactly the sort keys the evaluator accepts, member for member', async () => {
		const { resolver } = surfaces();

		const refusal = await resolver
			.organizationDepartments(undefined, [{ field: 'organizationId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
		expect(allowedByRefusal(refusal)).toEqual([...valuesOf('OrganizationDepartmentSortField')].sort());
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationDepartments(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_DEPARTMENT, DEPARTMENT]);

		const byCreatedAt = await resolver.organizationDepartments(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreatedAt.nodes.map((node) => node.id)).toEqual([DEPARTMENT, OTHER_DEPARTMENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationDepartments(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([DEPARTMENT]);

		const second = await resolver.organizationDepartments(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_DEPARTMENT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationDepartments(undefined, undefined, undefined, 20);

		const last = await resolver.organizationDepartments(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([DEPARTMENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a filter field the resource does not declare, a pivot included', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationDepartments({ members: { eq: EMPLOYEE } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationDepartments(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationDepartmentResolver — one concept, two protocols, the same operations', () => {
	it('reads one department through the same service method the REST node route calls', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		expect(await resolver.organizationDepartment(DEPARTMENT)).toBe(ROWS[1]);
		expect(organizationDepartmentService.findOneByIdString).toHaveBeenCalledWith(DEPARTMENT);
	});

	it('answers null for a department that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationDepartmentService } = surfaces();
		organizationDepartmentService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationDepartment(OTHER_DEPARTMENT)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		expect(await resolver.organizationDepartmentCount()).toBe(2);
		expect(organizationDepartmentService.countBy).toHaveBeenCalledWith();
	});

	it('reads one employee’s departments through the method the employee route calls, as a connection', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		const connection = await resolver.organizationDepartmentsByEmployee(EMPLOYEE);

		// The same read, with the same single argument the route states as a path segment.
		expect(organizationDepartmentService.findByEmployee).toHaveBeenCalledWith(EMPLOYEE);
		expect(connection.nodes.map((node) => node.id)).toEqual([DEPARTMENT]);
		expect(connection.totalCount).toBe(1);
		// The connection protocol is the platform's own, so the walk is the same walk every other
		// list here answers with.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(DEPARTMENT);
	});

	it('files a department through the same service method the create route calls', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		await resolver.createOrganizationDepartment({
			name: 'Acme Workshop',
			organizationId: ORGANIZATION,
			memberIds: [EMPLOYEE]
		});

		expect(organizationDepartmentService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Acme Workshop',
				organizationId: ORGANIZATION,
				// A related row is named by its identifier and handed over as the row the pivot is
				// written from, which is the shape the entity's own relation takes.
				members: [{ id: EMPLOYEE }]
			})
		);
		// The tenant is never a member of the payload: the service stamps it from the credential.
		expect(organizationDepartmentService.create.mock.calls[0][0]).not.toHaveProperty('tenantId');
	});

	it('leaves a relation list the caller did not state undefined rather than empty', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		await resolver.createOrganizationDepartment({ name: 'Acme Workshop' });

		// An absent list is not an instruction; an empty one is the instruction to clear the pivot.
		const payload = organizationDepartmentService.create.mock.calls[0][0] as Record<string, unknown>;

		expect(payload.members).toBeUndefined();
		expect(payload.tags).toBeUndefined();
	});

	it('edits a department through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationDepartment({
			id: DEPARTMENT,
			name: 'Acme Workshop',
			tagIds: undefined
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationDepartmentUpdateCommand);
		expect(command.id).toBe(DEPARTMENT);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({ name: 'Acme Workshop' });
	});

	it('moves departments into and out of one employee’s book through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		// The delivered handler answers the write's own success, and the route hands that answer back.
		commandBus.execute.mockResolvedValueOnce(true);

		expect(
			await resolver.updateOrganizationDepartmentByEmployee({
				organizationId: ORGANIZATION,
				memberId: EMPLOYEE,
				addedEntityIds: [DEPARTMENT],
				removedEntityIds: [OTHER_DEPARTMENT]
			})
		).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationDepartmentEditByEmployeeCommand);
		// The employee is named by its identifier and handed over as the row the delivered handler
		// reads, which is what the delivered body carries.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			member: { id: EMPLOYEE },
			addedEntityIds: [DEPARTMENT],
			removedEntityIds: [OTHER_DEPARTMENT]
		});
	});

	it('leaves a direction the caller did not state undefined rather than sending it empty', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationDepartmentByEmployee({
			organizationId: ORGANIZATION,
			memberId: EMPLOYEE,
			addedEntityIds: [DEPARTMENT]
		});

		// The handler reads "nothing stated" and "nothing to change" as one instruction, so an absent
		// list is left out of the payload rather than replaced by an empty one.
		expect(commandBus.execute.mock.calls[0][0].input.removedEntityIds).toBeUndefined();
	});

	it('removes a department through the same service method the REST route calls', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		expect(await resolver.deleteOrganizationDepartment(DEPARTMENT)).toBe(true);
		expect(organizationDepartmentService.delete).toHaveBeenCalledWith(DEPARTMENT);
	});

	it('withdraws and restores a department through the same two service methods the REST routes call', async () => {
		const { resolver, organizationDepartmentService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationDepartment(DEPARTMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationDepartmentService.softRemove).toHaveBeenCalledWith(DEPARTMENT);

		expect(await resolver.recoverOrganizationDepartment(DEPARTMENT)).toBe(ROWS[1]);
		expect(organizationDepartmentService.softRecover).toHaveBeenCalledWith(DEPARTMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationDepartmentService } = surfaces();
		const refusal = new Error('ORGANIZATION_DEPARTMENT_STILL_REFERENCED: a candidate still points at this department.');

		organizationDepartmentService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationDepartment(DEPARTMENT)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'organizationDepartments', route: 'findAll' },
	{ field: 'organizationDepartment', route: 'findById' },
	{ field: 'organizationDepartmentCount', route: 'getCount' },
	{ field: 'organizationDepartmentsByEmployee', route: 'findByEmployee' },
	{ field: 'createOrganizationDepartment', route: 'create' },
	{ field: 'updateOrganizationDepartment', route: 'update' },
	{ field: 'updateOrganizationDepartmentByEmployee', route: 'updateByEmployee' },
	{ field: 'deleteOrganizationDepartment', route: 'delete' },
	{ field: 'softDeleteOrganizationDepartment', route: 'softRemove' },
	{ field: 'recoverOrganizationDepartment', route: 'softRecover' }
];

describe('OrganizationDepartmentResolver — the guard stack is the controller’s, field by field', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationDepartmentResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationDepartmentController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, FeatureFlagGuard]));
		// The controller states the permission guard per route rather than on the class, so neither
		// surface demands a permission the other does not before the route's own guard runs.
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on either class, because the controller states none', () => {
		// The controller states no `@Permissions` at all — not on the class and not on any of the
		// routes it declares — so nothing is inherited by the fields below and nothing is restated
		// here either. That is a different statement from an empty `@Permissions()`, which would
		// override a class-level permission rather than be absent.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationDepartmentController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationDepartmentResolver)).toBeUndefined();
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(OrganizationDepartmentController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because
		// it is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(OrganizationDepartmentController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(OrganizationDepartmentController, route));
	});

	it('permits the four reads exactly as far as their routes do, and no further', () => {
		const proto = fieldsOf(OrganizationDepartmentResolver);

		// The list, the node read, the count and the employee read are delivered without a permission
		// — the controller states none on the class and none on those four routes — so their fields
		// state none either and add no guard of their own. A resolver that demanded one here would
		// refuse a caller the REST route serves, which is the same defect as an ungated write read the
		// other way round. The route side is read rather than assumed, so an upstream change that gates
		// one of these reads fails here instead of leaving the field quietly more permissive than it.
		for (const field of [
			'organizationDepartments',
			'organizationDepartment',
			'organizationDepartmentCount',
			'organizationDepartmentsByEmployee'
		]) {
			const entry = ROUTE_PARITY.find((candidate) => candidate.field === field) as { route: string };

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', proto[field])).toBeUndefined();
			expect(permissionOfRoute(OrganizationDepartmentController, entry.route)).toBeUndefined();
			expect(guardsOfRoute(OrganizationDepartmentController, entry.route)).toEqual([TenantPermissionGuard]);
		}
	});

	it('holds the lifecycle pair to the pair its own routes state, which is the one the writes carry', () => {
		const proto = fieldsOf(OrganizationDepartmentResolver);
		const pair = [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT];

		// This test used to assert the opposite — that the three lifecycle fields state no permission —
		// because the controller inherited `delete`, `softRemove` and `softRecover` from the CRUD base,
		// whose handlers state none. It now overrides all three for no other reason than to attach
		// `@UseGuards(PermissionGuard)` with this pair, so a field left unpermissioned here is a way to
		// remove, withdraw or restore a department that the route refuses. The route side is read first
		// so the comparison below cannot pass on the two surfaces being empty together.
		for (const route of ['delete', 'softRemove', 'softRecover']) {
			expect(permissionOfRoute(OrganizationDepartmentController, route)).toEqual(pair);
		}

		for (const field of [
			'deleteOrganizationDepartment',
			'softDeleteOrganizationDepartment',
			'recoverOrganizationDepartment'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual(pair);
			expect(Reflect.getMetadata('__guards__', proto[field])).toEqual([PermissionGuard]);
		}
	});

	it('carries the employee permission on the employee assignment alone, which is the pair its route carries', () => {
		const proto = fieldsOf(OrganizationDepartmentResolver);

		// Assigning people to a department is the employee domain's own operation: the route states
		// `@UseGuards(PermissionGuard)` and `@Permissions(ORG_EMPLOYEES_EDIT)`, and the field states
		// exactly that pair beside the tenant guard the class already carries.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['updateOrganizationDepartmentByEmployee'])).toEqual([
			PermissionsEnum.ORG_EMPLOYEES_EDIT
		]);
		expect(Reflect.getMetadata('__guards__', proto['updateOrganizationDepartmentByEmployee'])).toEqual([
			PermissionGuard
		]);
		// The two writes that mirror the resource's own edit routes are not given the employee
		// permission: their routes admit either `ALL_ORG_EDIT` or `ORG_EMPLOYEES_EDIT`, so a field that
		// carried the employee permission alone would refuse a caller holding only the organisation-wide
		// one whom the route serves — two scopes for one concept, which is what the two-protocol rule
		// forbids.
		for (const field of ['createOrganizationDepartment', 'updateOrganizationDepartment']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_EMPLOYEES_EDIT
			]);
		}
	});

	it('answers the connection under the list route’s chain while recording the paginated route’s own permission', () => {
		// Two delivered routes fold into the one connection: the list route carries no permission and
		// the paginated route carries the read permission. The field states the list route's chain,
		// because a connection carrying the paginated route's permission would refuse a caller the
		// list route serves — the one disagreement the doctrine names as a defect. The paginated
		// route's own declaration is asserted here so the asymmetry is recorded rather than hidden.
		expect(permissionOfField('organizationDepartments')).toEqual(
			permissionOfRoute(OrganizationDepartmentController, 'findAll')
		);
		expect(permissionOfField('organizationDepartments')).toBeUndefined();
		expect(typeof handlersOf(OrganizationDepartmentController)['pagination']).toBe('function');
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationDepartmentController)['pagination'])
		).toEqual([PermissionsEnum.ORG_INCOMES_VIEW]);
		expect(
			guardsOfRoute(OrganizationDepartmentController, 'pagination').sort()
		).toEqual([TenantPermissionGuard, PermissionGuard].sort());
	});
});

/**
 * The module that hosts the resolver is deliberately not imported by this suite.
 *
 * Its providers include the two command handlers, and the base class of the employee-assignment
 * handler is declared by the shared handler barrel, which reaches the core barrel, which reaches
 * this domain's own handlers again. A suite that loads the module therefore enters that cycle before
 * the base class is defined, and the run ends as a load error rather than as a test failure — which
 * would say nothing about the surface under test. What the module's wiring has to satisfy is
 * asserted where it can be: the resolver is instantiated over its two dependencies in every test
 * above, and the gate and the guard chain are read from its own metadata.
 */

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
		getHandler: () => (OrganizationDepartmentResolver.prototype as never)[field],
		getClass: () => OrganizationDepartmentResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationDepartmentResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the
		// class, so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationDepartmentResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationDepartmentResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationDepartments')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationDepartments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationDepartments'))).resolves.toBe(true);
	});
});
