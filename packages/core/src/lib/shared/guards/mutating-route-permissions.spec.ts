/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time and
 * that decorator's module reaches the entity graph again through the employee repository. Entering
 * the cycle from the controller end leaves the decorator module half-initialized, and the suite
 * fails to LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel
 * first lets it finish. The API does not hit this because Nest bootstraps the entity graph before
 * the service layer.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from '../../core/crud';
import { OrganizationDepartmentController } from '../../organization-department/organization-department.controller';
import { OrganizationEmploymentTypeController } from '../../organization-employment-type/organization-employment-type.controller';
import { OrganizationPositionController } from '../../organization-position/organization-position.controller';
import { OrganizationVendorController } from '../../organization-vendor/organization-vendor.controller';
import { TimeLogController } from '../../time-tracking/time-log/time-log.controller';
import { TimeSlotController } from '../../time-tracking/time-slot/time-slot.controller';
import { TimerController } from '../../time-tracking/timer/timer.controller';
import { OrganizationPermissionGuard } from './organization-permission.guard';
import { PermissionGuard } from './permission.guard';

/**
 * GHSA-v79w-54p2-wmh5 — `PermissionGuard.canActivate()` returns `true` when the
 * `PERMISSIONS_METADATA` of a route is empty, so a mutating handler that forgets `@Permissions(...)`
 * is reachable by every authenticated member of the tenant, including EMPLOYEE / VIEWER /
 * CANDIDATE.
 *
 * `CrudController` declares POST '', PUT ':id', DELETE ':id', DELETE ':id/soft' and
 * PUT ':id/recover' with no guards at all, and Nest's MetadataScanner walks the prototype chain, so
 * those routes are exposed on EVERY subclass unless the subclass overrides them. This suite asserts
 * that no mutating route of the affected controllers — inherited ones included — is left bare.
 */

const MUTATING_METHODS = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

interface RouteDescriptor {
	name: string;
	method: RequestMethod;
	path: string;
	handler: (...args: any[]) => any;
	declaredOn: Function;
}

/**
 * Enumerates every HTTP route a Nest controller exposes, walking the prototype chain the way Nest's
 * own MetadataScanner does. When a subclass overrides an inherited handler, the subclass copy wins,
 * which is exactly how a route gets gated without touching the base class.
 */
function collectRoutes(controller: Function): RouteDescriptor[] {
	const routes = new Map<string, RouteDescriptor>();

	let prototype = controller.prototype;
	let declaredOn: Function = controller;

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor' || routes.has(name)) {
				continue;
			}

			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);

			if (!descriptor || typeof descriptor.value !== 'function') {
				continue;
			}

			const method: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, descriptor.value);

			if (method === undefined) {
				continue;
			}

			routes.set(name, {
				name,
				method,
				path: Reflect.getMetadata(PATH_METADATA, descriptor.value),
				handler: descriptor.value,
				declaredOn
			});
		}

		prototype = Object.getPrototypeOf(prototype);
		declaredOn = prototype?.constructor;
	}

	return [...routes.values()];
}

function mutatingRoutes(controller: Function): RouteDescriptor[] {
	return collectRoutes(controller).filter((route) => MUTATING_METHODS.has(route.method));
}

function permissionsOf(controller: Function, route: RouteDescriptor): PermissionsEnum[] {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, route.handler) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller) ??
		[]
	);
}

function guardsOf(route: RouteDescriptor): Function[] {
	return Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? [];
}

describe('CrudController inherited mutating routes', () => {
	it('exposes exactly the five unguarded mutating routes every subclass inherits', () => {
		// If this list changes, every `expectFullyGated` assertion below has a new route to cover and
		// the knowledge-base plugin's copy of this base class in
		// `help-center-permissions.spec.ts` has to be updated with it.
		expect(
			mutatingRoutes(CrudController)
				.map((route) => `${RequestMethod[route.method]} ${route.path}`)
				.sort()
		).toEqual(['DELETE :id', 'DELETE :id/soft', 'POST /', 'PUT :id', 'PUT :id/recover'].sort());
	});

	it('declares no guard and no permission on those routes, which is what makes the omission fail open', () => {
		for (const route of mutatingRoutes(CrudController)) {
			expect(Reflect.getMetadata(GUARDS_METADATA, route.handler)).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route.handler)).toBeUndefined();
		}
	});
});

/**
 * Asserts that every mutating route of a controller — inherited routes included — is behind
 * `PermissionGuard` and declares at least one of the expected permissions.
 */
function expectFullyGated(controller: Function, expected: PermissionsEnum[], exemptions: string[] = []): void {
	const routes = mutatingRoutes(controller).filter((route) => !exemptions.includes(route.name));

	expect(routes.length).toBeGreaterThan(0);

	const label = (route: RouteDescriptor) => `${RequestMethod[route.method]} ${route.path} (${route.name})`;

	// Compared as whole objects so a failure names the exact route that is still bare.
	expect(
		routes.map((route) => ({
			route: label(route),
			permissionGuard: guardsOf(route).includes(PermissionGuard),
			permissions: permissionsOf(controller, route)
		}))
	).toEqual(
		routes.map((route) => ({
			route: label(route),
			permissionGuard: true,
			permissions: expected
		}))
	);
}

