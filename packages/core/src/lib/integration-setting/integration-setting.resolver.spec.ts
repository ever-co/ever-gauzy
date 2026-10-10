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
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingModule } from './integration-setting.module';
import { IntegrationSettingResolver } from './integration-setting.resolver';

/**
 * The credentials of a configured integration over GraphQL.
 *
 * The resource serves one delivered route — the rotation of one credential — and this suite pins the
 * half of the two-protocol doctrine that is easy to get quietly wrong on a resource of that shape:
 *
 * - the one capability is a root field of the one composed schema, and it is a mutation: the resource
 *   serves no read, so the surface states no query;
 * - the field performs the route's own two steps against the route's own service, in the route's own
 *   order — the upsert, then the row read back;
 * - **the permission is the handler's**, which overrides the controller's class-level pair; asserting
 *   the resolved value rather than the class list is what keeps the field from running under a wider
 *   scope than the route;
 * - **the secret projection is asserted member by member**: the stored value is written and never
 *   answered, and neither the cleartext nor the masked copy is a member of the type;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The one route this resource serves, beside the root field that mirrors it. */
const ROUTE = { field: 'updateIntegrationSetting', handler: 'update' };

/** The row a scripted service answers with, as the delivered read-back returns it. */
const ROW = {
	id: '00000000-0000-4000-8000-000000000050',
	settingsName: 'access_token',
	integrationId: '00000000-0000-4000-8000-000000000051',
	tenantId: '00000000-0000-4000-8000-000000000001',
	organizationId: null,
	isActive: true,
	isArchived: false,
	createdAt: new Date('2026-01-01T10:00:00.000Z'),
	updatedAt: new Date('2026-01-01T10:00:00.000Z')
};

/** The resolver, over a scripted service. */
function surfaces() {
	const integrationSettingService = {
		create: jest.fn().mockResolvedValue(ROW),
		findOneByIdString: jest.fn().mockResolvedValue(ROW)
	};

	return {
		integrationSettingService,
		resolver: new IntegrationSettingResolver(integrationSettingService as never)
	};
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
		.filter((field) => /^(integrationSetting|integrationSettings|updateIntegrationSetting)$/.test(field))
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationSettingController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationSettingController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', IntegrationSettingController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(IntegrationSettingController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission the one resolver field runs under, by the route's own rule. */
function permissionOfField(): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (IntegrationSettingResolver.prototype as never)[ROUTE.field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationSettingResolver)
	);
}

describe('IntegrationSettingResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the rotation as the one mutation, and no read beside it', () => {
		expect(ownedRootFields('Mutation')).toEqual(['updateIntegrationSetting']);
		// The credentials are never listed or read back by the delivered API, so there is no read for a
		// query field to mirror — and the read it would be is the one a secret must not have.
		expect(ownedRootFields('Query')).toEqual([]);
	});

	it('declares no connection, edge or filter for a list nobody serves', () => {
		// An unreachable list type would be declared and referenced by nothing, which this schema warns
		// about; it would also invite a read of the values the delivered projection withholds.
		expect(printed).not.toMatch(/type IntegrationSettingConnection/);
		expect(printed).not.toMatch(/type IntegrationSettingEdge/);
		expect(printed).not.toMatch(/input IntegrationSettingFilter/);
		expect(printed).not.toMatch(/input IntegrationSettingSort/);
	});

	it('carries every fact about the row except the value', () => {
		for (const member of [
			'id',
			'settingsName',
			'integrationId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'deletedAt',
			'createdAt',
			'updatedAt'
		]) {
			expect(declaresMember('IntegrationSetting', member)).toBe(true);
		}
	});

	it('refuses the stored value, in cleartext and in its masked form', () => {
		// The row a resolver holds is the entity the masking subscriber ran on: its `settingsValue`
		// property still carries the stored cleartext, and only the serialized form is masked. A member
		// for it would resolve off that property, which is the one way round the delivered projection.
		expect(declaresMember('IntegrationSetting', 'settingsValue')).toBe(false);
		// The masked copy is produced on the response path rather than held by the row, so a member for
		// it would answer a value that depends on which reader produced the row.
		expect(declaresMember('IntegrationSetting', 'wrapSecretKey')).toBe(false);
		expect(declaresMember('IntegrationSetting', 'wrapSecretValue')).toBe(false);
	});

	it('states the value on the way in, which is the delivered write body', () => {
		// The asymmetry is deliberate: refusing the member on the input as well would leave a client
		// unable to rotate a credential at all.
		expect(declaresMember('UpdateIntegrationSettingInput', 'settingsValue')).toBe(true);
		expect(declaresMember('UpdateIntegrationSettingInput', 'id')).toBe(true);
		// The delivered body composes credentials for the configured-integration writes, and it is the
		// only other place the value appears.
		expect(declaresMember('IntegrationSettingInput', 'settingsValue')).toBe(true);
	});
});

