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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { IssueTypeController } from './issue-type/issue-type.controller';
import { TaskPriorityController } from './priorities/priority.controller';
import { TaskRelatedIssueTypeController } from './related-issue-type/related-issue-type.controller';
import { TaskSizeController } from './sizes/size.controller';
import { TaskStatusController } from './statuses/status.controller';
import { TaskVersionController } from './versions/version.controller';
import { TaskMetadataResolver } from './task-metadata.resolver';

/**
 * The vocabulary a task points at, over GraphQL.
 *
 * Six resources, six controllers and one resolver. The suite pins what makes that grouping honest
 * rather than convenient:
 *
 * - every one of the six resources' nine delivered routes is a root field of the one composed schema,
 *   and every list is a connection behind the platform's own cursor codec;
 * - every field reaches the same service method its own route reaches, and every write dispatches
 *   through the same one;
 * - **the guard chain and the (absent) permission are each controller's**, read off that controller's
 *   own metadata rather than restated here — and all six carry the same chain, which is the claim the
 *   grouping rests on;
 * - the gate is on the class, so every field is behind it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OPEN = '00000000-0000-4000-8000-000000000010';
const DONE = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered readers answer with. */
const ROWS = [
	{
		id: OPEN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Open',
		value: 'open',
		order: 0,
		color: '#64748b',
		isSystem: false,
		isDefault: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: DONE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Done',
		value: 'done',
		order: 1,
		color: '#16a34a',
		isSystem: false,
		isDefault: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** One scripted vocabulary resource: the six services are structurally the same. */
function resource() {
	return {
		fetchAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		reorder: jest.fn().mockResolvedValue({ success: true, list: [{ id: OPEN, order: 0 }] }),
		markAsDefault: jest.fn().mockResolvedValue([{ ...ROWS[0], isDefault: true }, ROWS[1]])
	};
}

/** The resolver, over six scripted services and a scripted bootstrap service. */
function surfaces() {
	const statuses = resource();
	const sizes = resource();
	const priorities = resource();
	const versions = resource();
	const issueTypes = resource();
	const related = resource();
	const tags = { findTagsByLevel: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }) };
	const bootstrap = {
		bootstrap: jest.fn().mockResolvedValue({
			taskStatuses: { items: ROWS, total: ROWS.length },
			issueTypes: { items: ROWS, total: ROWS.length }
		})
	};

	return {
		statuses,
		sizes,
		priorities,
		versions,
		issueTypes,
		related,
		tags,
		bootstrap,
		resolver: new TaskMetadataResolver(
			statuses as never,
			sizes as never,
			priorities as never,
			versions as never,
			issueTypes as never,
			related as never,
			tags as never,
			bootstrap as never
		)
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

/**
 * The six resources, each with its controller and the field prefix its root fields carry.
 *
 * The prefixes are named here rather than derived because a field name is a contract: renaming one is
 * a schema change, and a suite that derived the name could not tell an intentional rename from a typo.
 */
const RESOURCES = [
	{
		key: 'statuses',
		controller: TaskStatusController,
		noun: 'TaskStatus',
		plural: 'taskStatuses',
		node: 'taskStatus',
		count: 'taskStatusCount',
		create: 'createTaskStatus',
		update: 'updateTaskStatus',
		remove: 'deleteTaskStatus',
		softRemove: 'softDeleteTaskStatus',
		recover: 'recoverTaskStatus'
	},
	{
		key: 'sizes',
		controller: TaskSizeController,
		noun: 'TaskSize',
		plural: 'taskSizes',
		node: 'taskSize',
		count: 'taskSizeCount',
		create: 'createTaskSize',
		update: 'updateTaskSize',
		remove: 'deleteTaskSize',
		softRemove: 'softDeleteTaskSize',
		recover: 'recoverTaskSize'
	},
	{
		key: 'priorities',
		controller: TaskPriorityController,
		noun: 'TaskPriority',
		plural: 'taskPriorities',
		node: 'taskPriority',
		count: 'taskPriorityCount',
		create: 'createTaskPriority',
		update: 'updateTaskPriority',
		remove: 'deleteTaskPriority',
		softRemove: 'softDeleteTaskPriority',
		recover: 'recoverTaskPriority'
	},
	{
		key: 'versions',
		controller: TaskVersionController,
		noun: 'TaskVersion',
		plural: 'taskVersions',
		node: 'taskVersion',
		count: 'taskVersionCount',
		create: 'createTaskVersion',
		update: 'updateTaskVersion',
		remove: 'deleteTaskVersion',
		softRemove: 'softDeleteTaskVersion',
		recover: 'recoverTaskVersion'
	},
	{
		key: 'issueTypes',
		controller: IssueTypeController,
		noun: 'IssueType',
		plural: 'issueTypes',
		node: 'issueType',
		count: 'issueTypeCount',
		create: 'createIssueType',
		update: 'updateIssueType',
		remove: 'deleteIssueType',
		softRemove: 'softDeleteIssueType',
		recover: 'recoverIssueType'
	},
	{
		key: 'related',
		controller: TaskRelatedIssueTypeController,
		noun: 'TaskRelatedIssueType',
		plural: 'taskRelatedIssueTypes',
		node: 'taskRelatedIssueType',
		count: 'taskRelatedIssueTypeCount',
		create: 'createTaskRelatedIssueType',
		update: 'updateTaskRelatedIssueType',
		remove: 'deleteTaskRelatedIssueType',
		softRemove: 'softDeleteTaskRelatedIssueType',
		recover: 'recoverTaskRelatedIssueType'
	}
] as const;

/** The handlers of one controller, inherited ones included. */
function handlersOf(controller: unknown): Record<string, object> {
	return (controller as { prototype: Record<string, object> }).prototype;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: unknown, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: unknown, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = TaskMetadataResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TaskMetadataResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TaskMetadataResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TaskMetadataResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TaskMetadataResolver — the six resources are one shape, and the SDL says so', () => {
	it('declares the nine routes of every one of the six resources', () => {
		const queries = rootFields('Query');
		const mutations = rootFields('Mutation');

		for (const resource of RESOURCES) {
			expect(queries).toEqual(expect.arrayContaining([resource.plural, resource.node, resource.count]));
			expect(mutations).toEqual(
				expect.arrayContaining([
					resource.create,
					resource.update,
					resource.remove,
					resource.softRemove,
					resource.recover
				])
			);
		}
	});

	it('declares the two routes that belong to one resource alone', () => {
		expect(rootFields('Query')).toContain('taskMetadata');
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['reorderTaskStatuses', 'markTaskStatusAsDefault', 'markIssueTypeAsDefault'])
		);
	});

	it('declares a connection, its edges, its filter and its sort for every one of the six', () => {
		for (const resource of RESOURCES) {
			expect(printed).toMatch(new RegExp(`type ${resource.noun}Connection \\{`));
			expect(printed).toMatch(new RegExp(`type ${resource.noun}Edge \\{`));
			expect(printed).toMatch(new RegExp(`input ${resource.noun}Filter \\{`));
			expect(printed).toMatch(new RegExp(`input ${resource.noun}Sort \\{`));
		}
	});

	it('carries the row a vocabulary resource is, and no collection the reader does not load', () => {
		const body = printed.match(/type TaskStatus \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/value: String!/);
		expect(body).toMatch(/isSystem: Boolean/);
		expect(body).toMatch(/projectId: ID/);
		expect(body).toMatch(/organizationTeamId: ID/);
		// The project and the team the row belongs to are loaded only when a REST caller names them
		// in `relations`, which no read this surface performs does.
		expect(body).not.toMatch(/^\s*project\s*:/m);
		expect(body).not.toMatch(/^\s*organizationTeam\s*:/m);
	});

	it('offers no argument it cannot honour', () => {
		for (const resource of RESOURCES) {
			expect(printed).not.toMatch(new RegExp(`${resource.plural}\\([^)]*withDeleted`));
			expect(printed).toMatch(new RegExp(`${resource.count}: Int\\n`));
		}
	});
});

