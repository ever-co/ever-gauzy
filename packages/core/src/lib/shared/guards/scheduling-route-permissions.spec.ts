/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller — see the note at the top
 * of `mutating-route-permissions.spec.ts`: entering the entity graph from a controller leaves a decorator module
 * half-initialized.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { AppointmentEmployeesController } from '../../appointment-employees/appointment-employees.controller';
import { AppointmentEmployeesResolver } from '../../appointment-employees/appointment-employees.resolver';
import { AvailabilitySlotsController } from '../../availability-slots/availability-slots.controller';
import { AvailabilitySlotsResolver } from '../../availability-slots/availability-slots.resolver';
import { EmployeeAppointmentController } from '../../employee-appointment/employee-appointment.controller';
import { EmployeeAppointmentResolver } from '../../employee-appointment/employee-appointment.resolver';
import { EventTypeController } from '../../event-types/event-type.controller';
import { EventTypeResolver } from '../../event-types/event-type.resolver';
import { DEFAULT_ROLE_PERMISSIONS } from '../../role-permission/default-role-permissions';
import { PermissionGuard } from './permission.guard';

/**
 * GHSA-v79w-54p2-wmh5, owner decision 2 (2026-10-22) — the scheduling writes.
 *
 * The availability-slot, appointment, appointment-invitation and event-type routes stated no `@Permissions`, and
 * `PermissionGuard` answers `true` to a route whose metadata is empty, so any signed-in member of the tenant — a
 * viewer or a candidate included — could file, change or remove any employee's bookable hours and appointments
 * and rewrite the event types every booking page offers. The owner's rule: reuse the availability grants
 * (`EMPLOYEE_AVAILABILITY_*`) for availability and the appointments booked into it, and gate the event types with
 * the new `EVENT_TYPES_EDIT`. The withdraw/restore pair states the grant `update` states, as owner decision 5
 * (2026-10-13) has it: `EMPLOYEE_AVAILABILITY_UPDATE` there, while the outright removal states `_DELETE`.
 *
 * This suite reads every mutating route each controller serves — the ones it inherits from `CrudController`
 * included, walking the prototype chain the way Nest's `MetadataScanner` does — and the GraphQL fields that mirror
 * them, and then runs the real `PermissionGuard` for the default grants of each role, so the behaviour change is
 * stated as who is served and who is refused rather than as decorators.
 */

const C = PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE;
const U = PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE;
const D = PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE;
const E = PermissionsEnum.EVENT_TYPES_EDIT;

const MUTATING = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

/** Every mutating handler a controller serves, by name, inherited ones included; a subclass copy wins. */
function mutatingHandlers(controller: Function): Map<string, Function> {
	const found = new Map<string, Function>();
	for (
		let prototype = controller.prototype;
		prototype && prototype !== Object.prototype;
		prototype = Object.getPrototypeOf(prototype)
	) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			const value = Object.getOwnPropertyDescriptor(prototype, name)?.value;
			if (name === 'constructor' || found.has(name) || typeof value !== 'function') {
				continue;
			}
			const method: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, value);
			if (method !== undefined && MUTATING.has(method)) {
				found.set(name, value);
			}
		}
	}
	return found;
}

/** [controller, the grant each mutating route must state, resolver, the grant each write field must state] */
const SURFACES: ReadonlyArray<[Function, Record<string, PermissionsEnum>, Function, Record<string, PermissionsEnum>]> =
	[
		[
			AvailabilitySlotsController,
			{ create: C, createBulkAvailabilitySlot: C, update: U, delete: D, softRemove: U, softRecover: U },
			AvailabilitySlotsResolver,
			{
				createAvailabilitySlot: C,
				createAvailabilitySlots: C,
				updateAvailabilitySlot: U,
				deleteAvailabilitySlot: D,
				softDeleteAvailabilitySlot: U,
				recoverAvailabilitySlot: U
			}
		],
		[
			EmployeeAppointmentController,
			{ create: C, update: U, delete: D, softRemove: U, softRecover: U },
			EmployeeAppointmentResolver,
			{
				createEmployeeAppointment: C,
				updateEmployeeAppointment: U,
				deleteEmployeeAppointment: D,
				softDeleteEmployeeAppointment: U,
				recoverEmployeeAppointment: U
			}
		],
		[
			AppointmentEmployeesController,
			{ create: C, update: U, delete: D, softRemove: U, softRecover: U },
			AppointmentEmployeesResolver,
			{
				createAppointmentEmployee: C,
				updateAppointmentEmployee: U,
				deleteAppointmentEmployee: D,
				softDeleteAppointmentEmployee: U,
				recoverAppointmentEmployee: U
			}
		],
		[
			EventTypeController,
			{ create: E, update: E, delete: E, softRemove: E, softRecover: E },
			EventTypeResolver,
			{ createEventType: E, updateEventType: E, deleteEventType: E, softDeleteEventType: E, recoverEventType: E }
		]
	];

