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
import { CommentController } from './comment.controller';
import { CommentResolver } from './comment.resolver';
import { CommentCreateCommand, CommentUpdateCommand } from './commands';

/**
 * The comment over GraphQL.
 *
 * The delivered REST routes post a comment, edit one, read one, list them, count them, remove one, and
 * withdraw and restore one. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, the list is a
 *   connection with the platform's own cursor codec behind it, and a refusal is the query protocol's
 *   own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **no field states a permission, because no route states one** — the controller carries both guards
 *   and no `@Permissions` at all, and the parity is read back from the controller's own metadata
 *   rather than restated here;
 * - the members the delivered reads answer are what the object type carries, and the relations and the
 *   collections those reads never join are not declared at all;
 * - a comment that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TASK = '00000000-0000-4000-8000-000000000003';
const AUTHOR = '00000000-0000-4000-8000-000000000004';
const RESOLVER = '00000000-0000-4000-8000-000000000005';
const ROOT = '00000000-0000-4000-8000-000000000010';
const REPLY = '00000000-0000-4000-8000-000000000011';
const SIBLING = '00000000-0000-4000-8000-000000000012';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them: the
 * comment that starts the conversation first, then its two replies, the later of the two sharing its
 * instant with nothing else and the last two sharing theirs — which is what makes the identifier the
 * key that decides between them.
 */
