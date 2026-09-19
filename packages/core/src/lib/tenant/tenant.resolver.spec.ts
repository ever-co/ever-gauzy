/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { RolesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, RoleGuard } from '../shared/guards';
import { TenantController } from './tenant.controller';
import { TenantModule } from './tenant.module';
import { TenantResolver } from './tenant.resolver';

/**
 * The tenant over GraphQL.
 *
 * The delivered REST routes serve the caller's own tenant, its creation, its edit and its removal.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those four capabilities is a root field of the one composed schema, and the read
 *   takes no identifier — the subject of `GET /api/tenant` is the credential, so an argument here
 *   would be a way to name somebody else's tenant that REST does not offer;
 * - every field reaches the same `TenantService` method the route reaches, with the same payload;
 * - **the guard chain is the controller's, and the tenant is the resource that makes reading it
 *   matter**: the controller states no guard and no permission on its class, so the class here states
 *   the gate and nothing else, while the two fields whose routes are role-guarded state `RoleGuard`
 *   and the installation owner's role. A class-level permission added for symmetry would be a scope
 *   no route of this resource has;
 * - **the creation refusal is the handler's** — a caller that already belongs to a tenant is refused
 *   by the handler rather than by a decorator, so it is asserted here against the field too;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The four routes this resource serves, each beside the root field that mirrors it. */
const ROUTES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'tenant', handler: 'findById' },
	{ field: 'createTenant', handler: 'create' },
	{ field: 'updateTenant', handler: 'update' },
	{ field: 'deleteTenant', handler: 'delete' }
];

/** The row a scripted service answers with, as the delivered read returns it. */
const ROW = {
	id: TENANT,
	name: 'Ever Technologies',
	logo: 'logo.png',
	imageId: '00000000-0000-4000-8000-000000000020',
	stripeCustomerId: 'cus_ABC123',
	standardWorkHoursPerDay: 8,
	isActive: true,
	isArchived: false,
	createdAt: new Date('2026-01-01T10:00:00.000Z'),
	updatedAt: new Date('2026-01-01T10:00:00.000Z')
};

/** The resolver, over a scripted service. */
function surfaces() {
	const tenantService = {
		findOneByIdString: jest.fn().mockResolvedValue(ROW),
		onboardTenant: jest.fn().mockResolvedValue(ROW),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 })
	};

	return { tenantService, resolver: new TenantResolver(tenantService as never) };
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
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
 * The root fields this domain contributes: the four names this resource's routes justify, stated
 * exactly rather than by a prefix, because the sibling configuration domain's fields are named for a
 * tenant concept too and a prefix would count them here.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /^(tenant|createTenant|updateTenant|deleteTenant)$/.test(field))
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * Whether one type declares a member.
 *
 * Read from the declaration rather than from the printed body as a whole, because the printed body
 * carries the descriptions too — and a description that explains *why* a member is absent names it,
 * which is what a `not.toContain` assertion would trip over.
 */
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
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TenantController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TenantController)
	);
}

/** The roles one route requires, by the same rule. */
function rolesOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(ROLES_METADATA, handlersOf(TenantController)[handler]) ??
		Reflect.getMetadata(ROLES_METADATA, TenantController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TenantController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(TenantController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The guards one resolver field runs under: the class chain followed by the field's own. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TenantResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', (TenantResolver.prototype as never)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the routes' own rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (TenantResolver.prototype as never)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TenantResolver)
	);
}

/** The roles one resolver field requires, by the same rule. */
function rolesOfField(field: string): unknown {
	return (
		Reflect.getMetadata(ROLES_METADATA, (TenantResolver.prototype as never)[field]) ??
		Reflect.getMetadata(ROLES_METADATA, TenantResolver)
	);
}

/** Every spy this suite installs on the request context goes with the test that installed it. */
afterEach(() => {
	jest.restoreAllMocks();
});

