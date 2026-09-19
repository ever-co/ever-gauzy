/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TagController } from './tag.controller';
import { TagResolver } from './tag.resolver';
import { TagListCommand } from './commands';

/**
 * The tag domain over GraphQL.
 *
 * The delivered REST routes serve a tag list, the level lookup, one tag, a count, a filing, a change,
 * a removal, and the withdrawal and restoration of a tag. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field dispatches the same command, or reaches the same service method, that the REST route
 *   reaches — the list included, which the REST route serves through `TagListCommand`;
 * - the scope is the credential's and never an argument: both readers build the same tenant-and-
 *   organization fragment, and this surface feeds them the organization the credential names rather
 *   than the one a client would have put in the query string;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**: the two writes carry the two permissions their routes carry, and the reads carry none,
 *   because the routes they mirror carry none — the controller's class states no permission at all;
 * - the members the delivered readers answer are what the object type carries, and the counters and
 *   the grouping relation one branch of the list reader computes are not declared at all;
 * - a tag that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TAG_TYPE = '00000000-0000-4000-8000-000000000003';
const BUG = '00000000-0000-4000-8000-000000000010';
const FEATURE = '00000000-0000-4000-8000-000000000011';

/**
 * The rows the delivered readers answer with: the same shape `findTags` hands back from the store and
 * `findTagsByLevel` answers as entities, which is the set this connection narrows.
 */
const ROWS = [
	{
		id: BUG,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Bug',
		color: '#e11d48',
		textColor: '#ffffff',
		description: 'Something is wrong',
		icon: 'alert-circle-outline',
		isSystem: false,
		tagTypeId: TAG_TYPE,
		fullIconUrl: 'http://localhost:3000/api/file/image/alert-circle-outline.svg',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FEATURE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Feature',
		color: '#0ea5e9',
		description: 'Something new',
		isSystem: false,
		tagTypeId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const tagService = {
		findTagsByLevel: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }) };

	return {
		tagService,
		commandBus,
		resolver: new TagResolver(tagService as never, commandBus as never)
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
 * The tag type domain's fields are named with this one's prefix (`tagTypes`, `createTagType`), and the
 * two domains share one composed schema, so they are named here and excluded: what this list asserts
 * is the set the tag resource contributes, and the tag type resource asserts its own beside it.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => {
			const name = field.toLowerCase();

			return name.includes('tag') && !name.includes('tagtype');
		})
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof TagController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TagController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TagController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = TagResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under, which are the class's chain plus whatever it restates. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TagResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (TagResolver.prototype as unknown as Record<string, object>)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['tags', 'findAll'],
	['tagsByLevel', 'findTagsByLevel'],
	['tag', 'findById'],
	['tagCount', 'getCount'],
	['createTag', 'create'],
	['updateTag', 'update'],
	['deleteTag', 'delete'],
	['softDeleteTag', 'softRemove'],
	['recoverTag', 'softRecover']
];

describe('TagResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the list, the level lookup, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['tags', 'tagsByLevel', 'tag', 'tagCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createTag', 'updateTag', 'deleteTag', 'softDeleteTag', 'recoverTag'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['tag', 'tagCount', 'tags', 'tagsByLevel']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createTag',
			'deleteTag',
			'recoverTag',
			'softDeleteTag',
			'updateTag'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TagConnection \{\s*nodes: \[Tag!\]!\s*edges: \[TagEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TagEdge \{\s*node: Tag!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TagFilter \{/);
		expect(printed).toMatch(/input TagSort \{/);
		expect(printed).toMatch(/enum TagSortField \{\s*createdAt\s*updatedAt\s*name\s*color\s*isSystem\s*\}/);
	});

	it('carries the members the delivered readers answer, and neither the counters nor the grouping', () => {
		const body = typeBody('Tag');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/color: String!/);
		expect(body).toMatch(/textColor: String/);
		expect(body).toMatch(/icon: String/);
		// The virtual member both readers resolve the icon into, so a client renders it without a
		// second request to the file endpoint.
		expect(body).toMatch(/fullIconUrl: String/);
		// The grouping is a column of the row, answered by every read.
		expect(body).toMatch(/tagTypeId: ID/);
		// The relation itself is loaded only when a REST caller names it in `relations`, which no read
		// this surface performs does.
		expect(body).not.toMatch(/^\s*tagType\s*:/m);
		// The usage counters are computed by one branch of the list reader and are absent from the
		// rows the other branch answers, so no member is declared for them.
		expect(body).not.toContain('counter');
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered readers answer live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/tags\([^)]*withDeleted/);
		expect(printed).not.toMatch(/tagsByLevel\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/tagCount\(/);
	});
});

