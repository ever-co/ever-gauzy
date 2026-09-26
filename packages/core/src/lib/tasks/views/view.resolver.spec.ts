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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TaskViewController } from './view.controller';
import { TaskViewResolver } from './view.resolver';
import { TaskViewCreateCommand, TaskViewUpdateCommand } from './commands';

/**
 * The saved task filters over GraphQL.
 *
 * The delivered `/api/task-views` routes serve a list, a paginated spelling of it, a count, one row
 * and five writes — and **not one of them states a permission**, which is the claim this suite pins
 * hardest: a field here that demanded one would refuse a caller every one of those routes serves.
 * The rest is the usual parity: one root field per route, a connection behind the platform's cursor
 * codec, and every field reaching the service method or command its route reaches.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-000000000003';
const MINE = '00000000-0000-4000-8000-000000000010';
const THEIRS = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered reader answers with. */
const ROWS = [
	{
		id: MINE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		name: 'My open work',
		visibilityLevel: 1,
		queryParams: { statuses: ['open'] },
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: THEIRS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Everything due',
		visibilityLevel: 2,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const taskViewService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		taskViewService,
		commandBus,
		resolver: new TaskViewResolver(taskViewService as never, commandBus as never)
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
function handlersOf(controller: typeof TaskViewController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof TaskViewController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: typeof TaskViewController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = TaskViewResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TaskViewResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TaskViewResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TaskViewResolver.prototype as unknown as Record<string, object>)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['taskViews', 'findAll'],
	['taskView', 'findById'],
	['taskViewCount', 'getCount'],
	['createTaskView', 'create'],
	['updateTaskView', 'update'],
	['deleteTaskView', 'delete'],
	['softDeleteTaskView', 'softRemove'],
	['recoverTaskView', 'softRecover']
];

describe('TaskViewResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read and every write of the delivered controller', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['taskViews', 'taskView', 'taskViewCount']));
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTaskView',
				'updateTaskView',
				'deleteTaskView',
				'softDeleteTaskView',
				'recoverTaskView'
			])
		);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type TaskViewConnection \{\s*nodes: \[TaskView!\]!\s*edges: \[TaskViewEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input TaskViewFilter \{/);
		// The three documents are carried as `JSON` and are in neither the filter nor the sort: they
		// are what the delivered reader replays, not columns a caller narrows a list by.
		const filterBody = printed.match(/input TaskViewFilter \{([\s\S]*?)\n\}/)?.[1] ?? '';
		expect(filterBody).not.toContain('queryParams');
		expect(filterBody).not.toContain('filterOptions');
		expect(filterBody).not.toContain('displayOptions');
	});

	it('carries the visibility level as its value rather than as a schema enum', () => {
		const body = printed.match(/type TaskView \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/visibilityLevel: Int/);
		expect(body).toMatch(/queryParams: JSON/);
		expect(body).toMatch(/filterOptions: JSON/);
		expect(body).toMatch(/displayOptions: JSON/);
		expect(body).toMatch(/properties: JSON/);
	});

	it('does not restate the tasks a view selects, which belong to the task resource', () => {
		// The `/api/tasks/view/:id` route is the task controller's, and it is served as `tasksByView`
		// there. A second field here would be a second surface for one reader.
		expect(rootFields('Query')).toContain('tasksByView');
		expect(rootFields('Query')).not.toContain('taskViewTasks');
	});
});

describe('TaskViewResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, taskViewService } = surfaces();

		const connection = await resolver.taskViews(undefined, undefined, undefined, 20);

		expect(taskViewService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(MINE);
	});

	it('narrows by the columns the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.taskViews({ visibilityLevel: { eq: 2 } })).nodes.map((n) => n.id)).toEqual([THEIRS]);
		expect((await resolver.taskViews({ projectId: { isNull: true } })).nodes.map((n) => n.id)).toEqual([
			THEIRS
		]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.taskViews(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([MINE]);

		const second = await resolver.taskViews(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([THEIRS]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});
});

describe('TaskViewResolver — one concept, two protocols, the same operations', () => {
	it('reads one view through the same service method the REST route calls', async () => {
		const { resolver, taskViewService } = surfaces();

		expect(await resolver.taskView(MINE)).toBe(ROWS[0]);
		expect(taskViewService.findOneByIdString).toHaveBeenCalledWith(MINE);
	});

	it('answers null for a view that is not there', async () => {
		const { resolver, taskViewService } = surfaces();
		taskViewService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.taskView(THEIRS)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, taskViewService } = surfaces();

		expect(await resolver.taskViewCount()).toBe(2);
		expect(taskViewService.countBy).toHaveBeenCalledWith();
	});

	it('saves a view through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createTaskView({
			organizationId: ORGANIZATION,
			name: 'My open work',
			visibilityLevel: 1,
			queryParams: { statuses: ['open'] }
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskViewCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'My open work',
			visibilityLevel: 1,
			queryParams: { statuses: ['open'] }
		});
	});

	it('changes a view through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTaskView({ id: MINE, name: 'My work' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskViewUpdateCommand);
		expect(command.id).toBe(MINE);
		expect(command.input).toEqual({ name: 'My work' });
	});

	it('removes a view through the same service method the REST route calls', async () => {
		const { resolver, taskViewService } = surfaces();

		expect(await resolver.deleteTaskView(MINE)).toBe(true);
		expect(taskViewService.delete).toHaveBeenCalledWith(MINE);

		const withdrawn = await resolver.softDeleteTaskView(MINE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(taskViewService.softRemove).toHaveBeenCalledWith(MINE);

		expect(await resolver.recoverTaskView(MINE)).toBe(ROWS[0]);
		expect(taskViewService.softRecover).toHaveBeenCalledWith(MINE);
	});
});

describe('TaskViewResolver — the guard stack is the controller’s and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', TaskViewResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(TaskViewController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states no permission on the class or on any field, because no route states one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskViewResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskViewController)).toBeUndefined();

		for (const [, handler] of ROUTE_OF_FIELD) {
			expect(permissionOfRoute(TaskViewController, handler)).toBeUndefined();
		}
		for (const [field] of ROUTE_OF_FIELD) {
			expect(permissionOfField(field)).toBeUndefined();
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
		getHandler: () => (TaskViewResolver.prototype as never)[field],
		getClass: () => TaskViewResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TaskViewResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TaskViewResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TaskViewResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('taskViews')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('taskViews');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('taskViews'))).resolves.toBe(true);
	});
});
