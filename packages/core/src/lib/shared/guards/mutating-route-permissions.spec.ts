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
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from '../../core/crud';
import { OrganizationContactController } from '../../organization-contact/organization-contact.controller';
import { OrganizationDepartmentController } from '../../organization-department/organization-department.controller';
import { OrganizationEmploymentTypeController } from '../../organization-employment-type/organization-employment-type.controller';
import { OrganizationPositionController } from '../../organization-position/organization-position.controller';
import { OrganizationVendorController } from '../../organization-vendor/organization-vendor.controller';
import { TagController } from '../../tags/tag.controller';
import { UserController } from '../../user/user.controller';
import { TimeLogController } from '../../time-tracking/time-log/time-log.controller';
import { TimeSlotController } from '../../time-tracking/time-slot/time-slot.controller';
import { TimeLog } from '../../time-tracking/time-log/time-log.entity';
import { TimeSlot } from '../../time-tracking/time-slot/time-slot.entity';
import { TimerController } from '../../time-tracking/timer/timer.controller';
import { ORGANIZATION_POLICY_TARGET_METADATA } from '../decorators/organization-policy-target.decorator';
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
 * `PermissionGuard` and declares exactly the expected permissions, in the declared order. The match is
 * deliberately strict: a route that silently drops one of the permissions, or gains an unrelated one,
 * changes who can reach it and has to be a visible change to this suite.
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

	it('evaluates the policy of the record itself on the routes that address a time log or slot by id', () => {
		// Without the target, a caller with no employee record could name a permissive organization in
		// the body while the handler loads and rewrites a record of an organization whose policy is off.
		expect(
			Reflect.getMetadata(ORGANIZATION_POLICY_TARGET_METADATA, TimeLogController.prototype.updateManualTime)
		).toEqual({ entity: TimeLog, param: 'id', source: 'params' });
		expect(Reflect.getMetadata(ORGANIZATION_POLICY_TARGET_METADATA, TimeSlotController.prototype.update)).toEqual({
			entity: TimeSlot,
			param: 'id',
			source: 'params'
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

/**
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * The repo-wide scan.
 *
 * The assertions above cover the controllers PR #10190 fixed. This section covers EVERY controller of
 * `packages/core` and `packages/plugins`, so the next controller that forgets `@Permissions` on a
 * mutating route — or inherits one of the five bare `CrudController` / `CrudFactory` routes — fails
 * here instead of shipping (GHSA-v79w-54p2-wmh5).
 *
 * It reads the DECORATORS out of the sources with the TypeScript parser rather than importing all ~250
 * controller modules: importing them pulls the whole service and entity graph of both packages through
 * ts-jest, which takes tens of minutes on a cold cache and would make every `nx test core` run pay for
 * it. The parse takes a couple of seconds. The last test of this section pins the static reading
 * against the runtime metadata Nest actually reads, for the controllers this suite already imports, so
 * a divergence between the two shows up as a failure rather than as silent blindness.
 *
 * A route counts as GATED when the permission metadata `PermissionGuard` resolves is non-empty
 * (handler first, then class, the way `getAllAndOverride` resolves it), or when the route is explicitly
 * opened another way: `@Public()` (no authentication at all) or `@Roles()` + `RoleGuard` (SUPER_ADMIN
 * routes such as `TenantController.update`).
 *
 * Everything else must be named below, with a reason. Two lists, on purpose:
 *   - `DELIBERATELY_OPEN` — reviewed, and open by design. The reason says which check in the service
 *     takes over (ownership, the caller's own session, onboarding...).
 *   - `AWAITING_TRIAGE` — the inventory this advisory produced. These routes are reachable by any
 *     authenticated member of the tenant today; they are NOT endorsed. Each one needs the permission
 *     its UI already gates on, and moves out of this list when it gets one. Nothing may be ADDED here:
 *     a new entry means a new mutating route shipped without a permission.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */

const DELIBERATELY_OPEN: ReadonlyArray<string> = Object.freeze([
	// AuthController: acts on the session of the caller and nobody else
	'AuthController.logout',
	'AuthController.switchWorkspace',
	// CommentController: user-owned: CommentService pins the author to the employee of the caller, and only a
	// CHANGE_SELECTED_EMPLOYEE holder may edit or delete another employee comment
	// (comment.service.ts:52, 125)
	'CommentController.create',
	'CommentController.delete',
	'CommentController.softRecover',
	'CommentController.softRemove',
	'CommentController.update',
	// EmailVerificationController: re-sends the confirmation link to the address of the caller
	'EmailVerificationController.resendConfirmationLink',
	// EmployeeNotificationController: own notifications: EmployeeNotificationService pins the receiver to the employee of the caller and
	// the rows are employee scoped (employee-notification.service.ts:126)
	'EmployeeNotificationController.create',
	'EmployeeNotificationController.delete',
	'EmployeeNotificationController.markAllAsRead',
	'EmployeeNotificationController.softRecover',
	'EmployeeNotificationController.softRemove',
	'EmployeeNotificationController.update',
	// EmployeeSettingController: own settings: the rows carry employeeId, so TenantAwareCrudService scopes every read and write to
	// the employee of the caller unless they hold CHANGE_SELECTED_EMPLOYEE (employee-setting.service.ts:30)
	'EmployeeSettingController.create',
	'EmployeeSettingController.delete',
	'EmployeeSettingController.softRecover',
	'EmployeeSettingController.softRemove',
	'EmployeeSettingController.update',
	// FavoriteController: user-owned: FavoriteService pins the favorite to the employee of the caller and refuses to delete
	// one that belongs to somebody else (favorite.service.ts:58, 117)
	'FavoriteController.create',
	'FavoriteController.delete',
	'FavoriteController.softRecover',
	'FavoriteController.softRemove',
	'FavoriteController.update',
	// OrganizationVendorController: the shared ga-vendor-select creates a vendor inline from the Expenses dialog, which expense editors
	// reach without ALL_ORG_EDIT; renaming and deleting a vendor stay behind ALL_ORG_EDIT
	'OrganizationVendorController.create',
	// ReactionController: user-owned: ReactionService pins the reacting employee to the caller and refuses to update or delete
	// the reaction of another employee (reaction.service.ts:32, 98, 134)
	'ReactionController.create',
	'ReactionController.delete',
	'ReactionController.softRecover',
	'ReactionController.softRemove',
	'ReactionController.update',
	// TenantController: onboarding: a user without a tenant creates their own and becomes its SUPER_ADMIN
	// (tenant.service.ts onboardTenant)
	'TenantController.create',
	// UserController: own preferences: the service ignores any id in the payload and writes RequestContext.currentUserId()
	// (user.service.ts:569, 583, 607)
	'UserController.updatePreferredComponentLayout',
	'UserController.updatePreferredLanguage',
	'UserController.updateUiPreferences'
]);

const AWAITING_TRIAGE: ReadonlyArray<string> = Object.freeze([
	'AppointmentEmployeesController.create',
	'AppointmentEmployeesController.delete',
	'AppointmentEmployeesController.softRecover',
	'AppointmentEmployeesController.softRemove',
	'AppointmentEmployeesController.update',
	'AvailabilitySlotsController.create',
	'AvailabilitySlotsController.createBulkAvailabilitySlot',
	'AvailabilitySlotsController.delete',
	'AvailabilitySlotsController.softRecover',
	'AvailabilitySlotsController.softRemove',
	'AvailabilitySlotsController.update',
	'BroadcastController.softRecover',
	'BroadcastController.softRemove',
	'CandidateFeedbacksController.delete',
	'CandidateFeedbacksController.softRecover',
	'CandidateFeedbacksController.softRemove',
	'CandidatePersonalQualitiesController.softRecover',
	'CandidatePersonalQualitiesController.softRemove',
	'CandidatePersonalQualitiesController.update',
	'CandidateTechnologiesController.softRecover',
	'CandidateTechnologiesController.softRemove',
	'CandidateTechnologiesController.update',
	'ContactController.create',
	'ContactController.delete',
	'ContactController.softRecover',
	'ContactController.softRemove',
	'ContactController.update',
	'EmployeeAppointmentController.create',
	'EmployeeAppointmentController.delete',
	'EmployeeAppointmentController.softRecover',
	'EmployeeAppointmentController.softRemove',
	'EmployeeAppointmentController.update',
	'EmployeeLevelController.create',
	'EmployeeLevelController.delete',
	'EmployeeLevelController.softRecover',
	'EmployeeLevelController.softRemove',
	'EmployeeLevelController.update',
	'EmployeeNotificationSettingController.create',
	'EmployeeNotificationSettingController.delete',
	'EmployeeNotificationSettingController.softRecover',
	'EmployeeNotificationSettingController.softRemove',
	'EmployeeNotificationSettingController.update',
	'EmployeePresetController.deleteEmployeeCriterion',
	'EmployeePresetController.saveEmployeePreset',
	'EmployeePresetController.saveUpdateEmployeeCriterion',
	'EntitySubscriptionController.create',
	'EntitySubscriptionController.delete',
	'EntitySubscriptionController.softRecover',
	'EntitySubscriptionController.softRemove',
	'EntitySubscriptionController.update',
	'EquipmentController.create',
	'EquipmentController.delete',
	'EquipmentController.softRecover',
	'EquipmentController.softRemove',
	'EquipmentController.update',
	'EquipmentSharingController.create',
	'EquipmentSharingController.delete',
	'EquipmentSharingController.softRecover',
	'EquipmentSharingController.softRemove',
	'EventTypeController.create',
	'EventTypeController.delete',
	'EventTypeController.softRecover',
	'EventTypeController.softRemove',
	'EventTypeController.update',
	'GoalController.create',
	'GoalController.delete',
	'GoalController.softRecover',
	'GoalController.softRemove',
	'GoalController.update',
	'GoalGeneralSettingController.create',
	'GoalGeneralSettingController.delete',
	'GoalGeneralSettingController.softRecover',
	'GoalGeneralSettingController.softRemove',
	'GoalGeneralSettingController.update',
	'GoalKpiController.create',
	'GoalKpiController.delete',
	'GoalKpiController.softRecover',
	'GoalKpiController.softRemove',
	'GoalKpiController.update',
	'GoalKpiTemplateController.create',
	'GoalKpiTemplateController.delete',
	'GoalKpiTemplateController.softRecover',
	'GoalKpiTemplateController.softRemove',
	'GoalKpiTemplateController.update',
	'GoalTemplateController.create',
	'GoalTemplateController.delete',
	'GoalTemplateController.softRecover',
	'GoalTemplateController.softRemove',
	'GoalTemplateController.update',
	'GoalTimeFrameController.create',
	'GoalTimeFrameController.delete',
	'GoalTimeFrameController.softRecover',
	'GoalTimeFrameController.softRemove',
	'GoalTimeFrameController.update',
	'InvoiceEstimateHistoryController.create',
	'InvoiceEstimateHistoryController.delete',
	'InvoiceEstimateHistoryController.softRecover',
	'InvoiceEstimateHistoryController.softRemove',
	'InvoiceEstimateHistoryController.update',
	'InvoiceItemController.create',
	'InvoiceItemController.delete',
	'InvoiceItemController.softRecover',
	'InvoiceItemController.softRemove',
	'InvoiceItemController.update',
	'IssueTypeController.create',
	'IssueTypeController.delete',
	'IssueTypeController.markAsDefault',
	'IssueTypeController.softRecover',
	'IssueTypeController.softRemove',
	'IssueTypeController.update',
	'JobSearchCategoryController.create',
	'JobSearchCategoryController.delete',
	'JobSearchCategoryController.softRecover',
	'JobSearchCategoryController.softRemove',
	'JobSearchCategoryController.update',
	'JobSearchOccupationController.create',
	'JobSearchOccupationController.delete',
	'JobSearchOccupationController.softRecover',
	'JobSearchOccupationController.softRemove',
	'JobSearchOccupationController.update',
	'JobSearchPresetController.createJobPreset',
	'JobSearchPresetController.deleteJobPresetCriterion',
	'JobSearchPresetController.saveUpdate',
	'KeyResultController.create',
	'KeyResultController.createBulkKeyResults',
	'KeyResultController.delete',
	'KeyResultController.softRecover',
	'KeyResultController.softRemove',
	'KeyResultController.update',
	'KeyResultUpdateController.create',
	'KeyResultUpdateController.delete',
	'KeyResultUpdateController.deleteBulkByKeyResultId',
	'KeyResultUpdateController.softRecover',
	'KeyResultUpdateController.softRemove',
	'KeyResultUpdateController.update',
	'KeyresultTemplateController.create',
	'KeyresultTemplateController.delete',
	'KeyresultTemplateController.softRecover',
	'KeyresultTemplateController.softRemove',
	'KeyresultTemplateController.update',
	'MentionController.create',
	'MentionController.delete',
	'MentionController.softRecover',
	'MentionController.softRemove',
	'MentionController.update',
	'OrganizationAwardController.create',
	'OrganizationAwardController.delete',
	'OrganizationAwardController.softRecover',
	'OrganizationAwardController.softRemove',
	'OrganizationAwardController.update',
	'OrganizationDocumentController.create',
	'OrganizationDocumentController.delete',
	'OrganizationDocumentController.softRecover',
	'OrganizationDocumentController.softRemove',
	'OrganizationDocumentController.update',
	'OrganizationLanguageController.create',
	'OrganizationLanguageController.delete',
	'OrganizationLanguageController.softRecover',
	'OrganizationLanguageController.softRemove',
	'OrganizationLanguageController.update',
	'OrganizationRecurringExpenseController.create',
	'OrganizationRecurringExpenseController.delete',
	'OrganizationRecurringExpenseController.softRecover',
	'OrganizationRecurringExpenseController.softRemove',
	'OrganizationRecurringExpenseController.update',
	'OrganizationStrategicInitiativeController.softRecover',
	'OrganizationStrategicInitiativeController.softRemove',
	'PluginActivationController.updateStatus',
	'PluginBillingController.create',
	'PluginBillingController.update',
	'PluginBillingController.updateStatus',
	'PluginCategoryController.create',
	'PluginCategoryController.delete',
	'PluginCategoryController.partialUpdate',
	'PluginCategoryController.update',
	'PluginSecurityController.createVerification',
	'PluginSourceController.create',
	'PluginSourceController.delete',
	'PluginSourceController.updateStatus',
	'PluginTagController.batchCreate',
	'PluginTagController.batchDelete',
	'PluginTagController.create',
	'PluginTagController.delete',
	'PluginTagController.update',
	'PluginTagsController.replacePluginTags',
	'PluginTenantController.bulkUpdate',
	'PluginTenantController.create',
	'PluginTenantController.disable',
	'PluginTenantController.enable',
	'PluginTenantController.managePluginTenantUsers',
	'PluginTenantController.remove',
	'PluginTenantController.update',
	'PluginTenantController.updateApproval',
	'PluginTenantController.updateConfiguration',
	'PluginUserAssignmentController.assignUsersToPlugin',
	'PluginUserAssignmentController.unassignUsersFromPlugin',
	'PluginVersionController.createVersion',
	'PluginVersionController.delete',
	'PluginVersionController.update',
	'PluginVersionController.updateStatus',
	'ProductController.softRecover',
	'ProductController.softRemove',
	'ProductOptionController.create',
	'ProductOptionController.delete',
	'ProductOptionController.softRecover',
	'ProductOptionController.softRemove',
	'ProductOptionController.update',
	'ProductVariantController.create',
	'ProductVariantController.createProductVariants',
	'ProductVariantController.delete',
	'ProductVariantController.deleteFeaturedImage',
	'ProductVariantController.softRecover',
	'ProductVariantController.softRemove',
	'ProductVariantController.update',
	'ProductVariantPriceController.create',
	'ProductVariantPriceController.delete',
	'ProductVariantPriceController.softRecover',
	'ProductVariantPriceController.softRemove',
	'ProductVariantPriceController.update',
	'ProductVariantSettingController.create',
	'ProductVariantSettingController.delete',
	'ProductVariantSettingController.softRecover',
	'ProductVariantSettingController.softRemove',
	'ProductVariantSettingController.update',
	'ReportController.updateReportMenu',
	'RequestApprovalController.delete',
	'RequestApprovalController.softRecover',
	'RequestApprovalController.softRemove',
	'ResourceLinkController.create',
	'ResourceLinkController.delete',
	'ResourceLinkController.softRecover',
	'ResourceLinkController.softRemove',
	'ResourceLinkController.update',
	'ScreeningTasksController.create',
	'ScreeningTasksController.delete',
	'ScreeningTasksController.softRecover',
	'ScreeningTasksController.softRemove',
	'ScreeningTasksController.update',
	'SharedEntityController.create',
	'SharedEntityController.delete',
	'SharedEntityController.softRecover',
	'SharedEntityController.softRemove',
	'SharedEntityController.update',
	'SkillController.create',
	'SkillController.delete',
	'SkillController.softRecover',
	'SkillController.softRemove',
	'SkillController.update',
	'TagTypeController.delete',
	'TagTypeController.softRecover',
	'TagTypeController.softRemove',
	'TaskPriorityController.create',
	'TaskPriorityController.delete',
	'TaskPriorityController.softRecover',
	'TaskPriorityController.softRemove',
	'TaskPriorityController.update',
	'TaskRelatedIssueTypeController.create',
	'TaskRelatedIssueTypeController.delete',
	'TaskRelatedIssueTypeController.softRecover',
	'TaskRelatedIssueTypeController.softRemove',
	'TaskRelatedIssueTypeController.update',
	'TaskSizeController.create',
	'TaskSizeController.delete',
	'TaskSizeController.softRecover',
	'TaskSizeController.softRemove',
	'TaskSizeController.update',
	'TaskStatusController.create',
	'TaskStatusController.delete',
	'TaskStatusController.markAsDefault',
	'TaskStatusController.reorder',
	'TaskStatusController.softRecover',
	'TaskStatusController.softRemove',
	'TaskStatusController.update',
	'TaskVersionController.create',
	'TaskVersionController.delete',
	'TaskVersionController.softRecover',
	'TaskVersionController.softRemove',
	'TaskVersionController.update',
	'TaskViewController.create',
	'TaskViewController.delete',
	'TaskViewController.softRecover',
	'TaskViewController.softRemove',
	'TaskViewController.update',
	'WakatimeController.save',
	'WakatimeController.saveData',
	'ZapierWebhookController.createWebhook',
	'ZapierWebhookController.deleteWebhook'
]);

/** Roots the scan walks. */
const SCANNED_ROOTS = ['packages/core/src', 'packages/plugins'];

/** The five mutating routes `CrudController` and `CrudFactory` declare, and their HTTP method. */
const INHERITED_CRUD_ROUTES: Readonly<Record<string, string>> = Object.freeze({
	create: 'POST',
	update: 'PUT',
	delete: 'DELETE',
	softRemove: 'DELETE',
	softRecover: 'PUT'
});

const HTTP_MUTATING_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);

interface ScannedRoute {
	/** `<ControllerClass>.<method>`, the key the opt-in lists use. */
	key: string;
	file: string;
	httpMethod: string;
	gated: boolean;
}

/** Every `*.controller.ts` under the scanned roots, sorted for a stable failure message. */
function controllerFiles(): string[] {
	const repoRoot = path.resolve(__dirname, '../../../../../..');
	const files: string[] = [];

	const walk = (directory: string): void => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(directory, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
				continue;
			}
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.name.endsWith('.controller.ts')) {
				files.push(full);
			}
		}
	};

	for (const root of SCANNED_ROOTS) {
		walk(path.join(repoRoot, root));
	}

	return files.sort();
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
	// `node.decorators` up to TypeScript 4.7, `ts.getDecorators()` from 5.0 on.
	return ((ts as any).getDecorators?.(node) ?? (node as any).decorators ?? []) as readonly ts.Decorator[];
}