describe('TagResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, commandBus } = surfaces();

		const connection = await resolver.tags(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, dispatched as the same command. The route
		// binds the tenant and the organization its own client sends in the query string; this surface
		// states the organization the credential names — no request is mounted in this suite, so this
		// asserts the payload's shape, and the next test asserts where the value comes from — and never
		// a criterion the caller stated.
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TagListCommand);
		expect(command.input).toEqual({ organizationId: undefined });
		expect(command.relations).toEqual([]);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(BUG);
	});

	it('scopes both readers by the organization the credential names, never by an argument', async () => {
		const { resolver, tagService, commandBus } = surfaces();
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			await resolver.tags();
			await resolver.tagsByLevel();

			// The delivered clients send this identifier in the query string of both routes, and both
			// readers build their organization fragment from it — the tags of the tenant level together
			// with the tags of that one organization. A caller cannot state it here: the argument set
			// narrows and pages, it does not choose a scope.
			expect(commandBus.execute.mock.calls[0][0].input).toEqual({ organizationId: ORGANIZATION });
			expect(tagService.findTagsByLevel).toHaveBeenCalledWith({ organizationId: ORGANIZATION }, []);
		} finally {
			organization.mockRestore();
		}
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.tags();

		expect(connection.nodes.map((node) => node.id)).toEqual([BUG, FEATURE]);
	});

	it('narrows by the fields the filter declares, including the grouping that is absent', async () => {
		const { resolver } = surfaces();

		const byColour = await resolver.tags({ color: { eq: '#0ea5e9' } });
		expect(byColour.nodes.map((node) => node.id)).toEqual([FEATURE]);

		const byText = await resolver.tags({ name: { ilike: 'fea%' } });
		expect(byText.nodes.map((node) => node.id)).toEqual([FEATURE]);

		// The question the tag screen asks of an ungrouped label, which is why `isNull` on the grouping
		// is a filter this resource declares.
		const ungrouped = await resolver.tags({ tagTypeId: { isNull: true } });
		expect(ungrouped.nodes.map((node) => node.id)).toEqual([FEATURE]);

		const byType = await resolver.tags({ tagTypeId: { eq: TAG_TYPE } });
		expect(byType.nodes.map((node) => node.id)).toEqual([BUG]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.tags(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([BUG, FEATURE]);

		const byColour = await resolver.tags(undefined, [{ field: 'color', direction: 'ASC' }]);
		expect(byColour.nodes.map((node) => node.id)).toEqual([FEATURE, BUG]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.tags(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([BUG]);

		const second = await resolver.tags(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FEATURE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.tags(undefined, undefined, undefined, 20);

		const last = await resolver.tags(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([BUG]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tags(undefined, [{ field: 'product_counter', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.tags({ product_counter: { eq: 2 } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tags(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('answers the level lookup with the same connection, read through its own service method', async () => {
		const { resolver, tagService } = surfaces();

		const connection = await resolver.tagsByLevel({ color: { eq: '#e11d48' } }, undefined, undefined, 20);

		// The read is the one `GET /tags/level` performs: the criterion is the organization the credential
		// names — absent in this suite, which mounts no request — and no relation beyond the ones the
		// reader loads itself.
		expect(tagService.findTagsByLevel).toHaveBeenCalledWith({ organizationId: undefined }, []);
		expect(connection.nodes.map((node) => node.id)).toEqual([BUG]);
		expect(connection.totalCount).toBe(1);
		// One codec behind both root fields, so a walk started on the list resumes on the lookup.
		const atLevel = await resolver.tagsByLevel(undefined, undefined, undefined, 20);
		expect(CursorCodec.decode(atLevel.edges[0].cursor).id).toBe(BUG);
	});

	it('refuses an undeclared field on the level lookup too, because it is the same contract', async () => {
		const { resolver } = surfaces();

		const error = await resolver.tagsByLevel({ counters: { eq: 2 } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('TagResolver — one concept, two protocols, the same operations', () => {
	it('reads one tag through the same service method the REST route calls', async () => {
		const { resolver, tagService } = surfaces();

		expect(await resolver.tag(BUG)).toBe(ROWS[0]);
		expect(tagService.findOneByIdString).toHaveBeenCalledWith(BUG);
	});

	it('answers null for a tag that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, tagService } = surfaces();
		tagService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.tag(FEATURE)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, tagService } = surfaces();

		expect(await resolver.tagCount()).toBe(2);
		expect(tagService.countBy).toHaveBeenCalledWith();
	});

	it('files a tag through the same service method the REST route calls', async () => {
		const { resolver, tagService } = surfaces();

		await resolver.createTag({ name: 'Feature', color: '#0ea5e9', organizationId: ORGANIZATION });

		expect(tagService.create).toHaveBeenCalledWith({
			name: 'Feature',
			color: '#0ea5e9',
			organizationId: ORGANIZATION
		});
	});

	it('changes a tag through the same service method the REST route calls, answering the row read back', async () => {
		const { resolver, tagService } = surfaces();

		expect(await resolver.updateTag({ id: BUG, color: '#111827' })).toBe(ROWS[0]);
		// The identifier is the criterion, as it is on the route: it is not repeated in the payload.
		expect(tagService.update).toHaveBeenCalledWith(BUG, { color: '#111827' });
		expect(tagService.findOneByIdString).toHaveBeenCalledWith(BUG);
	});

	it('removes a tag through the same service method the REST route calls', async () => {
		const { resolver, tagService } = surfaces();

		expect(await resolver.deleteTag(BUG)).toBe(true);
		expect(tagService.delete).toHaveBeenCalledWith(BUG);
	});

	it('withdraws and restores a tag through the same service methods the REST routes call', async () => {
		const { resolver, tagService } = surfaces();

		const withdrawn = await resolver.softDeleteTag(BUG);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(tagService.softRemove).toHaveBeenCalledWith(BUG);

		expect(await resolver.recoverTag(BUG)).toBe(ROWS[0]);
		expect(tagService.softRecover).toHaveBeenCalledWith(BUG);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, tagService } = surfaces();
		const refusal = new Error('TAG_STILL_REFERENCED: the tag could not be removed.');
		tagService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTag(BUG)).rejects.toBe(refusal);
	});
});

describe('TagResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		// This controller carries the tenant guard alone on the class: `PermissionGuard` is stated on
		// each of its two writes and nowhere else, so the resolver's class states the same one guard.
		expect(Reflect.getMetadata('__guards__', TagResolver)).toEqual(
			Reflect.getMetadata('__guards__', TagController)
		);
		expect(Reflect.getMetadata('__guards__', TagResolver)).toEqual([TenantPermissionGuard]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			// The controller's chain and the field's are the same set, which is the whole parity claim:
			// a field that added a guard of its own would narrow GraphQL below REST — or, here, widen
			// it — and either way is caught here. The two writes restate `PermissionGuard` beside the
			// class that already carries the tenant guard, which is exactly what their routes do.
			expect(guardsOfField(field).sort()).toEqual(guardsOfRoute(TagController, handler).sort());
		}
	});

	it('states on the class the permission the controller states on the class — which is none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagController)).toBeUndefined();
		expect(permissionOfField('createTag')).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(TagController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the two write permissions and no permission on the reads, because the routes do not', () => {
		// The two writes state what their routes state, `ALL_ORG_EDIT` beside the resource's own
		// permission, and nothing narrower.
		expect(permissionOfField('createTag')).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD]);
		expect(permissionOfField('updateTag')).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT]);

		// Every read mirrors a route that states none of its own, and this controller's class states
		// none either, so all four run under the guards alone. Demanding a permission here would refuse
		// a caller the REST route serves. `findById` and `getCount` are the inherited routes; the other
		// two are the controller's own.
		for (const handler of ['findAll', 'findTagsByLevel', 'findById', 'getCount']) {
			expect(permissionOfRoute(TagController, handler)).toBeUndefined();
		}
		for (const field of ['tags', 'tagsByLevel', 'tag', 'tagCount']) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});
});
