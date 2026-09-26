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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IntegrationTenantController } from './integration-tenant.controller';
import { IntegrationTenantModule } from './integration-tenant.module';
import { IntegrationTenantResolver } from './integration-tenant.resolver';
import { IntegrationTenantDeleteCommand, IntegrationTenantUpdateCommand } from './commands';

/**
 * The integrations a tenant has connected, over GraphQL.
 *
 * The delivered resource is a CRUD controller with three reads and a removal of its own on top of the
 * base it inherits, so this suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong on a resource of that shape:
 *
 * - every capability the controller serves — the list, the node, the count, the by-provider read, the
 *   creation, the edit, the removal and the two lifecycle moves — is a root field of the one composed
 *   schema, and the list is a connection with the platform's own cursor codec behind it;
 * - every field reaches the same service method, or dispatches the same command, that its own route
 *   reaches — the paginated spelling folds into the connection rather than becoming a second list;
 * - **the permission is read per field**, because the controller states a different one per route and
 *   leaves the inherited routes under its class-level pair;
 * - **the removal carries the organization the delivered route requires**, so a caller cannot reach a
 *   removal REST would refuse;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const INTEGRATION = '00000000-0000-4000-8000-000000000080';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** Every root field this domain contributes, beside the delivered route it mirrors. */
const ROUTES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'integrationTenants', handler: 'findAll' },
	{ field: 'integrationTenant', handler: 'findById' },
	{ field: 'integrationTenantCount', handler: 'getCount' },
	{ field: 'integrationTenantByOptions', handler: 'getIntegrationByOptions' },
	{ field: 'createIntegrationTenant', handler: 'create' },
	{ field: 'updateIntegrationTenant', handler: 'update' },
	{ field: 'deleteIntegrationTenant', handler: 'delete' },
	{ field: 'softDeleteIntegrationTenant', handler: 'softRemove' },
	{ field: 'recoverIntegrationTenant', handler: 'softRecover' }
];

/** The rows a scripted service answers with, in the order the connection returns them. */
const ROWS = [
	{
		id: '00000000-0000-4000-8000-000000000081',
		name: 'Github',
		integrationId: INTEGRATION,
		lastSyncedAt: new Date('2026-03-01T10:00:00.000Z'),
		organizationId: ORGANIZATION,
		tenantId: TENANT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000082',
		name: 'Jira',
		integrationId: '00000000-0000-4000-8000-000000000083',
		lastSyncedAt: null,
		organizationId: ORGANIZATION,
		tenantId: TENANT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const integrationTenantService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getIntegrationByOptions: jest.fn().mockResolvedValue(ROWS[0]),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		integrationTenantService,
		commandBus,
		resolver: new IntegrationTenantResolver(integrationTenantService as never, commandBus as never)
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

/** The composed schema, as text: this domain's documents plus every kernel document the loader globs. */
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

const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * The root fields this domain contributes, stated exactly rather than by a prefix: the resources named
 * for an integration concept beside this one would be counted by a prefix.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /^(integrationTenants?|integrationTenantCount|integrationTenantByOptions|createIntegrationTenant|updateIntegrationTenant|deleteIntegrationTenant|softDeleteIntegrationTenant|recoverIntegrationTenant)$/.test(field))
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** Whether one type declares a member, read from the declaration rather than from the text around it. */
function declaresMember(name: string, member: string): boolean {
	return new RegExp(`^\\s*${member}\\s*:`, 'm').test(typeBody(name));
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: object): Record<string, object> {
	return controller['prototype'] as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. It is what makes the inherited
 * routes comparable: the count, the creation and the two lifecycle moves are the CRUD base's, so their
 * effective permission is their controller's class-level one.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationTenantController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationTenantController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', IntegrationTenantController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(IntegrationTenantController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the routes' own rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (IntegrationTenantResolver.prototype as never)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationTenantResolver)
	);
}

describe('IntegrationTenantResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'integrationTenant',
			'integrationTenantByOptions',
			'integrationTenantCount',
			'integrationTenants'
		]);
	});

	it('declares one mutation per delivered write route, the base’s included', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createIntegrationTenant',
			'deleteIntegrationTenant',
			'recoverIntegrationTenant',
			'softDeleteIntegrationTenant',
			'updateIntegrationTenant'
		]);
	});

	it('declares the connection, its edge, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type IntegrationTenantConnection \{\s*nodes: \[IntegrationTenant!\]!\s*edges: \[IntegrationTenantEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type IntegrationTenantEdge \{\s*node: IntegrationTenant!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input IntegrationTenantFilter \{/);
		expect(printed).toMatch(/enum IntegrationTenantSortField \{/);
	});

	it('carries the row the delivered reads answer, and the two relations they load', () => {
		for (const member of ['id', 'name', 'lastSyncedAt', 'integrationId', 'tenantId', 'organizationId']) {
			expect(declaresMember('IntegrationTenant', member)).toBe(true);
		}

		expect(typeBody('IntegrationTenant')).toMatch(/integration: Integration/);
		expect(typeBody('IntegrationTenant')).toMatch(/settings: \[IntegrationSetting!\]/);
	});

	it('refuses the collections no resolver of this delivery serves', () => {
		// The decisions are the subject of their own resource, reached with `integrationEntitySettings`.
		expect(declaresMember('IntegrationTenant', 'entitySettings')).toBe(false);
		// `IntegrationMapController` declares no route at all, so nothing in the delivered API serves a
		// map row and this schema does not invent a surface for one.
		expect(declaresMember('IntegrationTenant', 'entityMaps')).toBe(false);
	});

	it('carries the provider as text, because the provider set grows outside this package', () => {
		expect(printed).toMatch(/name: String!/);
		expect(declaresMember('CreateIntegrationTenantInput', 'name')).toBe(true);
		// The row type vocabulary beside it is the platform's own closed set and is declared as an enum.
		expect(printed).toMatch(/enum IntegrationEntity \{/);
	});

	it('requires the organization on the removal, as the delivered route does', () => {
		const field = printed.match(/deleteIntegrationTenant\(([\s\S]*?)\): Boolean!/)?.[1] ?? '';

		expect(field).toMatch(/id: ID!/);
		expect(field).toMatch(/organizationId: ID!/);
	});
});