const ROWS = [
	{
		id: ROOT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		comment: 'Opening the conversation.',
		actorType: 'User',
		resolved: true,
		resolvedAt: new Date('2026-02-02T10:00:00.000Z'),
		editedAt: null,
		entity: 'Task',
		entityId: TASK,
		parentId: null,
		resolvedByEmployeeId: RESOLVER,
		employeeId: AUTHOR,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-02T10:00:00.000Z'),
		deletedAt: null
	},
	{
		id: REPLY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		comment: 'Answering the opening.',
		actorType: 'User',
		resolved: false,
		resolvedAt: null,
		editedAt: new Date('2026-03-02T10:00:00.000Z'),
		entity: 'Task',
		entityId: TASK,
		parentId: ROOT,
		resolvedByEmployeeId: null,
		employeeId: AUTHOR,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z'),
		deletedAt: null
	},
	{
		id: SIBLING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		comment: 'Answering the opening too.',
		actorType: 'System',
		resolved: false,
		resolvedAt: null,
		editedAt: null,
		entity: 'Task',
		entityId: TASK,
		parentId: ROOT,
		resolvedByEmployeeId: null,
		employeeId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z'),
		deletedAt: null
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const commentService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		commentService,
		commandBus,
		resolver: new CommentResolver(commentService as never, commandBus as never)
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
		.filter((field) => field.toLowerCase().includes('comment'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The member names one printed object type declares, in declaration order.
 *
 * Descriptions are stripped first: a printed field description is indented like a field and may carry
 * a colon of its own, so reading the member list off the raw body would count prose as a member.
 */
function membersOf(name: string): string[] {
	const body = typeBody(name).replace(/"""[\s\S]*?"""/g, '');

	return [...body.matchAll(/^[ \t]*(\w+)[ \t]*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CommentController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CommentController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof CommentController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = CommentResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('CommentResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['comments', 'comment', 'commentCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createComment',
				'updateComment',
				'deleteComment',
				'softDeleteComment',
				'recoverComment'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the
		// two answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['comment', 'commentCount', 'comments']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createComment',
			'deleteComment',
			'recoverComment',
			'softDeleteComment',
			'updateComment'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type CommentConnection \{\s*nodes: \[Comment!\]!\s*edges: \[CommentEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CommentEdge \{\s*node: Comment!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CommentFilter \{/);
		expect(printed).toMatch(/input CommentSort \{/);
		expect(printed).toMatch(
			/enum CommentSortField \{\s*id\s*entity\s*entityId\s*resolved\s*editedAt\s*resolvedAt\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the members the delivered reads answer, and neither the relations nor the collections they never join', () => {
		// The exact list is the assertion: the three relations (`employee`, `resolvedByEmployee` and
		// `parent`) are carried as the identifiers the rows themselves hold, and the three collections
		// (`replies`, `members` and `teams`) are carried nowhere, because the delivered list read names
		// no relation and the one-row read is handed no find options by this surface.
		expect(membersOf('Comment')).toEqual([
			'id',
			'comment',
			'actorType',
			'resolved',
			'resolvedAt',
			'editedAt',
			'entity',
			'entityId',
			'parentId',
			'resolvedByEmployeeId',
			'employeeId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'archivedAt',
			'deletedAt',
			'createdAt',
			'updatedAt'
		]);

		const body = typeBody('Comment');

		// The reply column is what the tree is read by, so it is carried as an identifier.
		expect(body).toMatch(/parentId: ID/);
		// The vocabulary of `actorType` is the kernel's own `ActorTypeEnum`, shared with every other row
		// that records whether a person or the system acted, so the member is carried as its value.
		expect(body).toMatch(/actorType: String/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// `withDeleted` is offered because the delivered list route offers it: `BaseQueryDTO` carries it
		// and that route hands its query string straight to the same read, so a REST caller can ask for
		// withdrawn rows and a connection that could not would hide them.
		expect(printed).toMatch(/comments\([^)]*withDeleted/);
		// The relations a REST caller may name are not a connection argument: this read names none.
		expect(printed).not.toMatch(/comments\([^)]*relations/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/commentCount\(/);
	});
});

describe('CommentResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, commentService } = surfaces();

		const connection = await resolver.comments(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when it is given no query string.
		expect(commentService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SIBLING);
	});

	it('orders newest first when the caller states none, and by the identifier between two comments of one instant', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.comments();

		// The later reply and its sibling share an instant, so the identifier is what orders them — the
		// key that makes the default order total, without which a cursor walk over it would not be.
		expect(connection.nodes.map((node) => node.id)).toEqual([SIBLING, REPLY, ROOT]);
	});

	it('narrows by the fields the filter declares, including the reply column', async () => {
		const { resolver } = surfaces();

		const open = await resolver.comments({ resolved: { eq: false } });
		expect(open.nodes.map((node) => node.id)).toEqual([SIBLING, REPLY]);

		const roots = await resolver.comments({ parentId: { isNull: true } });
		expect(roots.nodes.map((node) => node.id)).toEqual([ROOT]);

		const replies = await resolver.comments({ parentId: { eq: ROOT } });
		expect(replies.nodes.map((node) => node.id)).toEqual([SIBLING, REPLY]);

		const attached = await resolver.comments({ entity: { eq: 'Task' }, entityId: { eq: TASK } });
		expect(attached.totalCount).toBe(3);

		// A comment with no author carries no identifier there, which is what `isNull` states and what an
		// `eq` never matches.
		const authored = await resolver.comments({ employeeId: { isNull: true } });
		expect(authored.nodes.map((node) => node.id)).toEqual([SIBLING]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byId = await resolver.comments(undefined, [{ field: 'id', direction: 'ASC' }]);
		expect(byId.nodes.map((node) => node.id)).toEqual([ROOT, REPLY, SIBLING]);

		// A resolved comment sorts above an open one descending, and the identifier breaks the tie between
		// the two open comments.
		const byResolved = await resolver.comments(undefined, [{ field: 'resolved', direction: 'DESC' }]);
		expect(byResolved.nodes.map((node) => node.id)).toEqual([ROOT, SIBLING, REPLY]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.comments(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SIBLING]);
		expect(CursorCodec.decode(first.pageInfo.endCursor ?? '').id).toBe(SIBLING);

		const second = await resolver.comments(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([REPLY]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `comment` is filterable — a caller narrows by the text — but it is not a key the order is total on.
		const error = await resolver
			.comments(undefined, [{ field: 'comment', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The replies of a comment are a second read of this same connection, not a condition on a
		// collection no read behind it loads.
		const error = await resolver.comments({ replies: { eq: ROOT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.comments(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('CommentResolver — one concept, two protocols, the same operations', () => {
	it('reads one comment through the same service method the REST route calls', async () => {
		const { resolver, commentService } = surfaces();

		expect(await resolver.comment(ROOT)).toBe(ROWS[0]);
		// The route hands the method the find options it bound from its query string; this surface names
		// no relation, so it hands the method the route's own default — an empty option object.
		expect(commentService.findOneByIdString).toHaveBeenCalledWith(ROOT, {});
	});

	it('answers null for a comment that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, commentService } = surfaces();
		commentService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.comment(REPLY)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, commentService } = surfaces();

		expect(await resolver.commentCount()).toBe(3);
		expect(commentService.countBy).toHaveBeenCalledWith();
	});

	it('posts a comment through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			comment: 'Answering the opening.',
			entity: 'Task',
			entityId: TASK,
			organizationId: ORGANIZATION,
			parentId: ROOT,
			mentionEmployeeIds: [AUTHOR]
		};

		await resolver.createComment(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CommentCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('edits a comment through the command the REST route dispatches, with the identifier beside the body', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { id: REPLY, comment: 'Rewritten.' };

		await resolver.updateComment(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CommentUpdateCommand);
		// The route carries the identifier in the path and the body beside it; the command holds the two
		// as separate members, and this is the pair the field dispatches.
		expect(command.id).toBe(REPLY);
		expect(command.input).toEqual(input);
	});

	it('answers the edited row itself, because the handler answers a statement about the write', async () => {
		const { resolver, commentService, commandBus } = surfaces();
		const input = { id: REPLY, comment: 'Rewritten.' };

		// The handler's own answer is the store's update result, which is not a row: a field declared
		// `Comment!` cannot carry it, so the row is read back through the same service the reads call.
		commandBus.execute.mockResolvedValueOnce({ affected: 1 });

		const edited = await resolver.updateComment(input);

		expect(edited).toEqual(ROWS[0]);
		expect(commentService.findOneByIdString).toHaveBeenCalledWith(REPLY, {});
	});

	it('removes a comment through the same service method the REST route calls', async () => {
		const { resolver, commentService } = surfaces();

		expect(await resolver.deleteComment(ROOT)).toBe(true);
		expect(commentService.delete).toHaveBeenCalledWith(ROOT);
	});

	it('withdraws and restores a comment through the same service methods the REST routes call', async () => {
		const { resolver, commentService } = surfaces();

		const withdrawn = await resolver.softDeleteComment(ROOT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(commentService.softRemove).toHaveBeenCalledWith(ROOT);

		expect(await resolver.recoverComment(ROOT)).toBe(ROWS[0]);
		expect(commentService.softRecover).toHaveBeenCalledWith(ROOT);
	});
});

describe('CommentResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', CommentResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', CommentController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', CommentResolver) ?? [];
		// The paginated spelling is in the list although the connection folds it in: the route a field
		// mirrors is not the only route the surface has to be no narrower than.
		const routes = [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(CommentController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CommentController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CommentResolver)).toBeUndefined();
	});

	it('states no permission on any field, because no route runs under one', () => {
		const routes: Array<[string, string]> = [
			['comments', 'findAll'],
			['comment', 'findById'],
			['commentCount', 'getCount'],
			['createComment', 'create'],
			['updateComment', 'update'],
			['deleteComment', 'delete'],
			['softDeleteComment', 'softRemove'],
			['recoverComment', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(CommentController, handler)])
		);

		expect(stated).toEqual(expected);
		// The comparison above is between two objects of `undefined` values while both sides stay
		// undefined, so the absence is asserted directly as well: a permission added to either side
		// would otherwise be the only thing this test could notice.
		expect(Object.values(stated).every((permission) => permission === undefined)).toBe(true);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CommentController)['findAll'])).toBeUndefined();
		expect(permissionOfField('comments')).toBeUndefined();
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
		getHandler: () => (CommentResolver.prototype as never)[field],
		getClass: () => CommentResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CommentResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, CommentResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CommentResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('comments')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('comments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('comments'))).resolves.toBe(true);
	});
});
