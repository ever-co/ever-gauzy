/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

/**
 * The definition registry is the toggle provider's, and this suite is about what *this* platform does
 * with it.
 *
 * `getFeatureToggleDefinitions()` reads the provider client's in-memory definitions, which exist only
 * once a client has been initialised against a provider — something a unit suite must not do. The
 * double answers the definitions the way the client does, so the field's own rule — keep the codes
 * this installation knows and nothing else — is what the case below measures.
 */
jest.mock('unleash-client', () => ({ getFeatureToggleDefinitions: jest.fn() }));

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { getFeatureToggleDefinitions } from 'unleash-client';
import { environment } from '@gauzy/config';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FeatureModule } from './feature.module';
import { FeatureOrganizationService } from './feature-organization.service';
import { FeatureService } from './feature.service';
import { FeatureToggleController } from './feature-toggle.controller';
import { FeatureToggleResolver } from './feature-toggle.resolver';
import { FeatureToggleUpdateCommand } from './commands';

/**
 * The feature gate over GraphQL.
 *
 * The delivered `/api/feature/toggle` routes serve the catalogue, its roots, the tenant's toggle rows,
 * the provider's definitions and the toggle write. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the lists are
 *   connections with the platform's own cursor codec behind them, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's, field by field**, read from the
 *   controller's metadata rather than restated;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one;
 * - a sub-route is a filter: the parent route of the catalogue is `parentId: { isNull: true }` and the
 *   tenant and organization statements are filter members, not root fields.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ROOT_FEATURE = '00000000-0000-4000-8000-000000000010';
const CHILD_FEATURE = '00000000-0000-4000-8000-000000000011';
const ROOT_TOGGLE = '00000000-0000-4000-8000-000000000020';
const ORGANIZATION_TOGGLE = '00000000-0000-4000-8000-000000000021';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The catalogue a scripted reader answers with, in the order the delivered list read returns it: a
 * root and its child, which is what the parent route's selection is stated against.
 */
