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
import { ResourceLinkController } from './resource-link.controller';
import { ResourceLinkResolver } from './resource-link.resolver';
import { ResourceLinkCreateCommand, ResourceLinkUpdateCommand } from './commands';

/**
 * The resource link over GraphQL.
 *
 * The delivered `/api/resource-link` routes serve a list, a page, one link, a count, a filing, an
 * edit, a removal and the two lifecycle moves. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and the list is a connection with the platform's
 *   own cursor codec behind it;
 * - **each write is dispatched as the same command the REST route dispatches**, so the activity log
 *   the service writes is written once, for the same reason, whichever protocol the caller used;
 * - the guard chain is the controller's and no permission is stated anywhere, because the controller
 *   states none;
 * - the polymorphic pair the row is addressed by is a filter of the list rather than a root field,
 *   and it is what makes the list usable;
 * - a link that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000090';
const TASK = '00000000-0000-4000-8000-0000000000a0';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Task',
		entityId: TASK,
		title: 'Specification',
		url: 'https://example.test/spec',
		metaData: { siteName: 'Example' },
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Invoice',
		entityId: TASK,
		title: 'Purchase order',
		url: 'https://example.test/po',
		metaData: null,
		employeeId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const resourceLinkService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		resourceLinkService,
		commandBus,
		resolver: new ResourceLinkResolver(resourceLinkService as never, commandBus as never)
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
function handlersOf(controller: typeof ResourceLinkController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ResourceLinkController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ResourceLinkController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ResourceLinkResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['resourceLinks', 'findAll'],
	['resourceLink', 'findById'],
	['resourceLinkCount', 'getCount'],
	['createResourceLink', 'create'],
	['updateResourceLink', 'update'],
	['deleteResourceLink', 'delete'],
	['softDeleteResourceLink', 'softRemove'],
	['recoverResourceLink', 'softRecover']
];

describe('ResourceLinkResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['resourceLinks', 'resourceLink', 'resourceLinkCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createResourceLink',
				'updateResourceLink',
				'deleteResourceLink',
				'softDeleteResourceLink',
				'recoverResourceLink'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ResourceLinkConnection \{\s*nodes: \[ResourceLink!\]!\s*edges: \[ResourceLinkEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ResourceLinkEdge \{\s*node: ResourceLink!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ResourceLinkFilter \{/);
		expect(printed).toMatch(/enum ResourceLinkSortField \{\s*createdAt\s*updatedAt\s*title\s*entity\s*\}/);
	});

	it('carries the polymorphic pair, the address and the title', () => {
		const link = body('ResourceLink', 'type');

		expect(link).toMatch(/title: String!/);
		expect(link).toMatch(/url: String\b/);
		expect(link).toMatch(/entity: String\b/);
		expect(link).toMatch(/entityId: ID\b/);
		// A document on the production dialects and text on the embedded one; the scalar passes either
		// through rather than parsing one into the other.
		expect(link).toMatch(/metaData: JSON\b/);
		expect(link).toMatch(/employeeId: ID\b/);
		expect(link).toMatch(/deletedAt: DateTime/);
	});

	it('states the polymorphic pair as a filter, because that is the read a client performs', () => {
		expect(body('ResourceLinkFilter', 'input')).toMatch(/entity: StringFilter/);
		expect(body('ResourceLinkFilter', 'input')).toMatch(/entityId: IDFilter/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/resourceLinkCount\(/);
	});
});

describe('ResourceLinkResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, resourceLinkService } = surfaces();

		const connection = await resolver.resourceLinks(undefined, undefined, undefined, 20);

		expect(resourceLinkService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.resourceLinks()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the polymorphic pair, which is the question this list exists to answer', async () => {
		const { resolver } = surfaces();

		const links = await resolver.resourceLinks({ entity: { eq: 'Task' }, entityId: { eq: TASK } });

		expect(links.nodes.map((node) => node.id)).toEqual([FIRST]);
		// The other record of the same identifier answers the other link: the pair is the address, and
		// either half alone is not.
		expect((await resolver.resourceLinks({ entity: { eq: 'Invoice' } })).nodes.map((n) => n.id)).toEqual([
			SECOND
		]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.resourceLinks(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.resourceLinks(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.resourceLinks(undefined, [{ field: 'metaData', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.resourceLinks({ employee: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('ResourceLinkResolver — one concept, two protocols, the same operations', () => {
	it('reads one link through the same service method the REST route calls', async () => {
		const { resolver, resourceLinkService } = surfaces();

		expect(await resolver.resourceLink(FIRST)).toBe(ROWS[0]);
		expect(resourceLinkService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a link that is not there', async () => {
		const { resolver, resourceLinkService } = surfaces();
		resourceLinkService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.resourceLink(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, resourceLinkService } = surfaces();

		expect(await resolver.resourceLinkCount()).toBe(2);
		expect(resourceLinkService.countBy).toHaveBeenCalledWith();
	});

	it('files a link through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createResourceLink({
			organizationId: ORGANIZATION,
			entity: 'Task',
			entityId: TASK,
			title: 'Specification',
			url: 'https://example.test/spec'
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ResourceLinkCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			entity: 'Task',
			entityId: TASK,
			title: 'Specification',
			url: 'https://example.test/spec'
		});
	});

	it('changes a link through the command the REST route dispatches, with the identifier beside the body', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateResourceLink({ id: FIRST, title: 'Specification v2' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ResourceLinkUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual({ title: 'Specification v2' });
	});

	it('removes a link through the same service method the REST route calls', async () => {
		const { resolver, resourceLinkService } = surfaces();

		expect(await resolver.deleteResourceLink(FIRST)).toBe(true);
		expect(resourceLinkService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a link through the same service methods the REST routes call', async () => {
		const { resolver, resourceLinkService } = surfaces();

		expect((await resolver.softDeleteResourceLink(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(resourceLinkService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverResourceLink(FIRST)).toBe(ROWS[0]);
		expect(resourceLinkService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('ResourceLinkResolver — the guard stack is the controller’s and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ResourceLinkResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ResourceLinkController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ResourceLinkResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(ResourceLinkController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class or on any field, because no route has one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ResourceLinkController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ResourceLinkResolver)).toBeUndefined();

		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(ResourceLinkController, handler)])
		);

		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((value) => value === undefined)).toBe(true);
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
		getHandler: () => (ResourceLinkResolver.prototype as never)[field],
		getClass: () => ResourceLinkResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ResourceLinkResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ResourceLinkResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ResourceLinkResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('resourceLinks')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('resourceLinks');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('resourceLinks'))).resolves.toBe(true);
	});
});
