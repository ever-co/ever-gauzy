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
import { OfficialHolidayController } from './official-holiday.controller';
import { OfficialHolidayResolver } from './official-holiday.resolver';

/**
 * The official holiday over GraphQL.
 *
 * The delivered `/api/official-holiday` routes serve the list, one holiday, a filing, an edit and a
 * removal — five, and the controller inherits nothing. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - each of the five is a root field, and the list is a connection with the platform's own cursor
 *   codec behind it;
 * - **there is no count field and no lifecycle pair**, because the resource serves no such route;
 * - every field reaches the same `OfficialHolidayService` method the REST route reaches;
 * - the guard chain is the controller's and every field states the permission pair its own route
 *   states, with the class's `ALL_ORG_EDIT` half restated in each;
 * - the delivered read's own calendar order is kept rather than replaced;
 * - the delivered `year` narrowing is expressible through the connection's `or` group.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHRISTMAS = '00000000-0000-4000-8000-000000000010';
const MAY_DAY = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered read returns them. */
const ROWS = [
	{
		id: MAY_DAY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'May Day',
		countryCode: 'DE',
		date: new Date('2026-05-01T00:00:00.000Z'),
		endDate: null,
		isRecurring: true,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: CHRISTMAS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Christmas Day',
		countryCode: 'DE',
		date: new Date('2026-12-25T00:00:00.000Z'),
		endDate: new Date('2026-12-26T00:00:00.000Z'),
		isRecurring: true,
		createdAt: new Date('2026-01-02T10:00:00.000Z'),
		updatedAt: new Date('2026-01-02T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const officialHolidayService = {
		findAllByFilter: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 })
	};

	return { officialHolidayService, resolver: new OfficialHolidayResolver(officialHolidayService as never) };
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('officialholiday'))
		.sort();
}

/** The printed body of one type, object or input. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller. This one inherits nothing, so its prototype is the whole route set. */
function handlersOf(controller: typeof OfficialHolidayController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OfficialHolidayController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OfficialHolidayController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OfficialHolidayResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['officialHolidays', 'findAll'],
	['officialHoliday', 'findById'],
	['createOfficialHoliday', 'create'],
	['updateOfficialHoliday', 'update'],
	['deleteOfficialHoliday', 'delete']
];