describe('the scheduling writes state their grant behind PermissionGuard, on REST and on GraphQL alike', () => {
	it.each(SURFACES.map(([controller, routes]) => [controller.name, controller, routes] as const))(
		'%s states the expected grant on every mutating route it serves, inherited ones included',
		(_name, controller, routes) => {
			const handlers = mutatingHandlers(controller);

			// The whole mutating surface, not only the routes named here: a route added later without a grant fails.
			expect([...handlers.keys()].sort()).toEqual(Object.keys(routes).sort());

			for (const [name, handler] of handlers) {
				expect({ route: name, guards: Reflect.getMetadata(GUARDS_METADATA, handler) }).toEqual({
					route: name,
					guards: [PermissionGuard]
				});
				expect({ route: name, permissions: Reflect.getMetadata(PERMISSIONS_METADATA, handler) }).toEqual({
					route: name,
					permissions: [routes[name]]
				});
			}
			// No grant on the class: it would gate the reads as well.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toBeUndefined();
		}
	);

	it.each(SURFACES.map(([, , resolver, fields]) => [resolver.name, resolver, fields] as const))(
		'%s states the same grant on every write field',
		(_name, resolver, fields) => {
			for (const [field, permission] of Object.entries(fields)) {
				const handler = (resolver.prototype as Record<string, Function>)[field];

				expect({ field, guards: Reflect.getMetadata(GUARDS_METADATA, handler) }).toEqual({
					field,
					guards: [PermissionGuard]
				});
				expect({ field, permissions: Reflect.getMetadata(PERMISSIONS_METADATA, handler) }).toEqual({
					field,
					permissions: [permission]
				});
			}
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toBeUndefined();
		}
	);
});

const TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000001';
const ROLE_ID = '1f3c5a7e-0000-4000-8000-0000000000aa';

/** The grants a freshly provisioned tenant gives one role. */
function defaultsOf(role: RolesEnum): PermissionsEnum[] {
	return DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === role)?.defaultEnabledPermissions ?? [];
}

/** Runs the real `PermissionGuard` on one route for a signed-in caller of a role holding its default grants. */
async function served(controller: Function, route: string, role: RolesEnum): Promise<boolean> {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT_ID,
		roleId: ROLE_ID,
		role: { id: ROLE_ID, name: role, tenantId: TENANT_ID },
		permissions: defaultsOf(role)
	} as any);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID as ID);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID as ID);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1' as ID);
	jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);

	const checkRolePermission = jest.fn(async () => {
		throw new Error('decided from the request’s role state, never by a query');
	});
	const guard = new PermissionGuard({ get: jest.fn(async () => null), set: jest.fn() } as any, new Reflector(), {
		checkRolePermission
	} as any);
	const context = {
		getType: () => 'http',
		getHandler: () => (controller.prototype as Record<string, Function>)[route],
		getClass: () => controller,
		switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
	} as unknown as ExecutionContext;

	return guard.canActivate(context);
}

describe('who the scheduling writes serve with a new tenant’s default grants', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const AVAILABILITY: ReadonlyArray<[Function, string]> = [
		[AvailabilitySlotsController, 'create'],
		[AvailabilitySlotsController, 'createBulkAvailabilitySlot'],
		[AvailabilitySlotsController, 'update'],
		[AvailabilitySlotsController, 'delete'],
		[EmployeeAppointmentController, 'create'],
		[EmployeeAppointmentController, 'update'],
		[EmployeeAppointmentController, 'softRemove'],
		[AppointmentEmployeesController, 'create'],
		[AppointmentEmployeesController, 'delete']
	];
	const EVENT_TYPES: ReadonlyArray<[Function, string]> = [
		[EventTypeController, 'create'],
		[EventTypeController, 'update'],
		[EventTypeController, 'delete'],
		[EventTypeController, 'softRecover']
	];

	it('serves administrators everywhere', async () => {
		for (const role of [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]) {
			for (const [controller, route] of [...AVAILABILITY, ...EVENT_TYPES]) {
				expect({
					role,
					route: `${controller.name}.${route}`,
					served: await served(controller, route, role)
				}).toEqual({
					role,
					route: `${controller.name}.${route}`,
					served: true
				});
			}
		}
	});

	it('keeps an employee managing availability and appointments, and refuses them the event types', async () => {
		for (const [controller, route] of AVAILABILITY) {
			expect(await served(controller, route, RolesEnum.EMPLOYEE)).toBe(true);
		}
		// The behaviour change the owner accepted: EVENT_TYPES_EDIT is granted to administrators and managers only.
		for (const [controller, route] of EVENT_TYPES) {
			expect(await served(controller, route, RolesEnum.EMPLOYEE)).toBe(false);
		}
	});

	it('gives a manager the event types, which the new grant carries, and not the availability grants it never held', async () => {
		for (const [controller, route] of EVENT_TYPES) {
			expect(await served(controller, route, RolesEnum.MANAGER)).toBe(true);
		}
		for (const [controller, route] of AVAILABILITY) {
			expect(await served(controller, route, RolesEnum.MANAGER)).toBe(false);
		}
	});

	it('refuses a viewer, a candidate and an interviewer every scheduling write', async () => {
		for (const role of [RolesEnum.VIEWER, RolesEnum.CANDIDATE, RolesEnum.INTERVIEWER]) {
			for (const [controller, route] of [...AVAILABILITY, ...EVENT_TYPES]) {
				expect(await served(controller, route, role)).toBe(false);
			}
		}
	});
});
