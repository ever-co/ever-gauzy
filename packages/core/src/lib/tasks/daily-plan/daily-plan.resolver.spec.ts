/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { DailyPlanStatusEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { RequestContext } from '../../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { DailyPlanController } from './daily-plan.controller';
import { DailyPlanResolver } from './daily-plan.resolver';

/**
 * One person's day of planned work, over GraphQL.
 *
 * The delivered `/api/daily-plan` routes serve five different readers, one row, a count and eight
 * writes. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - each of the five readers is a root field of its own, because each joins something the connection's
 *   `filter` cannot express, and the connection declares no member that could not be evaluated;
 * - every field reaches the same service method its route reaches;
 * - **the guard chain and the permission are the controller's, field by field** — the reads state the
 *   read pair, the writes state their own, and the inherited routes run under the class pair, exactly
 *   as their routes do;
 * - the gate is on the class, so every field is behind it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const TEAM = '00000000-0000-4000-8000-000000000004';
const TASK = '00000000-0000-4000-8000-000000000005';
const TODAY = '00000000-0000-4000-8000-000000000010';
const TOMORROW = '00000000-0000-4000-8000-000000000011';

/** The rows the delivered readers answer with. */
const ROWS = [
	{
		id: TODAY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		date: new Date('2026-03-01T00:00:00.000Z'),
		workTimePlanned: 480,
		status: DailyPlanStatusEnum.OPEN,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: TOMORROW,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		date: new Date('2026-03-02T00:00:00.000Z'),
		workTimePlanned: 240,
		status: DailyPlanStatusEnum.COMPLETED,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const page = { items: ROWS, total: ROWS.length };
	const dailyPlanService = {
		getAllPlans: jest.fn().mockResolvedValue(page),
		getMyPlans: jest.fn().mockResolvedValue(page),
		getTeamDailyPlans: jest.fn().mockResolvedValue(page),
		getDailyPlansByEmployee: jest.fn().mockResolvedValue(page),
		getDailyPlansByTask: jest.fn().mockResolvedValue(page),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		createDailyPlan: jest.fn().mockResolvedValue(ROWS[0]),
		updateDailyPlan: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		addTaskToPlan: jest.fn().mockResolvedValue(ROWS[0]),
		removeTaskFromPlan: jest.fn().mockResolvedValue(ROWS[0]),
		removeTaskFromManyPlans: jest.fn().mockResolvedValue([ROWS[0]])
	};

	return { dailyPlanService, resolver: new DailyPlanResolver(dailyPlanService as never) };
}

/** The composed schema, as text. */
function composedSchema(): string {
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

	walk(join(__dirname, '..', '..'));

	return documents.join('\n');
}

/** The schema, built once. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The handlers of the controller, inherited ones included. */
function handlersOf(controller: typeof DailyPlanController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof DailyPlanController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under. */
function guardsOfRoute(controller: typeof DailyPlanController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the rule the guard itself applies. */
function permissionOfField(field: string): unknown {
	const fields = DailyPlanResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, DailyPlanResolver)
	);
}

/** The guards one resolver field runs under. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', DailyPlanResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (DailyPlanResolver.prototype as unknown as Record<string, object>)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** One resolver field and the controller route it mirrors. */
const ROUTE_OF_FIELD: ReadonlyArray<readonly [string, string]> = [
	['dailyPlans', 'get'],
	['myDailyPlans', 'getMyPlans'],
	['teamDailyPlans', 'getTeamDailyPlans'],
	['employeeDailyPlans', 'getEmployeeDailyPlans'],
	['dailyPlansForTask', 'getDailyPlansForTaskId'],
	['dailyPlan', 'findById'],
	['dailyPlanCount', 'getCount'],
	['createDailyPlan', 'create'],
	['updateDailyPlan', 'update'],
	['deleteDailyPlan', 'delete'],
	['softDeleteDailyPlan', 'softRemove'],
	['recoverDailyPlan', 'softRecover'],
	['addTaskToDailyPlan', 'addTaskToDailyPlan'],
	['removeTaskFromDailyPlan', 'removeTaskFromDailyPlan'],
	['removeTaskFromDailyPlans', 'removeTaskFromManyPlans']
];

describe('DailyPlanResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares one query per delivered read route', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'dailyPlans',
				'myDailyPlans',
				'teamDailyPlans',
				'employeeDailyPlans',
				'dailyPlansForTask',
				'dailyPlan',
				'dailyPlanCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createDailyPlan',
				'updateDailyPlan',
				'deleteDailyPlan',
				'softDeleteDailyPlan',
				'recoverDailyPlan',
				'addTaskToDailyPlan',
				'removeTaskFromDailyPlan',
				'removeTaskFromDailyPlans'
			])
		);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type DailyPlanConnection \{\s*nodes: \[DailyPlan!\]!\s*edges: \[DailyPlanEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input DailyPlanFilter \{/);
		expect(printed).toMatch(/input DailyPlanSort \{/);
		// The plan-task pivot is not a filter: no reader this surface mirrors joins it, so a
		// condition on it could only ever select the empty set.
		const filterBody = printed.match(/input DailyPlanFilter \{([\s\S]*?)\n\}/)?.[1] ?? '';
		expect(filterBody).not.toContain('taskIds');
		expect(filterBody).not.toContain('tasks');
	});

	it('says which unit the planned work is in', () => {
		const body = printed.match(/type DailyPlan \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/workTimePlanned: Float!/);
		expect(printed).toMatch(/\*\*in minutes\*\*/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/dailyPlans\([^)]*withDeleted/);
		expect(printed).toMatch(/dailyPlanCount: Int\n/);
	});
});

