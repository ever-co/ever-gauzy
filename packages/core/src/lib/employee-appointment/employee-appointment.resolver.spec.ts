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
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeAppointmentController } from './employee-appointment.controller';
import { EmployeeAppointmentModule } from './employee-appointment.module';
import { EmployeeAppointmentResolver } from './employee-appointment.resolver';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { EmployeeAppointmentCreateCommand, EmployeeAppointmentUpdateCommand } from './commands';

/**
 * The employee appointment over GraphQL.
 *
 * The delivered REST routes serve a list, one appointment, a count, the signing of an identifier, the
 * decoding of the token that signing produced, the filing, the change, the removal and the two lifecycle
 * moves. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and no permission is stated anywhere**, because the controller
 *   states none — not on its own routes and not on the routes it inherits from the CRUD base — read from
 *   the controller's own metadata rather than restated here;
 * - the two reads that answer something other than a row — the signed token and the identifier it carries
 *   — are root fields of their own, and a token that carries no identifier answers null;
 * - the relations the delivered reads do not join are identifiers on the type and never members, and the
 *   invitees of an appointment are the sibling surface's connection narrowed by the appointment.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const LATER = '00000000-0000-4000-8000-000000000020';
const EARLIER = '00000000-0000-4000-8000-000000000021';
const TOKEN = 'signed.appointment.token';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: no order of
 * its own, which is why the two are placed so that the connection's default order is observable.
 */
