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
import { PipelineController } from './pipeline.controller';
import { PipelineResolver } from './pipeline.resolver';

/**
 * The sales pipeline over GraphQL.
 *
 * The delivered `/api/pipelines` routes serve a page, a list, one pipeline, the deals of one
 * pipeline, a count, a filing, an edit, a removal and the withdrawal and restoration of a pipeline.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and each list is a connection with the
 *   platform's own cursor codec behind it;
 * - every field reaches the same `PipelineService` method the REST route reaches;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the count, whose route inherits the controller's class-level *edit*
 *   permission while its read siblings state the view one;
 * - **the deals of a pipeline are a root field of their own** rather than a filter on the pipeline
 *   list, because that read joins the stage pivot neither list read joins;
 * - the members the delivered reader cannot produce are not declared at all.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const STAGE = '00000000-0000-4000-8000-000000000020';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';
const DEAL_WON = '00000000-0000-4000-8000-000000000040';
const DEAL_OPEN = '00000000-0000-4000-8000-000000000041';

/** The pipelines a scripted service answers with. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Inbound',
		description: 'Everything the site brings in',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Partners',
		description: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The deals a scripted pipeline-deal read answers with, in the board's own stage order. */
const DEALS = [
	{ id: DEAL_OPEN, tenantId: TENANT, organizationId: ORGANIZATION, title: 'Expansion', probability: 2, stageId: STAGE },
	{ id: DEAL_WON, tenantId: TENANT, organizationId: ORGANIZATION, title: 'Renewal', probability: 5, stageId: STAGE }
];