function decoratorCall(node: ts.Node, name: string): ts.CallExpression | undefined {
	for (const decorator of decoratorsOf(node)) {
		const expression = decorator.expression;
		if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
			if (expression.expression.text === name) {
				return expression;
			}
		}
	}
	return undefined;
}

/** `undefined` when the decorator is absent; otherwise how many permissions it declares. */
function declaredPermissionCount(node: ts.Node): number | undefined {
	return decoratorCall(node, 'Permissions')?.arguments.length;
}

/** `@Public()` (unauthenticated by design) and `@Roles()` (role gate) are explicit decisions too. */
function isOpenedAnotherWay(node: ts.Node): boolean {
	return !!decoratorCall(node, 'Public') || !!decoratorCall(node, 'Roles');
}

/**
 * Enumerates every mutating route of every controller under the scanned roots, declared or inherited
 * from `CrudController` / `CrudFactory`, and says whether it is gated.
 */
function scanMutatingRoutes(): ScannedRoute[] {
	const repoRoot = path.resolve(__dirname, '../../../../../..');
	const routes: ScannedRoute[] = [];

	for (const file of controllerFiles()) {
		const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		const relative = path.relative(repoRoot, file).split(path.sep).join('/');

		for (const statement of source.statements) {
			if (!ts.isClassDeclaration(statement) || !statement.name || !decoratorCall(statement, 'Controller')) {
				continue;
			}

			const controller = statement.name.text;
			const classPermissions = declaredPermissionCount(statement);
			const classOpened = isOpenedAnotherWay(statement);

			const declared = new Map<string, ts.MethodDeclaration>();
			for (const member of statement.members) {
				if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
					declared.set(member.name.text, member);
				}
			}

			const add = (method: string, httpMethod: string, node?: ts.MethodDeclaration): void => {
				// Handler metadata WINS over class metadata, empty handler metadata included — that is what
				// `getAllAndOverride` does, and it is why a `@Permissions()` with no argument on a handler
				// would disarm the class-level gate.
				const handlerPermissions = node ? declaredPermissionCount(node) : undefined;
				const effective = handlerPermissions ?? classPermissions ?? 0;
				routes.push({
					key: `${controller}.${method}`,
					file: relative,
					httpMethod,
					gated: effective > 0 || classOpened || (node ? isOpenedAnotherWay(node) : false)
				});
			};

			for (const [method, node] of declared) {
				for (const decorator of decoratorsOf(node)) {
					const expression = decorator.expression;
					const name =
						ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
							? expression.expression.text
							: undefined;
					if (name && HTTP_MUTATING_DECORATORS.has(name)) {
						add(method, name.toUpperCase(), node);
						break;
					}
				}
			}

			const extendsClause = statement.heritageClauses?.find(
				(clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
			);
			const baseClass = extendsClause ? extendsClause.types[0].getText(source) : '';

			if (/^(CrudController|CrudFactory)\b/.test(baseClass)) {
				for (const [method, httpMethod] of Object.entries(INHERITED_CRUD_ROUTES)) {
					// A subclass method of the same name replaces the inherited route: Nest resolves the
					// handler on the most derived prototype, so an override without an HTTP decorator removes
					// the route, and one with a decorator is scanned above.
					if (!declared.has(method)) {
						add(method, httpMethod, undefined);
					}
				}
			}
		}
	}

	return routes;
}

