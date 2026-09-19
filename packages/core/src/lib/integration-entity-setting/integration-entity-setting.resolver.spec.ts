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
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingModule } from './integration-entity-setting.module';
import { IntegrationEntitySettingResolver } from './integration-entity-setting.resolver';
import {
	IntegrationEntitySettingGetCommand,
	IntegrationEntitySettingUpdateOrCreateCommand
} from './commands';

/**
 * The synchronisation decisions of a configured integration over GraphQL.
 *
 * The delivered REST routes serve the decisions of one integration and the write that stores them.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - both capabilities are root fields of the one composed schema, and the read is a connection with
 *   the platform's own cursor codec behind it;
 * - every field dispatches the same command its own route dispatches, with the same input — the
 *   integration from the read's own argument, and the decisions from the write's list;
 * - **the permission is stated per field, because the two routes do not run under the same one**: the
 *   read inherits the controller's class-level pair and the write states the edit alone, so a single
 *   class-level statement here would be wrong for one of them;
 * - the enum the schema states is the domain's own closed vocabulary, and the evaluator compares the
 *   same stored value the rest of the platform stores;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const INTEGRATION = '00000000-0000-4000-8000-000000000060';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The two routes this resource serves, each beside the root field that mirrors it. */
const ROUTES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'integrationEntitySettings', handler: 'getEntitySettingByIntegration' },
	{ field: 'updateIntegrationEntitySettings', handler: 'updateIntegrationEntitySettingByIntegration' }
];

/** The rows a scripted command bus answers with, in the order the delivered read returns them. */
const ROWS = [
	{
		id: '00000000-0000-4000-8000-000000000061',
		entity: 'Project',
		sync: true,
		integrationId: INTEGRATION,
		tiedEntities: [],
		tenantId: '00000000-0000-4000-8000-000000000001',
		organizationId: '00000000-0000-4000-8000-000000000002',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000062',
		entity: 'Task',
		sync: false,
		integrationId: INTEGRATION,
		tiedEntities: [{ id: '00000000-0000-4000-8000-000000000063', entity: 'TimeLog', sync: true }],
		tenantId: '00000000-0000-4000-8000-000000000001',
		organizationId: '00000000-0000-4000-8000-000000000002',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted command bus. */
function surfaces() {
	const commandBus = {
		execute: jest.fn().mockImplementation((command: unknown) =>
			Promise.resolve(
				command instanceof IntegrationEntitySettingGetCommand
					? { items: ROWS, total: ROWS.length }
					: ROWS
			)
		)
	};

	return { commandBus, resolver: new IntegrationEntitySettingResolver(commandBus as never) };
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
 * The root fields this domain contributes, stated exactly rather than by a prefix: the tied resource
 * beside this one writes a field whose name begins the same way, and a prefix would count it here.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /^(integrationEntitySetting|integrationEntitySettings|updateIntegrationEntitySettings)$/.test(field))
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationEntitySettingController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', IntegrationEntitySettingController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(IntegrationEntitySettingController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the routes' own rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (IntegrationEntitySettingResolver.prototype as never)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingResolver)
	);
}