describe('OrganizationDepartmentController', () => {
	// The departments page hides add/edit/delete behind ALL_ORG_EDIT
	// (apps/gauzy/.../departments.component.html); PUT 'employee' — which rewrites the same
	// `members[]` relation PUT ':id' rewrites — requires ORG_EMPLOYEES_EDIT. `checkRolePermission`
	// uses `IN (:...permissions)`, so the pair is OR semantics and both admin flows keep working.
	const expected = [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT];

	it('gates every mutating route, inherited ones included', () => {
		expectFullyGated(OrganizationDepartmentController, expected, ['updateByEmployee']);
	});

	it('keeps the pre-existing ORG_EMPLOYEES_EDIT gate on PUT employee', () => {
		const handler = OrganizationDepartmentController.prototype.updateByEmployee;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
		expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(PermissionGuard);
	});

	it('covers the four inherited CrudController routes with its own overrides', () => {
		const routes = mutatingRoutes(OrganizationDepartmentController);

		for (const name of ['create', 'delete', 'softRemove', 'softRecover', 'update']) {
			const route = routes.find((candidate) => candidate.name === name);

			expect(route).toBeDefined();
			expect(route?.declaredOn).toBe(OrganizationDepartmentController);
		}
	});
});

describe('OrganizationPositionController', () => {
	// The positions page is behind the ALL_ORG_VIEW route guard and is only editable by roles that
	// hold ALL_ORG_EDIT (SUPER_ADMIN / ADMIN by default).
	it('gates every mutating route, inherited ones included', () => {
		expectFullyGated(OrganizationPositionController, [PermissionsEnum.ALL_ORG_EDIT]);
	});
});

describe('OrganizationEmploymentTypeController', () => {
	it('gates every mutating route, inherited ones included', () => {
		expectFullyGated(OrganizationEmploymentTypeController, [PermissionsEnum.ALL_ORG_EDIT]);
	});
});

describe('OrganizationVendorController', () => {
	// `create` is deliberately left without a permission gate: the shared `ga-vendor-select` creates
	// a vendor inline from the Expenses dialog (`[addTag]="true"`), which EMPLOYEE
	// (EMPLOYEE_EXPENSES_EDIT) and DATA_ENTRY (ORG_EXPENSES_EDIT) users reach without holding
	// ALL_ORG_EDIT. Gating it would break that flow; renaming and deleting an existing vendor stays
	// behind ALL_ORG_EDIT, which is what the vendors page itself gates on.
	it('gates every mutating route except the inline-create route the Expenses dialog uses', () => {
		expectFullyGated(OrganizationVendorController, [PermissionsEnum.ALL_ORG_EDIT], ['create']);
	});

	it('documents that create stays reachable for expense editors', () => {
		const route = mutatingRoutes(OrganizationVendorController).find((candidate) => candidate.name === 'create');

		expect(route?.declaredOn).toBe(CrudController);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, route?.handler)).toBeUndefined();
	});
});

/**
 * GHSA-rmq9-85v7-f365 — the organization time-tracking policy is now enforced for every role. The
 * assertions below pin WHICH routes that decision reaches, which is the evidence that the desktop /
 * agent tracker is untouched: the routes the tracker uses to record tracked time never run
 * `OrganizationPermissionGuard`, so making the guard role agnostic cannot refuse them.
 */
describe('OrganizationPermissionGuard placement', () => {
	function organizationGuardedRoutes(controller: Function): Record<string, PermissionsEnum[]> {
		return Object.fromEntries(
			collectRoutes(controller)
				.filter((route) => guardsOf(route).includes(OrganizationPermissionGuard))
				.map((route) => [route.name, Reflect.getMetadata(PERMISSIONS_METADATA, route.handler)])
		);
	}

	it('gates exactly the three manual time-log routes on the organization policy', () => {
		expect(organizationGuardedRoutes(TimeLogController)).toEqual({
			addManualTime: [PermissionsEnum.ALLOW_MANUAL_TIME],
			updateManualTime: [PermissionsEnum.ALLOW_MODIFY_TIME],
			deleteTimeLog: [PermissionsEnum.ALLOW_DELETE_TIME]
		});
	});

	it('gates exactly the time-slot modify and delete routes on the organization policy', () => {
		expect(organizationGuardedRoutes(TimeSlotController)).toEqual({
			update: [PermissionsEnum.ALLOW_MODIFY_TIME],
			deleteTimeSlot: [PermissionsEnum.ALLOW_DELETE_TIME]
		});
	});

	it('leaves time-slot creation — the desktop and agent tracked-time path — outside the policy guard', () => {
		const create = collectRoutes(TimeSlotController).find((route) => route.name === 'create');

		expect(create?.method).toBe(RequestMethod.POST);
		expect(guardsOf(create as RouteDescriptor)).not.toContain(OrganizationPermissionGuard);
	});

	it('leaves every timer route outside the policy guard', () => {
		expect(organizationGuardedRoutes(TimerController)).toEqual({});
	});
});
