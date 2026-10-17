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
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { SharedEntityController } from './shared-entity.controller';
import { SharedEntityResolver } from './shared-entity.resolver';
import { SharedEntityCreateCommand, SharedEntityUpdateCommand } from './commands';

/**
 * The shared entity over GraphQL.
 *
 * The delivered `/api/shared-entities` routes serve a list, a page, one share, a count, a filing, an
 * edit, a removal, the lifecycle pair and a read by token. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and the list is a connection with the platform's
 *   own cursor codec behind it;
 * - **each write is dispatched as the same command the REST route dispatches**;
 * - the guard chain is the controller's — one guard, no permission — and no field states a permission
 *   the controller does not;
 * - **the token read is a root field of its own typed as `JSON`**, because it answers the share's
 *   target with the share's rules applied rather than a `SharedEntity` row;
 * - that field is not marked `@Public()` although its route is, and the reason is asserted rather than
 *   glossed: a marked field would be refused to every caller by the gate over it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TASK = '00000000-0000-4000-8000-0000000000a0';
const TOKEN = 'k7Qm2fT9pR4sV1xZ';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		token: TOKEN,
		entity: 'Task',
		entityId: TASK,
		shareRules: { fields: ['title', 'description'] },
		sharedOptions: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		token: 'b3Nc8dL0wE6yU5qA',
		entity: 'Invoice',
		entityId: TASK,
		shareRules: { fields: ['number'], relations: { items: { fields: ['name'] } } },
		sharedOptions: { showBranding: true },
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The document the token read answers with: the target, projected through the share's rules. */
const SHARED_DOCUMENT = { title: 'Ship the release', description: 'Cut the tag' };

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const sharedEntityService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getSharedEntityByToken: jest.fn().mockResolvedValue(SHARED_DOCUMENT),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		sharedEntityService,
		commandBus,
		resolver: new SharedEntityResolver(sharedEntityService as never, commandBus as never)
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

