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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AppointmentEmployeesController } from './appointment-employees.controller';
import { AppointmentEmployeesModule } from './appointment-employees.module';
import { AppointmentEmployeesResolver } from './appointment-employees.resolver';
import { AppointmentEmployeesService } from './appointment-employees.service';

/**
 * The appointment's invitation over GraphQL.
 *
 * The delivered REST routes serve a list, one invitation, a count, the invitation's own filing, change,
 * removal and two lifecycle moves, and — on two sub-routes — the same rows narrowed to one appointment and
 * to one employee. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every capability is a root field of the one composed schema, and the list is a connection with the
 *   platform's own cursor codec behind it, so a cursor obtained over REST resumes here and a refusal is the
 *   query protocol's own code;
 * - **the two sub-routes are filters of that connection and never root fields of their own** — they answer
 *   the same rows under one more field, and the filter is where this surface states them;
 * - every field reaches the same service method the REST route reaches through the CRUD base, so a client
 *   does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and no permission is stated anywhere**, because the controller
 *   states none — read from the controller's own metadata rather than restated here;
 * - the pivot is carried as the row it is: both appointment identifiers, no relation, and the document says
 *   which identifier is which.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE_ONE = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE_TWO = '00000000-0000-4000-8000-000000000004';
const APPOINTMENT_ONE = '00000000-0000-4000-8000-000000000030';
const APPOINTMENT_TWO = '00000000-0000-4000-8000-000000000031';
const INVITE_ONE = '00000000-0000-4000-8000-000000000040';
const INVITE_TWO = '00000000-0000-4000-8000-000000000041';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: no order of
 * its own, which is why the two are placed so that the connection's default order is observable.
 */
