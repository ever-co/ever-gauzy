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
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TenantApiKeyController } from './tenant-api-key.controller';
import { TenantApiKeyModule } from './tenant-api-key.module';
import { TenantApiKeyResolver } from './tenant-api-key.resolver';

/**
 * The tenant API key over GraphQL.
 *
 * The resource serves one delivered route — the issuance of a pair — and this suite pins the half of
 * the two-protocol doctrine that is easy to get quietly wrong on a resource of that shape:
 *
 * - the one capability is a root field of the one composed schema, and it is a mutation: the resource
 *   serves no read, so the surface states no query, no connection and no count;
 * - the field calls the same service method the route calls with the same input, and answers the pair
 *   the service built;
 * - **the guard chain and the permission are the controller's**, read from its own metadata rather
 *   than restated here;
 * - **the secret projection is asserted rather than assumed**: the pair the issuance answers carries
 *   the secret in clear text, which is what the delivered route answers, and nothing in this schema
 *   answers key material off a stored row — because no read of a row exists to be widened;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The one route this resource serves, beside the root field that mirrors it. */
const ROUTE = { field: 'generateTenantApiKeyPair', handler: 'generateKeyPair' };

/** The pair a scripted service answers with, as the delivered issuance builds it. */
const PAIR = {
	tenantId: '00000000-0000-4000-8000-000000000001',
	name: 'Storefront',
	apiKey: 'e48bfc3c1e724e7a931f501bc0036b45',
	apiSecret: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6'
};

/** The resolver, over a scripted service. */
function surfaces() {
	const tenantApiKeyService = { generateApiKey: jest.fn().mockResolvedValue(PAIR) };

	return { tenantApiKeyService, resolver: new TenantApiKeyResolver(tenantApiKeyService as never) };
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

/** The root fields this domain contributes, which are the ones that name the concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('tenantapikey'))
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
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TenantApiKeyController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TenantApiKeyController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TenantApiKeyController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(TenantApiKeyController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission the one resolver field runs under, by the route's own rule. */
function permissionOfField(): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (TenantApiKeyResolver.prototype as never)[ROUTE.field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TenantApiKeyResolver)
	);
}

describe('TenantApiKeyResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the issuance as the one mutation, and no read beside it', () => {
		expect(ownedRootFields('Mutation')).toEqual(['generateTenantApiKeyPair']);
		// The resource serves no list, no node and no count route, so there is no read for a query
		// field to mirror — and the stored row could not honestly answer one anyway: its secret column
		// holds a hash.
		expect(ownedRootFields('Query')).toEqual([]);
	});

	it('answers the pair the delivered issuance answers, secret included', () => {
		expect(printed).toMatch(/generateTenantApiKeyPair\(input: GenerateTenantApiKeyInput!\): TenantApiKeyPair!/);
		expect(declaresMember('TenantApiKeyPair', 'tenantId')).toBe(true);
		expect(declaresMember('TenantApiKeyPair', 'apiKey')).toBe(true);
		// The clear-text secret is the delivery of the issuance: a secret nobody is shown is a secret
		// nobody can use. It is an answer member, and the type it belongs to is returned by no query.
		expect(declaresMember('TenantApiKeyPair', 'apiSecret')).toBe(true);
	});

	it('declares no type for the stored row, so no field can answer stored key material', () => {
		// Nothing lists or reads a key row over REST either. A type named for the row would be an
		// invitation to resolve `apiKey` and `apiSecret` straight off it, which is exactly the way
		// round the delivered projection that the schema must not offer.
		expect(printed).not.toMatch(/^type TenantApiKey /m);
		expect(printed).not.toMatch(/^type TenantApiKeyRow /m);

		const queries = rootFields('Query').map((field) => field.toLowerCase());
		expect(queries.some((field) => field.includes('tenantapikey'))).toBe(false);
	});

	it('offers the label and not the tenant, because the route has one legal tenant', () => {
		expect(printed).toMatch(/input GenerateTenantApiKeyInput \{/);
		expect(declaresMember('GenerateTenantApiKeyInput', 'name')).toBe(true);
		// `IsTenantBelongsToUser` refuses every `tenantId` but the credential's own, so the member has
		// exactly one legal value over REST — and the service falls back to that value when it is
		// absent, which is what this field states.
		expect(declaresMember('GenerateTenantApiKeyInput', 'tenantId')).toBe(false);
	});
});

describe('TenantApiKeyResolver — one concept, two protocols, the same operation', () => {
	it('issues a pair through the same service method the REST route calls', async () => {
		const { resolver, tenantApiKeyService } = surfaces();

		expect(await resolver.generateTenantApiKeyPair({ name: 'Storefront' })).toBe(PAIR);
		expect(tenantApiKeyService.generateApiKey).toHaveBeenCalledWith({ name: 'Storefront' });
	});

	it('passes an empty input through as the route does, leaving the tenant to the service', async () => {
		const { resolver, tenantApiKeyService } = surfaces();

		await resolver.generateTenantApiKeyPair({});
		expect(tenantApiKeyService.generateApiKey).toHaveBeenCalledWith({});
	});

	it('surfaces the service’s refusal rather than answering a pair', async () => {
		const { resolver, tenantApiKeyService } = surfaces();
		// A tenant that already holds a pair is refused by the delivered service, which is the
		// resource's own rule: it issues a pair for a tenant that has none.
		const refusal = new Error('API key already exists for tenant.');

		tenantApiKeyService.generateApiKey.mockRejectedValueOnce(refusal);

		await expect(resolver.generateTenantApiKeyPair({ name: 'Second' })).rejects.toBe(refusal);
	});
});

describe('TenantApiKeyResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', TenantApiKeyController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', TenantApiKeyResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs the field under the guard chain its own route runs under', () => {
		// The controller's chain plus the gate on the resolver is the whole parity claim: a guard the
		// route does not carry would narrow GraphQL below REST, and one it carries and the field does
		// not would widen it.
		const stated = Reflect.getMetadata('__guards__', TenantApiKeyResolver) ?? [];

		expect([...guardsOfRoute(ROUTE.handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
	});

	it('states on the field the permission its own route runs under', () => {
		expect(permissionOfRoute(ROUTE.handler)).toEqual([PermissionsEnum.TENANT_API_KEY_CREATE]);
		expect(permissionOfField()).toEqual([PermissionsEnum.TENANT_API_KEY_CREATE]);
	});

	it('states no permission on the class, because the controller states none there', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TenantApiKeyController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TenantApiKeyResolver)).toBeUndefined();
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

/** A GraphQL execution context for the field, which is what the guard has to read without crashing. */
function graphqlContext(): ExecutionContext {
	return {
		getHandler: () => (TenantApiKeyResolver.prototype as never)[ROUTE.field],
		getClass: () => TenantApiKeyResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: ROUTE.field })
	} as unknown as ExecutionContext;
}

describe('TenantApiKeyResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TenantApiKeyResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TenantApiKeyResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the issuance while the capability is off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext()).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain(ROUTE.field);
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the issuance once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext())).resolves.toBe(true);
	});
});

describe('TenantApiKeyModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TenantApiKeyModule) ?? []) as unknown[];

		expect(providers).toContain(TenantApiKeyResolver);
	});

	it('reaches the module that provides the feature service the gate resolves through', () => {
		// The gate is a guard, and a guard is a provider of whichever module declares the handler it
		// protects — so this module is what has to reach `FeatureService`, and the API boot fails on an
		// unresolved dependency without it. The reference is deferred, which is why it is resolved here
		// the way the container resolves it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, TenantApiKeyModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(FeatureModule);
	});
});