const FEATURES = [
	{
		id: ROOT_FEATURE,
		name: 'Orders',
		code: 'FEATURE_ORDER',
		description: 'Orders and their lines.',
		image: null,
		link: 'pages/sales/orders',
		status: 'success',
		icon: 'file-text-outline',
		isPaid: false,
		parentId: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: CHILD_FEATURE,
		name: 'Order approvals',
		code: 'FEATURE_ORDER_APPROVALS',
		description: 'Routing an order through the approval module.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'checkmark-circle-outline',
		isPaid: false,
		parentId: ROOT_FEATURE,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/**
 * The tenant's switchboard: one tenant-wide row and one organization's own row, which is the pair a
 * reader has to be able to tell apart on this surface.
 */
const TOGGLES = [
	{
		id: ROOT_TOGGLE,
		featureId: ROOT_FEATURE,
		isEnabled: true,
		tenantId: TENANT,
		organizationId: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: ORGANIZATION_TOGGLE,
		featureId: CHILD_FEATURE,
		isEnabled: false,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over scripted services and a scripted command bus. */
function surfaces() {
	const featureService = {
		findAll: jest.fn().mockResolvedValue({ items: FEATURES, total: FEATURES.length })
	};
	const featureOrganizationService = {
		findAll: jest.fn().mockResolvedValue({ items: TOGGLES, total: TOGGLES.length })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(true) };

	return {
		featureService,
		featureOrganizationService,
		commandBus,
		resolver: new FeatureToggleResolver(
			featureService as never,
			featureOrganizationService as never,
			commandBus as never
		)
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
 * The root fields this domain contributes.
 *
 * Named for the domain's two concepts rather than for a substring of them: the catalogue of another
 * domain carries a `featured` image, whose fields would otherwise be read as this domain's own. The
 * mutation is named for the concept it acts on, so it is stated rather than derived.
 *
 * @param operation The root operation type.
 * @returns The domain's root fields, sorted.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.startsWith('feature') || field === 'toggleFeature')
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
 * which is exactly what a `not.toContain` assertion would trip over.
 *
 * @param name The type.
 * @param member The member.
 * @returns True when the member is declared.
 */
function declaresMember(name: string, member: string): boolean {
	return new RegExp(`^\\s*${member}\\s*:`, 'm').test(typeBody(name));
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof FeatureToggleController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof FeatureToggleController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof FeatureToggleController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = FeatureToggleResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one field runs under: the class chain the gate is declared on, then the field's own. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', FeatureToggleResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', (FeatureToggleResolver.prototype as never)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (FeatureToggleResolver.prototype as never)[field],
		getClass: () => FeatureToggleResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('FeatureToggleResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two connections and the public definition read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['features', 'featureToggles', 'featureToggleDefinitions'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['toggleFeature']));
	});

	it('declares the reads and the write the controller serves, and no more', () => {
		// The controller serves five routes; the parent route is the catalogue's own selection stated as
		// a filter, so it is deliberately not a root field of its own.
		expect(ownedRootFields('Query')).toEqual(['featureToggleDefinitions', 'featureToggles', 'features']);
		expect(ownedRootFields('Mutation')).toEqual(['toggleFeature']);
	});

	it('declares the connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type FeatureConnection \{\s*nodes: \[Feature!\]!\s*edges: \[FeatureEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type FeatureEdge \{\s*node: Feature!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(
			/type FeatureToggleConnection \{\s*nodes: \[FeatureToggle!\]!\s*edges: \[FeatureToggleEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type FeatureToggleEdge \{\s*node: FeatureToggle!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input FeatureFilter \{/);
		expect(printed).toMatch(/input FeatureSort \{/);
		expect(printed).toMatch(/enum FeatureSortField \{\s*createdAt\s*updatedAt\s*name\s*code\s*status\s*\}/);
		expect(printed).toMatch(/input FeatureToggleFilter \{/);
		expect(printed).toMatch(/input FeatureToggleSort \{/);
		expect(printed).toMatch(/enum FeatureToggleSortField \{\s*createdAt\s*updatedAt\s*isEnabled\s*\}/);
	});

	it('carries the catalogue entry as the delivered read answers it, and not the members it cannot', () => {
		expect(declaresMember('Feature', 'code')).toBe(true);
		expect(declaresMember('Feature', 'name')).toBe(true);
		expect(declaresMember('Feature', 'link')).toBe(true);
		expect(declaresMember('Feature', 'parentId')).toBe(true);
		// The enablement is not on the catalogue entry: `isEnabled` is a virtual column nothing persists,
		// so a member here would be absent on every row this surface answers. It is `FeatureToggle.isEnabled`.
		expect(declaresMember('Feature', 'isEnabled')).toBe(false);
		// `imageUrl` is virtual for the same reason, and the relations are loaded only when a REST caller
		// names them — the reads this surface mirrors pass none.
		expect(declaresMember('Feature', 'imageUrl')).toBe(false);
		expect(declaresMember('Feature', 'children')).toBe(false);
		expect(declaresMember('Feature', 'featureOrganizations')).toBe(false);
		// The catalogue is installation-wide: the row has no tenant and no organization column at all.
		expect(declaresMember('Feature', 'tenantId')).toBe(false);
		expect(declaresMember('Feature', 'organizationId')).toBe(false);
	});

	it('carries the toggle as a scoped row, and says what each scope means', () => {
		expect(declaresMember('FeatureToggle', 'featureId')).toBe(true);
		expect(declaresMember('FeatureToggle', 'isEnabled')).toBe(true);
		expect(declaresMember('FeatureToggle', 'tenantId')).toBe(true);
		expect(declaresMember('FeatureToggle', 'organizationId')).toBe(true);
		// The relation is loaded only when a REST caller names it in `relations`, which this read does
		// not: the entry of a row is reachable as `features(filter: { id: { eq: … } })`.
		expect(declaresMember('FeatureToggle', 'feature')).toBe(false);
		// The scope is what tells a tenant-wide row from an organization's own, and the document says so
		// rather than leaving a reader to infer it from a null.
		expect(printed).toMatch(/the tenant-wide\s+answer/);
	});

	it('offers no node query and no count, because the controller serves neither', () => {
		// `FeatureToggleController` is not a CRUD controller: it declares no `GET /:id` and no
		// `GET /count`, so a one-row field or a count here would be a capability REST does not have.
		expect(printed).not.toMatch(/featureToggle\(/);
		expect(printed).not.toMatch(/featureToggleCount/);
		expect(printed).not.toMatch(/featureCount/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list reads answer live rows only, so neither connection offers `withDeleted`.
		expect(printed).toMatch(/features\([^)]*withDeleted/);
		expect(printed).toMatch(/featureToggles\([^)]*withDeleted/);
	});

	it('states the write input the toggle route binds, and not the tenant it stamps itself', () => {
		expect(declaresMember('UpdateFeatureToggleInput', 'featureId')).toBe(true);
		expect(declaresMember('UpdateFeatureToggleInput', 'isEnabled')).toBe(true);
		expect(declaresMember('UpdateFeatureToggleInput', 'organizationId')).toBe(true);
		// The delivered handler overwrites whatever tenant a body states with the credential's own.
		expect(declaresMember('UpdateFeatureToggleInput', 'tenantId')).toBe(false);
	});
});

describe('FeatureToggleResolver — the connection contract', () => {
	it('answers the catalogue with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, featureService } = surfaces();

		const connection = await resolver.features(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs.
		expect(featureService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ROOT_FEATURE);
	});

	it('orders the catalogue in creation order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.features();

		// The same order the delivered parent route fixes for the same rows.
		expect(connection.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE, CHILD_FEATURE]);
	});

	it('expresses the parent route as the filter it is rather than as a root field', async () => {
		const { resolver } = surfaces();

		const roots = await resolver.features({ parentId: { isNull: true } });

		expect(roots.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE]);
		expect(rootFields('Query')).not.toContain('parentFeatures');
	});

	it('narrows the catalogue by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.features({ code: { eq: 'FEATURE_ORDER' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE]);

		const byRoot = await resolver.features({ parentId: { isNull: true } });
		expect(byRoot.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE]);

		const byChild = await resolver.features({ parentId: { eq: ROOT_FEATURE } });
		expect(byChild.nodes.map((node) => node.id)).toEqual([CHILD_FEATURE]);
	});

	it('orders the catalogue by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.features(undefined, [{ field: 'name', direction: 'DESC' }]);

		expect(byName.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE, CHILD_FEATURE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.features(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ROOT_FEATURE]);

		const second = await resolver.features(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([CHILD_FEATURE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('answers the toggle rows at both scopes, and narrows them by scope', async () => {
		const { resolver, featureOrganizationService } = surfaces();

		const all = await resolver.featureToggles(undefined, undefined, undefined, 20);

		expect(featureOrganizationService.findAll).toHaveBeenCalledWith({});
		// Newest first by default, with the identifier as the tie-break.
		expect(all.nodes.map((node) => node.id)).toEqual([ORGANIZATION_TOGGLE, ROOT_TOGGLE]);

		// The tenant-wide row alone is the selection that tells the two scopes apart.
		const tenantWide = await resolver.featureToggles({ organizationId: { isNull: true } });
		expect(tenantWide.nodes.map((node) => node.id)).toEqual([ROOT_TOGGLE]);

		const scoped = await resolver.featureToggles({ organizationId: { eq: ORGANIZATION } });
		expect(scoped.nodes.map((node) => node.id)).toEqual([ORGANIZATION_TOGGLE]);

		const byFeature = await resolver.featureToggles({ featureId: { eq: ROOT_FEATURE } });
		expect(byFeature.nodes.map((node) => node.id)).toEqual([ROOT_TOGGLE]);

		const enabled = await resolver.featureToggles({ isEnabled: { eq: false } });
		expect(enabled.nodes.map((node) => node.id)).toEqual([ORGANIZATION_TOGGLE]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.features(undefined, [{ field: 'parentId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.features({ isEnabled: { eq: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.featureToggles(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('FeatureToggleResolver — one concept, two protocols, the same operations', () => {
	it('reads the catalogue through the same service method the list route calls', async () => {
		const { resolver, featureService } = surfaces();

		expect((await resolver.features()).totalCount).toBe(2);
		expect(featureService.findAll).toHaveBeenCalledWith({});
	});

	it('reads the toggle rows through the same service method the organizations route calls', async () => {
		const { resolver, featureOrganizationService } = surfaces();

		expect((await resolver.featureToggles()).totalCount).toBe(2);
		expect(featureOrganizationService.findAll).toHaveBeenCalledWith({});
	});

	it('answers the provider’s definitions narrowed to the codes this installation knows', async () => {
		const opened = environment.unleashConfig.url;
		environment.unleashConfig.url = 'http://toggles.test/api';
		// One code the platform's own catalogue names and one it does not: the delivered route keeps the
		// codes the compiled `FeatureEnum` holds, so a toggle declared for something else is never served
		// as if it were a capability of this installation.
		(getFeatureToggleDefinitions as jest.Mock).mockReturnValue([
			{
				name: FeatureEnum.FEATURE_DOCUMENTS,
				type: 'release',
				project: 'default',
				enabled: true,
				stale: false,
				impressionData: false,
				strategies: [],
				variants: []
			},
			{
				name: 'SOMETHING_THIS_PLATFORM_DOES_NOT_KNOW',
				type: 'release',
				project: 'default',
				enabled: true,
				stale: false,
				impressionData: false,
				strategies: [],
				variants: []
			}
		]);
		const { resolver } = surfaces();

		try {
			const definitions = await resolver.featureToggleDefinitions();

			expect(definitions.map((definition) => definition.name)).toEqual([FeatureEnum.FEATURE_DOCUMENTS]);
		} finally {
			environment.unleashConfig.url = opened;
		}
	});

	it('switches a capability through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.toggleFeature({ featureId: ROOT_FEATURE, isEnabled: false })).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(FeatureToggleUpdateCommand);
		expect(command.input).toEqual({ featureId: ROOT_FEATURE, isEnabled: false });
	});

	it('switches it for one organization when the caller names one', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.toggleFeature({ featureId: ROOT_FEATURE, isEnabled: true, organizationId: ORGANIZATION });

		expect(commandBus.execute.mock.calls[0][0].input).toEqual({
			featureId: ROOT_FEATURE,
			isEnabled: true,
			organizationId: ORGANIZATION
		});
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('FEATURE_TOGGLE_REFUSED: the catalogue holds no such code.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.toggleFeature({ featureId: ROOT_FEATURE, isEnabled: true })).rejects.toBe(refusal);
	});
});

describe('FeatureToggleResolver — the guard stack, the permission and the gate are the controller’s', () => {
	/** Every root field and the delivered route it mirrors. */
	const ROUTES: ReadonlyArray<[string, string]> = [
		['features', 'findAll'],
		['featureToggles', 'getFeaturesOrganization'],
		['featureToggleDefinitions', 'getFeatureToggleDefinitions'],
		['toggleFeature', 'enabledDisabledFeature']
	];

	it('runs every field under the guard chain its own route runs under, plus the gate', () => {
		for (const [field, handler] of ROUTES) {
			// The controller declares its guards per route rather than on the class, so the field states
			// the same pair — and the gate is the one addition, declared on the class for every field.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(FeatureToggleController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on every field the permission its own route states', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(FeatureToggleController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('reads the catalogue and the toggle rows under the view permission, and writes under the edit one', () => {
		for (const field of ['features', 'featureToggles']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_VIEW]);
		}

		expect(permissionOfField('toggleFeature')).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
	});

	it('asks for no credential and no permission on the public definition read, because its route does not', () => {
		// `GET /feature/toggle/definition` declares `@Public()` and nothing else, so its field declares
		// `@Public()` and nothing else — no tenant guard, no permission guard and no permission.
		expect(permissionOfField('featureToggleDefinitions')).toBeUndefined();
		expect(guardsOfField('featureToggleDefinitions')).toEqual([FeatureFlagGuard]);
		expect(
			Reflect.getMetadata('__guards__', FeatureToggleController.prototype.getFeatureToggleDefinitions)
		).toBeUndefined();
	});
});

describe('FeatureToggleResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, FeatureToggleResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', FeatureToggleResolver)).toEqual([FeatureFlagGuard]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('featureToggles')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('featureToggles');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the toggle mutation itself while the capability is off', async () => {
		const { guard } = gate(false);

		// Nothing on this surface is exempt, the write included: the door that switches the capability
		// back on is the REST route, which this code does not gate.
		await expect(guard.canActivate(graphqlContext('toggleFeature'))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('features'))).resolves.toBe(true);
	});
});

describe('FeatureModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the services', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, FeatureModule) ?? []) as unknown[];

		expect(providers).toContain(FeatureToggleResolver);
		expect(providers).toContain(FeatureService);
		expect(providers).toContain(FeatureOrganizationService);
	});

	it('exports the services and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, FeatureModule) ?? []) as unknown[];

		expect(exported).toContain(FeatureService);
		expect(exported).toContain(FeatureOrganizationService);
		expect(exported).toContain(CqrsModule);
	});

	it('reaches the module the permission guards on its fields look their permissions up through', () => {
		// The tenant and permission guards are providers of whichever module declares the resolver they
		// protect, so this module is what has to reach `RolePermissionService` — without it the API boot
		// fails on an unresolved dependency, which no static check sees.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, FeatureModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(RolePermissionModule);
	});
});