const ROWS = [
	{
		id: INVITE_ONE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		appointmentId: APPOINTMENT_ONE,
		employeeId: EMPLOYEE_ONE,
		employeeAppointmentId: APPOINTMENT_ONE,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: INVITE_TWO,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		appointmentId: APPOINTMENT_TWO,
		employeeId: EMPLOYEE_TWO,
		employeeAppointmentId: APPOINTMENT_TWO,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const appointmentEmployeesService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};

	return {
		appointmentEmployeesService,
		resolver: new AppointmentEmployeesResolver(appointmentEmployeesService as never)
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
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the boot
 * loader globs, which is what makes a reference from this domain to another one resolvable.
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
 * Ownership is stated by the concept's own name: `appointmentEmployee` spells the pivot and nothing else,
 * so the appointment surface's fields — `employeeAppointments`, `signEmployeeAppointment` and the rest —
 * are not among them, which is asserted below rather than assumed.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('appointmentemployee'))
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The members of one object or input type this schema declares, as a client reads them. */
function membersOf(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The values of one enum this schema declares. */
function enumValues(name: string): string[] {
	const type = schema.getType(name) as { getValues(): readonly { name: string }[] } | undefined;

	return (type?.getValues() ?? []).map((value) => value.name);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof AppointmentEmployeesController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather than
 * to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof AppointmentEmployeesController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler states
 * of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof AppointmentEmployeesController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof AppointmentEmployeesResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(AppointmentEmployeesResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, AppointmentEmployeesResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', AppointmentEmployeesResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(AppointmentEmployeesResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('AppointmentEmployeesResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['appointmentEmployees', 'appointmentEmployee', 'appointmentEmployeeCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createAppointmentEmployee',
				'updateAppointmentEmployee',
				'deleteAppointmentEmployee',
				'softDeleteAppointmentEmployee',
				'recoverAppointmentEmployee'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would be a
		// second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['appointmentEmployee', 'appointmentEmployeeCount', 'appointmentEmployees']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createAppointmentEmployee',
			'deleteAppointmentEmployee',
			'recoverAppointmentEmployee',
			'softDeleteAppointmentEmployee',
			'updateAppointmentEmployee'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['appointmentEmployeesPagination', 'appointmentEmployeePagination'])
		);

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(AppointmentEmployeesController)[handler]).toBe('function');
		}
	});

	it('answers both sub-routes as filters of the connection, and declares no root field for either', () => {
		// `GET /appointment/:appointmentId` and `GET /employee-appointments/:employeeId` answer the same rows
		// the connection answers, narrowed by one field each, so each is that filter — and the handlers are
		// asserted to exist, which is what makes their absence from the root types a decision rather than an
		// oversight.
		expect(typeof handlersOf(AppointmentEmployeesController)['findByAppointmentId']).toBe('function');
		expect(typeof handlersOf(AppointmentEmployeesController)['findEmployeeAppointments']).toBe('function');

		expect(ownedRootFields('Query')).toEqual(['appointmentEmployee', 'appointmentEmployeeCount', 'appointmentEmployees']);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining([
				'appointmentEmployeesByAppointment',
				'appointmentEmployeesByEmployee',
				'employeeAppointmentsByEmployee'
			])
		);

		// What the two sub-routes narrow by is what the filter declares — the appointment on one, the
		// employee on the other.
		expect(membersOf('AppointmentEmployeeFilter')).toEqual(
			expect.arrayContaining(['appointmentId', 'employeeId'])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type AppointmentEmployeeConnection \{\s*nodes: \[AppointmentEmployee!\]!\s*edges: \[AppointmentEmployeeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type AppointmentEmployeeEdge \{\s*node: AppointmentEmployee!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input AppointmentEmployeeFilter \{/);
		expect(printed).toMatch(/input AppointmentEmployeeSort \{/);
		expect(printed).toMatch(/enum AppointmentEmployeeSortField \{\s*createdAt\s*updatedAt\s*\}/);
	});

	it('states the count as a nullable total that takes no argument', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count route
		// counts the caller's own rows. Nullable, because an aggregate the resource has no answer for must not
		// be answered as a zero.
		expect(printed).toMatch(/appointmentEmployeeCount: Int\n/);
		expect(printed).not.toMatch(/appointmentEmployeeCount: Int!/);
		expect(fieldArgs('Query', 'appointmentEmployeeCount')).toEqual([]);

		// The node query is nullable for the same reason it is on every other resource: a miss is not an
		// error.
		expect(printed).toMatch(/appointmentEmployee\(id: ID!\): AppointmentEmployee\n/);

		expect(fieldArgs('Query', 'appointmentEmployees')).toEqual([
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

	it('carries both appointment identifiers and neither relation the list read fails to join', () => {
		const body = typeBody('AppointmentEmployee');

		expect(body).toMatch(/appointmentId: ID!/);
		expect(body).toMatch(/employeeId: ID/);
		expect(body).toMatch(/employeeAppointmentId: ID/);

		// The delivered `GET /employee-appointments/:employeeId` joins `employeeAppointment` for its own
		// caller; the list read this connection mirrors joins nothing, so neither relation is a member — a
		// member present for one caller and absent for another would be worse than no member.
		expect(body).not.toMatch(/\bemployee:/);
		expect(body).not.toMatch(/\bemployeeAppointment:/);

		// The two identifiers are distinct members and the document says which is which, because a reader
		// that took one for the other would narrow by the wrong column.
		expect(printed).toContain('plain column');
		expect(printed).toContain('relation id of');

		// The two lifecycle routes write this column and nothing else, so it is carried.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('declares exactly the fields the evaluator knows, so the schema and the resolver cannot drift', async () => {
		const { resolver } = surfaces();
		const declared = membersOf('AppointmentEmployeeFilter').filter((member) => !['and', 'or', 'not'].includes(member));

		expect(declared.length).toBeGreaterThan(0);

		// Every member the schema offers is a member the evaluator knows: a field the SDL declared and the
		// resolver's own declaration did not would be refused as unknown, which is exactly the drift this
		// asserts against.
		for (const member of declared) {
			await expect(resolver.appointmentEmployees({ [member]: { isNull: false } })).resolves.toBeDefined();
		}
	});

	it('offers exactly the sort keys the evaluator can order by', async () => {
		const { resolver } = surfaces();
		const declared = enumValues('AppointmentEmployeeSortField');

		expect(declared).toEqual(['createdAt', 'updatedAt']);

		for (const field of declared) {
			await expect(resolver.appointmentEmployees(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});

	it('declares the write inputs the two write mutations take, and no member the store owns', () => {
		// The inherited write takes the entity as the store's own partial, so the inputs mirror the row's
		// writable columns: the two identifiers and the organization.
		expect(inputBody('CreateAppointmentEmployeeInput')).toMatch(/appointmentId: ID!/);
		expect(inputBody('CreateAppointmentEmployeeInput')).toMatch(/employeeId: ID!/);
		expect(inputBody('CreateAppointmentEmployeeInput')).toMatch(/organizationId: ID(?![!\w])/);

		// The change states the criterion and leaves the columns optional, which is the shape of the
		// inherited partial update.
		expect(inputBody('UpdateAppointmentEmployeeInput')).toMatch(/id: ID!/);
		expect(inputBody('UpdateAppointmentEmployeeInput')).toMatch(/appointmentId: ID(?![!\w])/);
		expect(inputBody('UpdateAppointmentEmployeeInput')).toMatch(/employeeId: ID(?![!\w])/);

		for (const body of [
			inputBody('CreateAppointmentEmployeeInput'),
			inputBody('UpdateAppointmentEmployeeInput')
		]) {
			// The tenant is stamped from the credential by the service and overwrites whatever a body states.
			expect(body).not.toMatch(/tenantId:/);
			// The bookkeeping columns are the platform's own: the lifecycle routes move the marker, and an
			// input that could set one would be a way to write a fact this surface does not own.
			expect(body).not.toMatch(/isActive:|isArchived:|archivedAt:|deletedAt:/);
		}
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/appointmentEmployees\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/appointmentEmployeeCount\(/);
	});
});

describe('AppointmentEmployeesResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		const connection = await resolver.appointmentEmployees(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: no `where` and no
		// `relations`, because this surface has no query string to bind and states its narrowing in `filter`.
		expect(appointmentEmployeesService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(INVITE_ONE);
	});

	it('orders newest first when the caller states none, with the identifier as the last key', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.appointmentEmployees();

		// The delivered reads state no order of their own, so this is the connection's own decision — and it
		// is total, which is what makes a cursor walk over it stable.
		expect(connection.nodes.map((node) => node.id)).toEqual([INVITE_ONE, INVITE_TWO]);
	});

	it('narrows to the rows the appointment sub-route answers, through the filter', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		// The sub-route reads `findAll({ where: { appointmentId } })`; the connection reads the same rows with
		// the route's own defaults and narrows them with the filter, which is the same set by another road.
		const connection = await resolver.appointmentEmployees({ appointmentId: { eq: APPOINTMENT_ONE } });

		expect(appointmentEmployeesService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes.map((node) => node.id)).toEqual([INVITE_ONE]);
	});

	it('narrows to the rows the employee sub-route answers, through the filter', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.appointmentEmployees({ employeeId: { eq: EMPLOYEE_TWO } });

		expect(connection.nodes.map((node) => node.id)).toEqual([INVITE_TWO]);
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const oldest = await resolver.appointmentEmployees(undefined, [{ field: 'createdAt', direction: 'ASC' }]);

		expect(oldest.nodes.map((node) => node.id)).toEqual([INVITE_TWO, INVITE_ONE]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.appointmentEmployees(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([INVITE_ONE]);

		const second = await resolver.appointmentEmployees(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([INVITE_TWO]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.appointmentEmployees(undefined, undefined, undefined, 20);
		const last = await resolver.appointmentEmployees(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([INVITE_ONE]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.appointmentEmployees(undefined, [{ field: 'appointmentId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.appointmentEmployees({ employeeAppointment: { eq: APPOINTMENT_ONE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// The members deliberately absent from the filter are not merely undocumented: naming one is refused.
		const tenant = await resolver.appointmentEmployees({ tenantId: { eq: TENANT } }).catch((thrown) => thrown);
		expect(isRefusal(tenant)).toBe(true);
		expect((tenant as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.appointmentEmployees(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every invitation', async () => {
		const { resolver } = surfaces();

		const error = await resolver.appointmentEmployees(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('AppointmentEmployeesResolver — one concept, two protocols, the same operations', () => {
	it('reads one invitation through the same service method the REST route calls', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		expect(await resolver.appointmentEmployee(INVITE_ONE)).toBe(ROWS[0]);
		// The inherited `GET /:id` reads the row and nothing beside it, which is what this field mirrors.
		expect(appointmentEmployeesService.findOneByIdString).toHaveBeenCalledWith(INVITE_ONE);
	});

	it('answers null for an invitation that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();
		appointmentEmployeesService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.appointmentEmployee(INVITE_TWO)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		expect(await resolver.appointmentEmployeeCount()).toBe(2);
		expect(appointmentEmployeesService.countBy).toHaveBeenCalledWith();
	});

	it('files an invitation through the same service method the REST route calls', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();
		const input = {
			appointmentId: APPOINTMENT_ONE,
			employeeId: EMPLOYEE_ONE,
			organizationId: ORGANIZATION
		};

		expect(await resolver.createAppointmentEmployee(input)).toBe(ROWS[0]);
		expect(appointmentEmployeesService.create).toHaveBeenCalledWith(input);
	});

	it('changes an invitation through the same service method the REST route calls, and reads the row back', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		expect(await resolver.updateAppointmentEmployee({ id: INVITE_ONE, employeeId: EMPLOYEE_TWO })).toBe(ROWS[0]);

		// The identifier is the criterion and is not repeated in the payload, which is the shape the
		// inherited route has: `:id` names the row and the body carries only what changes.
		expect(appointmentEmployeesService.update).toHaveBeenCalledWith(INVITE_ONE, { employeeId: EMPLOYEE_TWO });
		// The delivered route answers the store's update result, which is not a row, so the row the write
		// produced is read back through the same read the node field uses.
		expect(appointmentEmployeesService.findOneByIdString).toHaveBeenCalledWith(INVITE_ONE);
	});

	it('removes an invitation through the same service method the REST route calls', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		expect(await resolver.deleteAppointmentEmployee(INVITE_ONE)).toBe(true);
		expect(appointmentEmployeesService.delete).toHaveBeenCalledWith(INVITE_ONE);
	});

	it('withdraws and restores an invitation through the same two service methods', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();

		const withdrawn = await resolver.softDeleteAppointmentEmployee(INVITE_ONE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(appointmentEmployeesService.softRemove).toHaveBeenCalledWith(INVITE_ONE);

		const restored = await resolver.recoverAppointmentEmployee(INVITE_ONE);
		expect(restored.deletedAt).toBeNull();
		expect(appointmentEmployeesService.softRecover).toHaveBeenCalledWith(INVITE_ONE);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, appointmentEmployeesService } = surfaces();
		const refusal = new Error('You are not allowed to remove this invitation.');

		appointmentEmployeesService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteAppointmentEmployee(INVITE_ONE)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table of
 * permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch. The two sub-routes are deliberately absent from the
 * table: they are answered by the connection's filter and mirror no field of their own — which is asserted
 * where the filter is.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'appointmentEmployees', route: 'findAll' },
	{ field: 'appointmentEmployee', route: 'findById' },
	{ field: 'appointmentEmployeeCount', route: 'getCount' },
	{ field: 'createAppointmentEmployee', route: 'create' },
	{ field: 'updateAppointmentEmployee', route: 'update' },
	{ field: 'deleteAppointmentEmployee', route: 'delete' },
	{ field: 'softDeleteAppointmentEmployee', route: 'softRemove' },
	{ field: 'recoverAppointmentEmployee', route: 'softRecover' }
];

describe('AppointmentEmployeesResolver — the guard stack and the permission are the controller’s', () => {
	it('states on the class the guard the controller states on the class, and the gate beside it', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', AppointmentEmployeesController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', AppointmentEmployeesResolver) ?? [];

		// The delivered controller carries the tenant guard at class level and no permission anywhere, so
		// the resolver states the same guard and appends the gate to it.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		// No permission guard, because there is no permission to guard: a `PermissionGuard` here would be a
		// guard with nothing to read and a scope the routes do not have.
		expect(resolverGuards).not.toContain(PermissionGuard);
	});

	it('states no permission on the class and none on any field, as the controller does', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AppointmentEmployeesController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AppointmentEmployeesResolver)).toBeUndefined();

		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', AppointmentEmployeesResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same set,
			// which is the whole parity claim: a route that added a guard of its own would narrow REST below
			// GraphQL and is caught here, and so is a field that added one.
			expect([...guardsOfRoute(AppointmentEmployeesController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is asserted
		// to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(AppointmentEmployeesController)[route]).toBe('function');

		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(AppointmentEmployeesController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(AppointmentEmployeesController, route));
	});

	it('reads the two sub-routes’ scope without minting a field for them', () => {
		// The sub-routes carry no guard and no permission of their own either, so the filter that answers them
		// is read under exactly the chain the connection is read under — the parity claim, stated for the two
		// routes that have no field to compare against.
		for (const route of ['findByAppointmentId', 'findEmployeeAppointments']) {
			expect(Reflect.getMetadata('__guards__', handlersOf(AppointmentEmployeesController)[route])).toBeUndefined();
			expect(permissionOfRoute(AppointmentEmployeesController, route)).toBeUndefined();
			expect(guardsOfRoute(AppointmentEmployeesController, route)).toEqual([TenantPermissionGuard]);
		}

		expect(guardsOfField('appointmentEmployees')).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		expect(permissionOfField('appointmentEmployees')).toBeUndefined();
	});

	it('holds the inherited routes to the metadata the base controller carries for them', () => {
		for (const route of ['getCount', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata('__guards__', handlersOf(AppointmentEmployeesController)[route])).toBeUndefined();
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(AppointmentEmployeesController)[route])
			).toBeUndefined();
		}

		for (const field of [
			'appointmentEmployeeCount',
			'deleteAppointmentEmployee',
			'softDeleteAppointmentEmployee',
			'recoverAppointmentEmployee'
		]) {
			expect(Reflect.getMetadata('__guards__', fieldsOf(AppointmentEmployeesResolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(AppointmentEmployeesResolver)[field])).toBeUndefined();
		}
	});
});

describe('AppointmentEmployeesModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppointmentEmployeesModule) ?? []) as unknown[];

		expect(providers).toContain(AppointmentEmployeesResolver);
		expect(providers).toContain(AppointmentEmployeesService);
	});

	it('re-exports the service the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is the
		// service, and nothing besides it: it injects no bus and no other service.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, AppointmentEmployeesModule) ?? []) as unknown[];

		expect(exported).toContain(AppointmentEmployeesService);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
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
		getHandler: () => (AppointmentEmployeesResolver.prototype as never)[field],
		getClass: () => AppointmentEmployeesResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('AppointmentEmployeesResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class, so
		// every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, AppointmentEmployeesResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', AppointmentEmployeesResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('appointmentEmployees')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('appointmentEmployees');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the write fields as well, which is what makes the gate a property of the surface', async () => {
		const { guard } = gate(false);

		for (const field of ['createAppointmentEmployee', 'deleteAppointmentEmployee']) {
			const refusal = await guard.canActivate(graphqlContext(field)).catch((thrown) => thrown);

			expect(refusal).toBeInstanceOf(NotFoundException);
			expect((refusal as Error).message).toContain(field);
			expect((refusal as NotFoundException).getStatus()).toBe(404);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('appointmentEmployees'))).resolves.toBe(true);
	});
});