describe('TaskMetadataResolver — the connection contract, six times over', () => {
	it('answers every list with nodes, edges, a total and the boundary cursors', async () => {
		const world = surfaces();

		for (const resource of RESOURCES) {
			const connection = await (world.resolver as never as Record<string, Function>)[resource.plural].call(
				world.resolver,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				20
			);

			expect(connection.nodes).toHaveLength(2);
			expect(connection.totalCount).toBe(2);
			expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
			expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OPEN);
			// One codec behind all six walks, so a cursor obtained on one resumes on the other.
			expect((world as never as Record<string, { fetchAll: jest.Mock }>)[resource.key].fetchAll).toHaveBeenCalled();
		}
	});

	it('scopes every reader by the credential and by the two narrower choices the caller makes', async () => {
		const world = surfaces();
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			await world.resolver.taskStatuses('team-1', 'project-1');

			expect(world.statuses.fetchAll).toHaveBeenCalledWith({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				organizationTeamId: 'team-1',
				projectId: 'project-1'
			});
		} finally {
			tenant.mockRestore();
			organization.mockRestore();
		}
	});

	it('orders newest first when the caller states none, and by the keys the sort enum offers', async () => {
		const world = surfaces();

		const byDefault = await world.resolver.taskStatuses();
		expect(byDefault.nodes.map((node) => node.id)).toEqual([OPEN, DONE]);

		const byOrder = await world.resolver.taskStatuses(undefined, undefined, undefined, [
			{ field: 'order', direction: 'ASC' }
		]);
		expect(byOrder.nodes.map((node) => node.id)).toEqual([OPEN, DONE]);

		const refused = await world.resolver
			.taskStatuses(undefined, undefined, undefined, [{ field: 'counter', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);
		expect((refused as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('narrows by the fields the filter declares, and refuses one it does not', async () => {
		const world = surfaces();

		const byValue = await world.resolver.taskStatuses(undefined, undefined, { value: { eq: 'done' } });
		expect(byValue.nodes.map((node) => node.id)).toEqual([DONE]);

		const ungrouped = await world.resolver.taskStatuses(undefined, undefined, { projectId: { isNull: true } });
		expect(ungrouped.nodes.map((node) => node.id)).toEqual([OPEN, DONE]);

		const refused = await world.resolver
			.taskStatuses(undefined, undefined, { members: { eq: 'x' } })
			.catch((thrown) => thrown);
		expect((refused as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const world = surfaces();
		// The list fields take the two narrower scopes, then `filter`, `sort`, `page`, `first`,
		// `after`, `last`, `before`, `limit` and `offset`, in that order.
		const first = await world.resolver.taskStatuses(undefined, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OPEN]);

		const second = await world.resolver.taskStatuses(undefined, undefined, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([DONE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});
});

describe('TaskMetadataResolver — one concept, two protocols, the same operations', () => {
	it('reads one row of every resource through the same service method its route calls', async () => {
		const world = surfaces();

		for (const resource of RESOURCES) {
			const row = await (world.resolver as never as Record<string, Function>)[resource.node].call(
				world.resolver,
				OPEN
			);

			expect(row).toBe(ROWS[0]);
			expect((world as never as Record<string, { findOneByIdString: jest.Mock }>)[resource.key].findOneByIdString)
				.toHaveBeenCalledWith(OPEN);
		}
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const world = surfaces();
		world.sizes.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await world.resolver.taskSize(DONE)).toBeNull();
	});

	it('counts every resource through the same service method its count route calls', async () => {
		const world = surfaces();

		for (const resource of RESOURCES) {
			const count = await (world.resolver as never as Record<string, Function>)[resource.count].call(
				world.resolver
			);

			expect(count).toBe(2);
			expect((world as never as Record<string, { countBy: jest.Mock }>)[resource.key].countBy).toHaveBeenCalledWith();
		}
	});

	it('files a row of every resource through the same service method its create route calls', async () => {
		const world = surfaces();

		await world.resolver.createTaskStatus({ name: 'Open', value: 'open', template: 'TODO' });
		expect(world.statuses.create).toHaveBeenCalledWith({
			name: 'Open',
			value: 'open',
			template: 'TODO'
		});
		// The template is a member of the delivered body and of no column: the service merges the
		// workflow it names onto the row.
		expect(world.statuses.create.mock.calls[0][0]).toHaveProperty('template');

		await world.resolver.createTaskSize({ name: 'Medium', value: 'medium' });
		expect(world.sizes.create).toHaveBeenCalledWith({ name: 'Medium', value: 'medium' });

		await world.resolver.createTaskPriority({ name: 'High', value: 'high' });
		expect(world.priorities.create).toHaveBeenCalledWith({ name: 'High', value: 'high' });

		await world.resolver.createTaskVersion({ name: '1.0', value: '1.0' });
		expect(world.versions.create).toHaveBeenCalledWith({ name: '1.0', value: '1.0' });

		await world.resolver.createIssueType({ name: 'Bug' });
		expect(world.issueTypes.create).toHaveBeenCalledWith({ name: 'Bug' });

		await world.resolver.createTaskRelatedIssueType({ name: 'Duplicate', value: 'duplicate' });
		expect(world.related.create).toHaveBeenCalledWith({ name: 'Duplicate', value: 'duplicate' });
	});

	it('changes a row of every resource through the same service method its edit route calls, answering the row read back', async () => {
		const world = surfaces();

		expect(await world.resolver.updateTaskStatus({ id: OPEN, name: 'In progress' })).toBe(ROWS[0]);
		expect(world.statuses.update).toHaveBeenCalledWith(OPEN, { name: 'In progress' });

		expect(await world.resolver.updateTaskSize({ id: OPEN, name: 'Large' })).toBe(ROWS[0]);
		expect(world.sizes.update).toHaveBeenCalledWith(OPEN, { name: 'Large' });

		expect(await world.resolver.updateTaskPriority({ id: OPEN, name: 'Urgent' })).toBe(ROWS[0]);
		expect(world.priorities.update).toHaveBeenCalledWith(OPEN, { name: 'Urgent' });

		expect(await world.resolver.updateTaskVersion({ id: OPEN, name: '2.0' })).toBe(ROWS[0]);
		expect(world.versions.update).toHaveBeenCalledWith(OPEN, { name: '2.0' });

		expect(await world.resolver.updateIssueType({ id: OPEN, name: 'Story' })).toBe(ROWS[0]);
		expect(world.issueTypes.update).toHaveBeenCalledWith(OPEN, { name: 'Story' });

		expect(await world.resolver.updateTaskRelatedIssueType({ id: OPEN, name: 'Blocks' })).toBe(ROWS[0]);
		expect(world.related.update).toHaveBeenCalledWith(OPEN, { name: 'Blocks' });
	});

	it('removes, withdraws and restores a row of every resource through the routes’ own methods', async () => {
		const world = surfaces();

		for (const resource of RESOURCES) {
			const service = (world as never as Record<string, Record<string, jest.Mock>>)[resource.key];
			const resolver = world.resolver as never as Record<string, Function>;

			expect(await resolver[resource.remove].call(world.resolver, OPEN)).toBe(true);
			expect(service.delete).toHaveBeenCalledWith(OPEN);

			const withdrawn = await resolver[resource.softRemove].call(world.resolver, OPEN);
			expect(withdrawn.deletedAt).toBeInstanceOf(Date);
			expect(service.softRemove).toHaveBeenCalledWith(OPEN);

			expect(await resolver[resource.recover].call(world.resolver, OPEN)).toBe(ROWS[0]);
			expect(service.softRecover).toHaveBeenCalledWith(OPEN);
		}
	});

	it('reorders and marks defaults through the same service methods those routes call', async () => {
		const world = surfaces();

		const reordered = await world.resolver.reorderTaskStatuses([{ id: OPEN, order: 0 }]);
		expect(reordered.success).toBe(true);
		expect(world.statuses.reorder).toHaveBeenCalledWith([{ id: OPEN, order: 0 }]);

		const statuses = await world.resolver.markTaskStatusAsDefault(OPEN, { organizationId: ORGANIZATION });
		expect(statuses[0].isDefault).toBe(true);
		expect(world.statuses.markAsDefault).toHaveBeenCalledWith(OPEN, { organizationId: ORGANIZATION });

		const issueTypes = await world.resolver.markIssueTypeAsDefault(OPEN, { projectId: 'project-1' });
		expect(issueTypes).toHaveLength(2);
		expect(world.issueTypes.markAsDefault).toHaveBeenCalledWith(OPEN, { projectId: 'project-1' });
	});

	it('answers the vocabulary in one request, through the same service the bootstrap route calls', async () => {
		const world = surfaces();

		const answer = (await world.resolver.taskMetadata(ORGANIZATION, undefined, undefined, [
			'taskStatuses',
			'issueTypes'
		])) as unknown as Record<string, { nodes: unknown[]; totalCount: number }>;

		expect(world.bootstrap.bootstrap).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			organizationTeamId: undefined,
			projectId: undefined,
			include: ['taskStatuses', 'issueTypes']
		});
		// Each section is the connection its own root field answers, so a page walked here resumes
		// on that field.
		expect(answer.taskStatuses.nodes).toHaveLength(2);
		expect(answer.taskStatuses.totalCount).toBe(2);
		expect(answer.issueTypes.nodes).toHaveLength(2);
		// A section the caller did not ask for is absent rather than empty.
		expect(answer.taskSizes).toBeUndefined();
	});
});

describe('TaskMetadataResolver — the guard stack and the permission are the controllers’', () => {
	it('guards the resolver the way every one of the six controllers is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', TaskMetadataResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);

		for (const resource of RESOURCES) {
			expect(Reflect.getMetadata('__guards__', resource.controller)).toEqual([TenantPermissionGuard]);
		}
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const resource of RESOURCES) {
			const pairs: ReadonlyArray<readonly [string, string]> = [
				[resource.plural, 'findAll'],
				[resource.node, 'findById'],
				[resource.count, 'getCount'],
				[resource.create, 'create'],
				[resource.update, 'update'],
				[resource.remove, 'delete'],
				[resource.softRemove, 'softRemove'],
				[resource.recover, 'softRecover']
			];

			for (const [field, handler] of pairs) {
				expect(guardsOfField(field).sort()).toEqual(
					[...guardsOfRoute(resource.controller, handler), FeatureFlagGuard].sort()
				);
			}
		}
	});

	it('states no permission anywhere, because not one of the six controllers states one', () => {
		// The whole grouping claim rests on this: the six controllers carry the tenant guard and
		// nothing else — no class-level permission and no handler-level one — so the six resources
		// have one chain, and a field that demanded a permission would refuse a caller every one of
		// those routes serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskMetadataResolver)).toBeUndefined();

		for (const resource of RESOURCES) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resource.controller)).toBeUndefined();

			for (const handler of ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
				expect(permissionOfRoute(resource.controller, handler)).toBeUndefined();
			}
		}

		for (const field of [
			'taskStatuses',
			'taskStatus',
			'taskStatusCount',
			'createTaskStatus',
			'updateTaskStatus',
			'deleteTaskStatus',
			'softDeleteTaskStatus',
			'recoverTaskStatus',
			'reorderTaskStatuses',
			'markTaskStatusAsDefault',
			'issueTypes',
			'createIssueType',
			'markIssueTypeAsDefault',
			'taskMetadata'
		]) {
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
		getHandler: () => (TaskMetadataResolver.prototype as never)[field],
		getClass: () => TaskMetadataResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TaskMetadataResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TaskMetadataResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TaskMetadataResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('taskStatuses')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('taskStatuses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('taskStatuses'))).resolves.toBe(true);
	});
});