describe('IntegrationTenantResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, integrationTenantService } = surfaces();

		const connection = await resolver.integrationTenants(undefined, undefined, undefined, 20);

		// The read is the service's own list method — the one the list route reaches and the paginated
		// spelling slices — so the criterion that makes a row a connection stays in the service.
		expect(integrationTenantService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ROWS[0].id);
	});

	it('orders the list newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.integrationTenants();

		expect(connection.nodes.map((node) => node.id)).toEqual([ROWS[0].id, ROWS[1].id]);
	});

	it('narrows by the fields the filter declares, the provider and the never-synced set included', async () => {
		const { resolver } = surfaces();

		const github = await resolver.integrationTenants({ name: { eq: 'Github' } });
		expect(github.nodes.map((node) => node.id)).toEqual([ROWS[0].id]);

		const never = await resolver.integrationTenants({ lastSyncedAt: { isNull: true } });
		expect(never.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);

		const mine = await resolver.integrationTenants({ organizationId: { eq: ORGANIZATION } });
		expect(mine.totalCount).toBe(2);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.integrationTenants(undefined, undefined, undefined, 1);

		expect(first.nodes).toHaveLength(1);

		const second = await resolver.integrationTenants(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrationTenants(undefined, [{ field: 'integrationId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrationTenants({ settings: { eq: 'x' } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrationTenants(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('IntegrationTenantResolver — one concept, two protocols, the same operations', () => {
	it('reads one connection through the same service method the node route calls, relations included', async () => {
		const { resolver, integrationTenantService } = surfaces();

		expect(await resolver.integrationTenant(ROWS[0].id)).toBe(ROWS[0]);
		expect(integrationTenantService.findOneByIdString).toHaveBeenCalledWith(ROWS[0].id, { relations: undefined });

		await resolver.integrationTenant(ROWS[0].id, ['settings']);
		expect(integrationTenantService.findOneByIdString).toHaveBeenCalledWith(ROWS[0].id, { relations: ['settings'] });
	});

	it('answers null for a connection that is not there, which is the route’s 404 in this vocabulary', async () => {
		const { resolver, integrationTenantService } = surfaces();
		integrationTenantService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.integrationTenant(ROWS[1].id)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, integrationTenantService } = surfaces();

		expect(await resolver.integrationTenantCount()).toBe(2);
		expect(integrationTenantService.countBy).toHaveBeenCalledWith();
	});

	it('resolves the connection for a provider through the same service method its route calls', async () => {
		const { resolver, integrationTenantService } = surfaces();

		expect(await resolver.integrationTenantByOptions('Github', ORGANIZATION)).toBe(ROWS[0]);
		expect(integrationTenantService.getIntegrationByOptions).toHaveBeenCalledWith({
			name: 'Github',
			organizationId: ORGANIZATION,
			relations: undefined
		});
	});

	it('answers null where the delivered route answers false', async () => {
		const { resolver, integrationTenantService } = surfaces();
		integrationTenantService.getIntegrationByOptions.mockResolvedValueOnce(false);

		expect(await resolver.integrationTenantByOptions('Github', ORGANIZATION)).toBeNull();
	});

	it('connects an integration through the same service method the creation route calls', async () => {
		const { resolver, integrationTenantService } = surfaces();

		await resolver.createIntegrationTenant({ name: 'Github', organizationId: ORGANIZATION });

		expect(integrationTenantService.create).toHaveBeenCalledWith({
			name: 'Github',
			organizationId: ORGANIZATION
		});
	});

	it('changes a connection through the command the edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateIntegrationTenant({ id: ROWS[0].id, isActive: false });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IntegrationTenantUpdateCommand);
		expect(command.id).toBe(ROWS[0].id);
		expect(command.input).toEqual({ id: ROWS[0].id, isActive: false });
	});

	it('removes a connection through the command the removal route dispatches, scope included', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteIntegrationTenant(ROWS[0].id, ORGANIZATION, TENANT)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IntegrationTenantDeleteCommand);
		expect(command.id).toBe(ROWS[0].id);
		// The delivered handler reads the row under this scope before it deletes, which is what
		// publishes the event a provider's own cleanup listens for.
		expect(command.options).toEqual({ organizationId: ORGANIZATION, tenantId: TENANT });
	});

	it('withdraws and restores a connection through the same service methods the lifecycle routes call', async () => {
		const { resolver, integrationTenantService } = surfaces();

		const withdrawn = await resolver.softDeleteIntegrationTenant(ROWS[0].id);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(integrationTenantService.softRemove).toHaveBeenCalledWith(ROWS[0].id);

		expect(await resolver.recoverIntegrationTenant(ROWS[0].id)).toBe(ROWS[0]);
		expect(integrationTenantService.softRecover).toHaveBeenCalledWith(ROWS[0].id);
	});

	it('surfaces a refusal rather than answering a row', async () => {
		const { resolver, integrationTenantService } = surfaces();
		const refusal = new Error('INTEGRATION_TENANT_STILL_REFERENCED: the sync is still configured.');

		integrationTenantService.softRemove.mockRejectedValueOnce(refusal);

		await expect(resolver.softDeleteIntegrationTenant(ROWS[0].id)).rejects.toBe(refusal);
	});
});

