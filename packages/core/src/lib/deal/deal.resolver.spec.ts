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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { DealController } from './deal.controller';
import { DealResolver } from './deal.resolver';

/**
 * The deal over GraphQL.
 *
 * The delivered `/api/deals` routes serve a list, one deal, a count, a filing, an edit, a removal and
 * the withdrawal and restoration of a deal. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and the list is a connection with the
 *   platform's own cursor codec behind it, so a cursor obtained over REST resumes here;
 * - every field reaches the same `DealService` method the REST route reaches;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the edit, the removal and the two lifecycle moves, whose routes inherit the
 *   controller's class-level *view* permission, and the create, which is the one route that raises
 *   itself to the edit one;
 * - the members the delivered reader cannot produce are not declared at all;
 * - a deal that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const STAGE = '00000000-0000-4000-8000-000000000020';
const CLIENT = '00000000-0000-4000-8000-000000000030';
const WON = '00000000-0000-4000-8000-000000000010';
const OPEN = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: WON,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Renewal',
		probability: 5,
		stageId: STAGE,
		clientId: CLIENT,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OPEN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Expansion',
		probability: 2,
		stageId: STAGE,
		clientId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const dealService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { dealService, resolver: new DealResolver(dealService as never) };
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

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof DealController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof DealController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof DealController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = DealResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['deals', 'findAll'],
	['deal', 'findById'],
	['dealCount', 'getCount'],
	['createDeal', 'create'],
	['updateDeal', 'update'],
	['deleteDeal', 'delete'],
	['softDeleteDeal', 'softRemove'],
	['recoverDeal', 'softRecover']
];

describe('DealResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['deals', 'deal', 'dealCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createDeal', 'updateDeal', 'deleteDeal', 'softDeleteDeal', 'recoverDeal'])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type DealConnection \{\s*nodes: \[Deal!\]!\s*edges: \[DealEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type DealEdge \{\s*node: Deal!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input DealFilter \{/);
		expect(printed).toMatch(/input DealSort \{/);
		expect(printed).toMatch(
			/enum DealSortField \{\s*createdAt\s*updatedAt\s*title\s*probability\s*stageId\s*clientId\s*\}/
		);
	});

	it('carries the columns the row always holds and neither relation as an object', () => {
		const body = typeBody('Deal');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/title: String!/);
		// A probability is a number whose scale the SDL states: the delivered column is an `int` and
		// the delivered validator bounds it to 0–5, so the member is a whole number and says so.
		expect(body).toMatch(/probability: Int!/);
		expect(body).toMatch(/stageId: ID!/);
		expect(body).toMatch(/clientId: ID\b/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
		// Both relations are owner-side identifiers only: the connection's read joins neither row, so
		// an object member would be absent on exactly the rows this surface answers.
		expect(body).not.toMatch(/\bstage: /);
		expect(body).not.toMatch(/\bclient: /);
	});

	it('offers no argument it cannot honour', () => {
		// The count route passes its query string through as the store's own `where`, which this
		// surface cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/dealCount\(/);
		// No money member is a `Float`, and the type carries no money member at all.
		expect(typeBody('Deal')).not.toMatch(/: Float/);
	});
});

describe('DealResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, dealService } = surfaces();

		const connection = await resolver.deals(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(dealService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(WON);
	});

	it('orders by the resource’s own default when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.deals();

		expect(connection.nodes.map((node) => node.id)).toEqual([WON, OPEN]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.deals({ title: { ilike: 'ren%' } })).nodes.map((node) => node.id)).toEqual([WON]);
		expect((await resolver.deals({ probability: { gte: 5 } })).nodes.map((node) => node.id)).toEqual([WON]);
		expect((await resolver.deals({ clientId: { isNull: true } })).nodes.map((node) => node.id)).toEqual([OPEN]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.deals(undefined, [{ field: 'title', direction: 'ASC' }]);
		expect(byTitle.nodes.map((node) => node.id)).toEqual([OPEN, WON]);

		const byProbability = await resolver.deals(undefined, [{ field: 'probability', direction: 'DESC' }]);
		expect(byProbability.nodes.map((node) => node.id)).toEqual([WON, OPEN]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.deals(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([WON]);

		const second = await resolver.deals(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OPEN]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.deals(undefined, [{ field: 'client', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.deals({ stage: { eq: STAGE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.deals(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('DealResolver — one concept, two protocols, the same operations', () => {
	it('reads one deal through the same service method the REST route calls', async () => {
		const { resolver, dealService } = surfaces();

		expect(await resolver.deal(WON)).toBe(ROWS[0]);
		expect(dealService.findOneByIdString).toHaveBeenCalledWith(WON);
	});

	it('answers null for a deal that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, dealService } = surfaces();
		dealService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.deal(OPEN)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, dealService } = surfaces();

		expect(await resolver.dealCount()).toBe(2);
		expect(dealService.countBy).toHaveBeenCalledWith();
	});

	it('files a deal through the same service method the REST route calls', async () => {
		const { resolver, dealService } = surfaces();

		await resolver.createDeal({ organizationId: ORGANIZATION, title: 'Renewal', probability: 5, stageId: STAGE });

		expect(dealService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, title: 'Renewal', probability: 5, stageId: STAGE })
		);
	});

	it('changes a deal through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, dealService } = surfaces();

		const updated = await resolver.updateDeal({ id: WON, probability: 4 });

		expect(dealService.update).toHaveBeenCalledWith(WON, { probability: 4 });
		expect(dealService.findOneByIdString).toHaveBeenCalledWith(WON);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a deal through the same service method the REST route calls', async () => {
		const { resolver, dealService } = surfaces();

		expect(await resolver.deleteDeal(WON)).toBe(true);
		expect(dealService.delete).toHaveBeenCalledWith(WON);
	});

	it('withdraws and restores a deal through the same service methods the REST routes call', async () => {
		const { resolver, dealService } = surfaces();

		const withdrawn = await resolver.softDeleteDeal(WON);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(dealService.softRemove).toHaveBeenCalledWith(WON);

		expect(await resolver.recoverDeal(WON)).toBe(ROWS[0]);
		expect(dealService.softRecover).toHaveBeenCalledWith(WON);
	});

	it('lets a refusal through rather than turning it into an answer', async () => {
		const { resolver, dealService } = surfaces();
		const refusal = new Error('A deal whose stage was removed cannot be filed.');

		dealService.create.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createDeal({ organizationId: ORGANIZATION, title: 'x', probability: 1, stageId: STAGE })
		).rejects.toBe(refusal);
	});
});

describe('DealResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', DealResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', DealController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', DealResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(DealController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DealResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, DealController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(DealController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the class’s view permission on every write but the create', () => {
		// The controller overrides only the list, the one-row read and the create; the edit, the
		// removal and the two lifecycle moves are inherited from the CRUD base and therefore run under
		// the controller's class-level *view* permission. Widening them here — or narrowing the reads
		// with the edit permission the resource's own name suggests — is the asymmetry the
		// two-protocol rule forbids us to resolve on one surface only.
		for (const field of ['deals', 'deal', 'dealCount', 'updateDeal', 'deleteDeal', 'softDeleteDeal', 'recoverDeal']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.VIEW_SALES_PIPELINES]);
		}

		expect(permissionOfField('createDeal')).toEqual([PermissionsEnum.EDIT_SALES_PIPELINES]);
		expect(permissionOfRoute(DealController, 'create')).toEqual([PermissionsEnum.EDIT_SALES_PIPELINES]);
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
		getHandler: () => (DealResolver.prototype as never)[field],
		getClass: () => DealResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('DealResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, DealResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', DealResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('deals')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('deals');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('deals'))).resolves.toBe(true);
	});
});