describe('DailyPlanResolver — the connection contract, and the five readers behind it', () => {
	it('answers every list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, dailyPlanService } = surfaces();
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			const connection = await resolver.dailyPlans(undefined, undefined, undefined, 20);

			// The delivered clients send the organization they are showing in the query string, and
			// every one of these readers builds its criterion from it.
			expect(dailyPlanService.getAllPlans).toHaveBeenCalledWith({ where: { organizationId: ORGANIZATION } });
			expect(connection.totalCount).toBe(2);
			expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(TODAY);
		} finally {
			organization.mockRestore();
		}
	});

	it('reads each of the other four through its own reader, scoped by the credential', async () => {
		const { resolver, dailyPlanService } = surfaces();
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			await resolver.myDailyPlans();
			await resolver.teamDailyPlans();
			await resolver.employeeDailyPlans(EMPLOYEE);
			await resolver.dailyPlansForTask(TASK);

			const scope = { where: { organizationId: ORGANIZATION } };
			expect(dailyPlanService.getMyPlans).toHaveBeenCalledWith(scope);
			expect(dailyPlanService.getTeamDailyPlans).toHaveBeenCalledWith(scope);
			// The employee is the path segment on the route and the argument here; the tenant and the
			// organization are never the caller's to choose.
			expect(dailyPlanService.getDailyPlansByEmployee).toHaveBeenCalledWith(scope, EMPLOYEE);
			expect(dailyPlanService.getDailyPlansByTask).toHaveBeenCalledWith(scope, TASK);
		} finally {
			organization.mockRestore();
		}
	});

	it('narrows by the columns the filter declares and refuses one it does not', async () => {
		const { resolver } = surfaces();

		expect((await resolver.dailyPlans({ status: { eq: 'completed' } })).nodes.map((n) => n.id)).toEqual([
			TOMORROW
		]);
		expect((await resolver.dailyPlans({ employeeId: { eq: EMPLOYEE } })).totalCount).toBe(2);

		const refused = await resolver.dailyPlans({ tasks: { eq: TASK } }).catch((thrown) => thrown);
		expect((refused as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.dailyPlans()).nodes.map((node) => node.id)).toEqual([TODAY, TOMORROW]);
	});
});

