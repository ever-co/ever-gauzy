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
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TagTypeController } from './tag-type.controller';
import { TagTypeResolver } from './tag-type.resolver';

/**
 * The tag type domain over GraphQL.
 *
 * The delivered REST routes serve a group list, one group, a count, a declaration, a change, a
 * removal, and the withdrawal and restoration of a group. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**: the list, the count and the two writes carry what their routes carry, and the node query
 *   and the three inherited lifecycle routes carry none, because the controller states none on the
 *   class and none on them;
 * - the members the delivered reader answers are what the object type carries, and the reverse
 *   collection it never loads is not declared at all;
 * - a group that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CATEGORY = '00000000-0000-4000-8000-000000000010';
const PRIORITY = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered list method answers with. */
const ROWS = [
	{
		id: CATEGORY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		type: 'Category',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: PRIORITY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		type: 'Priority',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const tagTypeService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { tagTypeService, resolver: new TagTypeResolver(tagTypeService as never) };
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
		.filter((field) => field.toLowerCase().includes('tagtype'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof TagTypeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TagTypeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TagTypeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = TagTypeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under, which are the class's chain plus whatever it restates. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TagTypeResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TagTypeResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['tagTypes', 'findAll'],
	['tagType', 'findById'],
	['tagTypeCount', 'getCount'],
	['createTagType', 'create'],
	['updateTagType', 'update'],
	['deleteTagType', 'delete'],
	['softDeleteTagType', 'softRemove'],
	['recoverTagType', 'softRecover']
];

describe('TagTypeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['tagTypes', 'tagType', 'tagTypeCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createTagType',
				'updateTagType',
				'deleteTagType',
				'softDeleteTagType',
				'recoverTagType'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination`, the latter inherited —
		// and the two answer one question, so the surface states it once: a second root field for the
		// paginated spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['tagType', 'tagTypeCount', 'tagTypes']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createTagType',
			'deleteTagType',
			'recoverTagType',
			'softDeleteTagType',
			'updateTagType'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TagTypeConnection \{\s*nodes: \[TagType!\]!\s*edges: \[TagTypeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TagTypeEdge \{\s*node: TagType!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TagTypeFilter \{/);
		expect(printed).toMatch(/input TagTypeSort \{/);
		expect(printed).toMatch(/enum TagTypeSortField \{\s*createdAt\s*updatedAt\s*type\s*\}/);
	});

	it('carries the members the delivered reader answers, and not the reverse collection', () => {
		const body = typeBody('TagType');

		expect(body).toMatch(/type: String!/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The reverse side is loaded only when a REST caller names it in `relations`, which no read this
		// surface performs does, and it is not a column the write stores either: a tag is grouped by
		// writing the tag's own `tagTypeId`.
		expect(body).not.toMatch(/^\s*tags\s*:/m);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered reader answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/tagTypes\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/tagTypeCount\(/);
	});
});

describe('TagTypeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, tagTypeService } = surfaces();

		const connection = await resolver.tagTypes(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: this surface
		// binds no query string, so the read is made with no options.
		expect(tagTypeService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CATEGORY);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.tagTypes();

		expect(connection.nodes.map((node) => node.id)).toEqual([CATEGORY, PRIORITY]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.tagTypes({ type: { eq: 'Priority' } });
		expect(byType.nodes.map((node) => node.id)).toEqual([PRIORITY]);

		const byPrefix = await resolver.tagTypes({ type: { ilike: 'cat%' } });
		expect(byPrefix.nodes.map((node) => node.id)).toEqual([CATEGORY]);

		const byInstant = await resolver.tagTypes({ createdAt: { gte: '2026-02-15T00:00:00.000Z' } });
		expect(byInstant.nodes.map((node) => node.id)).toEqual([CATEGORY]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.tagTypes(undefined, [{ field: 'type', direction: 'ASC' }]);
		expect(byType.nodes.map((node) => node.id)).toEqual([CATEGORY, PRIORITY]);

		const byTypeDescending = await resolver.tagTypes(undefined, [{ field: 'type', direction: 'DESC' }]);
		expect(byTypeDescending.nodes.map((node) => node.id)).toEqual([PRIORITY, CATEGORY]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.tagTypes(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([CATEGORY]);

		const second = await resolver.tagTypes(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([PRIORITY]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.tagTypes(undefined, undefined, undefined, 20);

		const last = await resolver.tagTypes(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([CATEGORY]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tagTypes(undefined, [{ field: 'tags', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.tagTypes({ tags: { eq: CATEGORY } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tagTypes(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('TagTypeResolver — one concept, two protocols, the same operations', () => {
	it('reads one group through the same service method the REST route calls', async () => {
		const { resolver, tagTypeService } = surfaces();

		expect(await resolver.tagType(CATEGORY)).toBe(ROWS[0]);
		expect(tagTypeService.findOneByIdString).toHaveBeenCalledWith(CATEGORY);
	});

	it('answers null for a group that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, tagTypeService } = surfaces();
		tagTypeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.tagType(PRIORITY)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, tagTypeService } = surfaces();

		expect(await resolver.tagTypeCount()).toBe(2);
		expect(tagTypeService.countBy).toHaveBeenCalledWith();
	});

	it('declares a group through the same service method the REST route calls', async () => {
		const { resolver, tagTypeService } = surfaces();

		await resolver.createTagType({ organizationId: ORGANIZATION, type: 'Priority' });

		expect(tagTypeService.create).toHaveBeenCalledWith({ organizationId: ORGANIZATION, type: 'Priority' });
	});

	it('changes a group through the same service method the REST route calls, answering the row read back', async () => {
		const { resolver, tagTypeService } = surfaces();

		expect(await resolver.updateTagType({ id: CATEGORY, type: 'Product category' })).toBe(ROWS[0]);
		// The identifier is the criterion, as it is on the route: it is not repeated in the payload.
		expect(tagTypeService.update).toHaveBeenCalledWith(CATEGORY, { type: 'Product category' });
		expect(tagTypeService.findOneByIdString).toHaveBeenCalledWith(CATEGORY);
	});

	it('removes a group through the same service method the REST route calls', async () => {
		const { resolver, tagTypeService } = surfaces();

		expect(await resolver.deleteTagType(CATEGORY)).toBe(true);
		expect(tagTypeService.delete).toHaveBeenCalledWith(CATEGORY);
	});

	it('withdraws and restores a group through the same service methods the REST routes call', async () => {
		const { resolver, tagTypeService } = surfaces();

		const withdrawn = await resolver.softDeleteTagType(CATEGORY);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(tagTypeService.softRemove).toHaveBeenCalledWith(CATEGORY);

		expect(await resolver.recoverTagType(CATEGORY)).toBe(ROWS[0]);
		expect(tagTypeService.softRecover).toHaveBeenCalledWith(CATEGORY);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, tagTypeService } = surfaces();
		const refusal = new Error('TAG_TYPE_STILL_REFERENCED: a tag is still filed under this group.');
		tagTypeService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTagType(CATEGORY)).rejects.toBe(refusal);
	});
});

describe('TagTypeResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		// This controller carries both guards on the class, so its writes need no guard of their own —
		// and neither do the fields below. The gate on the endpoint itself is the one addition, and it
		// is not a scope: it narrows nothing of what the routes serve.
		expect(Reflect.getMetadata('__guards__', TagTypeResolver)).toEqual([
			...Reflect.getMetadata('__guards__', TagTypeController),
			FeatureFlagGuard
		]);
		expect(Reflect.getMetadata('__guards__', TagTypeResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			// The controller's chain plus the gate on the endpoint itself and the field's are the same
			// set, which is the whole parity claim: a field that added a guard of its own would narrow
			// GraphQL below REST and is caught here.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(TagTypeController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class — which is none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagTypeResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagTypeController)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(TagTypeController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries no permission on the node query and the lifecycle routes, because their routes carry none', () => {
		// `GET /:id`, the removal, the withdrawal and the recovery are inherited from the CRUD base
		// without a permission of their own, and this controller states none on the class either — so
		// they run under the guards alone. Demanding a permission here would refuse a caller the REST
		// route serves; the asymmetry between reading one group and listing them is the controller's to
		// resolve, and resolving it in one surface only is exactly what this delivery exists to prevent.
		for (const handler of ['findById', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TagTypeController)[handler])).toBeUndefined();
			expect(permissionOfRoute(TagTypeController, handler)).toBeUndefined();
		}
		for (const field of ['tagType', 'deleteTagType', 'softDeleteTagType', 'recoverTagType']) {
			expect(permissionOfField(field)).toBeUndefined();
		}

		// The routes that do state permissions state them here too, and never the other one.
		expect(permissionOfField('tagTypes')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TAG_TYPES_VIEW
		]);
		expect(permissionOfField('tagTypeCount')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TAG_TYPES_VIEW
		]);
		expect(permissionOfField('createTagType')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TAG_TYPES_ADD
		]);
		expect(permissionOfField('updateTagType')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TAG_TYPES_EDIT
		]);
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
		getHandler: () => (TagTypeResolver.prototype as never)[field],
		getClass: () => TagTypeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TagTypeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TagTypeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TagTypeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('tagTypes')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('tagTypes');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('tagTypes'))).resolves.toBe(true);
	});
});
