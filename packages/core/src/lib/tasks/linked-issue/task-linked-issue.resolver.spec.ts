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
import { TaskLinkedIssueController } from './task-linked-issue.controller';
import { TaskLinkedIssueResolver } from './task-linked-issue.resolver';
import { TaskLinkedIssueCreateCommand, TaskLinkedIssueUpdateCommand } from './commands';

/**
 * How one task relates to another, over GraphQL.
 *
 * The delivered `/api/task-linked-issue` routes serve a list, a paginated spelling of it, a count, one
 * row and five writes. This suite pins that each is a root field, that one task's links are the
 * connection narrowed on one end of the relation rather than a root field per task, that every field
 * reaches the same service method or command its route reaches, and that the guard chain and every
 * permission are the controller's — read off the controller rather than restated here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const BLOCKED = '00000000-0000-4000-8000-000000000003';
const BLOCKER = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered reader answers with. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		action: 1,
		taskFromId: BLOCKED,
		taskToId: BLOCKER,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		action: 6,
		taskFromId: BLOCKER,
		taskToId: BLOCKED,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const taskLinkedIssueService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softDelete: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		taskLinkedIssueService,
		commandBus,
		resolver: new TaskLinkedIssueResolver(taskLinkedIssueService as never, commandBus as never)
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

/** The handlers of the controller, inherited ones included. */
function handlersOf(controller: typeof TaskLinkedIssueController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof TaskLinkedIssueController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: typeof TaskLinkedIssueController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = TaskLinkedIssueResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TaskLinkedIssueResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TaskLinkedIssueResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TaskLinkedIssueResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['taskLinkedIssues', 'findAll'],
	['taskLinkedIssue', 'findById'],
	['taskLinkedIssueCount', 'getCount'],
	['createTaskLinkedIssue', 'create'],
	['updateTaskLinkedIssue', 'update'],
	['deleteTaskLinkedIssue', 'delete'],
	['softDeleteTaskLinkedIssue', 'softRemove'],
	['recoverTaskLinkedIssue', 'softRecover']
];

describe('TaskLinkedIssueResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read and every write of the delivered controller', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['taskLinkedIssues', 'taskLinkedIssue', 'taskLinkedIssueCount'])
		);
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTaskLinkedIssue',
				'updateTaskLinkedIssue',
				'deleteTaskLinkedIssue',
				'softDeleteTaskLinkedIssue',
				'recoverTaskLinkedIssue'
			])
		);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type TaskLinkedIssueConnection \{\s*nodes: \[TaskLinkedIssue!\]!\s*edges: \[TaskLinkedIssueEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		// Both ends of the relation are filterable, which is what makes a task's own links a filtered
		// list rather than a root field per task.
		expect(printed).toMatch(
			/input TaskLinkedIssueFilter \{\s*id: IDFilter\s*action: NumberFilter\s*taskFromId: IDFilter\s*taskToId: IDFilter/
		);
	});

	it('carries the direction of the relation as its value rather than as a schema enum', () => {
		const body = printed.match(/type TaskLinkedIssue \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/action: Int!/);
		// The two task relations are not exposed: they are loaded only when a REST caller names them
		// in `relations`, which no read this surface performs does.
		expect(body).not.toMatch(/^\s*taskFrom\s*:/m);
		expect(body).not.toMatch(/^\s*taskTo\s*:/m);
		expect(body).toMatch(/taskFromId: ID!/);
		expect(body).toMatch(/taskToId: ID!/);
	});
});

describe('TaskLinkedIssueResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();

		const connection = await resolver.taskLinkedIssues(undefined, undefined, undefined, 20);

		expect(taskLinkedIssueService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by either end of the relation', async () => {
		const { resolver } = surfaces();

		expect((await resolver.taskLinkedIssues({ taskFromId: { eq: BLOCKED } })).nodes.map((n) => n.id)).toEqual([
			FIRST
		]);
		expect((await resolver.taskLinkedIssues({ taskToId: { eq: BLOCKED } })).nodes.map((n) => n.id)).toEqual([
			SECOND
		]);
		expect((await resolver.taskLinkedIssues({ action: { in: [1, 6] } })).totalCount).toBe(2);
	});

	it('refuses an undeclared filter field and an undeclared sort key', async () => {
		const { resolver } = surfaces();

		const filter = await resolver.taskLinkedIssues({ members: { eq: 'x' } }).catch((thrown) => thrown);
		expect((filter as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		const sort = await resolver
			.taskLinkedIssues(undefined, [{ field: 'taskToId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);
		expect((sort as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});
});

describe('TaskLinkedIssueResolver — one concept, two protocols, the same operations', () => {
	it('reads one link through the same service method the REST route calls', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();

		expect(await resolver.taskLinkedIssue(FIRST)).toBe(ROWS[0]);
		expect(taskLinkedIssueService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a link that is not there', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();
		taskLinkedIssueService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.taskLinkedIssue(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();

		expect(await resolver.taskLinkedIssueCount()).toBe(2);
		expect(taskLinkedIssueService.countBy).toHaveBeenCalledWith();
	});

	it('links two tasks through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createTaskLinkedIssue({
			organizationId: ORGANIZATION,
			action: 1,
			taskFromId: BLOCKED,
			taskToId: BLOCKER
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskLinkedIssueCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			action: 1,
			taskFromId: BLOCKED,
			taskToId: BLOCKER
		});
	});

	it('changes a link through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTaskLinkedIssue({ id: FIRST, organizationId: ORGANIZATION, action: 6 });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskLinkedIssueUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, action: 6 });
	});

	it('removes a link through the service method that writes the removal activity log', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();

		expect(await resolver.deleteTaskLinkedIssue(FIRST)).toBe(true);
		expect(taskLinkedIssueService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a link through the service methods the routes call', async () => {
		const { resolver, taskLinkedIssueService } = surfaces();

		const withdrawn = await resolver.softDeleteTaskLinkedIssue(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		// The soft route calls the service's own `softDelete`, not the inherited `softRemove`: that is
		// the method that writes the removal activity log.
		expect(taskLinkedIssueService.softDelete).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverTaskLinkedIssue(FIRST)).toBe(ROWS[0]);
		expect(taskLinkedIssueService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('TaskLinkedIssueResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', TaskLinkedIssueResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(TaskLinkedIssueController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskLinkedIssueResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TaskLinkedIssueController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskLinkedIssueResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(TaskLinkedIssueController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the route-specific permissions, and the class pair on the routes that state none', () => {
		expect(permissionOfField('taskLinkedIssues')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TASK_VIEW
		]);
		expect(permissionOfField('createTaskLinkedIssue')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_ADD
		]);
		expect(permissionOfField('deleteTaskLinkedIssue')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_DELETE
		]);
		expect(permissionOfField('softDeleteTaskLinkedIssue')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_DELETE
		]);
		// The one-row query, the count and the recovery are inherited from the CRUD base, which states
		// no permission of its own: they run under the class's.
		for (const field of ['taskLinkedIssue', 'taskLinkedIssueCount', 'recoverTaskLinkedIssue']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_TASK_EDIT
			]);
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
		getHandler: () => (TaskLinkedIssueResolver.prototype as never)[field],
		getClass: () => TaskLinkedIssueResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TaskLinkedIssueResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TaskLinkedIssueResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TaskLinkedIssueResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('taskLinkedIssues')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('taskLinkedIssues');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('taskLinkedIssues'))).resolves.toBe(true);
	});
});