describe('IntegrationTenantResolver — the guard stack is the controller’s and each field states its route’s permission', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', IntegrationTenantController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', IntegrationTenantResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			const stated = Reflect.getMetadata('__guards__', IntegrationTenantResolver) ?? [];

			expect([...guardsOfRoute(handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
			expect(Reflect.getMetadata('__guards__', (IntegrationTenantResolver.prototype as never)[field])).toBeUndefined();
		}
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(ROUTES.map(({ field, handler }) => [field, permissionOfRoute(handler)]));

		expect(stated).toEqual(expected);
	});

	it('states the view permission on the three reads, the edit on the edit and the delete on the removal', () => {
		for (const field of ['integrationTenants', 'integrationTenant', 'integrationTenantByOptions']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.INTEGRATION_VIEW]);
		}

		expect(permissionOfField('updateIntegrationTenant')).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		expect(permissionOfField('deleteIntegrationTenant')).toEqual([PermissionsEnum.INTEGRATION_DELETE]);
	});

	it('states the class-level pair on the inherited routes’ fields, as their controller’s class does', () => {
		// The count, the creation and the two lifecycle moves are the CRUD base's: none of them states a
		// permission of its own, so the class-level pair is the whole of their scope.
		for (const handler of ['getCount', 'create', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationTenantController)[handler])
			).toBeUndefined();
			expect(permissionOfRoute(handler)).toEqual([
				PermissionsEnum.INTEGRATION_ADD,
				PermissionsEnum.INTEGRATION_EDIT
			]);
		}

		for (const field of [
			'integrationTenantCount',
			'createIntegrationTenant',
			'softDeleteIntegrationTenant',
			'recoverIntegrationTenant'
		]) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.INTEGRATION_ADD,
				PermissionsEnum.INTEGRATION_EDIT
			]);
		}
	});

	it('carries no class-level permission, because the four route scopes cannot be stated in one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationTenantResolver)).toBeUndefined();
	});
});

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
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
		getHandler: () => (IntegrationTenantResolver.prototype as never)[field],
		getClass: () => IntegrationTenantResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('IntegrationTenantResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IntegrationTenantResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IntegrationTenantResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('integrationTenants')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('integrationTenants');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the removal too, which is the field a caller would reach for first', async () => {
		await expect(gate(false).guard.canActivate(graphqlContext('deleteIntegrationTenant'))).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('integrationTenants'))).resolves.toBe(true);
	});
});

describe('IntegrationTenantModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service and the commands', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntegrationTenantModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntegrationTenantModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(providers).toContain(IntegrationTenantResolver);
		expect(resolved).toContain(FeatureModule);
	});
});