const ROWS = [
	{
		id: LATER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		agenda: 'Quarterly review',
		description: 'Half-year review of the delivery plan',
		location: 'Room 2',
		startDateTime: new Date('2026-03-10T09:00:00.000Z'),
		endDateTime: new Date('2026-03-10T10:00:00.000Z'),
		bufferTimeStart: true,
		bufferTimeEnd: false,
		bufferTimeInMins: 10,
		breakTimeInMins: 5,
		breakStartTime: new Date('2026-03-10T09:30:00.000Z'),
		emails: 'ada@example.com',
		status: 'Scheduled',
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: EARLIER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: null,
		agenda: 'Onboarding',
		description: null,
		location: null,
		startDateTime: new Date('2026-02-10T09:00:00.000Z'),
		endDateTime: new Date('2026-02-10T10:00:00.000Z'),
		bufferTimeStart: null,
		bufferTimeEnd: null,
		bufferTimeInMins: null,
		breakTimeInMins: null,
		breakStartTime: null,
		emails: null,
		status: 'Cancelled',
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const employeeAppointmentService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		signAppointmentId: jest.fn().mockReturnValue(TOKEN),
		// Deliberately untyped: the delivered decoder's answer is a union — a payload, a bare string or null —
		// and the suite scripts all three.
		decodeSignToken: jest.fn().mockReturnValue({ appointmentId: LATER } as unknown),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		employeeAppointmentService,
		commandBus,
		resolver: new EmployeeAppointmentResolver(employeeAppointmentService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('employeeappointment'))
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
function handlersOf(controller: typeof EmployeeAppointmentController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeAppointmentController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler states
 * of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeAppointmentController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeAppointmentResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeAppointmentResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAppointmentResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeAppointmentResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeAppointmentResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeAppointmentResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeAppointments', 'employeeAppointment', 'employeeAppointmentCount'])
		);
	});

	it('declares the two answers that are not rows as root fields of their own', () => {
		// A signed token and the identifier it carries are not columns of any table and not members of any
		// type here, so they cannot hang off the appointment — and a capability the delivered routes serve
		// is not one this surface may drop.
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['signEmployeeAppointment', 'decodeEmployeeAppointment'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeAppointment',
				'updateEmployeeAppointment',
				'deleteEmployeeAppointment',
				'softDeleteEmployeeAppointment',
				'recoverEmployeeAppointment'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would be a
		// second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'decodeEmployeeAppointment',
			'employeeAppointment',
			'employeeAppointmentCount',
			'employeeAppointments',
			'signEmployeeAppointment'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeAppointment',
			'deleteEmployeeAppointment',
			'recoverEmployeeAppointment',
			'softDeleteEmployeeAppointment',
			'updateEmployeeAppointment'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['employeeAppointmentsPagination', 'employeeAppointmentPagination'])
		);

		// Every field above names a handler that exists on the controller, inherited ones included — and the
		// paginated spelling is served by one too, which is what makes its absence a decision rather than a
		// route nobody wrote.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'signAppointment',
			'decodeToken',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(EmployeeAppointmentController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeAppointmentConnection \{\s*nodes: \[EmployeeAppointment!\]!\s*edges: \[EmployeeAppointmentEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeAppointmentEdge \{\s*node: EmployeeAppointment!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeAppointmentFilter \{/);
		expect(printed).toMatch(/input EmployeeAppointmentSort \{/);
		expect(printed).toMatch(
			/enum EmployeeAppointmentSortField \{\s*createdAt\s*updatedAt\s*startDateTime\s*endDateTime\s*status\s*agenda\s*\}/
		);
	});

	it('states the count as a nullable total that takes no argument, and the reads as the shapes they answer', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count route
		// counts the caller's own rows. Nullable, because an aggregate the resource has no answer for must not
		// be answered as a zero.
		expect(printed).toMatch(/employeeAppointmentCount: Int\n/);
		expect(printed).not.toMatch(/employeeAppointmentCount: Int!/);
		expect(fieldArgs('Query', 'employeeAppointmentCount')).toEqual([]);

		// The signing answers text and the decoding answers an identifier — and the second is nullable,
		// because a token that carries no appointment identifier answers none.
		expect(printed).toMatch(/signEmployeeAppointment\(id: ID!\): String!\n/);
		expect(printed).toMatch(/decodeEmployeeAppointment\(token: String!\): ID\n/);
		expect(printed).not.toMatch(/decodeEmployeeAppointment\(token: String!\): ID!/);

		// The node query is nullable for the same reason it is on every other resource: a miss is not an error.
		expect(printed).toMatch(/employeeAppointment\(id: ID!\): EmployeeAppointment\n/);

		expect(fieldArgs('Query', 'employeeAppointments')).toEqual([
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
	});

	it('carries the appointment as the delivered reads answer it, and neither relation they do not join', () => {
		expect(membersOf('EmployeeAppointment')).toEqual(
			expect.arrayContaining([
				'id',
				'agenda',
				'description',
				'location',
				'startDateTime',
				'endDateTime',
				'bufferTimeStart',
				'bufferTimeEnd',
				'bufferTimeInMins',
				'breakTimeInMins',
				'breakStartTime',
				'emails',
				'status',
				'employeeId',
				'tenantId',
				'organizationId',
				'isActive',
				'isArchived',
				'archivedAt',
				'deletedAt',
				'createdAt',
				'updatedAt'
			])
		);

		const body = typeBody('EmployeeAppointment');

		// The delivered reads join only the relations their own caller named, and both reads this surface
		// mirrors name none — so a relation member would be absent on every row answered here. What always
		// travels is the identifier, and the invitees are the sibling surface's own connection: an
		// appointment's invitees are `appointmentEmployees(filter: { appointmentId: … })`.
		expect(body).not.toContain('invitees');
		expect(body).not.toMatch(/\bemployee:/);
		expect(body).toMatch(/employeeId: ID/);

		// Three columns of the booking are required on the row and stated as such here.
		expect(body).toMatch(/agenda: String!/);
		expect(body).toMatch(/startDateTime: DateTime!/);
		expect(body).toMatch(/endDateTime: DateTime!/);

		// `status` is carried as its value: the vocabulary is the contracts package's own, and a schema enum
		// would be a second declaration of a value set this file does not own.
		expect(body).toMatch(/status: String/);
		expect(printed).not.toMatch(/enum EmployeeAppointmentStatus/);

		// The two lifecycle routes write this column and nothing else, so it is carried; without it the
		// answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('declares exactly the fields the evaluator knows, so the schema and the resolver cannot drift', async () => {
		const { resolver } = surfaces();
		const declared = membersOf('EmployeeAppointmentFilter').filter(
			(member) => !['and', 'or', 'not'].includes(member)
		);

		// Every member the schema offers is a member the evaluator knows: a field the SDL declared and the
		// resolver's own declaration did not would be refused as unknown, which is exactly the drift this
		// asserts against.
		expect(declared.length).toBeGreaterThan(0);

		for (const member of declared) {
			await expect(resolver.employeeAppointments({ [member]: { isNull: false } })).resolves.toBeDefined();
		}
	});

	it('offers exactly the sort keys the evaluator can order by', async () => {
		const { resolver } = surfaces();
		const declared = enumValues('EmployeeAppointmentSortField');

		expect(declared).toEqual(['createdAt', 'updatedAt', 'startDateTime', 'endDateTime', 'status', 'agenda']);

		for (const field of declared) {
			await expect(resolver.employeeAppointments(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});

	it('declares the write inputs the two write mutations take, and no member the handlers drop', () => {
		expect(inputBody('CreateEmployeeAppointmentInput')).toMatch(/organizationId: ID!/);
		expect(inputBody('CreateEmployeeAppointmentInput')).toMatch(/agenda: String!/);
		expect(inputBody('CreateEmployeeAppointmentInput')).toMatch(/startDateTime: DateTime!/);
		expect(inputBody('CreateEmployeeAppointmentInput')).toMatch(/endDateTime: DateTime!/);
		expect(inputBody('CreateEmployeeAppointmentInput')).toMatch(/emails: String/);

		// The organization is on the change as well, because the handler resolves the organization from it;
		// every other member is optional, because the handler leaves an absent member as it is.
		expect(inputBody('UpdateEmployeeAppointmentInput')).toMatch(/id: ID!/);
		expect(inputBody('UpdateEmployeeAppointmentInput')).toMatch(/organizationId: ID(?![!\w])/);
		expect(inputBody('UpdateEmployeeAppointmentInput')).toMatch(/status: String(?![!\w])/);
		expect(inputBody('UpdateEmployeeAppointmentInput')).toMatch(/agenda: String(?![!\w])/);

		// The update states no `emails`: the delivered handler does read `data['emails']` off the body it is
		// handed, but the request type the route publishes for the operation does not declare the member, and
		// this input mirrors that type rather than the handler's reading of it. Carrying it would publish a
		// member the route's own contract withholds.
		expect(inputBody('UpdateEmployeeAppointmentInput')).not.toMatch(/\bemails:/);

		// The invitation list is not a member of either: the handlers never read it, so a body stating it
		// would be accepted and then dropped. An invitee is filed through its own resource's write.
		expect(inputBody('CreateEmployeeAppointmentInput')).not.toMatch(/\binvitees:/);
		expect(inputBody('UpdateEmployeeAppointmentInput')).not.toMatch(/\binvitees:/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/employeeAppointments\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/employeeAppointmentCount\(/);
	});
});

describe('EmployeeAppointmentResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		const connection = await resolver.employeeAppointments(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: no `where` and no
		// `relations`, because this surface has no query string to bind and states its narrowing in `filter`.
		expect(employeeAppointmentService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LATER);
	});

	it('orders newest first when the caller states none, with the identifier as the last key', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeAppointments();

		// The delivered reads state no order of their own, so this is the connection's own decision — and it
		// is total, which is what makes a cursor walk over it stable.
		expect(connection.nodes.map((node) => node.id)).toEqual([LATER, EARLIER]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.employeeAppointments({ status: { eq: 'Cancelled' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([EARLIER]);

		const byEmployee = await resolver.employeeAppointments({ employeeId: { eq: EMPLOYEE } });
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([LATER]);

		// A date column reaches the evaluator as an instant and a caller states one as text, so this is the
		// comparison the two have to be brought onto one scale for.
		const fromMarch = await resolver.employeeAppointments({ startDateTime: { gte: '2026-03-01T00:00:00.000Z' } });
		expect(fromMarch.nodes.map((node) => node.id)).toEqual([LATER]);

		const byAddress = await resolver.employeeAppointments({ emails: { ilike: '%@example.com' } });
		expect(byAddress.nodes.map((node) => node.id)).toEqual([LATER]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStart = await resolver.employeeAppointments(undefined, [{ field: 'startDateTime', direction: 'ASC' }]);
		expect(byStart.nodes.map((node) => node.id)).toEqual([EARLIER, LATER]);

		const byAgenda = await resolver.employeeAppointments(undefined, [{ field: 'agenda', direction: 'DESC' }]);
		expect(byAgenda.nodes.map((node) => node.id)).toEqual([LATER, EARLIER]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeAppointments(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([LATER]);

		const second = await resolver.employeeAppointments(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([EARLIER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.employeeAppointments(undefined, undefined, undefined, 20);
		const last = await resolver.employeeAppointments(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([LATER]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAppointments(undefined, [{ field: 'location', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.employeeAppointments({ invitees: { eq: LATER } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// The members deliberately absent from the filter are not merely undocumented: naming one is refused.
		const tenant = await resolver.employeeAppointments({ tenantId: { eq: TENANT } }).catch((thrown) => thrown);
		expect(isRefusal(tenant)).toBe(true);
		expect((tenant as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAppointments(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every appointment', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAppointments(undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('EmployeeAppointmentResolver — one concept, two protocols, the same operations', () => {
	it('reads one appointment through the same service method the REST route calls', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		expect(await resolver.employeeAppointment(LATER)).toBe(ROWS[0]);
		// The route reads the relations its `relations` query parameter names and reads none otherwise, so
		// the read runs with the service's own default.
		expect(employeeAppointmentService.findById).toHaveBeenCalledWith(LATER);
	});

	it('answers null for an appointment that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeAppointmentService } = surfaces();
		employeeAppointmentService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeAppointment(EARLIER)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		expect(await resolver.employeeAppointmentCount()).toBe(2);
		expect(employeeAppointmentService.countBy).toHaveBeenCalledWith();
	});

	it('signs an identifier through the same service method the sign route calls', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		expect(await resolver.signEmployeeAppointment(LATER)).toBe(TOKEN);
		expect(employeeAppointmentService.signAppointmentId).toHaveBeenCalledWith(LATER);
	});

	it('decodes a token through the same service method the decode route calls', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		expect(await resolver.decodeEmployeeAppointment(TOKEN)).toBe(LATER);
		expect(employeeAppointmentService.decodeSignToken).toHaveBeenCalledWith(TOKEN);
	});

	it('answers null for a token that carries no appointment identifier', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		// A payload that decodes but names no appointment — and a token that does not decode at all, which
		// the delivered decoder answers with null. Neither is a malformed question, so neither is a refusal.
		employeeAppointmentService.decodeSignToken.mockReturnValueOnce({ sub: 'someone' });
		expect(await resolver.decodeEmployeeAppointment(TOKEN)).toBeNull();

		employeeAppointmentService.decodeSignToken.mockReturnValueOnce(null);
		expect(await resolver.decodeEmployeeAppointment(TOKEN)).toBeNull();

		employeeAppointmentService.decodeSignToken.mockReturnValueOnce('a-plain-string-payload');
		expect(await resolver.decodeEmployeeAppointment(TOKEN)).toBeNull();
	});

	it('files an appointment through the command the REST route dispatches, in the caller’s language', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			agenda: 'Quarterly review',
			startDateTime: new Date('2026-03-10T09:00:00.000Z'),
			endDateTime: new Date('2026-03-10T10:00:00.000Z'),
			emails: 'ada@example.com'
		};

		expect(await resolver.createEmployeeAppointment(input)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeAppointmentCreateCommand);
		expect(command.employeeAppointmentInput).toEqual(input);
		// The handler renders the invitation in this language, so the two surfaces send the same text.
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('changes an appointment through the command the REST route dispatches, and reads the row back', async () => {
		const { resolver, commandBus, employeeAppointmentService } = surfaces();

		expect(await resolver.updateEmployeeAppointment({ id: LATER, agenda: 'Annual review', status: 'Completed' })).toBe(
			ROWS[0]
		);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeAppointmentUpdateCommand);
		// The identifier is the criterion, which is the shape the route itself has: `:id` names the row and
		// the body carries only what changes.
		expect(command.id).toBe(LATER);
		expect(command.employeeAppointmentUpdateRequest).toEqual({ agenda: 'Annual review', status: 'Completed' });

		// The command's answer is the store's update result, which is not a row, so the row the write produced
		// is read back through the same read the node field uses.
		expect(employeeAppointmentService.findById).toHaveBeenCalledWith(LATER);
	});

	it('removes an appointment through the same service method the REST route calls', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		expect(await resolver.deleteEmployeeAppointment(LATER)).toBe(true);
		expect(employeeAppointmentService.delete).toHaveBeenCalledWith(LATER);
	});

	it('withdraws and restores an appointment through the same two service methods', async () => {
		const { resolver, employeeAppointmentService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeAppointment(LATER);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeAppointmentService.softRemove).toHaveBeenCalledWith(LATER);

		const restored = await resolver.recoverEmployeeAppointment(LATER);
		expect(restored.deletedAt).toBeNull();
		expect(employeeAppointmentService.softRecover).toHaveBeenCalledWith(LATER);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeAppointmentService } = surfaces();
		const refusal = new Error('You are not allowed to remove this appointment.');

		employeeAppointmentService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmployeeAppointment(LATER)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table of
 * permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeAppointments', route: 'findAll' },
	{ field: 'employeeAppointment', route: 'findById' },
	{ field: 'employeeAppointmentCount', route: 'getCount' },
	{ field: 'signEmployeeAppointment', route: 'signAppointment' },
	{ field: 'decodeEmployeeAppointment', route: 'decodeToken' },
	{ field: 'createEmployeeAppointment', route: 'create' },
	{ field: 'updateEmployeeAppointment', route: 'update' },
	{ field: 'deleteEmployeeAppointment', route: 'delete' },
	{ field: 'softDeleteEmployeeAppointment', route: 'softRemove' },
	{ field: 'recoverEmployeeAppointment', route: 'softRecover' }
];

describe('EmployeeAppointmentResolver — the guard stack and the permission are the controller’s', () => {
	it('states on the class the guard the controller states on the class, and the gate beside it', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeAppointmentController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeAppointmentResolver) ?? [];

		// The delivered controller carries the tenant guard at class level and no permission anywhere, so
		// the resolver states the same guard and appends the gate to it.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		// No permission guard, because there is no permission to guard: a `PermissionGuard` here would be a
		// guard with nothing to read and a scope the routes do not have.
		expect(resolverGuards).not.toContain(PermissionGuard);
	});

	it('states no permission on the class and none on any field, as the controller does', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAppointmentController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAppointmentResolver)).toBeUndefined();

		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toBeUndefined();
		}
		// The query protocol's own reads are held to the same rule: the routes state nothing, so the fields
		// state nothing.
		expect(permissionOfField('employeeAppointments')).toBeUndefined();
		expect(permissionOfField('employeeAppointment')).toBeUndefined();
		expect(permissionOfField('employeeAppointmentCount')).toBeUndefined();
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeAppointmentResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same set,
			// which is the whole parity claim: a route that added a guard of its own would narrow REST below
			// GraphQL and is caught here, and so is a field that added one.
			expect([...guardsOfRoute(EmployeeAppointmentController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is asserted
		// to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeAppointmentController)[route]).toBe('function');

		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeAppointmentController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeAppointmentController, route));
	});

	it('holds the three inherited routes to the metadata the base controller carries for them', () => {
		for (const route of ['getCount', 'delete', 'softRemove', 'softRecover']) {
			// The CRUD base carries neither a guard nor a permission of its own, so the controller's class
			// level guard is the whole of what those routes run under — and therefore the whole of what the
			// fields mirroring them run under.
			expect(Reflect.getMetadata('__guards__', handlersOf(EmployeeAppointmentController)[route])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeAppointmentController)[route])).toBeUndefined();
		}

		for (const field of ['employeeAppointmentCount', 'deleteEmployeeAppointment', 'softDeleteEmployeeAppointment', 'recoverEmployeeAppointment']) {
			expect(Reflect.getMetadata('__guards__', fieldsOf(EmployeeAppointmentResolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeAppointmentResolver)[field])).toBeUndefined();
		}
	});

	it('reads the two computed answers under the guard their own routes run under', () => {
		// The signing and decoding routes declare no permission and no guard of their own, so their fields
		// state none either: the class chain is the whole of their scope.
		for (const [field, route] of [
			['signEmployeeAppointment', 'signAppointment'],
			['decodeEmployeeAppointment', 'decodeToken']
		] as ReadonlyArray<[string, string]>) {
			expect(permissionOfRoute(EmployeeAppointmentController, route)).toBeUndefined();
			expect(guardsOfRoute(EmployeeAppointmentController, route)).toEqual([TenantPermissionGuard]);
			expect(permissionOfField(field)).toBeUndefined();
			expect(guardsOfField(field)).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		}
	});
});

describe('EmployeeAppointmentModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeAppointmentModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeAppointmentResolver);
		expect(providers).toContain(EmployeeAppointmentService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is the
		// service and the command bus its two writes dispatch through. The bus is imported rather than
		// provided here, which is exactly why it has to be re-exported.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeAppointmentModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeAppointmentService);
		expect(exported).toContain(CqrsModule);
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
		getHandler: () => (EmployeeAppointmentResolver.prototype as never)[field],
		getClass: () => EmployeeAppointmentResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeAppointmentResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class, so
		// every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeAppointmentResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeAppointmentResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeAppointments')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeAppointments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the computed reads as well, which is what makes the gate a property of the surface', async () => {
		const { guard } = gate(false);

		for (const field of ['signEmployeeAppointment', 'decodeEmployeeAppointment']) {
			const refusal = await guard.canActivate(graphqlContext(field)).catch((thrown) => thrown);

			expect(refusal).toBeInstanceOf(NotFoundException);
			expect((refusal as Error).message).toContain(field);
			expect((refusal as NotFoundException).getStatus()).toBe(404);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeAppointments'))).resolves.toBe(true);
	});
});