describe('every mutating route of core and the plugins', () => {
	const scanned = scanMutatingRoutes();
	const ungated = scanned
		.filter((route) => !route.gated)
		.map((route) => route.key)
		.sort();
	const optedIn = [...DELIBERATELY_OPEN, ...AWAITING_TRIAGE];

	it('scans the whole surface, not a handful of controllers', () => {
		// Guards against the walk silently finding nothing (a moved root, a changed file suffix).
		expect(new Set(scanned.map((route) => route.file)).size).toBeGreaterThan(150);
		expect(scanned.length).toBeGreaterThan(800);
	});

	it('leaves no mutating route without permission metadata, beyond the declared opt-ins', () => {
		const allowed = new Set(optedIn);
		expect(ungated.filter((key) => !allowed.has(key))).toEqual([]);
	});

	it('keeps the opt-in lists honest: every entry still names a route that is still ungated', () => {
		// Without this, a route that later gets a permission — or disappears — would leave a stale line
		// that quietly re-opens the hole if the route comes back.
		const stillUngated = new Set(ungated);
		expect(optedIn.filter((key) => !stillUngated.has(key))).toEqual([]);
		expect(optedIn.length).toBe(new Set(optedIn).size);
	});

	it('agrees with the metadata Nest itself reads, for the controllers this suite loads', () => {
		// The static reading is only trustworthy while it matches the runtime one. These controllers cover
		// all four shapes: class-level metadata, handler-level metadata, an inherited bare route and an
		// overridden gated route.
		const controllers: Function[] = [
			UserController,
			TagController,
			OrganizationContactController,
			OrganizationVendorController,
			OrganizationDepartmentController
		];

		for (const controller of controllers) {
			const runtime = mutatingRoutes(controller)
				.filter((route) => permissionsOf(controller, route).length === 0)
				.map((route) => `${controller.name}.${route.name}`)
				.sort();
			const statically = scanned
				.filter((route) => route.gated === false && route.key.startsWith(`${controller.name}.`))
				.map((route) => route.key)
				.sort();

			expect({ controller: controller.name, routes: statically }).toEqual({
				controller: controller.name,
				routes: runtime
			});
		}
	});
});