describe('TenantResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the read and the three writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['tenant']);
		expect(ownedRootFields('Mutation')).toEqual(['createTenant', 'deleteTenant', 'updateTenant']);
	});

	it('declares a read that takes no identifier, which is the route it mirrors', () => {
		// `GET /api/tenant` answers the tenant of the credential: an `id` argument would be a way to
		// name somebody else's tenant that the delivered route does not offer.
		expect(printed).not.toMatch(/^\s*tenant\(/m);
	});

	it('carries the row the delivered read answers', () => {
		expect(printed).toMatch(/type Tenant \{/);

		for (const member of [
			'id',
			'name',
			'logo',
			'imageId',
			'image',
			'stripeCustomerId',
			'standardWorkHoursPerDay',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt'
		]) {
			expect(declaresMember('Tenant', member)).toBe(true);
		}
	});

	it('carries the eager asset beside its identifier, and refuses what the read cannot produce', () => {
		// The relation is eager on the entity, so the asset is present on every row this surface
		// answers; the collections below are not loaded by this resource's reads at all.
		expect(typeBody('Tenant')).toMatch(/image: ImageAsset/);

		for (const member of ['organizations', 'rolePermissions', 'featureOrganizations']) {
			expect(declaresMember('Tenant', member)).toBe(false);
		}
	});

	it('refuses the withdrawal column, because no delivered route withdraws a tenant', () => {
		// The resource serves a read, a creation, an edit and a removal. Nothing sets `deletedAt`, so
		// the member would be null on every row this surface could ever answer.
		expect(declaresMember('Tenant', 'deletedAt')).toBe(false);
	});

	it('declares the write inputs the delivered bodies bind', () => {
		expect(printed).toMatch(/input CreateTenantInput \{\s*name: String!\s*logo: String\s*imageId: ID/);
		// The import members are the delivered body's own, and the edit states the name it wants
		// rather than patching around the one on the row.
		expect(declaresMember('CreateTenantInput', 'isImporting')).toBe(true);
		expect(printed).toMatch(/input UpdateTenantInput \{\s*name: String!\s*logo: String\s*imageId: ID\s*\}/);
	});

	it('carries no identifier on the edit input, because the delivered edit takes none', () => {
		// `PUT /api/tenant` reads the tenant from the credential, so there is nothing for a caller to
		// name — and an `id` member here would be a subject the route cannot honour.
		expect(declaresMember('UpdateTenantInput', 'id')).toBe(false);
	});
});

describe('TenantResolver — one concept, two protocols, the same operations', () => {
	it('reads the caller’s own tenant through the same service method the route calls', async () => {
		const { resolver, tenantService } = surfaces();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		expect(await resolver.tenant()).toBe(ROW);
		expect(tenantService.findOneByIdString).toHaveBeenCalledWith(TENANT);
	});

	it('answers null for a caller with no tenant, which is the route’s 404 in this vocabulary', async () => {
		const { resolver, tenantService } = surfaces();
		tenantService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.tenant()).toBeNull();
	});

	it('files a tenant through the same service method the route calls, with the caller it reads', async () => {
		const { resolver, tenantService } = surfaces();
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);

		await resolver.createTenant({ name: 'Ever Technologies', logo: 'logo.png' });

		expect(tenantService.onboardTenant).toHaveBeenCalledTimes(1);
		expect(tenantService.onboardTenant.mock.calls[0][0]).toEqual({ name: 'Ever Technologies', logo: 'logo.png' });
	});

	it('refuses a caller that already belongs to a tenant, as the delivered handler does', async () => {
		const { resolver, tenantService } = surfaces();
		// The check is the handler's rather than a guard's, which is why it is asserted here: a
		// resolver that mirrored only the guards would let a second tenant through.
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: TENANT } as never);

		await expect(resolver.createTenant({ name: 'Second Tenant' })).rejects.toBeInstanceOf(BadRequestException);
		expect(tenantService.onboardTenant).not.toHaveBeenCalled();
	});

	it('replaces the caller’s tenant through the same service method, and answers the row read back', async () => {
		const { resolver, tenantService } = surfaces();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		expect(await resolver.updateTenant({ name: 'Ever Technologies OÜ' })).toBe(ROW);
		expect(tenantService.update).toHaveBeenCalledWith(
			TENANT,
			expect.objectContaining({ name: 'Ever Technologies OÜ' })
		);
		// The delivered route answers the store's own update result; the field answers the tenant,
		// which is what a client reads next.
		expect(tenantService.findOneByIdString).toHaveBeenCalledWith(TENANT);
	});

	it('removes the caller’s tenant through the same service method the route calls', async () => {
		const { resolver, tenantService } = surfaces();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		expect(await resolver.deleteTenant()).toBe(true);
		expect(tenantService.delete).toHaveBeenCalledWith(TENANT);
	});

	it('surfaces a refusal rather than answering a row', async () => {
		const { resolver, tenantService } = surfaces();
		const refusal = new Error('TENANT_STILL_REFERENCED: the tenant still holds organizations.');

		tenantService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTenant()).rejects.toBe(refusal);
	});
});

describe('TenantResolver — the guard stack is the controller’s and the role is each route’s', () => {
	it('states the gate and nothing else on the class, because that is what the controller states', () => {
		// The tenant controller carries no guard at all: `GET /` and `POST /` are open to any
		// authenticated caller. A permission guard added here for symmetry would refuse a caller REST
		// serves, which is exactly what the two-protocol rule forbids.
		expect(Reflect.getMetadata('__guards__', TenantController) ?? []).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TenantController)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', TenantResolver)).toEqual([FeatureFlagGuard]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			// The route's chain, plus the gate on the resolver: the whole parity claim. The two
			// role-guarded writes are the case that proves it — their fields carry `RoleGuard` because
			// their routes do, and the two reads carry nothing because their routes carry nothing.
			expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(handler), FeatureFlagGuard].sort());
		}
	});

	it('states the installation owner’s role on the two fields whose routes require it', () => {
		for (const { field, handler } of ROUTES) {
			expect(rolesOfField(field)).toEqual(rolesOfRoute(handler));
		}

		expect(rolesOfField('updateTenant')).toEqual([RolesEnum.SUPER_ADMIN]);
		expect(rolesOfField('deleteTenant')).toEqual([RolesEnum.SUPER_ADMIN]);
		expect(guardsOfField('updateTenant')).toContain(RoleGuard);
		expect(guardsOfField('deleteTenant')).toContain(RoleGuard);
	});

	it('states no permission on any field, because no route of this resource states one', () => {
		for (const { field, handler } of ROUTES) {
			expect(permissionOfRoute(handler)).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
		}
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
		getHandler: () => (TenantResolver.prototype as never)[field],
		getClass: () => TenantResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TenantResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the
		// class, so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TenantResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TenantResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('tenant')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('tenant');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the removal too, which is the field a caller would reach for first', async () => {
		const { guard } = gate(false);

		// Nothing on this surface is exempt, the writes included: the door that switches the
		// capability back on is the REST route, which this code does not gate.
		await expect(guard.canActivate(graphqlContext('deleteTenant'))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('tenant'))).resolves.toBe(true);
	});
});

describe('TenantModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TenantModule) ?? []) as unknown[];

		expect(providers).toContain(TenantResolver);
	});

	it('reaches the module that provides the feature service the gate resolves through', () => {
		// The gate is a guard, and a guard is a provider of whichever module declares the handler it
		// protects — so this module is what has to reach `FeatureService`, and the API boot fails on an
		// unresolved dependency without it. The reference is deferred, which is why it is resolved here
		// the way the container resolves it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, TenantModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(FeatureModule);
	});
});