/** The printed body of one type, object or input. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof SharedEntityController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof SharedEntityController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof SharedEntityController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = SharedEntityResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['sharedEntities', 'findAll'],
	['sharedEntity', 'findById'],
	['sharedEntityCount', 'getCount'],
	['sharedEntityByToken', 'getSharedEntityByToken'],
	['createSharedEntity', 'create'],
	['updateSharedEntity', 'update'],
	['deleteSharedEntity', 'delete'],
	['softDeleteSharedEntity', 'softRemove'],
	['recoverSharedEntity', 'softRecover']
];

describe('SharedEntityResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the token read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['sharedEntities', 'sharedEntity', 'sharedEntityCount', 'sharedEntityByToken'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createSharedEntity',
				'updateSharedEntity',
				'deleteSharedEntity',
				'softDeleteSharedEntity',
				'recoverSharedEntity'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type SharedEntityConnection \{\s*nodes: \[SharedEntity!\]!\s*edges: \[SharedEntityEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type SharedEntityEdge \{\s*node: SharedEntity!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input SharedEntityFilter \{/);
		expect(printed).toMatch(/enum SharedEntitySortField \{\s*createdAt\s*updatedAt\s*entity\s*\}/);
	});

	it('types the token read as a document, because it answers the target and not the share', () => {
		// The delivered method loads the record the share names and applies the share's rules to it, so
		// the answer's members are the target's and its shape is decided per share.
		expect(printed).toMatch(/sharedEntityByToken\(token: String!\): JSON/);
		expect(printed).not.toMatch(/sharedEntityByToken\([^)]*\): SharedEntity/);
	});

	it('carries the capability, the two rules documents and the polymorphic pair', () => {
		const share = body('SharedEntity', 'type');

		expect(share).toMatch(/token: String!/);
		expect(share).toMatch(/entity: String\b/);
		expect(share).toMatch(/entityId: ID\b/);
		expect(share).toMatch(/shareRules: JSON\b/);
		expect(share).toMatch(/sharedOptions: JSON\b/);
		expect(share).toMatch(/deletedAt: DateTime/);
	});

	it('pins the target and the token out of the edit input, because both are written once', () => {
		const update = body('UpdateSharedEntityInput', 'input');

		expect(update).toMatch(/shareRules: JSON!/);
		expect(update).not.toContain('entity:');
		expect(update).not.toContain('token:');
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/sharedEntityCount\(/);
	});
});

describe('SharedEntityResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, sharedEntityService } = surfaces();

		const connection = await resolver.sharedEntities(undefined, undefined, undefined, 20);

		expect(sharedEntityService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.sharedEntities()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the pair a share addresses its target with', async () => {
		const { resolver } = surfaces();

		expect((await resolver.sharedEntities({ entity: { eq: 'Task' } })).nodes.map((n) => n.id)).toEqual([FIRST]);
		expect((await resolver.sharedEntities({ entityId: { eq: TASK } })).totalCount).toBe(2);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.sharedEntities(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.sharedEntities(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.sharedEntities(undefined, [{ field: 'token', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.sharedEntities({ target: { eq: TASK } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('SharedEntityResolver — one concept, two protocols, the same operations', () => {
	it('reads one share through the same service method the REST route calls', async () => {
		const { resolver, sharedEntityService } = surfaces();

		expect(await resolver.sharedEntity(FIRST)).toBe(ROWS[0]);
		expect(sharedEntityService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a share that is not there', async () => {
		const { resolver, sharedEntityService } = surfaces();
		sharedEntityService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.sharedEntity(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, sharedEntityService } = surfaces();

		expect(await resolver.sharedEntityCount()).toBe(2);
		expect(sharedEntityService.countBy).toHaveBeenCalledWith();
	});

	it('resolves a token through the same service method the REST route calls', async () => {
		const { resolver, sharedEntityService } = surfaces();

		expect(await resolver.sharedEntityByToken(TOKEN)).toBe(SHARED_DOCUMENT);
		expect(sharedEntityService.getSharedEntityByToken).toHaveBeenCalledWith(TOKEN);
	});

	it('lets the token read’s miss through rather than turning it into an empty document', async () => {
		// A token that is not there, one whose share was withdrawn and one whose target has gone are one
		// answer on purpose: telling them apart would confirm which tokens are live.
		const { resolver, sharedEntityService } = surfaces();
		const miss = new NotFoundException('Failed to get shared entity by token: Shared entity not found');

		sharedEntityService.getSharedEntityByToken.mockRejectedValueOnce(miss);

		await expect(resolver.sharedEntityByToken('not-a-token')).rejects.toBe(miss);
	});

	it('creates a share through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createSharedEntity({
			organizationId: ORGANIZATION,
			entity: 'Task',
			entityId: TASK,
			shareRules: { fields: ['title'] }
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(SharedEntityCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			entity: 'Task',
			entityId: TASK,
			shareRules: { fields: ['title'] }
		});
	});

	it('changes a share through the command the REST route dispatches, with the identifier beside it', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateSharedEntity({
			id: FIRST,
			organizationId: ORGANIZATION,
			shareRules: { fields: ['title', 'description'] }
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(SharedEntityUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, shareRules: { fields: ['title', 'description'] } });
	});

	it('removes a share through the same service method the REST route calls', async () => {
		const { resolver, sharedEntityService } = surfaces();

		expect(await resolver.deleteSharedEntity(FIRST)).toBe(true);
		expect(sharedEntityService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a share through the same service methods the REST routes call', async () => {
		const { resolver, sharedEntityService } = surfaces();

		expect((await resolver.softDeleteSharedEntity(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(sharedEntityService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverSharedEntity(FIRST)).toBe(ROWS[0]);
		expect(sharedEntityService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('SharedEntityResolver — the guard stack is the controller’s and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', SharedEntityController)).toEqual(
			expect.arrayContaining([TenantPermissionGuard])
		);
		expect(Reflect.getMetadata('__guards__', SharedEntityResolver)).toEqual(
			expect.arrayContaining([TenantPermissionGuard])
		);
		// The controller states no permission guard, so neither does the resolver.
		expect(Reflect.getMetadata('__guards__', SharedEntityResolver)).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', SharedEntityResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(SharedEntityController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class or on any field, because no route has one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SharedEntityController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SharedEntityResolver)).toBeUndefined();

		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(SharedEntityController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the marker neither endpoint does, and states why rather than shipping a dead field', () => {
		// The token route is `@Public()`. The global authentication guard returns on that marker before
		// it authenticates, so a marked field would run with no user on the request — and the capability
		// gate, which resolves from that context, would then refuse the field to every caller.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(SharedEntityController)['getSharedEntityByToken'])).toBe(
			true
		);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, SharedEntityResolver.prototype.sharedEntityByToken)).toBeUndefined();
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
		getHandler: () => (SharedEntityResolver.prototype as never)[field],
		getClass: () => SharedEntityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('SharedEntityResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, SharedEntityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', SharedEntityResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('sharedEntities')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('sharedEntities');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('sharedEntities'))).resolves.toBe(true);
	});
});
