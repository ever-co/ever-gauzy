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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { MentionController } from './mention.controller';
import { MentionModule } from './mention.module';
import { MentionResolver } from './mention.resolver';
import { MentionService } from './mention.service';

/**
 * The mention over GraphQL.
 *
 * The delivered REST routes serve a mention list, one mention, a count, a filing, an edit, a removal,
 * and the withdrawal and restoration of a mention — the nine routes the CRUD base declares, since this
 * controller declares none of its own. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches — including the filing, whose
 *   route is inherited but whose service is this domain's, so the field has to reach the override
 *   that publishes the subscription and raises the notification rather than the base insert;
 * - **the guard chain is the controller's and no field states a permission**, because the delivered
 *   controller states none anywhere and declares no handler of its own;
 * - **neither employee is an object member**, because no read behind this surface joins a relation —
 *   the identifiers the row stores are what this surface carries;
 * - a mention that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const AUTHOR = '00000000-0000-4000-8000-000000000003';
const MENTIONED = '00000000-0000-4000-8000-000000000004';
const COMMENT = '00000000-0000-4000-8000-000000000010';
const TASK = '00000000-0000-4000-8000-000000000011';
const OTHER_COMMENT = '00000000-0000-4000-8000-000000000012';

/**
 * The rows a scripted service answers with, deliberately not in the order the connection means: the
 * delivered list method states no order of its own, so the default sort below is a decision this
 * surface makes and this fixture is what proves it is applied.
 */