describe('IntegrationSettingResolver — one concept, two protocols, the same operation', () => {
	it('performs the route’s own two steps, in the route’s own order', async () => {
		const { resolver, integrationSettingService } = surfaces();
		const id = ROW.id;

		expect(await resolver.updateIntegrationSetting({ id, settingsValue: 'rotated-token' })).toBe(ROW);

		// The delivered route calls `create` with the path identifier inside the body — an upsert under
		// that identifier rather than an edit of a row it read first — and then answers the row read back.
		expect(integrationSettingService.create).toHaveBeenCalledWith({ settingsValue: 'rotated-token', id });
		expect(integrationSettingService.findOneByIdString).toHaveBeenCalledWith(id);
	});

	it('carries the organization the caller states into the write', async () => {
		const { resolver, integrationSettingService } = surfaces();

		await resolver.updateIntegrationSetting({
			id: ROW.id,
			organizationId: ROW.organizationId,
			settingsValue: 'rotated-token'
		});

		expect(integrationSettingService.create).toHaveBeenCalledWith({
			organizationId: ROW.organizationId,
			settingsValue: 'rotated-token',
			id: ROW.id
		});
	});

	it('surfaces a refusal rather than answering a row', async () => {
		const { resolver, integrationSettingService } = surfaces();
		const refusal = new Error('INTEGRATION_SETTING_REFUSED: the row belongs to another tenant.');

		integrationSettingService.create.mockRejectedValueOnce(refusal);

		await expect(
			resolver.updateIntegrationSetting({ id: ROW.id, settingsValue: 'rotated-token' })
		).rejects.toBe(refusal);
	});
});

describe('IntegrationSettingResolver — the guard stack is the controller’s and the permission is the route’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', IntegrationSettingController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', IntegrationSettingResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs the field under the guard chain its own route runs under', () => {
		const stated = Reflect.getMetadata('__guards__', IntegrationSettingResolver) ?? [];

		expect([...guardsOfRoute(ROUTE.handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		expect(
			Reflect.getMetadata('__guards__', (IntegrationSettingResolver.prototype as never)[ROUTE.field])
		).toBeUndefined();
	});

	it('states the edit permission the handler states, and not the controller’s wider pair', () => {
		// The handler's statement is the one the reflector resolves, so the route runs under
		// `INTEGRATION_EDIT` alone: the class-level `INTEGRATION_ADD` beside it is not part of this
		// route's scope, and stating it here would be a wider scope than REST has.
		expect(permissionOfRoute(ROUTE.handler)).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		expect(permissionOfField()).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationSettingResolver)).toBeUndefined();
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
		getHandler: () => (IntegrationSettingResolver.prototype as never)[ROUTE.field],
		getClass: () => IntegrationSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: ROUTE.field })
	} as unknown as ExecutionContext;
}

describe('IntegrationSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IntegrationSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IntegrationSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the write while the capability is off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext()).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain(ROUTE.field);
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the write once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext())).resolves.toBe(true);
	});
});

describe('IntegrationSettingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntegrationSettingModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntegrationSettingModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(providers).toContain(IntegrationSettingResolver);
		expect(resolved).toContain(FeatureModule);
	});
});
