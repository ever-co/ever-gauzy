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
import { BaseEntityEnum, EmployeeSettingTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeSettingController } from './employee-setting.controller';
import { EmployeeSettingModule } from './employee-setting.module';
import { EmployeeSettingResolver } from './employee-setting.resolver';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingCreateCommand, EmployeeSettingUpdateCommand } from './commands';

/**
 * The employee setting over GraphQL.
 *
 * The delivered REST routes serve a setting list, one setting, a count, a filing, a change, a removal
 * and the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to
 * get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and no field states a permission, because the controller
 *   states none** — it carries `TenantPermissionGuard` at class level and has no `@Permissions`
 *   anywhere, so every route it serves runs under that guard alone and so does every field here;
 * - the two vocabularies the columns carry are carried as their values rather than redeclared as
 *   schema enums, and the relation is carried as the identifier that always travels rather than as a
 *   member the read could not answer;
 * - a setting that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const EXPENSE = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-000000000060';
const SECOND = '00000000-0000-4000-8000-000000000061';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		settingType: EmployeeSettingTypeEnum.NORMAL,
		entity: BaseEntityEnum.Employee,
		entityId: EMPLOYEE,
		data: { theme: 'dark' },
		defaultData: { theme: 'light' },
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
		settingType: EmployeeSettingTypeEnum.TASK_VIEWS,
		entity: BaseEntityEnum.Expense,
		entityId: EXPENSE,
		data: { columns: ['title'] },
		defaultData: null,
		isActive: true,
		isArchived: false,
		deletedAt: new Date('2026-04-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const employeeSettingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		employeeSettingService,
		commandBus,
		resolver: new EmployeeSettingResolver(employeeSettingService as never, commandBus as never)
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * Ownership is stated by the concept rather than assumed from a pattern: the sibling employee surface
 * spells `employee` too — `employees`, `employeeCount`, `workingEmployees` and the rest — and none of
 * those is a field of this resource. What is left is this resource's own vocabulary.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('employeesetting'))
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
function handlersOf(controller: typeof EmployeeSettingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. For this controller both readings
 * are absent, which is the parity the fields below are asserted against.
 */
