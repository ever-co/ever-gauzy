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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeNotificationSettingController } from './employee-notification-setting.controller';
import { EmployeeNotificationSettingModule } from './employee-notification-setting.module';
import { EmployeeNotificationSettingResolver } from './employee-notification-setting.resolver';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingCreateCommand, EmployeeNotificationSettingUpdateCommand } from './commands';

/**
 * The employee notification setting over GraphQL.
 *
 * The delivered REST routes serve a setting list, one setting, a count, a filing, a change, a removal
 * and the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to
 * get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the empty permission list are the controller's** — it carries both guards at
 *   class level and states `@Permissions()` naming nothing, which the permission guard reads as "no
 *   permission required", so every field here runs under the same chain with the same empty list;
 * - the employee is carried as the identifier that always travels rather than as a member the read
 *   could not answer, and the delivered create body's omission of it is mirrored rather than patched
 *   over with a member the write never reads;
 * - a setting that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000070';
const SECOND = '00000000-0000-4000-8000-000000000071';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		payment: true,
		assignment: true,
		invitation: true,
		mention: false,
		comment: true,
		message: false,
		preferences: { digest: 'daily' },
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		payment: false,
		assignment: false,
		invitation: true,
		mention: true,
		comment: false,
		message: true,
		preferences: { digest: 'weekly' },
		isActive: true,
		isArchived: false,
		deletedAt: new Date('2026-04-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const employeeNotificationSettingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		employeeNotificationSettingService,
		commandBus,
		resolver: new EmployeeNotificationSettingResolver(
			employeeNotificationSettingService as never,
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

/** The members of one object type this schema declares, as a client reads them. */
function objectFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('employeenotificationsetting'))
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
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
function handlersOf(controller: typeof EmployeeNotificationSettingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. For this controller both readings
 * are the empty list the class states.
 */
function permissionOfRoute(controller: typeof EmployeeNotificationSettingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeNotificationSettingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeNotificationSettingResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeNotificationSettingResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationSettingResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeNotificationSettingResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeNotificationSettingResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeNotificationSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'employeeNotificationSettings',
				'employeeNotificationSetting',
				'employeeNotificationSettingCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeNotificationSetting',
				'updateEmployeeNotificationSetting',
				'deleteEmployeeNotificationSetting',
				'softDeleteEmployeeNotificationSetting',
				'recoverEmployeeNotificationSetting'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'employeeNotificationSetting',
			'employeeNotificationSettingCount',
			'employeeNotificationSettings'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeNotificationSetting',
			'deleteEmployeeNotificationSetting',
			'recoverEmployeeNotificationSetting',
			'softDeleteEmployeeNotificationSetting',
			'updateEmployeeNotificationSetting'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['employeeNotificationSettingsPagination', 'employeeNotificationSettingPagination'])
		);

		// Every field above mirrors a handler that exists on the controller, inherited ones included:
		// the three the base controller mounts are the routes a resource that declares none of its own
		// still serves.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(EmployeeNotificationSettingController)[handler]).toBe('function');
		}
		expect(Reflect.getMetadata('path', handlersOf(EmployeeNotificationSettingController)['pagination'])).toBe(
			'pagination'
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeNotificationSettingConnection \{\s*nodes: \[EmployeeNotificationSetting!\]!\s*edges: \[EmployeeNotificationSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type EmployeeNotificationSettingEdge \{\s*node: EmployeeNotificationSetting!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input EmployeeNotificationSettingFilter \{/);
		expect(printed).toMatch(/input EmployeeNotificationSettingSort \{/);
		expect(printed).toMatch(
			/enum EmployeeNotificationSettingSortField \{\s*createdAt\s*updatedAt\s*employeeId\s*deletedAt\s*\}/
		);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/employeeNotificationSettingCount: Int\n/);
		expect(printed).not.toMatch(/employeeNotificationSettingCount: Int!/);
		expect(fieldArgs('Query', 'employeeNotificationSettingCount')).toEqual([]);

		expect(fieldArgs('Query', 'employeeNotificationSettings')).toEqual([
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

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/employeeNotificationSettings\([^)]*withDeleted/);
		// The one-row route binds its query string to `BaseQueryDTO`, which names relations this schema's
		// type does not carry, so the field takes no argument for them.
		expect(printed).toMatch(/employeeNotificationSetting\(id: ID!\): EmployeeNotificationSetting\n/);
		expect(fieldArgs('Query', 'employeeNotificationSetting')).toEqual(['id']);
	});
});

describe('EmployeeNotificationSettingResolver — which members the surface exposes, and which it carries as values', () => {
	it('carries the columns the delivered reads answer with', () => {
		expect(objectFields('EmployeeNotificationSetting')).toEqual(
			expect.arrayContaining([
				'id',
				'payment',
				'assignment',
				'invitation',
				'mention',
				'comment',
				'message',
				'preferences',
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
	});

	it('carries the six flags as nullable booleans and the document as a document', () => {
		const body = typeBody('EmployeeNotificationSetting');

		// The defaults are the store's, applied when a row is written; a non-null member would tell a
		// client a value a row that predates a flag does not hold.
		for (const flag of ['payment', 'assignment', 'invitation', 'mention', 'comment', 'message']) {
			expect(body).toMatch(new RegExp(`${flag}: Boolean\\n`));
			expect(body).not.toMatch(new RegExp(`${flag}: Boolean!`));
		}

		// The one member the entity declares as required is stated as a document, never as a string of
		// one: a caller stores what it means, and the connection protocol's JSON kind is what reads it.
		expect(body).toMatch(/preferences: JSON/);
		expect(body).not.toMatch(/preferences: String/);
	});

	it('carries no relation object, and carries the identifier the relation reports instead', () => {
		const body = typeBody('EmployeeNotificationSetting');

		// The reads behind these fields join no relation, so a member for the object would be absent on
		// every row answered here. What always travels is the foreign key, and the employee behind it is
		// read from the employee surface, which is where that concept is declared.
		expect(body).not.toMatch(/\bemployee\s*:/);
		expect(body).not.toMatch(/\bemployeeId\s*:\s*Employee\b/);
		expect(body).toMatch(/employeeId: ID/);

		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateEmployeeNotificationSettingInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeNotificationSettingInput \{/);
		expect(printed).toMatch(
			/createEmployeeNotificationSetting\(input: CreateEmployeeNotificationSettingInput!\): EmployeeNotificationSetting!/
		);
		expect(printed).toMatch(
			/updateEmployeeNotificationSetting\(input: UpdateEmployeeNotificationSettingInput!\): EmployeeNotificationSetting!/
		);
	});

	it('declares the document required on the create body and the flags optional, as the delivered validation has it', () => {
		const create = inputBody('CreateEmployeeNotificationSettingInput');

		// `preferences` is the one column the entity declares as required, so the member is non-null;
		// every flag carries a default, so none of them is.
		expect(create).toMatch(/preferences: JSON!/);
		for (const flag of ['payment', 'assignment', 'invitation', 'mention', 'comment', 'message']) {
			expect(create).toMatch(new RegExp(`${flag}: Boolean\\n`));
		}
		expect(create).toMatch(/organizationId: ID$/m);
	});

	it('omits the employee from the create body, because the delivered body omits it and the service derives it', () => {
		// The delivered `CreateEmployeeNotificationSettingDTO` omits the relation and its identifier, and
		// the delivered service takes the employee the credential names when the body states none. A
		// member here would name a person the write never reads, and the field would look like a scope
		// the caller could choose.
		expect(inputBody('CreateEmployeeNotificationSettingInput')).not.toMatch(/\bemployeeId\s*:/);
		expect(inputBody('UpdateEmployeeNotificationSettingInput')).not.toMatch(/\bemployeeId\s*:/);
		// The relation is not a member of any write body either.
		expect(printed).not.toMatch(/input \w*EmployeeNotificationSettingInput \{[^}]*\bemployee\s*:/);
	});

	it('states the identifier on the update input and leaves every other member optional', () => {
		const update = inputBody('UpdateEmployeeNotificationSettingInput');

		// The delivered update route carries the identifier in its path and its body is the create body
		// with every member optional; this surface's mutation takes one argument, so the identifier
		// travels in the input and nothing else is required.
		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/preferences: JSON\n/);
		expect(update).toMatch(/payment: Boolean\n/);
		expect(update).toMatch(/organizationId: ID$/m);
	});
});

describe('EmployeeNotificationSettingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		const connection = await resolver.employeeNotificationSettings(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(employeeNotificationSettingService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeNotificationSettings();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, documents and flags included', async () => {
		const { resolver } = surfaces();

		const byMention = await resolver.employeeNotificationSettings({ mention: { eq: false } });
		expect(byMention.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byInvitation = await resolver.employeeNotificationSettings({ invitation: { eq: true } });
		expect(byInvitation.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		// The document column is narrowed as a document, which is what the JSON kind is for: a caller
		// asks whether a value is present inside the document rather than for the document as a whole.
		const byDigest = await resolver.employeeNotificationSettings({ preferences: { contains: ['weekly'] } });
		expect(byDigest.nodes.map((node) => node.id)).toEqual([SECOND]);

		// A flag filter is a three-state question: rows that carry it, rows that do not, and rows whose
		// column is absent — which is what `isNull` states.
		const absent = await resolver.employeeNotificationSettings({ message: { isNull: true } });
		expect(absent.totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byCreated = await resolver.employeeNotificationSettings(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byEmployee = await resolver.employeeNotificationSettings(undefined, [
			{ field: 'employeeId', direction: 'ASC' }
		]);
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeNotificationSettings(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.employeeNotificationSettings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.employeeNotificationSettings(undefined, undefined, undefined, 20);

		const last = await resolver.employeeNotificationSettings(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// The flags are filterable and not sortable: half the rows carry a flag and half do not, so an
		// order over that split is the question the filter already answers per flag.
		const error = await resolver
			.employeeNotificationSettings(undefined, [{ field: 'payment', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The relation is not a column and not a filterable field: a caller that wants one employee's
		// preferences narrows by `employeeId`, which is the key that always travels.
		const error = await resolver
			.employeeNotificationSettings({ employee: { eq: EMPLOYEE } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeNotificationSettings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeNotificationSettingResolver — one concept, two protocols, the same operations', () => {
	it('reads the list through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		const connection = await resolver.employeeNotificationSettings();

		expect(employeeNotificationSettingService.findAll).toHaveBeenCalledTimes(1);
		expect(connection.totalCount).toBe(ROWS.length);
	});

	it('reads one setting through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		expect(await resolver.employeeNotificationSetting(FIRST)).toBe(ROWS[0]);
		expect(employeeNotificationSettingService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a setting that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();
		employeeNotificationSettingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeNotificationSetting(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		expect(await resolver.employeeNotificationSettingCount()).toBe(2);
		expect(employeeNotificationSettingService.countBy).toHaveBeenCalledWith();
	});

	it('files preferences through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			payment: false,
			assignment: true,
			preferences: { digest: 'daily' },
			organizationId: ORGANIZATION
		};

		await resolver.createEmployeeNotificationSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeNotificationSettingCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('changes preferences through the command the REST route dispatches, with the identifier both ways', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { id: FIRST, payment: false, preferences: { digest: 'weekly' } };

		await resolver.updateEmployeeNotificationSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeNotificationSettingUpdateCommand);
		// The identifier is carried in both places the delivered route carries it — the path and the
		// body — because the command takes them as two arguments and the handler refuses the call when
		// either is missing.
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual(input);
	});

	it('removes a setting through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		expect(await resolver.deleteEmployeeNotificationSetting(FIRST)).toBe(true);
		expect(employeeNotificationSettingService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a setting through the same service methods the REST routes call', async () => {
		const { resolver, employeeNotificationSettingService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeNotificationSetting(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeNotificationSettingService.softRemove).toHaveBeenCalledWith(FIRST);

		const restored = await resolver.recoverEmployeeNotificationSetting(FIRST);
		expect(restored.deletedAt).toBeNull();
		expect(employeeNotificationSettingService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('EMPLOYEE_NOTIFICATION_SETTING_REFUSED: the preferences cannot be written.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.createEmployeeNotificationSetting({ preferences: { digest: 'daily' } })).rejects.toBe(
			refusal
		);
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
	{ field: 'employeeNotificationSettings', route: 'findAll' },
	{ field: 'employeeNotificationSetting', route: 'findById' },
	{ field: 'employeeNotificationSettingCount', route: 'getCount' },
	{ field: 'createEmployeeNotificationSetting', route: 'create' },
	{ field: 'updateEmployeeNotificationSetting', route: 'update' },
	{ field: 'deleteEmployeeNotificationSetting', route: 'delete' },
	{ field: 'softDeleteEmployeeNotificationSetting', route: 'softRemove' },
	{ field: 'recoverEmployeeNotificationSetting', route: 'softRecover' }
];

describe('EmployeeNotificationSettingResolver — the guard stack and the permission are the controller’s', () => {
	it('states the controller’s own guards on the class, with the empty permission list it states', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeNotificationSettingController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeNotificationSettingResolver) ?? [];

		// The delivered controller carries both guards and both are mirrored, with the gate appended.
		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);

		// The empty list is a statement rather than an omission: the controller declares `@Permissions()`
		// naming nothing, and the permission guard authorises a request whose list is empty before it
		// looks anything up. The resolver states the same empty list, so the two surfaces carry the same
		// metadata instead of one of them leaving a reader to guess.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationSettingController)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationSettingResolver)).toEqual([]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeNotificationSettingResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here. No handler states a guard of its own either, so the
			// two lists are the class chain and nothing else.
			expect([...guardsOfRoute(EmployeeNotificationSettingController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
			expect(
				Reflect.getMetadata('__guards__', handlersOf(EmployeeNotificationSettingController)[route])
			).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeNotificationSettingController)[route]).toBe('function');

		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeNotificationSettingController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeNotificationSettingController, route));
	});

	it('states no permission on any field, because the controller states none on any handler', () => {
		for (const { field, route } of ROUTE_PARITY) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeNotificationSettingResolver)[field])
			).toBeUndefined();
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeNotificationSettingController)[route])
			).toBeUndefined();
			// The field resolves to the class's empty list, which is what its route resolves to.
			expect(permissionOfField(field)).toEqual([]);
			expect(permissionOfRoute(EmployeeNotificationSettingController, route)).toEqual([]);
		}
	});

	it('states no permission of its own anywhere, which is what the empty list means', () => {
		const stated = Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationSettingResolver) as unknown[];

		// Not one permission of a sibling resource is stated here: the routes carry none, and a field
		// that claimed one would refuse a caller the REST route serves.
		expect(stated).toHaveLength(0);
		expect(stated).not.toEqual(expect.arrayContaining([PermissionsEnum.ORG_USERS_VIEW]));
		for (const { field } of ROUTE_PARITY) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeNotificationSettingResolver)[field])
			).toBeUndefined();
		}
	});

	it('holds the inherited lifecycle routes to the controller’s own chain, which is the whole of their scope', () => {
		for (const [field, route] of [
			['softDeleteEmployeeNotificationSetting', 'softRemove'],
			['recoverEmployeeNotificationSetting', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(
				Reflect.getMetadata('__guards__', handlersOf(EmployeeNotificationSettingController)[route])
			).toBeUndefined();
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeNotificationSettingController)[route])
			).toBeUndefined();
			expect(
				Reflect.getMetadata('__guards__', fieldsOf(EmployeeNotificationSettingResolver)[field])
			).toBeUndefined();
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeNotificationSettingResolver)[field])
			).toBeUndefined();
		}
	});
});

describe('EmployeeNotificationSettingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeNotificationSettingModule) ??
			[]) as unknown[];

		expect(providers).toContain(EmployeeNotificationSettingResolver);
		expect(providers).toContain(EmployeeNotificationSettingService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is
		// the service it reads through, already exported, and the command bus its two dispatches resolve
		// through, which is what the gate on this module's exports is about.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeNotificationSettingModule) ??
			[]) as unknown[];

		expect(exported).toContain(EmployeeNotificationSettingService);
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
		getHandler: () => (EmployeeNotificationSettingResolver.prototype as never)[field],
		getClass: () => EmployeeNotificationSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeNotificationSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeNotificationSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeNotificationSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('employeeNotificationSettings'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeNotificationSettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeNotificationSettings'))).resolves.toBe(true);
	});
});
