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
import { OrganizationController } from './organization.controller';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './commands';

/**
 * The organization over GraphQL.
 *
 * The delivered REST routes serve an organization list, one organization, a count, a filing, an edit,
 * a removal, and the withdrawal and restoration of an organization. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the two readings that are easy to get backwards: the node query, whose route
 *   carries an *empty* permission declaration that overrides the controller's class-level one, and the
 *   three removals, which inherit the class-level one because the routes declare none;
 * - the members the delivered read can produce are what the object type carries, and a relation the
 *   read does not join is an identifier rather than a field that would answer null;
 * - an organization that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const DEFAULT_ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them.
 */
const ROWS = [
	{
		id: OTHER_ORG,
		tenantId: TENANT,
		name: 'Zephyr Trading',
		currency: 'EUR',
		isDefault: false,
		regionCode: 'DE',
		timeZone: 'Europe/Berlin',
		currencyPosition: 'LEFT',
		allowManualTime: true,
		timeFormat: 24,
		screenshotFrequency: 10,
		contactId: null,
		imageId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: DEFAULT_ORG,
		tenantId: TENANT,
		name: 'Acme',
		currency: 'USD',
		isDefault: true,
		regionCode: 'US',
		timeZone: 'America/New_York',
		currencyPosition: 'LEFT',
		allowManualTime: true,
		timeFormat: 12,
		screenshotFrequency: 10,
		contactId: null,
		imageId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };

	return {
		organizationService,
		commandBus,
		resolver: new OrganizationResolver(organizationService as never, commandBus as never)
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
 * The concept's name is a *prefix* of its neighbours' — `organizationContact`, `organizationProject`
 * and their fields all begin with the same seven letters — so the match is anchored at both ends
 * rather than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organization(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)Organization$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. An *empty* declaration counts as a
 * declaration here, which is the whole point of the node query below: `@Permissions()` on a route is
 * not the same statement as no `@Permissions` at all.
 */
function permissionOfRoute(controller: typeof OrganizationController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['organizations', 'organization', 'organizationCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganization',
				'updateOrganization',
				'deleteOrganization',
				'softDeleteOrganization',
				'recoverOrganization'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['organization', 'organizationCount', 'organizations']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganization',
			'deleteOrganization',
			'recoverOrganization',
			'softDeleteOrganization',
			'updateOrganization'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationConnection \{\s*nodes: \[Organization!\]!\s*edges: \[OrganizationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationEdge \{\s*node: Organization!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationFilter \{/);
		expect(printed).toMatch(/input OrganizationSort \{/);
		expect(printed).toMatch(
			/enum OrganizationSortField \{\s*createdAt\s*updatedAt\s*name\s*currency\s*isDefault\s*\}/
		);
	});

	it('carries the settings columns the rest of the platform reads its defaults from', () => {
		const body = typeBody('Organization');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/currency: String!/);
		expect(body).toMatch(/currencyPosition: String!/);
		expect(body).toMatch(/timeFormat: Int!/);
		expect(body).toMatch(/standardWorkHoursPerDay: Int/);
		expect(body).toMatch(/defaultValueDateType: String/);
		expect(body).toMatch(/startWeekOn: String/);
		expect(body).toMatch(/allowManualTime: Boolean!/);
		expect(body).toMatch(/trackKeyboardMouseActivity: Boolean!/);
		// A rate is a rate and an amount is an amount: nothing on this row is money, so the one
		// fractional member is a Float and no member of this type is a Decimal.
		expect(body).toMatch(/bonusPercentage: Float/);
		expect(body).not.toContain('Decimal');
		// The screenshot interval is a `numeric` column, so a fractional interval the write accepts is
		// one this surface has to be able to answer.
		expect(body).toMatch(/screenshotFrequency: Float!/);
	});

	it('carries the relation the delivered read always joins, and identifiers for the ones it does not', () => {
		const body = typeBody('Organization');

		// `image` is declared eager on the entity, so it travels on every row either read returns.
		expect(body).toMatch(/image: ImageAsset/);
		expect(body).toMatch(/imageId: ID/);
		// The contact row is a relation the delivered read joins only when a REST caller names it, and
		// this surface names none: the identifier is what is carried.
		expect(body).toMatch(/contactId: ID/);
		expect(body).not.toMatch(/\bcontact: Contact\b/);
		// The collections are neither joined nor named by a column of this row.
		for (const collection of ['employees', 'invoices', 'tags', 'skills', 'awards', 'languages']) {
			expect(body).not.toMatch(new RegExp(`\\b${collection}:`));
		}
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/organizations\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/organizationCount\(/);
	});

	it('declares only the create members the delivered write reads, and not one it discards', () => {
		const body = printed.match(/input CreateOrganizationInput \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/currency: String!/);
		expect(body).toMatch(/standardWorkHoursPerDay: Int/);
		expect(body).toMatch(/contact: OrganizationContactDetailInput/);
		// The delivered body validates `tagIds` and the handler then drops it, so the member is not
		// offered: a write that is accepted and silently discarded is worse than one not offered.
		expect(body).not.toContain('tagIds');
		// No member names the tenant, because the tenant comes from the credential on every write here.
		expect(body).not.toContain('tenantId');
	});

	it('declares the visibility flags on the edit only, which is where the delivered body validates them', () => {
		const create = printed.match(/input CreateOrganizationInput \{([\s\S]*?)\n\}/)?.[1] ?? '';
		const update = printed.match(/input UpdateOrganizationInput \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(create).not.toContain('show_profits');
		expect(update).toMatch(/show_profits: Boolean/);
		expect(update).toMatch(/show_employees_count: Boolean/);
		expect(update).toMatch(/id: ID!/);
	});
});

describe('OrganizationResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationService } = surfaces();

		const connection = await resolver.organizations(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(organizationService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(DEFAULT_ORG);
	});

	it('orders by name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizations();

		expect(connection.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG, OTHER_ORG]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizations({ name: { ilike: 'acm%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG]);

		const byDefault = await resolver.organizations({ isDefault: { eq: true } });
		expect(byDefault.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG]);

		const byCurrency = await resolver.organizations({ currency: { in: ['EUR'] } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([OTHER_ORG]);

		// A relation the read does not join is not a filter, so it is refused rather than evaluated
		// against a row that carries none of it.
		const refusal = await resolver
			.organizations({ employees: { eq: DEFAULT_ORG } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizations(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_ORG, DEFAULT_ORG]);

		const byDefault = await resolver.organizations(undefined, [{ field: 'isDefault', direction: 'DESC' }]);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG, OTHER_ORG]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizations(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG]);

		const second = await resolver.organizations(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_ORG]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizations(undefined, undefined, undefined, 20);

		const last = await resolver.organizations(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([DEFAULT_ORG]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizations(undefined, [{ field: 'website', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizations(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationResolver — one concept, two protocols, the same operations', () => {
	it('reads one organization through the same service method the REST route calls', async () => {
		const { resolver, organizationService } = surfaces();

		expect(await resolver.organization(DEFAULT_ORG)).toBe(ROWS[1]);
		expect(organizationService.findOneByIdString).toHaveBeenCalledWith(DEFAULT_ORG);
	});

	it('answers null for an organization that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationService } = surfaces();
		organizationService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organization(OTHER_ORG)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationService } = surfaces();

		expect(await resolver.organizationCount()).toBe(2);
		expect(organizationService.countBy).toHaveBeenCalledWith();
	});

	it('files an organization through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganization({ name: 'Acme', currency: 'USD', regionCode: 'US' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationCreateCommand);
		expect(command.input).toEqual({ name: 'Acme', currency: 'USD', regionCode: 'US' });
		// The tenant is never a member of the payload: the handler stamps it from the credential.
		expect(command.input).not.toHaveProperty('tenantId');
	});

	it('edits an organization through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganization({ id: DEFAULT_ORG, name: 'Acme', currency: 'USD', show_profits: true });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationUpdateCommand);
		expect(command.id).toBe(DEFAULT_ORG);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({ name: 'Acme', currency: 'USD', show_profits: true });
	});

	it('removes an organization through the same service method the REST route calls', async () => {
		const { resolver, organizationService } = surfaces();

		expect(await resolver.deleteOrganization(DEFAULT_ORG)).toBe(true);
		expect(organizationService.delete).toHaveBeenCalledWith(DEFAULT_ORG);
	});

	it('withdraws and restores an organization through the same service methods the REST routes call', async () => {
		const { resolver, organizationService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganization(DEFAULT_ORG);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationService.softRemove).toHaveBeenCalledWith(DEFAULT_ORG);

		expect(await resolver.recoverOrganization(DEFAULT_ORG)).toBe(ROWS[1]);
		expect(organizationService.softRecover).toHaveBeenCalledWith(DEFAULT_ORG);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationService } = surfaces();
		const refusal = new Error('ORGANIZATION_STILL_REFERENCED: a channel still points at this organization.');

		organizationService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganization(DEFAULT_ORG)).rejects.toBe(refusal);
	});
});

describe('OrganizationResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizations', 'findAll'],
			['organization', 'findById'],
			['organizationCount', 'getCount'],
			['createOrganization', 'create'],
			['updateOrganization', 'update'],
			['deleteOrganization', 'delete'],
			['softDeleteOrganization', 'softRemove'],
			['recoverOrganization', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries an empty permission on the node query, because the route it mirrors declares one', () => {
		// The delivered `GET /:id` carries `@Permissions()` with no argument. That is not the same
		// statement as carrying none: the guard reads the handler's declaration before the class's, so
		// the empty declaration overrides the controller's class-level edit permission. A field here
		// that inherited the class permission would be narrower than the route; one that stated nothing
		// would be narrower still.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationController.prototype.findById)).toEqual([]);
		expect(permissionOfField('organization')).toEqual([]);
		expect(permissionOfRoute(OrganizationController, 'findById')).toEqual([]);

		// The writes declare none of their own, so they resolve to the class-level edit permission — and
		// the fields state it rather than leaving it to be inherited, so the parity is readable.
		for (const handler of ['create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(permissionOfRoute(OrganizationController, handler)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		}

		// The two read routes that do state the view permission state it here too, and never the edit one.
		for (const field of ['organizations', 'organizationCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_VIEW]);
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
		getHandler: () => (OrganizationResolver.prototype as never)[field],
		getClass: () => OrganizationResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizations')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizations');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizations'))).resolves.toBe(true);
	});
});