describe('the routes GHSA-v79w-54p2-wmh5 left reachable by any tenant member', () => {
	// Each of these was served by the BARE `CrudController` handler: no guard, no permission. The
	// controls below show what that meant.
	it('gates soft-deleting and restoring a user with ORG_USERS_EDIT', () => {
		// Not the `delete` pair (ALL_ORG_EDIT | ACCESS_DELETE_ACCOUNT): EMPLOYEE holds
		// ACCESS_DELETE_ACCOUNT for deleting its own account, and `UserService.delete` is what enforces
		// "own account" — the soft routes do not go through it.
		expectFullyGated(
			UserController,
			[PermissionsEnum.ORG_USERS_EDIT],
			[
				'create',
				'update',
				'delete',
				'factoryReset',
				'updatePreferredLanguage',
				'updatePreferredComponentLayout',
				'updateUiPreferences'
			]
		);
	});

	it('gates deleting, soft-deleting and restoring an organization contact with ORG_CONTACT_EDIT', () => {
		expectFullyGated(OrganizationContactController, [PermissionsEnum.ORG_CONTACT_EDIT], ['updateByEmployee']);
	});

	it('gates deleting, soft-deleting and restoring a tag', () => {
		const tagRoutes = mutatingRoutes(TagController).filter((route) =>
			['delete', 'softRemove', 'softRecover'].includes(route.name)
		);

		expect(tagRoutes.map((route) => route.name).sort()).toEqual(['delete', 'softRecover', 'softRemove']);

		for (const route of tagRoutes) {
			expect(route.declaredOn).toBe(TagController);
			expect(guardsOf(route)).toContain(PermissionGuard);
			// The tags page offers delete to ALL_ORG_EDIT or ORG_TAGS_DELETE and edit to ORG_TAGS_EDIT;
			// `checkRolePermission` uses `IN (:...permissions)`, so holding any one of them passes.
			expect(permissionsOf(TagController, route)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_TAGS_EDIT,
				PermissionsEnum.ORG_TAGS_DELETE
			]);
		}
	});

	it('CONTROL: the inherited handlers these routes used to serve carry no permission metadata at all', () => {
		// This is the pre-fix state of all three controllers: `Reflect.getMetadata` on the inherited
		// handler, then on the controller class, yields nothing.
		for (const name of ['delete', 'softRemove', 'softRecover']) {
			const handler = (CrudController.prototype as any)[name];

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toBeUndefined();

			for (const controller of [UserController, TagController, OrganizationContactController]) {
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toBeUndefined();
			}
		}
	});

	it('CONTROL: PermissionGuard authorizes a route whose effective metadata is empty', () => {
		// Why the bare routes were reachable by EMPLOYEE / VIEWER / CANDIDATE: the guard returns true
		// before it ever asks the role-permission service. Gating the routes is what closes that, which is
		// why this suite asserts the metadata rather than the guard.
		const guard = new PermissionGuard({ get: jest.fn(), set: jest.fn() } as any, new Reflector(), {
			checkRolePermission: jest.fn(async () => false)
		} as any);

		class BareController {}
		const handler = function bareHandler() {
			/* the inherited CrudController route */
		};

		const context = {
			getHandler: () => handler,
			getClass: () => BareController,
			switchToHttp: () => ({ getRequest: () => ({}) })
		} as unknown as ExecutionContext;

		return expect(guard.canActivate(context)).resolves.toBe(true);
	});
});
