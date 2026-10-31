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
import { DealController } from './deal.controller';

/**
 * Deals: updating and deleting require `EDIT_SALES_PIPELINES`, matching the web app, which asks for it
 * before it offers to edit, move, delete or restore a deal. Every write the controller serves, the
 * inherited CRUD writes included, states it; the reads keep the class's `VIEW_SALES_PIPELINES`.
 */

const MUTATING = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

/** A route handler, as the decorators' metadata is attached to it. */
type Handler = (...args: unknown[]) => unknown;

interface Route {
	name: string;
	method: RequestMethod;
	path: string;
	handler: Handler;
}

/** Every route the controller serves, inherited ones included, the subclass copy of a handler winning. */
function routesOf(controller: typeof DealController): Route[] {
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
function permissionsOf(route: Route): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, route.handler) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, DealController)
	);
}

/** Whether `PermissionGuard` runs on a route, from the class or the handler. */
function guardedByPermissionGuard(route: Route): boolean {
	const guards = [
		...((Reflect.getMetadata(GUARDS_METADATA, DealController) ?? []) as unknown[]),
		...((Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? []) as unknown[])
	];
	return guards.includes(PermissionGuard);
}

const label = (route: Route) => `${RequestMethod[route.method]} ${route.path} (${route.name})`;

describe('DealController — the permission each route states', () => {
	it('states EDIT_SALES_PIPELINES behind PermissionGuard on every write, the inherited CRUD writes included', () => {
		const writes = routesOf(DealController).filter((route) => MUTATING.has(route.method));

		expect(writes.map(label).sort()).toEqual(
			[
				'POST / (create)',
				'PUT :id (update)',
				'DELETE :id (delete)',
				'DELETE :id/soft (softRemove)',
				'PUT :id/recover (softRecover)'
			].sort()
		);
		for (const route of writes) {
			expect({
				route: label(route),
				guarded: guardedByPermissionGuard(route),
				permissions: permissionsOf(route)
			}).toEqual({
				route: label(route),
				guarded: true,
				permissions: [PermissionsEnum.EDIT_SALES_PIPELINES]
			});
		}
	});

	it('leaves the reads under the class view permission', () => {
		const reads = routesOf(DealController).filter((route) => route.method === RequestMethod.GET);

		expect(reads.length).toBeGreaterThan(0);
		for (const route of reads) {
			expect({ route: label(route), permissions: permissionsOf(route) }).toEqual({
				route: label(route),
				permissions: [PermissionsEnum.VIEW_SALES_PIPELINES]
			});
		}
	});

	it('hands an update, a delete, a soft delete and a restore to the base routes unchanged', async () => {
		const dealService = {
			update: jest.fn().mockResolvedValue({ affected: 1 }),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			softRemove: jest.fn().mockResolvedValue({ id: 'deal-1' }),
			softRecover: jest.fn().mockResolvedValue({ id: 'deal-1' })
		};
		const controller = new DealController(dealService as never);

		await expect(controller.update('deal-1', { stageId: 'stage-2', tenantId: 'other' } as never)).resolves.toEqual({
			affected: 1
		});
		await expect(controller.delete('deal-1')).resolves.toEqual({ affected: 1 });
		await expect(controller.softRemove('deal-1')).resolves.toEqual({ id: 'deal-1' });
		await expect(controller.softRecover('deal-1')).resolves.toEqual({ id: 'deal-1' });

		// The base route's body rules still apply: the tenant is never taken from the body.
		expect(dealService.update).toHaveBeenCalledWith('deal-1', { stageId: 'stage-2' });
		expect(dealService.delete).toHaveBeenCalledWith('deal-1');
		expect(dealService.softRemove).toHaveBeenCalledWith('deal-1', []);
		expect(dealService.softRecover).toHaveBeenCalledWith('deal-1', []);
	});
});

describe('PermissionGuard on a deal route — the request decides by the role it holds', () => {
	const TENANT_ID = '3c5e7a90-0000-4000-8000-000000000001';
	const ROLE_ID = '3c5e7a90-0000-4000-8000-0000000000aa';

	/**
	 * The real guard over the real reflector and the metadata the controller declares, with the role's
	 * permissions on the request. A `false` here is what Nest answers with 403 Forbidden.
	 */
	async function decide(handler: keyof DealController, permissions: PermissionsEnum[]): Promise<boolean> {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			tenantId: TENANT_ID,
			roleId: ROLE_ID,
			role: { id: ROLE_ID, name: RolesEnum.EMPLOYEE, tenantId: TENANT_ID },
			permissions
		} as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID);

		const guard = new PermissionGuard({ get: jest.fn(), set: jest.fn() } as never, new Reflector(), {
			checkRolePermission: jest.fn(async () => true)
		} as never);
		const context = {
			getType: () => 'http',
			getHandler: () => DealController.prototype[handler],
			getClass: () => DealController,
			switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
		} as unknown as ExecutionContext;

		return guard.canActivate(context);
	}

	const VIEW_ONLY = [PermissionsEnum.VIEW_SALES_PIPELINES];
	const EDITOR = [PermissionsEnum.VIEW_SALES_PIPELINES, PermissionsEnum.EDIT_SALES_PIPELINES];

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each(['update', 'delete', 'softRemove', 'softRecover'] as const)(
		'refuses %s to a role that may only view pipelines (403)',
		async (handler) => {
			await expect(decide(handler, VIEW_ONLY)).resolves.toBe(false);
		}
	);

	it.each(['update', 'delete', 'softRemove', 'softRecover'] as const)(
		'lets a role that may edit pipelines %s',
		async (handler) => {
			await expect(decide(handler, EDITOR)).resolves.toBe(true);
		}
	);

	it('still lets a role that may only view pipelines read the deals', async () => {
		await expect(decide('findAll', VIEW_ONLY)).resolves.toBe(true);
		await expect(decide('findById', VIEW_ONLY)).resolves.toBe(true);
	});
});