/** The resolver, over a scripted service. */
function surfaces() {
	const pipelineService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getPipelineDeals: jest.fn().mockResolvedValue({ items: DEALS, total: DEALS.length }),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { pipelineService, resolver: new PipelineResolver(pipelineService as never) };
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

/** The member names of one declared type, read off the parsed schema rather than off its text. */
function fieldNames(name: string): string[] {
	const declared = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(declared?.getFields() ?? {});
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PipelineController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof PipelineController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof PipelineController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = PipelineResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['pipelines', 'findAll'],
	['pipeline', 'findById'],
	['pipelineCount', 'getCount'],
	['pipelineDeals', 'getPipelineDeals'],
	['createPipeline', 'create'],
	['updatePipeline', 'update'],
	['deletePipeline', 'delete'],
	['softDeletePipeline', 'softRemove'],
	['recoverPipeline', 'softRecover']
];

describe('PipelineResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the deals of one pipeline', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['pipelines', 'pipeline', 'pipelineCount', 'pipelineDeals'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createPipeline',
				'updatePipeline',
				'deletePipeline',
				'softDeletePipeline',
				'recoverPipeline'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type PipelineConnection \{\s*nodes: \[Pipeline!\]!\s*edges: \[PipelineEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type PipelineEdge \{\s*node: Pipeline!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input PipelineFilter \{/);
		expect(printed).toMatch(/input PipelineSort \{/);
		expect(printed).toMatch(/enum PipelineSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('answers the deals of one pipeline with the deal domain’s own connection', () => {
		// One connection for one kind of row: the field borrows `DealConnection` rather than declaring
		// a second page shape, so a cursor minted on `deals` is valid here.
		expect(printed).toMatch(/pipelineDeals\([^)]*\): DealConnection!/);
		expect(printed).toMatch(/input PipelineStageInput \{/);
	});

	it('carries the columns the row always holds and not the stage collection', () => {
		const body = typeBody('Pipeline');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/description: String\b/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
		// `stages` is a `@OneToMany`: the delivered list read joins none, so the member would be null
		// on every row this surface answers. The stages are reached from the rows that own `pipelineId`.
		expect(body).not.toContain('stages');
	});

	it('declares no `index` member on a stage, because the delivered writer overwrites it', () => {
		// The writer assigns each stage its position itself, before it saves anything, so an `index` a
		// caller states is accepted and replaced. Asserted over the parsed input: the printed schema
		// carries each member's description between the members, which a text pattern would have to
		// reproduce, and the member set is what this test is about.
		expect(fieldNames('PipelineStageInput')).toEqual(['id', 'name', 'description']);
	});
});

describe('PipelineResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, pipelineService } = surfaces();

		const connection = await resolver.pipelines(undefined, undefined, undefined, 20);

		expect(pipelineService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders by the resource’s own default when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.pipelines()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.pipelines({ name: { ilike: 'part%' } })).nodes.map((node) => node.id)).toEqual([SECOND]);
		expect((await resolver.pipelines({ description: { isNull: true } })).nodes.map((node) => node.id)).toEqual([
			SECOND
		]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.pipelines(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.pipelines(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.pipelines(undefined, [{ field: 'stages', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.pipelines({ stages: { eq: STAGE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('PipelineResolver — the deals of one pipeline are a read of their own', () => {
	it('reads through the same service method the delivered route calls, with the route’s own arguments', async () => {
		const { resolver, pipelineService } = surfaces();

		await resolver.pipelineDeals(FIRST);

		// The route passes the pipeline, the `where` it bound from the query string — nothing, when the
		// caller states nothing — and its own empty relation list.
		expect(pipelineService.getPipelineDeals).toHaveBeenCalledWith(FIRST);
	});

	it('keeps the board order the delivered read fixed, instead of imposing one of its own', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.pipelineDeals(FIRST, undefined, undefined, undefined, 20);

		// The read orders by the position of each deal's stage — a joined column the deal row does not
		// carry — so the connection declares no default sort and the rows keep the service's order.
		expect(connection.nodes.map((node) => node.id)).toEqual([DEAL_OPEN, DEAL_WON]);
	});

	it('applies the deal domain’s own filter vocabulary to the rows it was given', async () => {
		const { resolver } = surfaces();

		const narrowed = await resolver.pipelineDeals(FIRST, { probability: { gte: 5 } });

		expect(narrowed.nodes.map((node) => node.id)).toEqual([DEAL_WON]);
	});

	it('walks by cursor over the rows the read returned', async () => {
		const { resolver } = surfaces();
		const first = await resolver.pipelineDeals(FIRST, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([DEAL_OPEN]);

		const second = await resolver.pipelineDeals(FIRST, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([DEAL_WON]);
	});

	it('lets the delivered read’s empty answer through rather than turning it into a refusal', async () => {
		const { resolver, pipelineService } = surfaces();
		// The delivered method catches a failed read and answers an empty page.
		pipelineService.getPipelineDeals.mockResolvedValueOnce({ items: [], total: 0 });

		const connection = await resolver.pipelineDeals(SECOND);

		expect(connection.nodes).toEqual([]);
		expect(connection.totalCount).toBe(0);
		expect(connection.pageInfo.startCursor).toBeNull();
	});
});

describe('PipelineResolver — one concept, two protocols, the same operations', () => {
	it('reads one pipeline through the same service method the REST route calls', async () => {
		const { resolver, pipelineService } = surfaces();

		expect(await resolver.pipeline(FIRST)).toBe(ROWS[0]);
		expect(pipelineService.findById).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a pipeline that is not there', async () => {
		const { resolver, pipelineService } = surfaces();
		pipelineService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.pipeline(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, pipelineService } = surfaces();

		expect(await resolver.pipelineCount()).toBe(2);
		expect(pipelineService.countBy).toHaveBeenCalledWith();
	});

	it('files a pipeline, with its stages, through the same service method the REST route calls', async () => {
		const { resolver, pipelineService } = surfaces();
		const stages = [{ name: 'Qualified' }, { name: 'Won' }];

		await resolver.createPipeline({ organizationId: ORGANIZATION, name: 'Inbound', stages });

		expect(pipelineService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, name: 'Inbound', stages })
		);
	});

	it('changes a pipeline through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, pipelineService } = surfaces();

		const updated = await resolver.updatePipeline({ id: FIRST, name: 'Inbound 2026', stages: [{ id: STAGE, name: 'Won' }] });

		expect(pipelineService.update).toHaveBeenCalledWith(FIRST, {
			name: 'Inbound 2026',
			stages: [{ id: STAGE, name: 'Won' }]
		});
		expect(pipelineService.findById).toHaveBeenCalledWith(FIRST);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a pipeline through the same service method the REST route calls', async () => {
		const { resolver, pipelineService } = surfaces();

		expect(await resolver.deletePipeline(FIRST)).toBe(true);
		expect(pipelineService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a pipeline through the same service methods the REST routes call', async () => {
		const { resolver, pipelineService } = surfaces();

		expect((await resolver.softDeletePipeline(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(pipelineService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverPipeline(FIRST)).toBe(ROWS[0]);
		expect(pipelineService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('PipelineResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', PipelineResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', PipelineController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', PipelineResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(PipelineController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PipelineResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, PipelineController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(PipelineController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the edit permission on the count, because the route it mirrors does', () => {
		// `GET /pipelines/count` is inherited from the CRUD base without a permission of its own, so it
		// runs under the controller's class-level edit permission while its read siblings state the view
		// one. Widening the count to the view permission here would give GraphQL a scope REST does not
		// have, which is what the two-protocol rule forbids.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PipelineController.prototype.getCount)).toBeUndefined();
		expect(permissionOfField('pipelineCount')).toEqual([PermissionsEnum.EDIT_SALES_PIPELINES]);
		expect(permissionOfRoute(PipelineController, 'getCount')).toEqual([PermissionsEnum.EDIT_SALES_PIPELINES]);

		for (const field of ['pipelines', 'pipeline', 'pipelineDeals']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.VIEW_SALES_PIPELINES]);
		}
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
		getHandler: () => (PipelineResolver.prototype as never)[field],
		getClass: () => PipelineResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('PipelineResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, PipelineResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', PipelineResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('pipelines')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('pipelines');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('pipelines'))).resolves.toBe(true);
	});
});