describe('OfficialHolidayResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query and the one-row query', () => {
		expect(ownedRootFields('Query')).toEqual(['officialHoliday', 'officialHolidays']);
	});

	it('declares the three writes the controller serves and no lifecycle pair', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createOfficialHoliday',
			'deleteOfficialHoliday',
			'updateOfficialHoliday'
		]);
	});
	it('declares no count field, because the controller inherits no count route', () => {
		// This controller is not a CRUD controller: it declares five routes and inherits none.
		expect(printed).not.toMatch(/officialHolidayCount/);
		expect(rootFields('Query')).not.toContain('officialHolidayCount');
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OfficialHolidayConnection \{\s*nodes: \[OfficialHoliday!\]!\s*edges: \[OfficialHolidayEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OfficialHolidayEdge \{\s*node: OfficialHoliday!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OfficialHolidayFilter \{/);
		expect(printed).toMatch(
			/enum OfficialHolidaySortField \{\s*createdAt\s*updatedAt\s*name\s*countryCode\s*date\s*endDate\s*\}/
		);
	});

	it('carries the calendar columns and not the archive date that no route writes', () => {
		const holiday = body('OfficialHoliday', 'type');

		expect(holiday).toMatch(/name: String!/);
		expect(holiday).toMatch(/countryCode: String!/);
		// A calendar day carried as an instant, because the kernel offers no calendar-day scalar.
		expect(holiday).toMatch(/date: DateTime!/);
		expect(holiday).toMatch(/endDate: DateTime\b/);
		expect(holiday).toMatch(/isRecurring: Boolean\b/);
		// No delivered route of this resource writes it: there is no archive operation behind it here.
		expect(holiday).not.toContain('archivedAt');
		// The edit body can write it, so the row has to be able to say it.
		expect(holiday).toMatch(/deletedAt: DateTime/);
	});

	it('states the calendar-year narrowing as a filter rather than an argument the read cannot take', () => {
		// The delivered `year` member is a disjunction between a date range and the recurrence flag, and
		// the connection protocol's own `or` group expresses exactly that disjunction.
		expect(body('OfficialHolidayFilter', 'input')).toMatch(/date: DateTimeFilter/);
		expect(body('OfficialHolidayFilter', 'input')).toMatch(/isRecurring: BooleanFilter/);
		expect(body('OfficialHolidayFilter', 'input')).toMatch(/or: \[OfficialHolidayFilter!\]/);
		expect(printed).not.toMatch(/officialHolidays\([^)]*\byear\b/);
	});
});

describe('OfficialHolidayResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, officialHolidayService } = surfaces();

		const connection = await resolver.officialHolidays(undefined, undefined, undefined, 20);

		// The route's own call for an empty query DTO: no country code, no year, no organization.
		expect(officialHolidayService.findAllByFilter).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(MAY_DAY);
	});

	it('keeps the calendar order the delivered read fixed', async () => {
		const { resolver } = surfaces();

		// May before December: the read orders by the holiday date itself.
		expect((await resolver.officialHolidays()).nodes.map((node) => node.id)).toEqual([MAY_DAY, CHRISTMAS]);
	});

	it('orders by a key the caller states, over the rows the read returned', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.officialHolidays(undefined, [{ field: 'name', direction: 'ASC' }]);

		expect(byName.nodes.map((node) => node.id)).toEqual([CHRISTMAS, MAY_DAY]);
	});

	it('narrows by country and by the calendar-year disjunction the delivered read performs', async () => {
		const { resolver } = surfaces();

		expect((await resolver.officialHolidays({ countryCode: { eq: 'DE' } })).totalCount).toBe(2);
		expect((await resolver.officialHolidays({ countryCode: { eq: 'de' } })).totalCount).toBe(0);
		expect((await resolver.officialHolidays({ countryCode: { ilike: 'de' } })).totalCount).toBe(2);

		// The delivered `year` question, stated the way the protocol states it: inside the year, or
		// recurring.
		const year2026 = await resolver.officialHolidays({
			or: [{ date: { between: ['2026-01-01', '2026-12-31'] } }, { isRecurring: { eq: true } }]
		});
		expect(year2026.totalCount).toBe(2);

		const year2027 = await resolver.officialHolidays({
			or: [{ date: { between: ['2027-01-01', '2027-12-31'] } }, { isRecurring: { eq: true } }]
		});
		// Both rows recur, so both answer for a year neither is stored against — which is the delivered
		// read's own rule rather than an artefact of this surface.
		expect(year2027.totalCount).toBe(2);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.officialHolidays(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([MAY_DAY]);

		const second = await resolver.officialHolidays(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([CHRISTMAS]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.officialHolidays(undefined, [{ field: 'isRecurring', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.officialHolidays({ year: { eq: 2026 } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('OfficialHolidayResolver — one concept, two protocols, the same operations', () => {
	it('reads one holiday through the same service method the REST route calls', async () => {
		const { resolver, officialHolidayService } = surfaces();

		expect(await resolver.officialHoliday(MAY_DAY)).toBe(ROWS[0]);
		expect(officialHolidayService.findOneByIdString).toHaveBeenCalledWith(MAY_DAY);
	});

	it('answers null for a holiday that is not there', async () => {
		const { resolver, officialHolidayService } = surfaces();
		officialHolidayService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.officialHoliday(CHRISTMAS)).toBeNull();
	});

	it('files a holiday through the same service method the REST route calls', async () => {
		const { resolver, officialHolidayService } = surfaces();

		await resolver.createOfficialHoliday({
			organizationId: ORGANIZATION,
			name: 'May Day',
			countryCode: 'DE',
			date: '2026-05-01',
			isRecurring: true
		});

		expect(officialHolidayService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, countryCode: 'DE', isRecurring: true })
		);
	});

	it('changes a holiday through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, officialHolidayService } = surfaces();

		const updated = await resolver.updateOfficialHoliday({ id: MAY_DAY, countryCode: 'AT' });

		expect(officialHolidayService.update).toHaveBeenCalledWith(MAY_DAY, { countryCode: 'AT' });
		expect(officialHolidayService.findOneByIdString).toHaveBeenCalledWith(MAY_DAY);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a holiday through the same service method the REST route calls', async () => {
		const { resolver, officialHolidayService } = surfaces();

		expect(await resolver.deleteOfficialHoliday(MAY_DAY)).toBe(true);
		expect(officialHolidayService.delete).toHaveBeenCalledWith(MAY_DAY);
	});
});

describe('OfficialHolidayResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OfficialHolidayResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OfficialHolidayController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OfficialHolidayResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(OfficialHolidayController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission pair the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OfficialHolidayResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OfficialHolidayController)
		);
	});

	it('states on every field the permission pair its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(OfficialHolidayController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('keeps a pair on every field, with the class’s half the one each route states', () => {
		// The delivered metadata states a pair on every route. The two reads keep the *view* half the
		// class does not state, and the three writes keep the *edit* half it does: restating only the
		// Time Off permission on any of them would narrow that field below its route.
		const pairs: Array<[string, PermissionsEnum, PermissionsEnum]> = [
			['officialHolidays', PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW],
			['officialHoliday', PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW],
			['createOfficialHoliday', PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_ADD],
			['updateOfficialHoliday', PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT],
			['deleteOfficialHoliday', PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_DELETE]
		];

		for (const [field, org, timeOff] of pairs) {
			expect(permissionOfField(field)).toEqual([org, timeOff]);
		}

		// The class pair is the edit one, and the reads are the routes that leave it behind.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OfficialHolidayResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_POLICY_EDIT
		]);
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
		getHandler: () => (OfficialHolidayResolver.prototype as never)[field],
		getClass: () => OfficialHolidayResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OfficialHolidayResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OfficialHolidayResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OfficialHolidayResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('officialHolidays')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('officialHolidays');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('officialHolidays'))).resolves.toBe(true);
	});
});
