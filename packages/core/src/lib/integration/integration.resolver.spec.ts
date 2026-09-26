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
import { IntegrationController } from './integration.controller';
import { IntegrationModule } from './integration.module';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationGetCommand, IntegrationTypeGetCommand } from './commands';

/**
 * The integration catalogue over GraphQL.
 *
 * The delivered REST routes serve the catalogue narrowed by the filter object the list route takes,
 * and the facets whole. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - both reads are root fields of the one composed schema and both are connections, so a cursor
 *   obtained here is the platform's own and a refusal is the query protocol's own code;
 * - every field dispatches the same command its route dispatches, with the same input — including the
 *   three members of the delivered list route's own filter object, which are arguments of the field
 *   rather than members of the connection's filter, because the store is what applies them;
 * - **the guard chain and the permission are the controller's**, read from its own metadata rather
 *   than restated here;
 * - the paid flag is stated once: as the argument the delivered read takes it as, and nowhere in the
 *   filter input beside it;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const TYPE_GITHUB = '00000000-0000-4000-8000-000000000030';
const TYPE_PROJECT = '00000000-0000-4000-8000-000000000031';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The two routes this resource serves, each beside the root field that mirrors it. */
const ROUTES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'integrations', handler: 'getIntegrations' },
	{ field: 'integrationTypes', handler: 'getIntegrationTypes' }
];

