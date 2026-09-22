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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationAwardController } from './organization-award.controller';
import { OrganizationAwardResolver } from './organization-award.resolver';

/**
 * The organization award over GraphQL.
 *
 * The delivered REST routes serve an award list, one award, a count, a filing, an edit, a removal, and
 * the withdrawal and restoration of an award. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain is the controller's and no field states a permission**, because the delivered
 *   controller states none anywhere — not on its own routes and not on the five it inherits;
 * - the members the delivered read can produce are what the object type carries, and a relation the
 *   read does not join is not declared at all;
 * - an award that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Best Workplace',
		year: '2026',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Fastest Growing',
		year: '2025',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const organizationAwardService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		organizationAwardService,
		resolver: new OrganizationAwardResolver(organizationAwardService as never)
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
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The concept's name is a prefix of the organization's own fields, so the match is anchored at both
 * ends rather than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationAward(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)OrganizationAward$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationAwardController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationAwardController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationAwardController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationAwardResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationAwardResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['organizationAwards', 'organizationAward', 'organizationAwardCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationAward',
				'updateOrganizationAward',
				'deleteOrganizationAward',
				'softDeleteOrganizationAward',
				'recoverOrganizationAward'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once.
		expect(ownedRootFields('Query')).toEqual([
			'organizationAward',
			'organizationAwardCount',
			'organizationAwards'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationAward',
			'deleteOrganizationAward',
			'recoverOrganizationAward',
			'softDeleteOrganizationAward',
			'updateOrganizationAward'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationAwardConnection \{\s*nodes: \[OrganizationAward!\]!\s*edges: \[OrganizationAwardEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationAwardEdge \{\s*node: OrganizationAward!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationAwardFilter \{/);
		expect(printed).toMatch(/input OrganizationAwardSort \{/);
		expect(printed).toMatch(/enum OrganizationAwardSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('carries the row’s own members and nothing the delivered read cannot produce', () => {
		const body = typeBody('OrganizationAward');

		expect(body).toMatch(/name: String!/);
		// The year is text in the column, so it is text here: declaring it a number would refuse the
		// values the delivered write already stores.
		expect(body).toMatch(/year: String!/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The row has no relation of its own and nothing eager, so no relation member is declared.
		expect(body).not.toMatch(/organization: Organization\b/);
		expect(body).not.toContain('tenant:');
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/organizationAwards\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/organizationAwardCount\(/);
	});

	it('sorts by name and the timestamps, and never by the free-text year', () => {
		const enumBody = printed.match(/enum OrganizationAwardSortField \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(enumBody).toContain('name');
		expect(enumBody).not.toContain('year');
		// Filtering on it is still offered: that is a question a caller asks.
		expect(printed).toMatch(/input OrganizationAwardFilter \{\s*id: IDFilter\s*name: StringFilter\s*year: StringFilter/);
	});
});

describe('OrganizationAwardResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationAwardService } = surfaces();

		const connection = await resolver.organizationAwards(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its `data` parameter states nothing.
		expect(organizationAwardService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationAwards();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationAwards({ name: { ilike: 'best%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byYear = await resolver.organizationAwards({ year: { eq: '2025' } });
		expect(byYear.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byOrganization = await resolver.organizationAwards({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(2);

		// A field the resource does not declare is refused rather than ignored.
		const refusal = await resolver
			.organizationAwards({ members: { eq: FIRST } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationAwards(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byCreated = await resolver.organizationAwards(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationAwards(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.organizationAwards(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationAwards(undefined, undefined, undefined, 20);

		const last = await resolver.organizationAwards(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationAwards(undefined, [{ field: 'year', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationAwards(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationAwardResolver — one concept, two protocols, the same operations', () => {
	it('reads one award through the same service method the REST route calls', async () => {
		const { resolver, organizationAwardService } = surfaces();

		expect(await resolver.organizationAward(SECOND)).toBe(ROWS[0]);
		expect(organizationAwardService.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for an award that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationAwardService } = surfaces();
		organizationAwardService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationAward(FIRST)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationAwardService } = surfaces();

		expect(await resolver.organizationAwardCount()).toBe(2);
		expect(organizationAwardService.countBy).toHaveBeenCalledWith();
	});

	it('files an award through the same service method the REST route calls', async () => {
		const { resolver, organizationAwardService } = surfaces();

		await resolver.createOrganizationAward({ organizationId: ORGANIZATION, name: 'Best Workplace', year: '2026' });

		expect(organizationAwardService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			name: 'Best Workplace',
			year: '2026'
		});
	});

	it('edits an award through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, organizationAwardService } = surfaces();

		const updated = await resolver.updateOrganizationAward({ id: SECOND, year: '2027' });

		expect(organizationAwardService.update).toHaveBeenCalledWith(SECOND, { year: '2027' });
		// The store's update result is a statement about the write rather than a row, so the answer is
		// read back through the same service.
		expect(organizationAwardService.findOneByIdString).toHaveBeenCalledWith(SECOND);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes an award through the same service method the REST route calls', async () => {
		const { resolver, organizationAwardService } = surfaces();

		expect(await resolver.deleteOrganizationAward(SECOND)).toBe(true);
		expect(organizationAwardService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores an award through the same service methods the REST routes call', async () => {
		const { resolver, organizationAwardService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationAward(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationAwardService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverOrganizationAward(SECOND)).toBe(ROWS[0]);
		expect(organizationAwardService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationAwardService } = surfaces();
		const refusal = new Error('ORGANIZATION_AWARD_STILL_REFERENCED: a profile still points at this award.');

		organizationAwardService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationAward(SECOND)).rejects.toBe(refusal);
	});
});

describe('OrganizationAwardResolver — the guard stack is the controller’s, and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationAwardResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationAwardController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, FeatureFlagGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// The delivered controller has no permission guard to mirror, so the resolver carries none
		// either: the gate is the only guard added to the chain the routes already run under.
		expect(resolverGuards).not.toContain(PermissionGuard);
		expect(controllerGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationAwardResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim.
			expect([...guardsOfRoute(OrganizationAwardController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationAwardController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationAwardResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationAwards', 'findAll'],
			['organizationAward', 'findById'],
			['organizationAwardCount', 'getCount'],
			['createOrganizationAward', 'create'],
			['updateOrganizationAward', 'update'],
			['deleteOrganizationAward', 'delete'],
			['softDeleteOrganizationAward', 'softRemove'],
			['recoverOrganizationAward', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationAwardController, handler)])
		);

		expect(stated).toEqual(expected);
		// Every one of them is unpermissioned, on both surfaces: the controller states none on any route,
		// and a field that demanded one would refuse a caller the REST route serves.
		for (const [, permission] of Object.entries(stated)) {
			expect(permission).toBeUndefined();
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
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
		getHandler: () => (OrganizationAwardResolver.prototype as never)[field],
		getClass: () => OrganizationAwardResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationAwardResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationAwardResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationAwardResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationAwards')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationAwards');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationAwards'))).resolves.toBe(true);
	});
});