describe('IntegrationEntitySettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the read and the write the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['integrationEntitySettings']);
		expect(ownedRootFields('Mutation')).toEqual(['updateIntegrationEntitySettings']);
	});

	it('declares the read as a connection, with its filter and its sort', () => {
		expect(printed).toMatch(
			/type IntegrationEntitySettingConnection \{\s*nodes: \[IntegrationEntitySetting!\]!\s*edges: \[IntegrationEntitySettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input IntegrationEntitySettingFilter \{/);
		expect(printed).toMatch(/enum IntegrationEntitySettingSortField \{/);
	});

	it('states the integration the read is of as an argument, where the route states it in the path', () => {
		const field = printed.match(/integrationEntitySettings\(([\s\S]*?)\): IntegrationEntitySettingConnection!/)?.[1] ?? '';

		expect(field).toMatch(/integrationId: ID!/);
		// The write takes the same identifier, from the same place in the route.
		expect(printed).toMatch(/updateIntegrationEntitySettings\([\s\S]*?integrationId: ID![\s\S]*?input: \[IntegrationEntitySettingInput!\]![\s\S]*?\): \[IntegrationEntitySetting!\]!/);
	});

	it('carries the row the delivered read loads, with the two facts a reader places it by', () => {
		for (const member of ['id', 'entity', 'sync', 'integrationId', 'tiedEntities', 'organizationId']) {
			expect(declaresMember('IntegrationEntitySetting', member)).toBe(true);
		}

		// The delivered read loads the configured integration and the tied rows, so both are answerable
		// here rather than requiring a second call.
		expect(typeBody('IntegrationEntitySetting')).toMatch(/integration: IntegrationTenant/);
		expect(typeBody('IntegrationEntitySetting')).toMatch(/tiedEntities: \[IntegrationEntitySettingTied!\]!/);
	});

	it('states the row type as the domain’s own closed vocabulary', () => {
		expect(printed).toMatch(/enum IntegrationEntity \{/);
		expect(typeBody('IntegrationEntitySetting')).toMatch(/entity: IntegrationEntity!/);
		expect(typeBody('IntegrationEntitySettingInput')).toMatch(/entity: IntegrationEntity!/);
	});

	it('declares the write input as the list the delivered body may be', () => {
		expect(printed).toMatch(/input IntegrationEntitySettingInput \{/);
		// The delivered body stores what it is given, tied rows included, and folds a single decision
		// into a list before it does — so the list is the shape both readings reach.
		expect(declaresMember('IntegrationEntitySettingInput', 'tiedEntities')).toBe(true);
	});

	it('offers no count and no identifier-narrowed node field the controller does not serve', () => {
		expect(printed).not.toMatch(/integrationEntitySettingCount/);
		expect(printed).not.toMatch(/^\s*integrationEntitySetting\(/m);
	});
});

describe('IntegrationEntitySettingResolver — the connection contract', () => {
	it('answers the read with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, commandBus } = surfaces();

		const connection = await resolver.integrationEntitySettings(INTEGRATION, undefined, undefined, undefined, 20);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IntegrationEntitySettingGetCommand);
		expect(command.integrationId).toBe(INTEGRATION);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ROWS[0].id);
	});

	it('orders the decisions by the row type when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.integrationEntitySettings(INTEGRATION);

		expect(connection.nodes.map((node) => node.entity)).toEqual(['Project', 'Task']);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const synced = await resolver.integrationEntitySettings(INTEGRATION, { sync: { eq: true } });
		expect(synced.nodes).toHaveLength(1);

		const byEntity = await resolver.integrationEntitySettings(INTEGRATION, { entity: { eq: 'Task' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.integrationEntitySettings(INTEGRATION, undefined, undefined, undefined, 1);

		expect(first.nodes).toHaveLength(1);

		const second = await resolver.integrationEntitySettings(
			INTEGRATION,
			undefined,
			undefined,
			{ first: 1, after: first.pageInfo.endCursor ?? undefined }
		);

		expect(second.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrationEntitySettings(INTEGRATION, undefined, [{ field: 'organizationId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrationEntitySettings(INTEGRATION, { tiedEntities: { eq: 'x' } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('IntegrationEntitySettingResolver — one concept, two protocols, the same operations', () => {
	it('stores the decisions through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = [{ entity: 'Task' as never, sync: true }];

		expect(await resolver.updateIntegrationEntitySettings(INTEGRATION, input)).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IntegrationEntitySettingUpdateOrCreateCommand);
		expect(command.integrationId).toBe(INTEGRATION);
		expect(command.input).toBe(input);
	});

	it('carries the tied rows the caller states into the same write', async () => {
		const { resolver, commandBus } = surfaces();
		const input = [
			{ entity: 'Task' as never, sync: true, tiedEntities: [{ entity: 'TimeLog' as never, sync: true }] }
		];

		await resolver.updateIntegrationEntitySettings(INTEGRATION, input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command.input[0].tiedEntities).toEqual([{ entity: 'TimeLog', sync: true }]);
	});

	it('surfaces a refusal rather than answering rows', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('INTEGRATION_NOT_FOUND: the integration is not this tenant’s.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.updateIntegrationEntitySettings(INTEGRATION, [])).rejects.toBe(refusal);
	});
});

describe('IntegrationEntitySettingResolver — the guard stack is the controller’s and each field states its route’s permission', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			const stated = Reflect.getMetadata('__guards__', IntegrationEntitySettingResolver) ?? [];

			expect([...guardsOfRoute(handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
			expect(
				Reflect.getMetadata('__guards__', (IntegrationEntitySettingResolver.prototype as never)[field])
			).toBeUndefined();
		}
	});

	it('states on every field the permission its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			expect(permissionOfField(field)).toEqual(permissionOfRoute(handler));
		}
	});

	it('states the class-level pair on the read and the edit alone on the write', () => {
		// The two routes do not run under the same permission — the read inherits the controller's class
		// pair, the write overrides it — which is why the permission is stated per field and the class
		// states none.
		expect(permissionOfField('integrationEntitySettings')).toEqual([
			PermissionsEnum.INTEGRATION_ADD,
			PermissionsEnum.INTEGRATION_EDIT
		]);
		expect(permissionOfField('updateIntegrationEntitySettings')).toEqual([PermissionsEnum.INTEGRATION_EDIT]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationEntitySettingResolver)).toBeUndefined();
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
		getHandler: () => (IntegrationEntitySettingResolver.prototype as never)[field],
		getClass: () => IntegrationEntitySettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('IntegrationEntitySettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IntegrationEntitySettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IntegrationEntitySettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('integrationEntitySettings'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('integrationEntitySettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the write too, and serves both once the capability is switched on', async () => {
		await expect(
			gate(false).guard.canActivate(graphqlContext('updateIntegrationEntitySettings'))
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(gate(true).guard.canActivate(graphqlContext('integrationEntitySettings'))).resolves.toBe(true);
	});
});

describe('IntegrationEntitySettingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the commands it dispatches', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntegrationEntitySettingModule) ??
			[]) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntegrationEntitySettingModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(providers).toContain(IntegrationEntitySettingResolver);
		expect(resolved).toContain(FeatureModule);
	});
});