describe('DailyPlanResolver — one concept, two protocols, the same operations', () => {
	it('reads one plan through the same service method the REST route calls', async () => {
		const { resolver, dailyPlanService } = surfaces();

		expect(await resolver.dailyPlan(TODAY)).toBe(ROWS[0]);
		expect(dailyPlanService.findOneByIdString).toHaveBeenCalledWith(TODAY);
	});

	it('answers null for a plan that is not there', async () => {
		const { resolver, dailyPlanService } = surfaces();
		dailyPlanService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.dailyPlan(TOMORROW)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, dailyPlanService } = surfaces();

		expect(await resolver.dailyPlanCount()).toBe(2);
		expect(dailyPlanService.countBy).toHaveBeenCalledWith();
	});

	it('opens a day’s plan through the same service method the REST route calls', async () => {
		const { resolver, dailyPlanService } = surfaces();

		await resolver.createDailyPlan({
			organizationId: ORGANIZATION,
			date: ROWS[0].date,
			workTimePlanned: 480,
			status: DailyPlanStatusEnum.OPEN,
			employeeId: EMPLOYEE,
			taskId: TASK
		});

		expect(dailyPlanService.createDailyPlan).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			date: ROWS[0].date,
			workTimePlanned: 480,
			status: DailyPlanStatusEnum.OPEN,
			employeeId: EMPLOYEE,
			taskId: TASK
		});
	});

	it('changes a day’s plan through the same service method the REST route calls', async () => {
		const { resolver, dailyPlanService } = surfaces();

		expect(await resolver.updateDailyPlan({ id: TODAY, organizationId: ORGANIZATION, status: 'completed' })).toBe(
			ROWS[0]
		);
		// The identifier is the criterion, as it is on the route: it is not repeated in the payload.
		expect(dailyPlanService.updateDailyPlan).toHaveBeenCalledWith(TODAY, {
			organizationId: ORGANIZATION,
			status: 'completed'
		});
	});

	it('removes a plan through the same service method the REST route calls', async () => {
		const { resolver, dailyPlanService } = surfaces();

		expect(await resolver.deleteDailyPlan(TODAY)).toBe(true);
		expect(dailyPlanService.delete).toHaveBeenCalledWith(TODAY);
	});

	it('withdraws and restores a plan through the same service methods the routes call', async () => {
		const { resolver, dailyPlanService } = surfaces();

		const withdrawn = await resolver.softDeleteDailyPlan(TODAY);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(dailyPlanService.softRemove).toHaveBeenCalledWith(TODAY);

		expect(await resolver.recoverDailyPlan(TODAY)).toBe(ROWS[0]);
		expect(dailyPlanService.softRecover).toHaveBeenCalledWith(TODAY);
	});

	it('writes the three membership moves through the same service methods the routes call', async () => {
		const { resolver, dailyPlanService } = surfaces();
		const membership = { organizationId: ORGANIZATION, taskId: TASK, employeeId: EMPLOYEE };

		expect(await resolver.addTaskToDailyPlan(TODAY, membership)).toBe(ROWS[0]);
		expect(dailyPlanService.addTaskToPlan).toHaveBeenCalledWith(TODAY, membership);

		expect(await resolver.removeTaskFromDailyPlan(TODAY, membership)).toBe(ROWS[0]);
		expect(dailyPlanService.removeTaskFromPlan).toHaveBeenCalledWith(TODAY, membership);

		expect(
			await resolver.removeTaskFromDailyPlans(TASK, {
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				planIds: [TODAY]
			})
		).toEqual([ROWS[0]]);
		expect(dailyPlanService.removeTaskFromManyPlans).toHaveBeenCalledWith(TASK, {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			planIds: [TODAY]
		});
	});
});

describe('DailyPlanResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		expect(Reflect.getMetadata('__guards__', DailyPlanResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const [field, handler] of ROUTE_OF_FIELD) {
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(DailyPlanController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DailyPlanResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, DailyPlanController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DailyPlanResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.DAILY_PLAN_UPDATE
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTE_OF_FIELD.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_OF_FIELD.map(([field, handler]) => [field, permissionOfRoute(DailyPlanController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the resource’s own permissions beside the class pair, and nothing narrower', () => {
		for (const field of ['dailyPlans', 'myDailyPlans', 'teamDailyPlans', 'employeeDailyPlans', 'dailyPlansForTask']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.DAILY_PLAN_READ
			]);
		}
		expect(permissionOfField('createDailyPlan')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.DAILY_PLAN_CREATE
		]);
		expect(permissionOfField('deleteDailyPlan')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.DAILY_PLAN_DELETE
		]);
		for (const field of ['addTaskToDailyPlan', 'removeTaskFromDailyPlan', 'removeTaskFromDailyPlans']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.DAILY_PLAN_CREATE,
				PermissionsEnum.DAILY_PLAN_UPDATE
			]);
		}
		// The one-row query, the count and the two lifecycle routes are inherited from the CRUD base:
		// they run under the class pair, which is also what the delivered routes do.
		for (const field of ['dailyPlan', 'dailyPlanCount', 'softDeleteDailyPlan', 'recoverDailyPlan']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.DAILY_PLAN_UPDATE
			]);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The gate, over a scripted cache and a scripted feature service. */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (DailyPlanResolver.prototype as never)[field],
		getClass: () => DailyPlanResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('DailyPlanResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, DailyPlanResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', DailyPlanResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('dailyPlans')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('dailyPlans');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('dailyPlans'))).resolves.toBe(true);
	});
});
