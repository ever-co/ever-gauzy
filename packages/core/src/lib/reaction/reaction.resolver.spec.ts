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
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ReactionController } from './reaction.controller';
import { ReactionResolver } from './reaction.resolver';
import { ReactionCreateCommand, ReactionUpdateCommand } from './commands';

/**
 * The reaction over GraphQL.
 *
 * The delivered REST routes serve a reaction list, one reaction, a count, a filing, an edit, a removal,
 * and the withdrawal and restoration of a reaction. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's — both guards — and no field states a permission**, because
 *   the delivered controller carries no `@Permissions` anywhere;
 * - the enumerated members are carried as their values rather than declared as schema enums, so this
 *   domain does not claim a vocabulary the contract owns;
 * - a reaction that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const MARKED_TASK = '00000000-0000-4000-8000-000000000010';
const MARKED_COMMENT = '00000000-0000-4000-8000-000000000011';
const NEWER_REACTION = '00000000-0000-4000-8000-000000000020';
const OLDER_REACTION = '00000000-0000-4000-8000-000000000021';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them: the
 * store's own, which is what the connection's default order exists to replace.
 */
const ROWS = [
	{
		id: NEWER_REACTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Task',
		entityId: MARKED_TASK,
		emoji: '👍',
		actorType: 'User',
		employeeId: EMPLOYEE,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OLDER_REACTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Comment',
		entityId: MARKED_COMMENT,
		emoji: '🎉',
		actorType: 'User',
		employeeId: EMPLOYEE,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const reactionService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		reactionService,
		commandBus,
		resolver: new ReactionResolver(reactionService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('reaction'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ReactionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ReactionController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ReactionController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ReactionResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain, then whatever the field states. */
function guardsOfField(field: string): unknown[] {
	const fields = ReactionResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', ReactionResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * Which field mirrors which delivered route. Written out once, so the permission comparison and the
 * guard comparison are made over one table rather than two that could drift apart.
 */
const ROUTES: Array<[string, string]> = [
	['reactions', 'findAll'],
	['reaction', 'findById'],
	['reactionCount', 'getCount'],
	['createReaction', 'create'],
	['updateReaction', 'update'],
	['deleteReaction', 'delete'],
	['softDeleteReaction', 'softRemove'],
	['recoverReaction', 'softRecover']
];

describe('ReactionResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['reactions', 'reaction', 'reactionCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createReaction',
				'updateReaction',
				'deleteReaction',
				'softDeleteReaction',
				'recoverReaction'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['reaction', 'reactionCount', 'reactions']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createReaction',
			'deleteReaction',
			'recoverReaction',
			'softDeleteReaction',
			'updateReaction'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ReactionConnection \{\s*nodes: \[Reaction!\]!\s*edges: \[ReactionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ReactionEdge \{\s*node: Reaction!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ReactionFilter \{/);
		expect(printed).toMatch(/input ReactionSort \{/);
		expect(printed).toMatch(
			/enum ReactionSortField \{\s*id\s*entity\s*entityId\s*emoji\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the mark, the identifiers it points at, and not the relation it cannot join', () => {
		const body = typeBody('Reaction');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/entity: String!/);
		expect(body).toMatch(/entityId: ID!/);
		expect(body).toMatch(/emoji: String!/);
		// The actor vocabulary is the kernel's own, carried as its value: a schema enum here would be a
		// third statement of one value set, in the place that can see neither of the other two.
		expect(body).toMatch(/actorType: String/);
		expect(body).not.toMatch(/actorType: String!/);
		// The employee row is not loaded by the read behind this surface — its individual read is handed
		// an empty options DTO — so the reaction carries the identifier and never the object.
		expect(body).toMatch(/employeeId: ID/);
		expect(body).not.toMatch(/\bemployee\s*:/);
		expect(body).not.toMatch(/Employee\b/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// Nothing here is a money amount or a rate, so no member is a number at all — and money, wherever
		// a domain carries it, is the kernel's `Decimal` and never a `Float`.
		expect(body).not.toMatch(/Float|Decimal/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/reactions\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/reactionCount\(/);
	});

	it('states the count as a nullable aggregate with no argument', () => {
		// A count is an aggregate a resource may legitimately have no answer for; a non-null field would
		// turn "not answered" into a fabricated zero.
		expect(printed).toMatch(/reactionCount: Int\n/);
	});
});

describe('ReactionResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, reactionService } = surfaces();

		const connection = await resolver.reactions(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs for a request that states no query string.
		expect(reactionService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(NEWER_REACTION);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.reactions();

		expect(connection.nodes.map((node) => node.id)).toEqual([NEWER_REACTION, OLDER_REACTION]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.reactions({ entity: { eq: 'Task' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([NEWER_REACTION]);

		const byMarkedRow = await resolver.reactions({ entityId: { eq: MARKED_COMMENT } });
		expect(byMarkedRow.nodes.map((node) => node.id)).toEqual([OLDER_REACTION]);

		const byEmoji = await resolver.reactions({ emoji: { eq: '👍' } });
		expect(byEmoji.nodes.map((node) => node.id)).toEqual([NEWER_REACTION]);

		// Every row the delivered read answers is live, which is what the withdrawal column says here.
		expect((await resolver.reactions({ deletedAt: { isNull: true } })).totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.reactions(undefined, [{ field: 'entity', direction: 'ASC' }]);

		expect(byEntity.nodes.map((node) => node.id)).toEqual([OLDER_REACTION, NEWER_REACTION]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.reactions(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([NEWER_REACTION]);

		const second = await resolver.reactions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OLDER_REACTION]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.reactions(undefined, undefined, undefined, 20);

		const last = await resolver.reactions(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([NEWER_REACTION]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `actorType` is filterable and deliberately not sortable, which is the case a reader is most
		// likely to assume the other way round.
		const error = await resolver
			.reactions(undefined, [{ field: 'actorType', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The reacted-to row is not joined by this read, so a condition on it is refused rather than
		// evaluated against a relation no row here carries.
		const error = await resolver.reactions({ task: { eq: MARKED_TASK } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.reactions(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ReactionResolver — one concept, two protocols, the same operations', () => {
	it('reads one reaction through the same service method the REST route calls', async () => {
		const { resolver, reactionService } = surfaces();

		expect(await resolver.reaction(NEWER_REACTION)).toBe(ROWS[0]);
		// The route binds an options DTO out of its query string; an unstated request is the empty one.
		expect(reactionService.findOneByIdString).toHaveBeenCalledWith(NEWER_REACTION, {});
	});

	it('answers null for a reaction that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, reactionService } = surfaces();
		reactionService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.reaction(OLDER_REACTION)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, reactionService } = surfaces();

		expect(await resolver.reactionCount()).toBe(2);
		expect(reactionService.countBy).toHaveBeenCalledWith();
	});

	it('leaves a reaction through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createReaction({
			entity: 'Task',
			entityId: MARKED_TASK,
			emoji: '👍',
			organizationId: ORGANIZATION
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ReactionCreateCommand);
		expect(command.input).toEqual({
			entity: 'Task',
			entityId: MARKED_TASK,
			emoji: '👍',
			organizationId: ORGANIZATION
		});
	});

	it('edits a reaction through the command the REST route dispatches, and answers the row', async () => {
		const { resolver, commandBus, reactionService } = surfaces();

		const answer = await resolver.updateReaction({
			id: NEWER_REACTION,
			emoji: '🎉',
			organizationId: ORGANIZATION
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ReactionUpdateCommand);
		// The identifier is the route's path segment and travels inside the command's payload.
		expect(command.id).toBe(NEWER_REACTION);
		expect(command.input).toEqual({ id: NEWER_REACTION, emoji: '🎉', organizationId: ORGANIZATION });
		// The delivered command answers the store's own result, which is not a row; the field answers
		// the row the write left behind, read back through the same service.
		expect(answer).toBe(ROWS[0]);
		expect(reactionService.findOneByIdString).toHaveBeenCalledWith(NEWER_REACTION, {});
	});

	it('removes a reaction through the same service method the REST route calls', async () => {
		const { resolver, reactionService } = surfaces();

		expect(await resolver.deleteReaction(NEWER_REACTION)).toBe(true);
		expect(reactionService.delete).toHaveBeenCalledWith(NEWER_REACTION);
	});

	it('withdraws and restores a reaction through the same service methods the REST routes call', async () => {
		const { resolver, reactionService } = surfaces();

		const withdrawn = await resolver.softDeleteReaction(NEWER_REACTION);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(reactionService.softRemove).toHaveBeenCalledWith(NEWER_REACTION);

		expect(await resolver.recoverReaction(NEWER_REACTION)).toBe(ROWS[0]);
		expect(reactionService.softRecover).toHaveBeenCalledWith(NEWER_REACTION);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, reactionService } = surfaces();
		const refusal = new Error('REACTION_NOT_FOUND: only the reacting employee may remove this mark.');

		reactionService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteReaction(NEWER_REACTION)).rejects.toBe(refusal);
	});
});

describe('ReactionResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ReactionResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ReactionController) ?? [];

		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every field under the guard chain its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, guardsOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [
				field,
				Array.from(new Set([...guardsOfRoute(ReactionController, handler), FeatureFlagGuard]))
			])
		);

		// The controller's chain plus the gate on the surface itself is the whole of what every field
		// carries, which is the parity claim: a route that added a guard of its own would narrow REST
		// below GraphQL and is caught here.
		expect(stated).toEqual(expected);
	});

	it('states on the class no permission, because the controller states none', () => {
		// `PermissionGuard` serves a request that states no permission, so the guard is a scope decision
		// this resource makes rather than a grant it asks for — and the resolver states neither.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ReactionController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ReactionResolver)).toBeUndefined();
		expect(permissionOfField('reactions')).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(ReactionController, handler)])
		);

		// Every route of this resource resolves to no permission — the controller states none on the
		// class and none on a handler — so every field states none either.
		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((permission) => permission === undefined)).toBe(true);
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
		getHandler: () => (ReactionResolver.prototype as never)[field],
		getClass: () => ReactionResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ReactionResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ReactionResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ReactionResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('reactions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('reactions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('createReaction'))).resolves.toBe(true);
	});
});
