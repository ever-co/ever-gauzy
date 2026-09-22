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
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EntitySubscriptionController } from './entity-subscription.controller';
import { EntitySubscriptionModule } from './entity-subscription.module';
import { EntitySubscriptionResolver } from './entity-subscription.resolver';
import { EntitySubscriptionService } from './entity-subscription.service';
import { EntitySubscriptionCreateCommand } from './commands';

/**
 * The entity subscription over GraphQL.
 *
 * The delivered REST routes serve a subscription list, one subscription, a count, a subscription
 * through the command bus, an edit, an unsubscribe, and the withdrawal and restoration of a
 * subscription — nine routes, four the controller declares and five it inherits. This suite pins the
 * half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method — or dispatches the same command — that the REST route
 *   reaches, including the subscribe, whose route's whole write is a command;
 * - **the unsubscribe states exactly the three members its route lets a caller state**, because the
 *   service derives the employee and the tenant from the credential and merges them into the same
 *   criterion: an argument this surface invented would aim the removal at somebody else's row;
 * - **the guard chain is the controller's and no field states a permission**, because the delivered
 *   controller states none anywhere — not on its own routes and not on the five it inherits;
 * - **the employee is not an object member**, because no read behind this surface joins a relation —
 *   the identifier the row stores is what this surface carries;
 * - a subscription that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SUBSCRIBER = '00000000-0000-4000-8000-000000000003';
const OTHER_SUBSCRIBER = '00000000-0000-4000-8000-000000000004';
const TASK = '00000000-0000-4000-8000-000000000010';
const PROJECT = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, deliberately not in the order the connection means: the
 * delivered list method states no order of its own, so the default sort below is a decision this
 * surface makes and this fixture is what proves it is applied.
 */
