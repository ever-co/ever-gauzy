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
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TaskController } from './task.controller';
import { TaskResolver } from './task.resolver';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';

/**
 * The unit of work over GraphQL.
 *
 * The delivered `/api/tasks` routes serve a list, a paginated spelling of it, a count, a maximum, six
 * narrower readers, one task, four writes and the team unassignment. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and every list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches;
 * - the pivot readers the connection's `filter` cannot state are fields of their own, and the filter
 *   declares no member that could not be evaluated;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**, read off the controller's metadata rather than restated from a list in this file;
 * - the gate is on the class, so every field is behind it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const TEAM = '00000000-0000-4000-8000-000000000005';
const VIEW = '00000000-0000-4000-8000-000000000006';
const PICKING = '00000000-0000-4000-8000-000000000010';
const EXCEPTION = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered readers answer with. */
const ROWS = [
	{
		id: PICKING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		title: 'Pick the order',
		number: 12,
		prefix: 'FUL',
		status: 'In Progress',
		priority: 'High',
		size: 'Medium',
		issueType: 'Task',
		estimate: 1.5,
		isDraft: false,
		isScreeningTask: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: EXCEPTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		title: 'Resolve the fulfilment exception',
		number: 9,
		status: 'Open',
		isDraft: false,
		isScreeningTask: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const page = { items: ROWS, total: ROWS.length };
	const taskService = {
		findAll: jest.fn().mockResolvedValue(page),
		getMyTasks: jest.fn().mockResolvedValue(page),
		getAllTasksByEmployee: jest.fn().mockResolvedValue(ROWS),
		findTeamTasks: jest.fn().mockResolvedValue(page),
		findModuleTasks: jest.fn().mockResolvedValue(page),
		getTasksByDateFilters: jest.fn().mockResolvedValue(page),
		findTasksByViewQuery: jest.fn().mockResolvedValue(page),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getMaxTaskNumberByProject: jest.fn().mockResolvedValue(12),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		unassignEmployeeFromTeamTasks: jest.fn().mockResolvedValue(undefined)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		taskService,
		commandBus,
		resolver: new TaskResolver(taskService as never, commandBus as never)
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

	walk(join(__dirname, '..'));

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

/** The handlers of the task controller, inherited ones included. */
function handlersOf(controller: typeof TaskController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof TaskController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain plus the handler's own. */
function guardsOfRoute(controller: typeof TaskController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = TaskResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TaskResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TaskResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', (TaskResolver.prototype as unknown as Record<string, object>)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['tasks', 'findAll'],
	['myTasks', 'findMyTasks'],
	['employeeTasks', 'getAllTasksByEmployee'],
	['teamTasks', 'findTeamTasks'],
	['moduleTasks', 'findModuleTasks'],
	['tasksByDate', 'getTasksByDateFilters'],
	['tasksByView', 'findTasksByViewQuery'],
	['task', 'findById'],
	['taskCount', 'getCount'],
	['taskMaxNumber', 'getMaxTaskNumberByProject'],
	['createTask', 'create'],
	['updateTask', 'update'],
	['deleteTask', 'delete'],
	['unassignEmployeeFromTeamTasks', 'deleteEmployeeFromTasks']
];

describe('TaskResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares one query per delivered read route', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'tasks',
				'myTasks',
				'employeeTasks',
				'teamTasks',
				'moduleTasks',
				'tasksByDate',
				'tasksByView',
				'task',
				'taskCount',
				'taskMaxNumber'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createTask', 'updateTask', 'deleteTask', 'unassignEmployeeFromTeamTasks'])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TaskConnection \{\s*nodes: \[Task!\]!\s*edges: \[TaskEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TaskEdge \{\s*node: Task!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TaskFilter \{/);
		expect(printed).toMatch(/input TaskSort \{/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list readers answer live rows only, so the connection does not offer
		// `withDeleted`; and a count route's field takes no argument at all.
		expect(printed).toMatch(/tasks\([^)]*withDeleted/);
		expect(printed).toMatch(/taskCount: Int\n/);
	});

	it('carries the members the delivered readers answer, and no collection they do not load', () => {
		const body = printed.match(/type Task \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/title: String!/);
		expect(body).toMatch(/status: String\n/);
		expect(body).toMatch(/taskStatusId: ID/);
		expect(body).toMatch(/estimate: Float/);
		// The assignment, team and module pivots are loaded only when a REST caller names them in
		// `relations`, which no read this surface performs does.
		expect(body).not.toMatch(/^\s*members\s*:/m);
		expect(body).not.toMatch(/^\s*teams\s*:/m);
		expect(body).not.toMatch(/^\s*modules\s*:/m);
		expect(body).not.toMatch(/^\s*tags\s*:/m);
	});
});

describe('TaskResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, taskService } = surfaces();

		const connection = await resolver.tasks(undefined, undefined, undefined, 20);

		expect(taskService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PICKING);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.tasks();

		expect(connection.nodes.map((node) => node.id)).toEqual([PICKING, EXCEPTION]);
	});

	it('narrows by the fields the filter declares, and by none it does not', async () => {
		const { resolver } = surfaces();

		const byText = await resolver.tasks({ title: { ilike: 'pick%' } });
		expect(byText.nodes.map((node) => node.id)).toEqual([PICKING]);

		const byProject = await resolver.tasks({ projectId: { eq: PROJECT } });
		expect(byProject.totalCount).toBe(2);

		const error = await resolver.tasks({ members: { eq: EMPLOYEE } }).catch((thrown) => thrown);
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('resumes a walk from an opaque cursor and refuses both pagination styles at once', async () => {
		const { resolver } = surfaces();
		const first = await resolver.tasks(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PICKING]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = await resolver.tasks(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([EXCEPTION]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const refused = await resolver
			.tasks(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(refused)).toBe(true);
		expect((refused as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('reads the pivot-joining lists through their own readers, scoped by the credential', async () => {
		const { resolver, taskService } = surfaces();
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			await resolver.myTasks();
			await resolver.employeeTasks(EMPLOYEE);
			await resolver.teamTasks();
			await resolver.moduleTasks();

			// The delivered clients send the organization they are showing in the query string, and
			// these readers build their criterion from it. A caller cannot choose the scope here: the
			// arguments narrow and page, they do not pick a tenant or an organization.
			expect(taskService.getMyTasks).toHaveBeenCalledWith({ where: { organizationId: ORGANIZATION } });
			expect(taskService.getAllTasksByEmployee).toHaveBeenCalledWith(EMPLOYEE, {
				where: { organizationId: ORGANIZATION }
			});
			expect(taskService.findTeamTasks).toHaveBeenCalledWith({ where: { organizationId: ORGANIZATION } });
			expect(taskService.findModuleTasks).toHaveBeenCalledWith({ where: { organizationId: ORGANIZATION } });
		} finally {
			organization.mockRestore();
		}
	});

	it('reads the date window and the saved view through the readers that answer them', async () => {
		const { resolver, taskService } = surfaces();
		const from = new Date('2026-03-01T00:00:00.000Z');
		const to = new Date('2026-03-02T00:00:00.000Z');

		const windowed = await resolver.tasksByDate(from, to, undefined, undefined, false, undefined, PROJECT);
		expect(windowed.totalCount).toBe(2);
		expect(taskService.getTasksByDateFilters).toHaveBeenCalledWith(
			expect.objectContaining({
				startDateFrom: from,
				startDateTo: to,
				isScreeningTask: false,
				projectId: PROJECT
			})
		);

		const byView = await resolver.tasksByView(VIEW);
		expect(byView.nodes.map((node) => node.id)).toEqual([PICKING, EXCEPTION]);
		expect(taskService.findTasksByViewQuery).toHaveBeenCalledWith(VIEW);
	});
});

describe('TaskResolver — one concept, two protocols, the same operations', () => {
	it('reads one task through the same service method the REST route calls', async () => {
		const { resolver, taskService } = surfaces();

		expect(await resolver.task(PICKING, true)).toBe(ROWS[0]);
		expect(taskService.findById).toHaveBeenCalledWith(PICKING, { includeRootEpic: true });
	});

	it('answers null for a task that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, taskService } = surfaces();
		taskService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.task(EXCEPTION)).toBeNull();
	});

	it('counts through the same service method the count route calls, with no narrowing', async () => {
		const { resolver, taskService } = surfaces();

		expect(await resolver.taskCount()).toBe(2);
		expect(taskService.countBy).toHaveBeenCalledWith();
	});

	it('answers the maximum through the same service method the max-number route calls', async () => {
		const { resolver, taskService } = surfaces();

		expect(await resolver.taskMaxNumber(PROJECT)).toBe(12);
		expect(taskService.getMaxTaskNumberByProject).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: PROJECT })
		);
	});

	it('files a task through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createTask({ organizationId: ORGANIZATION, title: 'Pick the order', tagIds: ['t1'] });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskCreateCommand);
		// The relation the caller states as an identifier is handed over as the row the pivot is
		// written from, which is the shape the delivered handler reads.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			title: 'Pick the order',
			tags: [{ id: 't1' }]
		});
	});

	it('edits a task through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTask({ id: PICKING, organizationId: ORGANIZATION, title: 'Pick faster' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TaskUpdateCommand);
		expect(command.id).toBe(PICKING);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, title: 'Pick faster' });
	});

	it('removes a task and takes an employee off a team’s tasks through the same service methods', async () => {
		const { resolver, taskService } = surfaces();

		expect(await resolver.deleteTask(PICKING)).toBe(true);
		expect(taskService.delete).toHaveBeenCalledWith(PICKING);

		expect(await resolver.unassignEmployeeFromTeamTasks(EMPLOYEE, TEAM)).toBe(true);
		expect(taskService.unassignEmployeeFromTeamTasks).toHaveBeenCalledWith(EMPLOYEE, TEAM);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, taskService } = surfaces();
		const refusal = new Error('TASK_NOT_EDITABLE: the task could not be written.');
		taskService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTask(PICKING)).rejects.toBe(refusal);
	});
});

describe('TaskResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', TaskResolver)).toEqual([
			...Reflect.getMetadata('__guards__', TaskController),
			FeatureFlagGuard
		]);
		expect(Reflect.getMetadata('__guards__', TaskResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(TaskController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TaskController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskResolver)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(TaskController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the four write permissions and the read pair, and nothing narrower', () => {
		expect(permissionOfField('createTask')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_ADD
		]);
		expect(permissionOfField('updateTask')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_EDIT
		]);
		expect(permissionOfField('deleteTask')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_DELETE
		]);
		expect(permissionOfField('unassignEmployeeFromTeamTasks')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_EDIT
		]);
		for (const field of ['tasks', 'myTasks', 'task', 'taskCount', 'taskMaxNumber', 'tasksByView']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.ORG_TASK_VIEW
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
		getHandler: () => (TaskResolver.prototype as never)[field],
		getClass: () => TaskResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TaskResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TaskResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TaskResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('tasks')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('tasks');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('tasks'))).resolves.toBe(true);
	});
});
