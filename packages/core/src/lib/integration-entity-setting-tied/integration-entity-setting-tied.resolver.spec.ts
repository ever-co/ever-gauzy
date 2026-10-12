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
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedModule } from './integration-entity-setting-tied.module';
import { IntegrationEntitySettingTiedResolver } from './integration-entity-setting-tied.resolver';
import { IntegrationEntitySettingTiedUpdateCommand } from './commands';

/**
 * The tied decisions of a configured integration over GraphQL.
 *
 * The resource serves one delivered route — the write that stores them — and this suite pins the half of
 * the two-protocol doctrine that is easy to get quietly wrong on a resource of that shape:
 *
 * - the one capability is a root field of the one composed schema, and it is a mutation: the resource
 *   serves no read, so the surface states no query and no connection;
 * - the field dispatches the same command the route dispatches, with the same two arguments, and answers
 *   the list the delivered handler produces rather than the single row the route annotates;
 * - **the guard chain and the permission are the controller's**, read from its own metadata rather than
 *   restated here;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const INTEGRATION = '00000000-0000-4000-8000-000000000070';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The one route this resource serves, beside the root field that mirrors it. */
const ROUTE = { field: 'updateIntegrationEntitySettingsTied', handler: 'updateIntegrationEntitySettingTiedByIntegration' };

/** The rows a scripted command bus answers with, as the delivered store returns them. */
const ROWS = [
	{
		id: '00000000-0000-4000-8000-000000000071',
		entity: 'TimeLog',
		sync: true,
		integrationEntitySettingId: '00000000-0000-4000-8000-000000000072',
		tenantId: '00000000-0000-4000-8000-000000000001',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted command bus. */
function surfaces() {
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS) };

	return { commandBus, resolver: new IntegrationEntitySettingTiedResolver(commandBus as never) };
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /^updateIntegrationEntitySettingsTied$/.test(field))
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
 * The permission the one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationEntitySettingTiedController)[ROUTE.handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingTiedController)
	);
}

/** The guards the route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(): unknown[] {
	const declared = Reflect.getMetadata('__guards__', IntegrationEntitySettingTiedController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(IntegrationEntitySettingTiedController)[ROUTE.handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission the one resolver field runs under, by the route's own rule. */
function permissionOfField(): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (IntegrationEntitySettingTiedResolver.prototype as never)[ROUTE.field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingTiedResolver)
	);
}

describe('IntegrationEntitySettingTiedResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the write as the one mutation, and no read beside it', () => {
		expect(ownedRootFields('Mutation')).toEqual(['updateIntegrationEntitySettingsTied']);
		// The resource serves no list, no node and no count route: a reader reaches a tied row through
		// the decision it hangs off, which is where the delivered read loads it.
		expect(rootFields('Query').filter((field) => field.toLowerCase().includes('tied'))).toEqual([]);
	});

	it('declares no connection, edge or filter for a list nobody serves', () => {
		expect(printed).not.toMatch(/type IntegrationEntitySettingTiedConnection/);
		expect(printed).not.toMatch(/type IntegrationEntitySettingTiedEdge/);
		expect(printed).not.toMatch(/input IntegrationEntitySettingTiedFilter/);
	});

	it('carries the row and the two facts that place it', () => {
		for (const member of ['id', 'entity', 'sync', 'integrationEntitySettingId', 'organizationId']) {
			expect(declaresMember('IntegrationEntitySettingTied', member)).toBe(true);
		}

		// The vocabulary is the integration domain's own, declared once and referenced here.
		expect(printed).toMatch(/enum IntegrationEntity \{/);
		expect(typeBody('IntegrationEntitySettingTied')).toMatch(/entity: IntegrationEntity!/);
	});

	it('states the list the delivered handler produces, and the identifier the route takes in its path', () => {
		expect(printed).toMatch(
			/updateIntegrationEntitySettingsTied\([\s\S]*?integrationId: ID![\s\S]*?input: \[IntegrationEntitySettingTiedInput!\]![\s\S]*?\): \[IntegrationEntitySettingTied!\]!/
		);
		expect(declaresMember('IntegrationEntitySettingTiedInput', 'entity')).toBe(true);
		expect(declaresMember('IntegrationEntitySettingTiedInput', 'sync')).toBe(true);
	});
});

describe('IntegrationEntitySettingTiedResolver — one concept, two protocols, the same operation', () => {
	it('stores the tied decisions through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = [{ entity: 'TimeLog' as never, sync: true }];

		// The field reproduces the delivered dispatch rather than reaching the service behind it: the
		// delivered module does not declare this command's handler among its providers, so the route
		// answers the command bus's refusal — and so does this field, until that registration lands.
		expect(await resolver.updateIntegrationEntitySettingsTied(INTEGRATION, input)).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IntegrationEntitySettingTiedUpdateCommand);
		expect(command.integrationId).toBe(INTEGRATION);
		expect(command.input).toBe(input);
	});

	it('surfaces the command bus’s refusal when the command reaches it', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('No handler found for the command: "IntegrationEntitySettingTiedUpdateCommand"');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.updateIntegrationEntitySettingsTied(INTEGRATION, [])).rejects.toBe(refusal);
	});
});

describe('IntegrationEntitySettingTiedResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingTiedController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingTiedResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs the field under the guard chain its own route runs under', () => {
		const stated = Reflect.getMetadata('__guards__', IntegrationEntitySettingTiedResolver) ?? [];

		expect([...guardsOfRoute(), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		expect(
			Reflect.getMetadata('__guards__', (IntegrationEntitySettingTiedResolver.prototype as never)[ROUTE.field])
		).toBeUndefined();
	});

	it('states on the field and on the class the permission the route runs under', () => {
		expect(permissionOfRoute()).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		expect(permissionOfField()).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		// The controller states it on the class and nothing on its handler, so the class-level statement
		// is the whole of the route's scope — and this resolver states the same one.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingTiedResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingTiedController)
		);
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
		getHandler: () => (IntegrationEntitySettingTiedResolver.prototype as never)[ROUTE.field],
		getClass: () => IntegrationEntitySettingTiedResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: ROUTE.field })
	} as unknown as ExecutionContext;
}

describe('IntegrationEntitySettingTiedResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IntegrationEntitySettingTiedResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingTiedResolver)).toContain(FeatureFlagGuard);
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

describe('IntegrationEntitySettingTiedModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the command it dispatches', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntegrationEntitySettingTiedModule) ??
			[]) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntegrationEntitySettingTiedModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(providers).toContain(IntegrationEntitySettingTiedResolver);
		expect(resolved).toContain(FeatureModule);
	});
});