/** The catalogue rows a scripted command bus answers with, in the order the delivered read returns them. */
const INTEGRATIONS = [
	{
		id: '00000000-0000-4000-8000-000000000040',
		name: 'Github',
		provider: 'github',
		imgSrc: 'github.svg',
		fullImgUrl: 'http://localhost:3000/public/github.svg',
		isComingSoon: false,
		isPaid: false,
		isFreeTrial: false,
		freeTrialPeriod: 0,
		order: 1,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000041',
		name: 'Jira',
		provider: 'jira',
		imgSrc: 'jira.svg',
		fullImgUrl: 'http://localhost:3000/public/jira.svg',
		isComingSoon: false,
		isPaid: true,
		isFreeTrial: true,
		freeTrialPeriod: 14,
		order: 2,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The facet rows a scripted command bus answers with, in the order the catalogue places them. */
const TYPES = [
	{
		id: TYPE_PROJECT,
		name: 'Project Management',
		description: 'Plan and track work',
		icon: 'kanban',
		groupName: 'Categories',
		order: 2,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: TYPE_GITHUB,
		name: 'Tools',
		description: 'Everything else',
		icon: 'wrench',
		groupName: 'Categories',
		order: 1,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted command bus. */
function surfaces() {
	const commandBus = {
		execute: jest.fn().mockImplementation((command: unknown) =>
			Promise.resolve(command instanceof IntegrationTypeGetCommand ? TYPES : INTEGRATIONS)
		)
	};

	return { commandBus, resolver: new IntegrationResolver(commandBus as never) };
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
 * The root fields this domain contributes, stated exactly rather than by a prefix: the resources
 * beside this one are named for an integration concept too, and a prefix would count their fields
 * here.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /^(integrations|integrationTypes)$/.test(field))
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', IntegrationController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(IntegrationController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the routes' own rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (IntegrationResolver.prototype as never)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationResolver)
	);
}

describe('IntegrationResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the catalogue read and the facet read, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['integrationTypes', 'integrations']);
		// Neither route writes, and the controller has no count or pagination route beside them.
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares both lists as connections, with their filters and their sorts', () => {
		expect(printed).toMatch(
			/type IntegrationConnection \{\s*nodes: \[Integration!\]!\s*edges: \[IntegrationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type IntegrationTypeConnection \{\s*nodes: \[IntegrationType!\]!\s*edges: \[IntegrationTypeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input IntegrationFilter \{/);
		expect(printed).toMatch(/input IntegrationTypeFilter \{/);
		expect(printed).toMatch(/enum IntegrationSortField \{/);
		expect(printed).toMatch(/enum IntegrationTypeSortField \{/);
	});

	it('states the delivered read’s own filter object as arguments of the list field', () => {
		// `integrationTypeId`, `searchQuery` and the paid flag are what `GET /api/integration` hands the
		// store: a relation membership and a name prefix are not columns the connection protocol can
		// evaluate, so they travel to the read rather than being applied to its answer.
		const field = printed.match(/integrations\(([\s\S]*?)\): IntegrationConnection!/)?.[1] ?? '';

		expect(field).toMatch(/integrationTypeId: ID/);
		expect(field).toMatch(/searchQuery: String/);
		expect(field).toMatch(/isPaid: Boolean/);
	});

	it('states the paid flag once, and not again inside the filter input', () => {
		// One narrowing with two spellings is two answers that can disagree.
		expect(declaresMember('IntegrationFilter', 'isPaid')).toBe(false);
		expect(declaresMember('IntegrationFilter', 'name')).toBe(true);
	});

	it('carries the catalogue row and the facet row as the delivered reads answer them', () => {
		for (const member of ['id', 'name', 'provider', 'redirectUrl', 'imgSrc', 'version', 'docUrl', 'order']) {
			expect(declaresMember('Integration', member)).toBe(true);
		}

		// The fully-qualified image URL is computed by the delivered read on every load, and the trial
		// length is a count of days rather than the decimal the store happens to hold it in.
		expect(declaresMember('Integration', 'fullImgUrl')).toBe(true);
		expect(printed).toMatch(/freeTrialPeriod: Int/);

		for (const member of ['id', 'name', 'description', 'icon', 'groupName', 'order']) {
			expect(declaresMember('IntegrationType', member)).toBe(true);
		}

		// Neither delivered read loads the reverse side of the many-to-many, so a member for it would
		// always be empty here.
		expect(declaresMember('Integration', 'integrationTypes')).toBe(false);
		expect(declaresMember('IntegrationType', 'integrations')).toBe(false);
	});

	it('declares the sync vocabulary once, for the resources that read and write it', () => {
		// The two settings resources beside this one write these values, so the enum is declared by the
		// domain that owns the concept and referenced rather than repeated.
		expect(printed).toMatch(/enum IntegrationEntity \{/);
		expect(printed).toMatch(/Project/);
		expect(printed).toMatch(/JOB_MATCHING/);
	});
});

describe('IntegrationResolver — the connection contract', () => {
	it('answers the catalogue with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, commandBus } = surfaces();

		const connection = await resolver.integrations(TYPE_GITHUB, 'git', undefined, undefined, undefined, undefined, 20);

		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(IntegrationGetCommand);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(INTEGRATIONS[0].id);
	});

	it('orders the catalogue by the position the delivered read orders it by', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.integrations();

		expect(connection.nodes.map((node) => node.id)).toEqual([INTEGRATIONS[0].id, INTEGRATIONS[1].id]);
	});

	it('hands the delivered read the narrowing its own filter object carries', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.integrations(TYPE_GITHUB, 'git', true);

		const { input } = commandBus.execute.mock.calls[0][0] as IntegrationGetCommand;
		expect(input.integrationTypeId).toBe(TYPE_GITHUB);
		expect(input.searchQuery).toBe('git');
		// The delivered handler compares this member with the strings `'true'` and `'false'`.
		expect(input.filter).toBe('true');
	});

	it('leaves the paid flag unstated when the caller states none, as the route does', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.integrations(TYPE_GITHUB, 'git');

		const { input } = commandBus.execute.mock.calls[0][0] as IntegrationGetCommand;
		expect(input.filter).toBeUndefined();
	});

	it('narrows the rows the delivered read returned by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const free = await resolver.integrations(undefined, undefined, undefined, { isComingSoon: { eq: false } });
		expect(free.totalCount).toBe(2);

		const trialling = await resolver.integrations(undefined, undefined, undefined, { isFreeTrial: { eq: true } });
		expect(trialling.nodes.map((node) => node.id)).toEqual([INTEGRATIONS[1].id]);

		const byProvider = await resolver.integrations(undefined, undefined, undefined, {
			provider: { ilike: 'git%' }
		});
		expect(byProvider.nodes.map((node) => node.id)).toEqual([INTEGRATIONS[0].id]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.integrations(
			undefined,
			undefined,
			undefined,
			undefined,
			[{ field: 'name', direction: 'ASC' }]
		);
		expect(byName.nodes.map((node) => node.name)).toEqual(['Github', 'Jira']);

		const newest = await resolver.integrations(
			undefined,
			undefined,
			undefined,
			undefined,
			[{ field: 'createdAt', direction: 'DESC' }]
		);
		expect(newest.nodes.map((node) => node.id)).toEqual([INTEGRATIONS[1].id, INTEGRATIONS[0].id]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.integrations(undefined, undefined, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes).toHaveLength(1);

		const second = await resolver.integrations(
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				first: 1,
				after: first.pageInfo.endCursor ?? undefined
			}
		);

		expect(second.nodes.map((node) => node.id)).toEqual([INTEGRATIONS[1].id]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrations(undefined, undefined, undefined, undefined, [{ field: 'docUrl', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrations(undefined, undefined, undefined, { isPaid: { eq: true } })
			.catch((thrown) => thrown);

		// The paid flag is an argument of this field, so it is not a filter member — and the refusal
		// names the members that are.
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.integrations(undefined, undefined, undefined, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('answers the facets with the same contract, in the delivered order', async () => {
		const { resolver, commandBus } = surfaces();

		const connection = await resolver.integrationTypes(undefined, undefined, undefined, 20);

		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(IntegrationTypeGetCommand);
		expect(connection.nodes.map((node) => node.id)).toEqual([TYPE_GITHUB, TYPE_PROJECT]);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.hasNextPage).toBe(false);
	});
});

describe('IntegrationResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', IntegrationController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', IntegrationResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			const stated = Reflect.getMetadata('__guards__', IntegrationResolver) ?? [];

			expect([...guardsOfRoute(handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
			expect(Reflect.getMetadata('__guards__', (IntegrationResolver.prototype as never)[field])).toBeUndefined();
		}
	});

	it('states on every field the permission its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			expect(permissionOfRoute(handler)).toEqual([PermissionsEnum.INTEGRATION_VIEW]);
			expect(permissionOfField(field)).toEqual([PermissionsEnum.INTEGRATION_VIEW]);
			// Neither handler states a permission of its own, so the class-level one is the whole of
			// their scope — and the class states it here too.
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(IntegrationController)[handler])
			).toBeUndefined();
		}

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IntegrationResolver)).toEqual([
			PermissionsEnum.INTEGRATION_VIEW
		]);
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
		getHandler: () => (IntegrationResolver.prototype as never)[field],
		getClass: () => IntegrationResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('IntegrationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IntegrationResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IntegrationResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('integrations')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('integrations');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the facet read too', async () => {
		const { guard } = gate(false);

		await expect(guard.canActivate(graphqlContext('integrationTypes'))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('integrations'))).resolves.toBe(true);
	});
});

describe('IntegrationModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the commands it dispatches', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntegrationModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntegrationModule) ?? []) as unknown[];

		expect(providers).toContain(IntegrationResolver);
		// The command bus is what the resolver injects, and the guard chain is resolved by the module
		// that declares the resolver.
		expect(imports).toContain(FeatureModule);
	});
});
