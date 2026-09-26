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
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentTypeResolver } from './organization-employment-type.resolver';

/**
 * The organization employment type over GraphQL.
 *
 * The delivered REST routes serve an employment-type list, one type, a count, a filing, an edit, a
 * removal, and the withdrawal and restoration of a type — two declared by the controller and seven
 * inherited from the CRUD base. This suite pins the half of the two-protocol doctrine that is easy to
 * get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol — including the delivered edit, which writes through the
 *   create path and is therefore an upsert rather than a partial update;
 * - **the guard chain and the permission are the controller's, field by field**: its class carries the
 *   tenant guard, its five write routes add `PermissionGuard` with `ALL_ORG_EDIT`, and its three reads
 *   state neither — so every field restates exactly what the route it mirrors states and nothing more,
 *   because a field demanding a permission its own route does not would refuse a caller REST serves;
 * - the members the delivered read can produce are what the object type carries, and the pivots the
 *   read does not join are neither fields nor filters;
 * - a type that is not there is `null` on the one-row field rather than a refusal.
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
		name: 'Contractor',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Full time',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const organizationEmploymentTypeService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		organizationEmploymentTypeService,
		resolver: new OrganizationEmploymentTypeResolver(organizationEmploymentTypeService as never)
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
 * The concept's name begins with the organization's own, so the match is anchored at both ends rather
 * than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationEmploymentType(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)OrganizationEmploymentType$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationEmploymentTypeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationEmploymentTypeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationEmploymentTypeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof OrganizationEmploymentTypeResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	return Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(OrganizationEmploymentTypeResolver)[field]);
}

/**
 * The guards one resolver field actually runs under: the class's chain followed by whatever the field
 * states of its own, which is the order the guard context creator concatenates them in.
 *
 * This is what a route's own chain has to be compared against rather than the class chain, because the
 * delivered controller does not state one chain for its routes: its five writes restate the permission
 * guard beside the class and its three reads do not.
 */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', OrganizationEmploymentTypeResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(OrganizationEmploymentTypeResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('OrganizationEmploymentTypeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationEmploymentTypes',
				'organizationEmploymentType',
				'organizationEmploymentTypeCount'
			])
		);
	});

	it('declares one mutation per delivered write route, inherited ones included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationEmploymentType',
				'updateOrganizationEmploymentType',
				'deleteOrganizationEmploymentType',
				'softDeleteOrganizationEmploymentType',
				'recoverOrganizationEmploymentType'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'organizationEmploymentType',
			'organizationEmploymentTypeCount',
			'organizationEmploymentTypes'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationEmploymentType',
			'deleteOrganizationEmploymentType',
			'recoverOrganizationEmploymentType',
			'softDeleteOrganizationEmploymentType',
			'updateOrganizationEmploymentType'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationEmploymentTypeConnection \{\s*nodes: \[OrganizationEmploymentType!\]!\s*edges: \[OrganizationEmploymentTypeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationEmploymentTypeEdge \{\s*node: OrganizationEmploymentType!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationEmploymentTypeFilter \{/);
		expect(printed).toMatch(/input OrganizationEmploymentTypeSort \{/);
		expect(printed).toMatch(/enum OrganizationEmploymentTypeSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('carries the row’s own members and neither the pivots nor the tenant relation', () => {
		const body = typeBody('OrganizationEmploymentType');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The three collections are pivots the delivered read does not join, and the relations behind
		// them are not declared: a member that always answers null is worse than no member.
		for (const collection of ['tags', 'members', 'candidates']) {
			expect(body).not.toMatch(new RegExp(`\\b${collection}:`));
		}
		expect(body).not.toMatch(/organization: Organization\b/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/organizationEmploymentTypes\([^)]*withDeleted/);
		expect(printed).not.toMatch(/organizationEmploymentTypeCount\(/);
	});

	it('declares no filter on a pivot the read does not join', () => {
		const filter = printed.match(/input OrganizationEmploymentTypeFilter \{([\s\S]*?)\n\}/)?.[1] ?? '';

		for (const collection of ['tags', 'members', 'candidates']) {
			expect(filter).not.toContain(collection);
		}
	});
});

describe('OrganizationEmploymentTypeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		const connection = await resolver.organizationEmploymentTypes(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its `data` parameter states nothing.
		expect(organizationEmploymentTypeService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationEmploymentTypes();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares and refuses a pivot', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationEmploymentTypes({ name: { eq: 'Full time' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byOrganization = await resolver.organizationEmploymentTypes({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(2);

		const refusal = await resolver
			.organizationEmploymentTypes({ members: { eq: FIRST } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationEmploymentTypes(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byCreated = await resolver.organizationEmploymentTypes(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationEmploymentTypes(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.organizationEmploymentTypes(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationEmploymentTypes(undefined, undefined, undefined, 20);

		const last = await resolver.organizationEmploymentTypes(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationEmploymentTypes(undefined, [{ field: 'members', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationEmploymentTypes(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationEmploymentTypeResolver — one concept, two protocols, the same operations', () => {
	it('reads one type through the same service method the REST route calls', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		expect(await resolver.organizationEmploymentType(SECOND)).toBe(ROWS[0]);
		expect(organizationEmploymentTypeService.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for a type that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();
		organizationEmploymentTypeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationEmploymentType(FIRST)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		expect(await resolver.organizationEmploymentTypeCount()).toBe(2);
		expect(organizationEmploymentTypeService.countBy).toHaveBeenCalledWith();
	});

	it('files a type through the same service method the REST route calls', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		await resolver.createOrganizationEmploymentType({ organizationId: ORGANIZATION, name: 'Contractor' });

		expect(organizationEmploymentTypeService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			name: 'Contractor'
		});
	});

	it('edits a type through the create path the REST route uses, with the identifier merged in', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		const updated = await resolver.updateOrganizationEmploymentType({ id: SECOND, name: 'Subcontractor' });

		// The delivered edit hands the service the stated body with the path identifier merged in, which
		// is the create path; the field makes the same call rather than reaching for the partial update.
		expect(organizationEmploymentTypeService.create).toHaveBeenCalledWith({
			name: 'Subcontractor',
			id: SECOND
		});
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a type through the same service method the REST route calls', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		expect(await resolver.deleteOrganizationEmploymentType(SECOND)).toBe(true);
		expect(organizationEmploymentTypeService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores a type through the same service methods the REST routes call', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationEmploymentType(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationEmploymentTypeService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverOrganizationEmploymentType(SECOND)).toBe(ROWS[0]);
		expect(organizationEmploymentTypeService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationEmploymentTypeService } = surfaces();
		const refusal = new Error('ORGANIZATION_EMPLOYMENT_TYPE_STILL_REFERENCED: an employee is classified by it.');

		organizationEmploymentTypeService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationEmploymentType(SECOND)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'organizationEmploymentTypes', route: 'findAll' },
	{ field: 'organizationEmploymentType', route: 'findById' },
	{ field: 'organizationEmploymentTypeCount', route: 'getCount' },
	{ field: 'createOrganizationEmploymentType', route: 'create' },
	{ field: 'updateOrganizationEmploymentType', route: 'update' },
	{ field: 'deleteOrganizationEmploymentType', route: 'delete' },
	{ field: 'softDeleteOrganizationEmploymentType', route: 'softRemove' },
	{ field: 'recoverOrganizationEmploymentType', route: 'softRecover' }
];

describe('OrganizationEmploymentTypeResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('guards the resolver with the controller’s class chain, plus the gate the endpoint adds', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationEmploymentTypeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationEmploymentTypeController) ?? [];

		// The scope guard is the part both surfaces carry on the class; the gate is this surface's own,
		// because a capability is asked of the endpoint rather than of the resource behind it. Neither
		// class carries the permission guard: the controller states it on each of its five write routes,
		// and the parity below reads it back off the field that mirrors one — a class-level one here
		// would guard the three reads with something no read route carries.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('restates the permission guard on the five routes that state a permission, and not on the three that do not', () => {
		const writes = ROUTE_PARITY.filter(({ route }) =>
			permissionOfRoute(OrganizationEmploymentTypeController, route)
		);
		const reads = ROUTE_PARITY.filter(
			({ route }) => !permissionOfRoute(OrganizationEmploymentTypeController, route)
		);

		// Five of the eight routes state a permission and three do not, so this cannot pass on a run
		// that lost the metadata altogether: the two sets would collapse into one and one of the two
		// counts below would be wrong.
		expect(writes).toHaveLength(5);
		expect(reads).toHaveLength(3);

		// The guard is on the routes that state a permission and on no others, and the field that
		// mirrors each one has to say the same: a read field carrying it would be a read this surface
		// refuses and the REST route serves.
		for (const { field } of writes) {
			expect(guardsOfField(field)).toContain(PermissionGuard);
		}
		for (const { field } of reads) {
			expect(guardsOfField(field)).not.toContain(PermissionGuard);
		}
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, route } of ROUTE_PARITY) {
			// A route that is not served at all would make the comparison meaningless, so the handler is
			// asserted to be there before the two readings are compared — inherited handlers included.
			expect(typeof handlersOf(OrganizationEmploymentTypeController)[route]).toBe('function');

			// Read per field rather than against one class chain, because the routes no longer share one:
			// the five writes state the permission guard of their own and the three reads do not, so a
			// single class-wide comparison would either miss a field that widened the surface or drag
			// every field up to the widest route's chain. The one addition is the gate on the endpoint
			// itself, which no route carries because it is not a scope.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(OrganizationEmploymentTypeController, route), FeatureFlagGuard].sort()
			);
		}
	});

	it('states no permission on the class, where the controller states none of its own', () => {
		// A permission on the class would gate every field, the reads included, and the reads mirror
		// routes that demand none; the controller states its permissions one route at a time instead,
		// which is why the fields that mirror those routes state theirs one field at a time.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationEmploymentTypeController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationEmploymentTypeResolver)).toBeUndefined();
	});

	it('states on every field exactly what its own route states, read from the route', () => {
		// Read from both surfaces rather than restated here: a table of permission names would agree with
		// the resolver while disagreeing with the controller, which is the failure this half of the
		// doctrine exists to catch. Five of these routes demand `ALL_ORG_EDIT`, so their fields must too
		// — and a comparison of two absences proves nothing, which is what the control rules out.
		expect(
			ROUTE_PARITY.some(({ route }) => permissionOfRoute(OrganizationEmploymentTypeController, route))
		).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(OrganizationEmploymentTypeResolver)[field])
			).toEqual(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationEmploymentTypeController)[route]));
			expect(permissionOfField(field)).toEqual(permissionOfRoute(OrganizationEmploymentTypeController, route));
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
		getHandler: () => (OrganizationEmploymentTypeResolver.prototype as never)[field],
		getClass: () => OrganizationEmploymentTypeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationEmploymentTypeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationEmploymentTypeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationEmploymentTypeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationEmploymentTypes'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationEmploymentTypes');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationEmploymentTypes'))).resolves.toBe(true);
	});
});
