/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PermissionGuard } from '../shared/guards';
import { GoalController } from './goal.controller';
import { GoalGeneralSettingController } from '../goal-general-setting/goal-general-setting.controller';
import { GoalKpiController } from '../goal-kpi/goal-kpi.controller';
import { GoalKpiTemplateController } from '../goal-kpi-template/goal-kpi-template.controller';
import { GoalTemplateController } from '../goal-template/goal-template.controller';
import { GoalTimeFrameController } from '../goal-time-frame/goal-time-frame.controller';
import { KeyResultController } from '../keyresult/keyresult.controller';
import { KeyresultTemplateController } from '../keyresult-template/keyresult-template.controller';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the goal, KPI, key-result, time-frame and template routes
 * wrote with no permission at all. `PermissionGuard` answers `true` to a route whose metadata is empty, and the
 * five writes `CrudController` declares — POST '', PUT ':id', DELETE ':id', DELETE ':id/soft', PUT ':id/recover' —
 * carry none and are served on every subclass that does not override them, so any signed-in member of the tenant
 * (an EMPLOYEE, a VIEWER, a CANDIDATE) could file, change, retire or remove the tenant's objectives.
 *
 * Every write of these eight controllers — the ones they declare and the inherited ones, which they now override
 * only to attach the grant — states `GOALS_EDIT` behind `PermissionGuard`; the reads are left as they were. The
 * routes are enumerated the way Nest's `MetadataScanner` enumerates them (the prototype chain, a subclass copy
 * winning), so an inherited write left bare fails here. Key-result progress updates are a per-user item with an
 * ownership check of their own and are not in this list.
 */

const GOAL_CONTROLLERS: Function[] = [
	GoalController,
	GoalGeneralSettingController,
	GoalKpiController,
	GoalKpiTemplateController,
	GoalTemplateController,
	GoalTimeFrameController,
	KeyResultController,
	KeyresultTemplateController
];

const MUTATING = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

interface Route {
	name: string;
	method: RequestMethod;
	path: string;
	handler: Function;
}

/** Every route a controller serves, inherited ones included, the subclass copy of a handler winning. */
function routesOf(controller: Function): Route[] {
	const routes = new Map<string, Route>();

	for (let prototype = controller.prototype; prototype && prototype !== Object.prototype;) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			const handler = Object.getOwnPropertyDescriptor(prototype, name)?.value;
			const method: RequestMethod | undefined =
				typeof handler === 'function' ? Reflect.getMetadata(METHOD_METADATA, handler) : undefined;

			if (name !== 'constructor' && !routes.has(name) && method !== undefined) {
				routes.set(name, { name, method, path: Reflect.getMetadata(PATH_METADATA, handler), handler });
			}
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return [...routes.values()];
}

/** What `PermissionGuard` reads for a route: the handler's permissions, else the class's. */
function permissionsOf(controller: Function, route: Route): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, route.handler) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

describe('the goal and KPI routes — GOALS_EDIT on every write (owner decision 2)', () => {
	it.each(GOAL_CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s states GOALS_EDIT behind PermissionGuard on every write, inherited ones included',
		(_name, controller) => {
			const writes = routesOf(controller).filter((route) => MUTATING.has(route.method));

			// The five CRUD writes at least, so a scan that found nothing cannot pass.
			expect(writes.length).toBeGreaterThanOrEqual(5);
			expect(
				writes.map((route) => ({
					route: `${RequestMethod[route.method]} ${route.path} (${route.name})`,
					permissionGuard: (
						(Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? []) as Function[]
					).includes(PermissionGuard),
					permissions: permissionsOf(controller, route)
				}))
			).toEqual(
				writes.map((route) => ({
					route: `${RequestMethod[route.method]} ${route.path} (${route.name})`,
					permissionGuard: true,
					permissions: [PermissionsEnum.GOALS_EDIT]
				}))
			);
		}
	);

	it.each(GOAL_CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s still serves the five CRUD writes on their own paths',
		(_name, controller) => {
			const served = routesOf(controller)
				.filter((route) => ['create', 'update', 'delete', 'softRemove', 'softRecover'].includes(route.name))
				.map((route) => `${RequestMethod[route.method]} ${route.path}`)
				.sort();

			expect(served).toEqual(['DELETE :id', 'DELETE :id/soft', 'POST /', 'PUT :id', 'PUT :id/recover'].sort());
		}
	);

	it('states the bulk key-result filing with the same grant', () => {
		const bulk = routesOf(KeyResultController).find((route) => route.name === 'createBulkKeyResults');

		expect(bulk && `${RequestMethod[bulk.method]} ${bulk.path}`).toBe('POST /bulk');
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, bulk?.handler as Function)).toEqual([
			PermissionsEnum.GOALS_EDIT
		]);
	});

	it.each(GOAL_CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s leaves its reads as they were: no permission',
		(_name, controller) => {
			const reads = routesOf(controller).filter((route) => route.method === RequestMethod.GET);

			expect(reads.length).toBeGreaterThan(0);
			for (const route of reads) {
				expect({ read: route.name, permissions: permissionsOf(controller, route) }).toEqual({
					read: route.name,
					permissions: undefined
				});
			}
		}
	);
});

describe('PermissionGuard on a goal write — the request decides by the role it holds', () => {
	const TENANT_ID = '2b4d6f80-0000-4000-8000-000000000001';
	const ROLE_ID = '2b4d6f80-0000-4000-8000-0000000000aa';

	/** The guard over the real reflector, the metadata the controller declares, and a role state on the request. */
	async function decide(permissions: PermissionsEnum[], name: RolesEnum): Promise<boolean> {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			tenantId: TENANT_ID,
			roleId: ROLE_ID,
			role: { id: ROLE_ID, name, tenantId: TENANT_ID },
			permissions
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID);

		const guard = new PermissionGuard({ get: jest.fn(), set: jest.fn() } as any, new Reflector(), {
			checkRolePermission: jest.fn(async () => true)
		} as any);
		const context = {
			getType: () => 'http',
			getHandler: () => GoalController.prototype.create,
			getClass: () => GoalController,
			switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
		} as unknown as ExecutionContext;

		return guard.canActivate(context);
	}

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('refuses a member whose role does not hold GOALS_EDIT — the EMPLOYEE defaults, for one', async () => {
		await expect(
			decide(
				[PermissionsEnum.ORG_TASK_ADD, PermissionsEnum.ORG_TASK_EDIT, PermissionsEnum.PROFILE_EDIT],
				RolesEnum.EMPLOYEE
			)
		).resolves.toBe(false);
	});

	it('lets a role that holds GOALS_EDIT through', async () => {
		await expect(decide([PermissionsEnum.GOALS_EDIT], RolesEnum.MANAGER)).resolves.toBe(true);
	});
});