function permissionOfRoute(controller: typeof EmployeeSettingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeSettingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeSettingResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeSettingResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeSettingResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeSettingResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeSettingResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeSettings', 'employeeSetting', 'employeeSettingCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeSetting',
				'updateEmployeeSetting',
				'deleteEmployeeSetting',
				'softDeleteEmployeeSetting',
				'recoverEmployeeSetting'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['employeeSetting', 'employeeSettingCount', 'employeeSettings']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeSetting',
			'deleteEmployeeSetting',
			'recoverEmployeeSetting',
			'softDeleteEmployeeSetting',
			'updateEmployeeSetting'
		]);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['employeeSettingsPagination', 'employeeSettingPagination'])
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
			expect(typeof handlersOf(EmployeeSettingController)[handler]).toBe('function');
		}
		expect(Reflect.getMetadata('path', handlersOf(EmployeeSettingController)['pagination'])).toBe('pagination');
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeSettingConnection \{\s*nodes: \[EmployeeSetting!\]!\s*edges: \[EmployeeSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeSettingEdge \{\s*node: EmployeeSetting!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeSettingFilter \{/);
		expect(printed).toMatch(/input EmployeeSettingSort \{/);
		expect(printed).toMatch(
			/enum EmployeeSettingSortField \{\s*createdAt\s*updatedAt\s*settingType\s*entity\s*employeeId\s*deletedAt\s*\}/
		);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/employeeSettingCount: Int\n/);
		expect(printed).not.toMatch(/employeeSettingCount: Int!/);
		expect(fieldArgs('Query', 'employeeSettingCount')).toEqual([]);

		expect(fieldArgs('Query', 'employeeSettings')).toEqual([
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
		expect(printed).not.toMatch(/employeeSettings\([^)]*withDeleted/);
		// The one-row route binds its query string to `FindOptionsQueryDTO`, which names relations this
		// schema's type does not carry, so the field takes no argument for them.
		expect(printed).toMatch(/employeeSetting\(id: ID!\): EmployeeSetting\n/);
		expect(fieldArgs('Query', 'employeeSetting')).toEqual(['id']);
	});
});

describe('EmployeeSettingResolver — which members the surface exposes, and which it carries as values', () => {
	it('carries the columns the delivered reads answer with', () => {
		expect(objectFields('EmployeeSetting')).toEqual(
			expect.arrayContaining([
				'id',
				'settingType',
				'entityId',
				'entity',
				'data',
				'defaultData',
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

	it('carries the two vocabularies as their values rather than declaring them as enums here', () => {
		const body = typeBody('EmployeeSetting');

		// The value sets belong to the columns that store them — the contracts package's
		// `EmployeeSettingTypeEnum` and `BaseEntityEnum` — so a second declaration in this schema could
		// diverge from the column it describes. The value travels; the vocabulary stays where it lives.
		expect(body).toMatch(/settingType: String/);
		expect(body).toMatch(/entity: String/);
		expect(printed).not.toMatch(/enum EmployeeSettingTypeEnum/);
		expect(printed).not.toMatch(/enum BaseEntityEnum/);
	});

	it('carries no relation object, and carries the identifier the relation reports instead', () => {
		const body = typeBody('EmployeeSetting');

		// The reads behind these fields join no relation, so a member for the object would be absent on
		// every row answered here. What always travels is the foreign key, and the employee behind it is
		// read from the employee surface, which is where that concept is declared.
		expect(body).not.toMatch(/\bemployee\s*:/);
		expect(body).not.toMatch(/\bemployeeId\s*:\s*Employee\b/);
		expect(body).toMatch(/employeeId: ID/);

		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		expect(body).toMatch(/data: JSON/);
		expect(body).toMatch(/defaultData: JSON/);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateEmployeeSettingInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeSettingInput \{/);
		expect(printed).toMatch(/createEmployeeSetting\(input: CreateEmployeeSettingInput!\): EmployeeSetting!/);
		expect(printed).toMatch(/updateEmployeeSetting\(input: UpdateEmployeeSettingInput!\): EmployeeSetting!/);
	});

	it('declares no member of the create body as required, which is the validation the delivered body has', () => {
		const create = inputBody('CreateEmployeeSettingInput');

		// Every member of `CreateEmployeeSettingDTO` is either optional in the entity or derived by the
		// delivered write — the employee from the credential, the tenant from the credential, the
		// organization from the caller's own memberships — so no member here is a non-null one, and a
		// `!` in this body would refuse a caller the delivered route serves.
		expect(create).not.toContain('!');
		expect(create).toMatch(/settingType: String/);
		expect(create).toMatch(/entityId: ID/);
		expect(create).toMatch(/entity: String/);
		expect(create).toMatch(/employeeId: ID/);
		expect(create).toMatch(/organizationId: ID/);
	});

	it('states the identifier on the update input and not the employee the delivered update body drops', () => {
		const update = inputBody('UpdateEmployeeSettingInput');

		// The delivered update route carries the identifier in its path and its body is the create body
		// with the employee removed; this surface's mutation takes one argument, so the identifier
		// travels in the input and the employee is not a member at all.
		expect(update).toMatch(/id: ID!/);
		expect(update).not.toMatch(/\bemployeeId\s*:/);
		expect(update).toMatch(/settingType: String/);
		expect(update).toMatch(/organizationId: ID/);
	});
});

describe('EmployeeSettingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeSettingService } = surfaces();

		const connection = await resolver.employeeSettings(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(employeeSettingService.findAll).toHaveBeenCalledWith({});
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

		const connection = await resolver.employeeSettings();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, documents included', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.employeeSettings({ settingType: { eq: EmployeeSettingTypeEnum.NORMAL } });
		expect(byType.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byEntity = await resolver.employeeSettings({ entity: { eq: BaseEntityEnum.Expense } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([SECOND]);

		// The document columns are narrowed as documents, which is what the JSON kind is for: a caller
		// asks whether a value is present inside the document rather than for the document as a whole.
		const byData = await resolver.employeeSettings({ data: { contains: ['dark'] } });
		expect(byData.nodes.map((node) => node.id)).toEqual([FIRST]);

		// A row the platform never gave a fallback document carries none, which is what `isNull` states.
		const withoutDefault = await resolver.employeeSettings({ defaultData: { isNull: true } });
		expect(withoutDefault.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.employeeSettings(undefined, [{ field: 'settingType', direction: 'ASC' }]);
		expect(byType.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byCreated = await resolver.employeeSettings(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeSettings(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.employeeSettings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.employeeSettings(undefined, undefined, undefined, 20);

		const last = await resolver.employeeSettings(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `data` is filterable and not sortable: a filter over a document is a question the connection
		// can answer, an order over one is not, and the two lists are declared separately for exactly
		// this reason.
		const error = await resolver
			.employeeSettings(undefined, [{ field: 'data', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The relation is not a column and not a filterable field: a caller that wants one employee's
		// settings narrows by `employeeId`, which is the key that always travels.
		const error = await resolver.employeeSettings({ employee: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeSettings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeSettingResolver — one concept, two protocols, the same operations', () => {
	it('reads the list through the same service method the REST route calls', async () => {
		const { resolver, employeeSettingService } = surfaces();

		const connection = await resolver.employeeSettings();

		expect(employeeSettingService.findAll).toHaveBeenCalledTimes(1);
		expect(connection.totalCount).toBe(ROWS.length);
	});

	it('reads one setting through the same service method the REST route calls', async () => {
		const { resolver, employeeSettingService } = surfaces();

		expect(await resolver.employeeSetting(FIRST)).toBe(ROWS[0]);
		expect(employeeSettingService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a setting that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeSettingService } = surfaces();
		employeeSettingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeSetting(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeSettingService } = surfaces();

		expect(await resolver.employeeSettingCount()).toBe(2);
		expect(employeeSettingService.countBy).toHaveBeenCalledWith();
	});

	it('files a setting through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			settingType: EmployeeSettingTypeEnum.NORMAL,
			entity: BaseEntityEnum.Employee,
			entityId: EMPLOYEE,
			data: { theme: 'dark' },
			defaultData: { theme: 'light' },
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION
		};

		await resolver.createEmployeeSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeSettingCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('changes a setting through the command the REST route dispatches, with the identifier both ways', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { id: FIRST, data: { theme: 'dark' }, organizationId: ORGANIZATION };

		await resolver.updateEmployeeSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeSettingUpdateCommand);
		// The identifier is carried in both places the delivered route carries it — the path and the
		// body — because the command takes them as two arguments and the service writes under the one
		// from the path.
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual(input);
	});

	it('removes a setting through the same service method the REST route calls', async () => {
		const { resolver, employeeSettingService } = surfaces();

		expect(await resolver.deleteEmployeeSetting(FIRST)).toBe(true);
		expect(employeeSettingService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a setting through the same service methods the REST routes call', async () => {
		const { resolver, employeeSettingService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeSetting(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeSettingService.softRemove).toHaveBeenCalledWith(FIRST);

		const restored = await resolver.recoverEmployeeSetting(FIRST);
		expect(restored.deletedAt).toBeNull();
		expect(employeeSettingService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('EMPLOYEE_SETTING_REFUSED: the setting cannot be written.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.createEmployeeSetting({ organizationId: ORGANIZATION })).rejects.toBe(refusal);
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
	{ field: 'employeeSettings', route: 'findAll' },
	{ field: 'employeeSetting', route: 'findById' },
	{ field: 'employeeSettingCount', route: 'getCount' },
	{ field: 'createEmployeeSetting', route: 'create' },
	{ field: 'updateEmployeeSetting', route: 'update' },
	{ field: 'deleteEmployeeSetting', route: 'delete' },
	{ field: 'softDeleteEmployeeSetting', route: 'softRemove' },
	{ field: 'recoverEmployeeSetting', route: 'softRecover' }
];

describe('EmployeeSettingResolver — the guard stack and the permission are the controller’s', () => {
	it('states the controller’s own guard on the class, and no permission at all', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeSettingController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeSettingResolver) ?? [];

		// The delivered controller carries the tenant guard at class level and no `@Permissions` on the
		// class or on any handler, so its routes run under that guard alone. The resolver states the
		// same chain with the gate appended, and states no permission anywhere: there is none to mirror,
		// and inventing one here would make GraphQL the narrower door for this resource.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeSettingController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeSettingResolver)).toBeUndefined();
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		// The permission guard is not in either chain, so a permission stated here would be inert
		// metadata that reads like a scope — which is worse than none.
		expect(controllerGuards).not.toContain(PermissionGuard);
		expect(resolverGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeSettingResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here. No handler states a guard of its own either, so the
			// two lists are the class chain and nothing else.
			expect([...guardsOfRoute(EmployeeSettingController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
			expect(Reflect.getMetadata('__guards__', handlersOf(EmployeeSettingController)[route])).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeSettingController)[route]).toBe('function');

		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeSettingController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeSettingController, route));
	});

	it('states no permission on any field, because the controller states none either', () => {
		for (const { field, route } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toBeUndefined();
			expect(permissionOfRoute(EmployeeSettingController, route)).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeSettingResolver)[field])).toBeUndefined();
		}

		// None of the permissions a sibling resource states is stated here: this resource's routes carry
		// no permission, and a field that claimed one would refuse a caller the REST route serves.
		expect(permissionOfField('employeeSettings')).not.toEqual([PermissionsEnum.ORG_USERS_VIEW]);
	});

	it('holds the inherited lifecycle routes to the controller’s own chain, which is the whole of their scope', () => {
		for (const [field, route] of [
			['softDeleteEmployeeSetting', 'softRemove'],
			['recoverEmployeeSetting', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata('__guards__', handlersOf(EmployeeSettingController)[route])).toBeUndefined();
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeSettingController)[route])
			).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', fieldsOf(EmployeeSettingResolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeSettingResolver)[field])).toBeUndefined();
		}
	});
});

describe('EmployeeSettingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeSettingModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeSettingResolver);
		expect(providers).toContain(EmployeeSettingService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is
		// the service it reads through and the command bus its two dispatches resolve through.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeSettingModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeSettingService);
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
		getHandler: () => (EmployeeSettingResolver.prototype as never)[field],
		getClass: () => EmployeeSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeSettings')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeSettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeSettings'))).resolves.toBe(true);
	});
});