const ROWS = [
	{
		id: COMMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		actorType: 'User',
		entity: 'Comment',
		entityId: COMMENT,
		parentEntityId: TASK,
		parentEntityType: 'Task',
		mentionedEmployeeId: MENTIONED,
		employeeId: AUTHOR,
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
		actorType: 'System',
		entity: 'Task',
		entityId: TASK,
		parentEntityId: null,
		parentEntityType: null,
		mentionedEmployeeId: MENTIONED,
		employeeId: AUTHOR,
		isActive: true,
		isArchived: false,
		deletedAt: new Date('2026-04-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_COMMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		actorType: 'User',
		entity: 'Comment',
		entityId: OTHER_COMMENT,
		parentEntityId: TASK,
		parentEntityType: 'Task',
		mentionedEmployeeId: AUTHOR,
		employeeId: MENTIONED,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const mentionService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		mentionService,
		resolver: new MentionResolver(mentionService as never)
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
 * happens to contain the word is not counted as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? /^mention(s|Count)?$/ : /^(create|update|delete|softDelete|recover)Mention$/;

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
function handlersOf(controller: typeof MentionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof MentionController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof MentionController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof MentionResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field states, by the same override rule over the field and the class. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(MentionResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, MentionResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', MentionResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(MentionResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('MentionResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['mentions', 'mention', 'mentionCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createMention',
				'updateMention',
				'deleteMention',
				'softDeleteMention',
				'recoverMention'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares no handler of its own, so its route set is the nine the CRUD base
		// declares and the surface states exactly those: one connection for the two list spellings, one
		// node query, one count, and one mutation per write. It has no sub-route, so there is no filter
		// fold to make and nothing beyond the nine to state.
		expect(ownedRootFields('Query')).toEqual(['mention', 'mentionCount', 'mentions']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createMention',
			'deleteMention',
			'recoverMention',
			'softDeleteMention',
			'updateMention'
		]);

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(typeof handlersOf(MentionController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type MentionConnection \{\s*nodes: \[Mention!\]!\s*edges: \[MentionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type MentionEdge \{\s*node: Mention!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input MentionFilter \{/);
		expect(printed).toMatch(/input MentionSort \{/);
		expect(printed).toMatch(
			/enum MentionSortField \{\s*id\s*entity\s*entityId\s*parentEntityType\s*mentionedEmployeeId\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the row’s own columns and the identifiers of the employees it does not join', () => {
		const body = typeBody('Mention');

		expect(body).toMatch(/entity: String!/);
		expect(body).toMatch(/entityId: ID!/);
		expect(body).toMatch(/mentionedEmployeeId: ID!/);
		expect(body).toMatch(/employeeId: ID\n/);
		expect(body).toMatch(/parentEntityId: ID\n/);
		expect(body).toMatch(/parentEntityType: String\n/);
		// The actor is the contract's own name for who did the mentioning, carried as its value: the
		// vocabulary is shared with every other per-entity row, so it is not declared as an enum here.
		expect(body).toMatch(/actorType: String\n/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// No read behind this surface joins a relation, so an object member here would be absent on every
		// row answered, whichever row was asked about.
		expect(body).not.toMatch(/\n\s*mentionedEmployee\s*:/);
		expect(body).not.toMatch(/\n\s*employee\s*:/);
		expect(body).not.toMatch(/\n\s*organization\s*:/);
		expect(body).not.toMatch(/\n\s*tenant\s*:/);
	});

	it('declares the filter from the row’s own columns, and no relation path', () => {
		const filter = inputBody('MentionFilter');
		const groups = ['and', 'or', 'not'];

		expect(
			(filter.match(/^\s*(\w+)\s*:/gm) ?? [])
				.map((line) => line.trim().replace(/:$/, ''))
				.filter((member) => !groups.includes(member))
		).toEqual([
			'id',
			'actorType',
			'entity',
			'entityId',
			'parentEntityId',
			'parentEntityType',
			'mentionedEmployeeId',
			'employeeId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'deletedAt'
		]);
		expect(filter).toMatch(/entity: StringFilter/);
		expect(filter).toMatch(/mentionedEmployeeId: IDFilter/);
		expect(filter).toMatch(/deletedAt: DateTimeFilter/);
		// A relation path is not a filter member: the read underneath joins nothing, so a condition on a
		// collection that is never loaded could only ever match the empty set.
		expect(filter).not.toMatch(/\n\s*mentionedEmployee\s*:/);
		expect(filter).not.toMatch(/\n\s*employee\s*:/);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/mentionCount: Int\n/);
		expect(printed).not.toMatch(/mentionCount: Int!/);
		expect(fieldArgs('Query', 'mentionCount')).toEqual([]);
		expect(printed).not.toMatch(/mentionCount\(/);

		// `withDeleted` is offered because the delivered list route offers it: `BaseQueryDTO` carries it
		// and that route hands its query string straight to the same read, so a REST caller can ask for
		// withdrawn rows and a connection that could not would hide them. The relations it can join are the
		// ones its REST caller names — which this read never does — so the connection offers no
		// `relations` argument it could not honour.
		expect(printed).toMatch(/mentions\([^)]*withDeleted/);
		expect(printed).not.toMatch(/mentions\([^)]*relations/);
		expect(fieldArgs('Query', 'mentions')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset',
			'withDeleted',
		]);
	});

	it('declares the two write inputs, with the members a filing cannot be stated without', () => {
		const create = inputBody('CreateMentionInput');
		const update = inputBody('UpdateMentionInput');

		expect(printed).toMatch(/input CreateMentionInput \{/);
		expect(printed).toMatch(/input UpdateMentionInput \{/);
		// The entity type, the entity identifier and the mentioned employee are columns the row cannot be
		// written without; the organization is what the subscription and the notification the filing
		// raises are addressed to.
		expect(create).toMatch(/entity: String!/);
		expect(create).toMatch(/entityId: ID!/);
		expect(create).toMatch(/mentionedEmployeeId: ID!/);
		expect(create).toMatch(/organizationId: ID!/);
		expect(create).toMatch(/parentEntityId: ID\n/);
		// The filing titles its notification with the entity's name, so the member is stated there; the
		// delivered update never reads it, so it is not promised on the edit.
		expect(create).toMatch(/entityName: String$/m);
		expect(update).not.toMatch(/\n\s*entityName\s*:/);

		// The edit is a column update: the identifier is the one required member and the rest is left as
		// it is.
		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/entity: String\n/);
		expect(update).toMatch(/mentionedEmployeeId: ID\n/);

		// The tenant and the authoring employee are stamped from the credential on the filing, so neither
		// body promises them.
		expect(create).not.toMatch(/\n\s*tenantId\s*:/);
		expect(create).not.toMatch(/\n\s*employeeId\s*:/);
	});
});

describe('MentionResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, mentionService } = surfaces();

		const connection = await resolver.mentions(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its caller states no query data: no
		// criterion of the caller's and no joined collection, with the tenant applied by the service from
		// the credential.
		expect(mentionService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(TASK);
	});

	it('orders newest first when the caller states none, and totals the order on the identifier', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.mentions();

		// The delivered list method states no order of its own, so the connection's default is a decision
		// this surface makes — newest first, with the identifier as the last key.
		expect(connection.nodes.map((node) => node.id)).toEqual([TASK, COMMENT, OTHER_COMMENT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.mentions({ entity: { eq: 'Comment' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([COMMENT, OTHER_COMMENT]);

		const byMentioned = await resolver.mentions({ mentionedEmployeeId: { eq: MENTIONED } });
		expect(byMentioned.nodes.map((node) => node.id)).toEqual([TASK, COMMENT]);

		const byParent = await resolver.mentions({ parentEntityId: { isNull: true } });
		expect(byParent.nodes.map((node) => node.id)).toEqual([TASK]);

		// The withdrawal column is filterable, so the live rows and the withdrawn ones can be told apart.
		expect((await resolver.mentions({ deletedAt: { isNull: true } })).totalCount).toBe(2);
		expect((await resolver.mentions({ deletedAt: { isNull: false } })).totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.mentions(undefined, [{ field: 'entity', direction: 'ASC' }]);
		expect(byEntity.nodes.map((node) => node.id)).toEqual([COMMENT, OTHER_COMMENT, TASK]);

		const byCreatedAt = await resolver.mentions(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreatedAt.nodes.map((node) => node.id)).toEqual([OTHER_COMMENT, COMMENT, TASK]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.mentions(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([TASK]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = await resolver.mentions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([COMMENT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.mentions(undefined, undefined, undefined, 20);
		const last = await resolver.mentions(undefined, undefined, { last: 1, before: all.edges[2].cursor });

		expect(last.nodes.map((node) => node.id)).toEqual([COMMENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.mentions(undefined, [{ field: 'archivedAt', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.mentions({ mentionedEmployee: { eq: MENTIONED } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.mentions(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('MentionResolver — one concept, two protocols, the same operations', () => {
	it('reads one mention through the same service method the REST route calls', async () => {
		const { resolver, mentionService } = surfaces();

		expect(await resolver.mention(COMMENT)).toBe(ROWS[0]);
		expect(mentionService.findOneByIdString).toHaveBeenCalledWith(COMMENT);
	});

	it('answers null for a mention that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, mentionService } = surfaces();
		mentionService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.mention(TASK)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, mentionService } = surfaces();

		expect(await resolver.mentionCount()).toBe(3);
		expect(mentionService.countBy).toHaveBeenCalledWith();
	});

	it('files a mention through the service’s override, which is the method the inherited route reaches', async () => {
		const { resolver, mentionService } = surfaces();

		await resolver.createMention({
			entity: 'Comment',
			entityId: COMMENT,
			mentionedEmployeeId: MENTIONED,
			organizationId: ORGANIZATION,
			parentEntityId: TASK,
			parentEntityType: 'Task',
			actorType: 'User',
			entityName: 'Fix the build'
		});

		// `MentionService.create` is an override, not the base insert: it publishes the subscription and
		// raises the notification beside the row, so reaching anything else here would file a mention the
		// mentioned employee is never told about.
		expect(mentionService.create).toHaveBeenCalledWith({
			entity: 'Comment',
			entityId: COMMENT,
			mentionedEmployeeId: MENTIONED,
			organizationId: ORGANIZATION,
			parentEntityId: TASK,
			parentEntityType: 'Task',
			actorType: 'User',
			entityName: 'Fix the build'
		});
	});

	it('changes a mention through the same service method the REST route calls', async () => {
		const { resolver, mentionService } = surfaces();

		const updated = await resolver.updateMention({ id: COMMENT, parentEntityId: OTHER_COMMENT });

		expect(mentionService.update).toHaveBeenCalledWith(COMMENT, {
			id: COMMENT,
			parentEntityId: OTHER_COMMENT
		});
		expect(updated).toBe(ROWS[0]);
	});

	it('answers the edit with the row it reads back, because the store’s update answers a result', async () => {
		const { resolver, mentionService } = surfaces();
		// `TenantAwareCrudService.update` answers `{ affected }` — a statement about the write rather than
		// a row — so a field declared as the object type has to read the row back through the read the
		// node query performs; answering the result would hand the caller an object with no identifier on
		// a member the schema promises is there.
		mentionService.update.mockResolvedValueOnce({ affected: 1 });

		const updated = await resolver.updateMention({ id: COMMENT, actorType: 'User' });

		expect(updated).toBe(ROWS[0]);
		expect(mentionService.findOneByIdString).toHaveBeenCalledWith(COMMENT, {});
	});

	it('removes a mention through the same service method the REST route calls', async () => {
		const { resolver, mentionService } = surfaces();

		expect(await resolver.deleteMention(COMMENT)).toBe(true);
		expect(mentionService.delete).toHaveBeenCalledWith(COMMENT);
	});

	it('withdraws and restores a mention through the same service methods the REST routes call', async () => {
		const { resolver, mentionService } = surfaces();

		const withdrawn = await resolver.softDeleteMention(COMMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(mentionService.softRemove).toHaveBeenCalledWith(COMMENT);

		expect(await resolver.recoverMention(COMMENT)).toBe(ROWS[0]);
		expect(mentionService.softRecover).toHaveBeenCalledWith(COMMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, mentionService } = surfaces();
		const refusal = new Error('MENTION_STILL_REFERENCED: a subscription still points at this mention.');

		mentionService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteMention(COMMENT)).rejects.toBe(refusal);
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
	{ field: 'mentions', route: 'findAll' },
	{ field: 'mention', route: 'findById' },
	{ field: 'mentionCount', route: 'getCount' },
	{ field: 'createMention', route: 'create' },
	{ field: 'updateMention', route: 'update' },
	{ field: 'deleteMention', route: 'delete' },
	{ field: 'softDeleteMention', route: 'softRemove' },
	{ field: 'recoverMention', route: 'softRecover' }
];

describe('MentionResolver — the guard stack is the controller’s, and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded, and adds only the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', MentionResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', MentionController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]));
		expect([...resolverGuards].sort()).toEqual([...controllerGuards, FeatureFlagGuard].sort());
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', MentionResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(MentionController, route), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(MentionController)[route]).toBe('function');
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(MentionController, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(MentionController, route));
	});

	it('states no permission on the class or on any field, because the controller states none', () => {
		// The delivered controller carries both guards and no `@Permissions` at all — it declares no
		// handler of its own, so its whole route set is inherited and unpermissioned — and a field that
		// demanded a permission would refuse a caller the REST route serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, MentionController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, MentionResolver)).toBeUndefined();

		for (const { field, route } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(MentionController)[route])).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
			expect(permissionOfRoute(MentionController, route)).toBeUndefined();
			// No field restates a guard of its own either: the class chain is the whole of what every
			// field runs under, beside the gate.
			expect(Reflect.getMetadata('__guards__', fieldsOf(MentionResolver)[field])).toBeUndefined();
		}
	});
});

describe('MentionModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MentionModule) ?? []) as unknown[];

		expect(providers).toContain(MentionResolver);
		expect(providers).toContain(MentionService);
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
		getHandler: () => (MentionResolver.prototype as never)[field],
		getClass: () => MentionResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('MentionResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the ones that state no guard of their own, which is what
		// makes the gate the whole of their scope beside the tenant and permission guards.
		expect(Reflect.getMetadata(FEATURE_METADATA, MentionResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', MentionResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('mentions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('mentions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('mentions'))).resolves.toBe(true);
	});
});
