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
import { ScreeningTaskStatusEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { ScreeningTasksController } from './screening-tasks.controller';
import { ScreeningTaskResolver } from './screening-task.resolver';
import { ScreeningTaskCreateCommand, ScreeningTaskUpdateCommand } from './commands';

/**
 * The decision a task goes through before it becomes work, over GraphQL.
 *
 * The delivered `/api/screening-tasks` routes serve a list, a paginated spelling of it, a count, one
 * row and five writes. This suite pins that each is a root field, that every field reaches the same
 * service method or command its route reaches, that the guard chain is the controller's — and that
 * **the controller's empty permission statement is mirrored rather than dropped**: it states
 * `@Permissions()` with nothing in it, which is an empty set rather than an absent one, and the
 * resolver states the same.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TASK = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered reader answers with. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		taskId: TASK,
		status: ScreeningTaskStatusEnum.PENDING,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		taskId: TASK,
		status: ScreeningTaskStatusEnum.SNOOZED,
		onHoldUntil: new Date('2026-03-08T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const screeningTasksService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		screeningTasksService,
		commandBus,
		resolver: new ScreeningTaskResolver(screeningTasksService as never, commandBus as never)
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
function handlersOf(controller: typeof ScreeningTasksController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof ScreeningTasksController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: typeof ScreeningTasksController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = ScreeningTaskResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ScreeningTaskResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', ScreeningTaskResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (ScreeningTaskResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['screeningTasks', 'findAll'],
	['screeningTask', 'findById'],
	['screeningTaskCount', 'getCount'],
	['createScreeningTask', 'create'],
	['updateScreeningTask', 'update'],
	['deleteScreeningTask', 'delete'],
	['softDeleteScreeningTask', 'softRemove'],
	['recoverScreeningTask', 'softRecover']
];

describe('ScreeningTaskResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read and every write of the delivered controller', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['screeningTasks', 'screeningTask', 'screeningTaskCount'])
		);
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createScreeningTask',
				'updateScreeningTask',
				'deleteScreeningTask',
				'softDeleteScreeningTask',
				'recoverScreeningTask'
			])
		);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type ScreeningTaskConnection \{\s*nodes: \[ScreeningTask!\]!\s*edges: \[ScreeningTaskEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input ScreeningTaskFilter \{/);
		expect(printed).toMatch(/input ScreeningTaskSort \{/);
	});

	it('carries the decision and the row it is about, and not the task the reader does not load', () => {
		const body = printed.match(/type ScreeningTask \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/onHoldUntil: DateTime/);
		expect(body).toMatch(/taskId: ID!/);
		// The task is loaded only when a REST caller names the relation, which no read here does.
		expect(body).not.toMatch(/^\s*task\s*:/m);
	});

	it('declares the create input as the whole task body the delivered write files', () => {
		const body = printed.match(/input CreateScreeningTaskInput \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/task: CreateTaskInput!/);
		expect(body).toMatch(/taskId: ID!/);
		expect(body).toMatch(/mentionEmployeeIds: \[ID!\]/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/screeningTasks\([^)]*withDeleted/);
		expect(printed).toMatch(/screeningTaskCount: Int\n/);
	});
});

describe('ScreeningTaskResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, screeningTasksService } = surfaces();

		const connection = await resolver.screeningTasks(undefined, undefined, undefined, 20);

		expect(screeningTasksService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the decision and by the task it is about', async () => {
		const { resolver } = surfaces();

		expect((await resolver.screeningTasks({ status: { eq: 'snoozed' } })).nodes.map((n) => n.id)).toEqual([
			SECOND
		]);
		expect((await resolver.screeningTasks({ taskId: { eq: TASK } })).totalCount).toBe(2);
		expect((await resolver.screeningTasks({ onHoldUntil: { isNull: false } })).totalCount).toBe(1);
	});

	it('orders newest first when the caller states none and by the keys the enum offers', async () => {
		const { resolver } = surfaces();

		expect((await resolver.screeningTasks()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
		expect(
			(await resolver.screeningTasks(undefined, [{ field: 'status', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([FIRST, SECOND]);
	});
});

describe('ScreeningTaskResolver — one concept, two protocols, the same operations', () => {
	it('reads one decision through the same service method the REST route calls', async () => {
		const { resolver, screeningTasksService } = surfaces();

		expect(await resolver.screeningTask(FIRST)).toBe(ROWS[0]);
		expect(screeningTasksService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a decision that is not there', async () => {
		const { resolver, screeningTasksService } = surfaces();
		screeningTasksService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.screeningTask(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, screeningTasksService } = surfaces();

		expect(await resolver.screeningTaskCount()).toBe(2);
		expect(screeningTasksService.countBy).toHaveBeenCalledWith();
	});

	it('puts a task up for screening through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const task = { organizationId: ORGANIZATION, title: 'Screen this job' };

		await resolver.createScreeningTask({
			organizationId: ORGANIZATION,
			task,
			taskId: TASK,
			mentionEmployeeIds: ['e1']
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ScreeningTaskCreateCommand);
		// The task is a whole body, not an identifier: the delivered handler files it before it
		// writes the decision.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			task,
			taskId: TASK,
			mentionEmployeeIds: ['e1']
		});
	});

	it('records where a decision stands through the same command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateScreeningTask({
			id: FIRST,
			organizationId: ORGANIZATION,
			status: ScreeningTaskStatusEnum.ACCEPTED
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ScreeningTaskUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, status: ScreeningTaskStatusEnum.ACCEPTED });
	});

	it('removes, withdraws and restores a decision through the routes’ own methods', async () => {
		const { resolver, screeningTasksService } = surfaces();

		expect(await resolver.deleteScreeningTask(FIRST)).toBe(true);
		expect(screeningTasksService.delete).toHaveBeenCalledWith(FIRST);

		const withdrawn = await resolver.softDeleteScreeningTask(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(screeningTasksService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverScreeningTask(FIRST)).toBe(ROWS[0]);
		expect(screeningTasksService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('ScreeningTaskResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', ScreeningTaskResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(ScreeningTasksController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states the controller’s empty permission statement, which is a set and not an absence', () => {
		// `@Permissions()` with nothing in it is an empty set: the guard is in the chain and has
		// nothing to check. Dropping the statement here would make the resolver's class metadata
		// `undefined` where the controller's is `[]`, which is a different claim about the chain.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ScreeningTasksController)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ScreeningTaskResolver)).toEqual([]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(ScreeningTasksController, handler)])
		);

		expect(stated).toEqual(expected);
		for (const [field] of ROUTE_OF_FIELD) {
			expect(permissionOfField(field)).toEqual([]);
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
		getHandler: () => (ScreeningTaskResolver.prototype as never)[field],
		getClass: () => ScreeningTaskResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ScreeningTaskResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ScreeningTaskResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ScreeningTaskResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('screeningTasks')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('screeningTasks');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('screeningTasks'))).resolves.toBe(true);
	});
});
