/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TaskEstimationController } from './task-estimation.controller';
import { TaskEstimationResolver } from './task-estimation.resolver';
import {
	TaskEstimationCreateCommand,
	TaskEstimationDeleteCommand,
	TaskEstimationUpdateCommand
} from './commands';

/**
 * How long one person thinks a task takes, over GraphQL.
 *
 * The delivered `/api/task-estimation` routes serve a list, a paginated spelling of it, a count, one
 * row and five writes. This suite pins that each of them is a root field, that a task's own estimates
 * are the connection narrowed on `taskId` rather than a root field per task, that every field reaches
 * the same service method or command its route reaches, and that the guard chain and the permission
 * are the controller's — read off the controller rather than restated here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TASK = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered reader answers with. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		taskId: TASK,
		employeeId: EMPLOYEE,
		estimate: 1.5,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		taskId: TASK,
		employeeId: EMPLOYEE,
		estimate: 3,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const taskEstimationService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		taskEstimationService,
		commandBus,
		resolver: new TaskEstimationResolver(taskEstimationService as never, commandBus as never)
	};
}

/** The composed schema, as text. */
function composedSchema(): string {
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

	walk(join(__dirname, '..', '..'));

	return documents.join('\n');
}

/** The schema, built once. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The handlers of the estimation controller, inherited ones included. */
function handlersOf(controller: typeof TaskEstimationController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof TaskEstimationController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: typeof TaskEstimationController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = TaskEstimationResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TaskEstimationResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TaskEstimationResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TaskEstimationResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['taskEstimations', 'findAll'],
	['taskEstimation', 'findById'],
	['taskEstimationCount', 'getCount'],
	['createTaskEstimation', 'create'],
	['updateTaskEstimation', 'update'],
	['deleteTaskEstimation', 'delete'],
	['softDeleteTaskEstimation', 'softRemove'],
	['recoverTaskEstimation', 'softRecover']
];

describe('TaskEstimationResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read and every write of the delivered controller', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['taskEstimations', 'taskEstimation', 'taskEstimationCount'])
		);
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTaskEstimation',
				'updateTaskEstimation',
				'deleteTaskEstimation',
				'softDeleteTaskEstimation',
				'recoverTaskEstimation'
			])
		);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type TaskEstimationConnection \{\s*nodes: \[TaskEstimation!\]!\s*edges: \[TaskEstimationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TaskEstimationEdge \{\s*node: TaskEstimation!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TaskEstimationFilter \{/);
		// `taskId` is the narrowing that makes a task's own estimates a filtered list rather than a
		// root field per task.
		expect(printed).toMatch(/input TaskEstimationFilter \{\s*id: IDFilter\s*estimate: NumberFilter\s*employeeId: IDFilter\s*taskId: IDFilter/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/taskEstimations\([^)]*withDeleted/);
		expect(printed).toMatch(/taskEstimationCount: Int\n/);
	});
});

describe('TaskEstimationResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, taskEstimationService } = surfaces();

		const connection = await resolver.taskEstimations(undefined, undefined, undefined, 20);

		expect(taskEstimationService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by task, which is how a task’s own estimates are read', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.taskEstimations({ taskId: { eq: TASK } });
		expect(mine.totalCount).toBe(2);

		const other = await resolver.taskEstimations({ taskId: { eq: 'another-task' } });
		expect(other.totalCount).toBe(0);
	});

	it('orders newest first when the caller states none and by the keys the enum offers', async () => {
		const { resolver } = surfaces();

		expect((await resolver.taskEstimations()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
		expect(
			(await resolver.taskEstimations(undefined, [{ field: 'estimate', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([FIRST, SECOND]);

		const refused = await resolver
			.taskEstimations(undefined, [{ field: 'taskId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);
		expect((refused as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});
});

describe('TaskEstimationResolver — one concept, two protocols, the same operations', () => {
	it('reads one estimate through the same service method the REST route calls', async () => {
		const { resolver, taskEstimationService } = surfaces();

		expect(await resolver.taskEstimation(FIRST)).toBe(ROWS[0]);
		expect(taskEstimationService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for an estimate that is not there', async () => {
		const { resolver, taskEstimationService } = surfaces();
		taskEstimationService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.taskEstimation(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, taskEstimationService } = surfaces();

		expect(await resolver.taskEstimationCount()).toBe(2);
		expect(taskEstimationService.countBy).toHaveBeenCalledWith();
	});

	it('records an estimate through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createTaskEstimation({ organizationId: ORGANIZATION, estimate: 2, employeeId: EMPLOYEE, taskId: TASK });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskEstimationCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			estimate: 2,
			employeeId: EMPLOYEE,
			taskId: TASK
		});
	});

	it('changes an estimate through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTaskEstimation({
			id: FIRST,
			organizationId: ORGANIZATION,
			estimate: 4,
			employeeId: EMPLOYEE,
			taskId: TASK
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskEstimationUpdateCommand);
		expect(command.id).toBe(FIRST);
		// The identifier is the criterion, as it is on the route: it is not repeated in the payload.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			estimate: 4,
			employeeId: EMPLOYEE,
			taskId: TASK
		});
	});

	it('removes an estimate through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteTaskEstimation(FIRST)).toBe(true);
		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(TaskEstimationDeleteCommand);
	});

	it('withdraws and restores an estimate through the same service methods the routes call', async () => {
		const { resolver, taskEstimationService } = surfaces();

		const withdrawn = await resolver.softDeleteTaskEstimation(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(taskEstimationService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverTaskEstimation(FIRST)).toBe(ROWS[0]);
		expect(taskEstimationService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('TaskEstimationResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', TaskEstimationResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(TaskEstimationController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskEstimationResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TaskEstimationController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskEstimationResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(TaskEstimationController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the three write permissions, and the class pair on the routes that state none', () => {
		expect(permissionOfField('createTaskEstimation')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_ADD
		]);
		expect(permissionOfField('updateTaskEstimation')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_EDIT
		]);
		expect(permissionOfField('deleteTaskEstimation')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_DELETE
		]);
		// The list, the one-row query, the count and the two lifecycle routes are inherited from the
		// CRUD base, which states no permission of its own: they run under the class's.
		for (const field of [
			'taskEstimations',
			'taskEstimation',
			'taskEstimationCount',
			'softDeleteTaskEstimation',
			'recoverTaskEstimation'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The gate, over a scripted cache and a scripted feature service. */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (TaskEstimationResolver.prototype as never)[field],
		getClass: () => TaskEstimationResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TaskEstimationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TaskEstimationResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TaskEstimationResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('taskEstimations')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('taskEstimations');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('taskEstimations'))).resolves.toBe(true);
	});
});