const ROWS = [
	{
		id: PROJECT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Project',
		entityId: PROJECT,
		type: 'manual',
		actorType: 'User',
		employeeId: SUBSCRIBER,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: TASK,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Task',
		entityId: TASK,
		type: 'mention',
		actorType: 'System',
		employeeId: SUBSCRIBER,
		isActive: true,
		isArchived: false,
		deletedAt: new Date('2026-04-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_SUBSCRIBER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Task',
		entityId: PROJECT,
		type: 'assignment',
		actorType: 'User',
		employeeId: OTHER_SUBSCRIBER,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const entitySubscriptionService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		unsubscribe: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		entitySubscriptionService,
		commandBus,
		resolver: new EntitySubscriptionResolver(entitySubscriptionService as never, commandBus as never)
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The match is anchored at both ends rather than a substring search, so another domain's field that
 * happens to contain the same words is not counted as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^entitySubscription(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)EntitySubscription$|^unsubscribeFromEntity$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
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

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EntitySubscriptionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EntitySubscriptionController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EntitySubscriptionController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EntitySubscriptionResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field states, by the same override rule over the field and the class. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EntitySubscriptionResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EntitySubscriptionResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EntitySubscriptionResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EntitySubscriptionResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EntitySubscriptionResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['entitySubscriptions', 'entitySubscription', 'entitySubscriptionCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEntitySubscription',
				'updateEntitySubscription',
				'unsubscribeFromEntity',
				'softDeleteEntitySubscription',
				'recoverEntitySubscription'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once. The rest of the nine routes are the four writes and
		// the count, and no route declares a read of its own that the connection could not answer, so
		// there is no sub-route carrying a root field of its own.
		expect(ownedRootFields('Query')).toEqual([
			'entitySubscription',
			'entitySubscriptionCount',
			'entitySubscriptions'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEntitySubscription',
			'recoverEntitySubscription',
			'softDeleteEntitySubscription',
			'unsubscribeFromEntity',
			'updateEntitySubscription'
		]);

		// Every field above names a handler that exists on the controller, declared or inherited.
		for (const handler of ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(typeof handlersOf(EntitySubscriptionController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EntitySubscriptionConnection \{\s*nodes: \[EntitySubscription!\]!\s*edges: \[EntitySubscriptionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type EntitySubscriptionEdge \{\s*node: EntitySubscription!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input EntitySubscriptionFilter \{/);
		expect(printed).toMatch(/input EntitySubscriptionSort \{/);
		expect(printed).toMatch(
			/enum EntitySubscriptionSortField \{\s*id\s*entity\s*entityId\s*type\s*employeeId\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the row’s own columns, the vocabularies as values, and no joined employee', () => {
		const body = typeBody('EntitySubscription');

		expect(body).toMatch(/entity: String!/);
		expect(body).toMatch(/entityId: ID!/);
		// The subscription kind is the contract's own vocabulary, written by rows this surface does not
		// file, so it is carried as its value rather than declared as a closed enum here.
		expect(body).toMatch(/type: String!/);
		expect(body).toMatch(/actorType: String\n/);
		expect(body).toMatch(/employeeId: ID\n/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// No read behind this surface joins a relation, so an object member here would be absent on every
		// row answered, whichever row was asked about.
		expect(body).not.toMatch(/\n\s*employee\s*:/);
		expect(body).not.toMatch(/\n\s*organization\s*:/);
		expect(body).not.toMatch(/\n\s*tenant\s*:/);
	});

	it('declares the filter from the row’s own columns, and no relation path', () => {
		const filter = inputBody('EntitySubscriptionFilter');
		const groups = ['and', 'or', 'not'];

		expect(
			(filter.match(/^\s*(\w+)\s*:/gm) ?? [])
				.map((line) => line.trim().replace(/:$/, ''))
				.filter((member) => !groups.includes(member))
		).toEqual([
			'id',
			'entity',
			'entityId',
			'type',
			'actorType',
			'employeeId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'deletedAt'
		]);
		expect(filter).toMatch(/type: StringFilter/);
		expect(filter).toMatch(/employeeId: IDFilter/);
		// A relation path is not a filter member: the read underneath joins nothing, so a condition on a
		// collection that is never loaded could only ever match the empty set.
		expect(filter).not.toMatch(/\n\s*employee\s*:/);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/entitySubscriptionCount: Int\n/);
		expect(printed).not.toMatch(/entitySubscriptionCount: Int!/);
		expect(fieldArgs('Query', 'entitySubscriptionCount')).toEqual([]);
		expect(printed).not.toMatch(/entitySubscriptionCount\(/);

		// The delivered list method reads live rows only, and the relations it can join are the ones its
		// REST caller names — which this read never does, so the connection offers neither `withDeleted`
		// nor a `relations` argument it could not honour.
		expect(printed).toMatch(/entitySubscriptions\([^)]*withDeleted/);
		expect(printed).not.toMatch(/entitySubscriptions\([^)]*relations/);
		expect(fieldArgs('Query', 'entitySubscriptions')).toEqual([
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

	it('states the three members the unsubscribe route lets a caller state, and no more', () => {
		// The route binds `entity`, `entityId` and `organizationId` out of its query string; the service
		// derives the employee and the tenant from the credential and merges them into the same criterion.
		// An `employeeId` or a `tenantId` argument here would let a caller aim the removal at another
		// caller's subscription, which the delivered route does not allow.
		expect(fieldArgs('Mutation', 'unsubscribeFromEntity')).toEqual([
			'id',
			'entity',
			'entityId',
			'organizationId'
		]);
		expect(printed).toMatch(/unsubscribeFromEntity\(id: ID!, entity: String, entityId: ID, organizationId: ID\)/);
	});

	it('declares the two write inputs from the delivered create DTO and the inherited edit', () => {
		const create = inputBody('CreateEntitySubscriptionInput');
		const update = inputBody('UpdateEntitySubscriptionInput');

		expect(printed).toMatch(/input CreateEntitySubscriptionInput \{/);
		expect(printed).toMatch(/input UpdateEntitySubscriptionInput \{/);
		// The record being watched and the kind of subscription are what the row cannot be written
		// without; the organization is the member the delivered DTO states beside them.
		expect(create).toMatch(/type: String!/);
		expect(create).toMatch(/entity: String!/);
		expect(create).toMatch(/entityId: ID!/);
		expect(create).toMatch(/organizationId: ID\n/);
		expect(create).toMatch(/actorType: String$/m);
		// The tenant and the employee are stamped from the credential on every write here.
		expect(create).not.toMatch(/\n\s*tenantId\s*:/);
		expect(create).not.toMatch(/\n\s*employeeId\s*:/);

		// The edit is a column update: the identifier is the one required member and the rest is left as
		// it is.
		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/type: String\n/);
		expect(update).toMatch(/entityId: ID\n/);
	});
});

describe('EntitySubscriptionResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		const connection = await resolver.entitySubscriptions(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its caller states no query data: no
		// criterion of the caller's and no joined collection, with the tenant applied by the service from
		// the credential.
		expect(entitySubscriptionService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(TASK);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.entitySubscriptions();

		// The delivered list method states no order of its own, so the connection's default is a decision
		// this surface makes — newest first, with the identifier as the last key.
		expect(connection.nodes.map((node) => node.id)).toEqual([TASK, PROJECT, OTHER_SUBSCRIBER]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.entitySubscriptions({ entity: { eq: 'Task' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([TASK, OTHER_SUBSCRIBER]);

		const byKind = await resolver.entitySubscriptions({ type: { eq: 'mention' } });
		expect(byKind.nodes.map((node) => node.id)).toEqual([TASK]);

		const bySubscriber = await resolver.entitySubscriptions({ employeeId: { eq: SUBSCRIBER } });
		expect(bySubscriber.nodes.map((node) => node.id)).toEqual([TASK, PROJECT]);

		// The withdrawal column is filterable, so the live rows and the withdrawn ones can be told apart.
		expect((await resolver.entitySubscriptions({ deletedAt: { isNull: true } })).totalCount).toBe(2);
		expect((await resolver.entitySubscriptions({ deletedAt: { isNull: false } })).totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.entitySubscriptions(undefined, [{ field: 'entity', direction: 'ASC' }]);
		// The two subscriptions to the same kind of record are tied on the key the caller stated, so the
		// identifier decides between them — ascending, because the stated direction is ascending.
		expect(byEntity.nodes.map((node) => node.id)).toEqual([PROJECT, OTHER_SUBSCRIBER, TASK]);

		const byCreatedAt = await resolver.entitySubscriptions(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreatedAt.nodes.map((node) => node.id)).toEqual([OTHER_SUBSCRIBER, PROJECT, TASK]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.entitySubscriptions(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([TASK]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = await resolver.entitySubscriptions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([PROJECT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.entitySubscriptions(undefined, undefined, undefined, 20);
		const last = await resolver.entitySubscriptions(undefined, undefined, {
			last: 1,
			before: all.edges[2].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PROJECT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.entitySubscriptions(undefined, [{ field: 'archivedAt', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.entitySubscriptions({ employee: { eq: SUBSCRIBER } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.entitySubscriptions(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EntitySubscriptionResolver — one concept, two protocols, the same operations', () => {
	it('reads one subscription through the same service method the REST route calls', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		expect(await resolver.entitySubscription(PROJECT)).toBe(ROWS[0]);
		expect(entitySubscriptionService.findOneByIdString).toHaveBeenCalledWith(PROJECT, {});
	});

	it('answers null for a subscription that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, entitySubscriptionService } = surfaces();
		entitySubscriptionService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.entitySubscription(TASK)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		expect(await resolver.entitySubscriptionCount()).toBe(3);
		expect(entitySubscriptionService.countBy).toHaveBeenCalledWith();
	});

	it('subscribes through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createEntitySubscription({
			type: 'manual',
			entity: 'Task',
			entityId: TASK,
			organizationId: ORGANIZATION,
			actorType: 'User'
		});

		// The route's whole write is the command, and its handler is what answers an existing
		// subscription rather than filing a second one, so the field dispatches the same command with the
		// same payload instead of calling the service beside it.
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EntitySubscriptionCreateCommand);
		expect(command.input).toEqual({
			type: 'manual',
			entity: 'Task',
			entityId: TASK,
			organizationId: ORGANIZATION,
			actorType: 'User'
		});
	});

	it('changes a subscription through the same service method the REST route calls', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		const updated = await resolver.updateEntitySubscription({ id: PROJECT, type: 'comment' });

		expect(entitySubscriptionService.update).toHaveBeenCalledWith(PROJECT, {
			id: PROJECT,
			type: 'comment'
		});
		expect(updated).toBe(ROWS[0]);
	});

	it('answers the edit with the row it reads back, because the store’s update answers a result', async () => {
		const { resolver, entitySubscriptionService } = surfaces();
		// `TenantAwareCrudService.update` answers `{ affected }` — a statement about the write rather than
		// a row — so a field declared as the object type has to read the row back through the read the
		// node query performs; answering the result would hand the caller an object with no identifier on
		// a member the schema promises is there.
		entitySubscriptionService.update.mockResolvedValueOnce({ affected: 1 });

		const updated = await resolver.updateEntitySubscription({ id: PROJECT, actorType: 'User' });

		expect(updated).toBe(ROWS[0]);
		expect(entitySubscriptionService.findOneByIdString).toHaveBeenCalledWith(PROJECT, {});
	});

	it('unsubscribes through the same service method the REST route calls, with the route’s own criterion', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		expect(await resolver.unsubscribeFromEntity(TASK, 'Task', TASK, ORGANIZATION)).toBe(true);
		// The three members the route binds are the three the field passes; the employee and the tenant
		// the service deletes on are derived there, from the credential.
		expect(entitySubscriptionService.unsubscribe).toHaveBeenCalledWith(TASK, {
			entity: 'Task',
			entityId: TASK,
			organizationId: ORGANIZATION
		});
	});

	it('passes an unstated member through as it stands rather than inventing one', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		await resolver.unsubscribeFromEntity(TASK);

		// The route lets a caller state none of the three as well: the criterion is then what the path
		// identifier and the credential alone say, and this surface does not narrow it further.
		expect(entitySubscriptionService.unsubscribe).toHaveBeenCalledWith(TASK, {
			entity: undefined,
			entityId: undefined,
			organizationId: undefined
		});
	});

	it('withdraws and restores a subscription through the same service methods the REST routes call', async () => {
		const { resolver, entitySubscriptionService } = surfaces();

		const withdrawn = await resolver.softDeleteEntitySubscription(PROJECT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(entitySubscriptionService.softRemove).toHaveBeenCalledWith(PROJECT);

		expect(await resolver.recoverEntitySubscription(PROJECT)).toBe(ROWS[0]);
		expect(entitySubscriptionService.softRecover).toHaveBeenCalledWith(PROJECT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, entitySubscriptionService } = surfaces();
		const refusal = new Error('ENTITY_SUBSCRIPTION_SHARED: another employee still watches this record.');

		entitySubscriptionService.unsubscribe.mockRejectedValueOnce(refusal);

		await expect(resolver.unsubscribeFromEntity(PROJECT)).rejects.toBe(refusal);
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
	{ field: 'entitySubscriptions', route: 'findAll' },
	{ field: 'entitySubscription', route: 'findById' },
	{ field: 'entitySubscriptionCount', route: 'getCount' },
	{ field: 'createEntitySubscription', route: 'create' },
	{ field: 'updateEntitySubscription', route: 'update' },
	{ field: 'unsubscribeFromEntity', route: 'delete' },
	{ field: 'softDeleteEntitySubscription', route: 'softRemove' },
	{ field: 'recoverEntitySubscription', route: 'softRecover' }
];

describe('EntitySubscriptionResolver — the guard stack is the controller’s, and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded, and adds only the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EntitySubscriptionResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EntitySubscriptionController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect([...resolverGuards].sort()).toEqual([...controllerGuards, FeatureFlagGuard].sort());
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EntitySubscriptionResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(EntitySubscriptionController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EntitySubscriptionController)[route]).toBe('function');
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EntitySubscriptionController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EntitySubscriptionController, route));
	});

	it('states no permission on the class or on any field, because the controller states none', () => {
		// The delivered controller carries both guards and no `@Permissions` at all — not on the four
		// routes it declares and not on the five it inherits — and a field that demanded a permission
		// would refuse a caller the REST route serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EntitySubscriptionController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EntitySubscriptionResolver)).toBeUndefined();

		for (const { field, route } of ROUTE_PARITY) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EntitySubscriptionController)[route])
			).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
			expect(permissionOfRoute(EntitySubscriptionController, route)).toBeUndefined();
			// No field restates a guard of its own either: the class chain is the whole of what every
			// field runs under, beside the gate.
			expect(Reflect.getMetadata('__guards__', fieldsOf(EntitySubscriptionResolver)[field])).toBeUndefined();
		}
	});
});

describe('EntitySubscriptionModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EntitySubscriptionModule) ??
			[]) as unknown[];

		expect(providers).toContain(EntitySubscriptionResolver);
		expect(providers).toContain(EntitySubscriptionService);
	});

	it('hands the command bus on, because the resolver dispatches a command', () => {
		// The resolver is declared by the module that owns the service it calls, and the module the Apollo
		// configuration names hosts it: a provider is private until the module that declares it exports
		// it, so a module that imports this one reaches the command bus only through this entry.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EntitySubscriptionModule) ??
			[]) as unknown[];

		expect(exported).toContain(CqrsModule);
		expect(exported).toContain(EntitySubscriptionService);
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
		getHandler: () => (EntitySubscriptionResolver.prototype as never)[field],
		getClass: () => EntitySubscriptionResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EntitySubscriptionResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the ones that state no guard of their own, which is what
		// makes the gate the whole of their scope beside the tenant and permission guards.
		expect(Reflect.getMetadata(FEATURE_METADATA, EntitySubscriptionResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EntitySubscriptionResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('entitySubscriptions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('entitySubscriptions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('entitySubscriptions'))).resolves.toBe(true);
	});
});
