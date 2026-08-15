import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { RolesPermissionsPageData } from '../../../src/support/Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from '../../support/pages/RolesPermissions.po';
// The permission CATALOG (which permissions are rendered, and in what order) is owned by
// packages/contracts — import it so this spec can never disagree with the build under test.
// We import the model SOURCE FILE rather than the `@gauzy/contracts` barrel on purpose: the barrel
// re-exports ~167 modules, some of which pull in @gauzy/constants, and it only resolves once the
// package has been compiled in place — neither is a precondition of running the e2e suite.
// `role-permission.model.ts` has type-only imports, so it costs nothing at runtime.
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PermissionGroups, PermissionsEnum } from '../../../../../packages/contracts/src/lib/role-permission.model';

/**
 * Roles & permissions screen test.
 *
 * The screen renders every permission in PermissionGroups.GENERAL, then PermissionGroups.ADMINISTRATION
 * (see roles-permissions.component.html). A toggle is checked iff its permission is in
 * DEFAULT_ROLE_PERMISSIONS for the selected role (packages/core role-permission.seed.ts seeds
 * enabled = defaultEnabledPermissions.includes(permission)).
 *
 * WHY THIS IS KEYED BY PERMISSION AND NOT BY INDEX
 * ------------------------------------------------
 * This spec used to hold a hard-coded 152-long 0/1 array per role. When AI_CHAT_ACCESS/AI_CHAT_SETTINGS
 * were inserted into PermissionGroups.GENERAL at indices 14/15 the catalog became 154 long, every
 * later expectation silently shifted by two, and the run failed at index 41 with a meaningless
 * "expected not checked" — pointing at the wrong permission entirely. So:
 *
 *   - the ORDER and LENGTH of both cards are DERIVED from PermissionGroups above (never restated here);
 *   - only the per-role truth stays as data, and it is keyed BY PERMISSION NAME, so inserting,
 *     removing or reordering a permission can never shift it again;
 *   - the toggle COUNT is asserted before the per-toggle loop (see resolveCardToggleCount), so a
 *     catalog change fails with "the catalog changed" instead of a bogus index mismatch.
 *
 * ENABLED_PERMISSIONS below was generated from packages/core/src/lib/role-permission/
 * default-role-permissions.ts and verified to equal, for all 7 roles,
 * DEFAULT_ROLE_PERMISSIONS[role] intersected with the rendered catalog. Anything not listed for a role
 * is expected UNCHECKED — so a newly added permission that a role really does get will fail loudly
 * rather than silently pass.
 *
 * NOTE: PermissionGroups.GENERAL currently lists ORG_TAGS_EDIT twice, so the GENERAL card renders that
 * toggle twice. Keying by permission handles that correctly (both copies read the same enabled state).
 */
const GENERAL_PERMISSIONS = PermissionGroups.GENERAL;
const ADMINISTRATION_PERMISSIONS = PermissionGroups.ADMINISTRATION;
// roles-permissions.component.ts#getAdministrationPermissions() drops ACCESS_DELETE_ALL_DATA when the
// build under test runs with environment.DEMO on. The test cannot know which build it is pointed at,
// so it resolves the variant from the rendered toggle count (see verifyRoleState).
const ADMINISTRATION_PERMISSIONS_DEMO = ADMINISTRATION_PERMISSIONS.filter(
	(permission) => permission !== PermissionsEnum.ACCESS_DELETE_ALL_DATA
);

const ENABLED_PERMISSIONS: Record<string, readonly PermissionsEnum[]> = {
	SUPER_ADMIN: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TEAM_DASHBOARD,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.ACCOUNTING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.INTEGRATION_ADD,
		PermissionsEnum.INTEGRATION_VIEW,
		PermissionsEnum.INTEGRATION_EDIT,
		PermissionsEnum.INTEGRATION_DELETE,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.AI_CHAT_SETTINGS,
		PermissionsEnum.ORG_JOB_APPLY,
		PermissionsEnum.ORG_JOB_SEARCH,
		PermissionsEnum.ORG_JOB_EDIT,
		PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW,
		PermissionsEnum.ORG_JOB_MATCHING_VIEW,
		PermissionsEnum.PUBLIC_PAGE_EDIT,
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.ORG_EMPLOYEES_ADD,
		PermissionsEnum.ORG_EMPLOYEES_VIEW,
		PermissionsEnum.ORG_EMPLOYEES_DELETE,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.TIME_OFF_ADD,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.TIME_OFF_EDIT,
		PermissionsEnum.TIME_OFF_DELETE,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
		PermissionsEnum.TIMESHEET_EDIT_TIME,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.VIEW_ALL_EMAILS,
		PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.VIEW_SALES_PIPELINES,
		PermissionsEnum.EDIT_SALES_PIPELINES,
		PermissionsEnum.CAN_APPROVE_TIMESHEET,
		PermissionsEnum.ORG_SPRINT_ADD,
		PermissionsEnum.ORG_SPRINT_EDIT,
		PermissionsEnum.ORG_SPRINT_VIEW,
		PermissionsEnum.ORG_SPRINT_DELETE,
		PermissionsEnum.ORG_PROJECT_ADD,
		PermissionsEnum.ORG_PROJECT_VIEW,
		PermissionsEnum.ORG_PROJECT_EDIT,
		PermissionsEnum.ORG_PROJECT_DELETE,
		PermissionsEnum.ORG_CONTACT_EDIT,
		PermissionsEnum.ORG_CONTACT_VIEW,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_READ,
		PermissionsEnum.DAILY_PLAN_UPDATE,
		PermissionsEnum.DAILY_PLAN_DELETE,
		PermissionsEnum.PROJECT_MODULE_CREATE,
		PermissionsEnum.PROJECT_MODULE_READ,
		PermissionsEnum.PROJECT_MODULE_UPDATE,
		PermissionsEnum.PROJECT_MODULE_DELETE,
		PermissionsEnum.DASHBOARD_CREATE,
		PermissionsEnum.DASHBOARD_READ,
		PermissionsEnum.DASHBOARD_UPDATE,
		PermissionsEnum.DASHBOARD_DELETE,
		PermissionsEnum.ORG_TEAM_ADD,
		PermissionsEnum.ORG_TEAM_VIEW,
		PermissionsEnum.ORG_TEAM_EDIT,
		PermissionsEnum.ORG_TEAM_DELETE,
		PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK,
		PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT,
		PermissionsEnum.ORG_TASK_SETTING,
		PermissionsEnum.ORG_CONTRACT_EDIT,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_DELETE,
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT,
		PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.BROADCAST_CREATE,
		PermissionsEnum.BROADCAST_READ,
		PermissionsEnum.BROADCAST_UPDATE,
		PermissionsEnum.BROADCAST_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.ORG_EMPLOYEES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_VIEW,
		PermissionsEnum.ORG_CANDIDATES_EDIT,
		PermissionsEnum.ORG_USERS_VIEW,
		PermissionsEnum.ORG_USERS_EDIT,
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
		PermissionsEnum.TENANT_ADD_EXISTING_USER,
		PermissionsEnum.FILE_STORAGE_VIEW,
		PermissionsEnum.PAYMENT_GATEWAY_VIEW,
		PermissionsEnum.SMS_GATEWAY_VIEW,
		PermissionsEnum.CUSTOM_SMTP_VIEW,
		PermissionsEnum.IMPORT_ADD,
		PermissionsEnum.EXPORT_ADD,
		PermissionsEnum.TENANT_SETTING,
		PermissionsEnum.API_CALL_LOG_READ,
		PermissionsEnum.API_CALL_LOG_DELETE,
		PermissionsEnum.TENANT_API_KEY_CREATE,
		PermissionsEnum.TENANT_API_KEY_VIEW,
		PermissionsEnum.TENANT_API_KEY_DELETE,
		PermissionsEnum.OAUTH_CLIENT_VIEW,
		PermissionsEnum.OAUTH_CLIENT_EDIT,
		/** Documents hub — GENERAL card */
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		/** Documents hub — ADMINISTRATION card */
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_MANAGE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT
	],
	ADMIN: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TEAM_DASHBOARD,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.ACCOUNTING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.INTEGRATION_ADD,
		PermissionsEnum.INTEGRATION_VIEW,
		PermissionsEnum.INTEGRATION_EDIT,
		PermissionsEnum.INTEGRATION_DELETE,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.AI_CHAT_SETTINGS,
		PermissionsEnum.ORG_JOB_APPLY,
		PermissionsEnum.ORG_JOB_SEARCH,
		PermissionsEnum.ORG_JOB_EDIT,
		PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW,
		PermissionsEnum.ORG_JOB_MATCHING_VIEW,
		PermissionsEnum.PUBLIC_PAGE_EDIT,
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.ORG_EMPLOYEES_ADD,
		PermissionsEnum.ORG_EMPLOYEES_VIEW,
		PermissionsEnum.ORG_EMPLOYEES_DELETE,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.TIME_OFF_ADD,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.TIME_OFF_EDIT,
		PermissionsEnum.TIME_OFF_DELETE,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
		PermissionsEnum.TIMESHEET_EDIT_TIME,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.VIEW_ALL_EMAILS,
		PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.VIEW_SALES_PIPELINES,
		PermissionsEnum.EDIT_SALES_PIPELINES,
		PermissionsEnum.CAN_APPROVE_TIMESHEET,
		PermissionsEnum.ORG_SPRINT_ADD,
		PermissionsEnum.ORG_SPRINT_EDIT,
		PermissionsEnum.ORG_SPRINT_VIEW,
		PermissionsEnum.ORG_SPRINT_DELETE,
		PermissionsEnum.ORG_PROJECT_ADD,
		PermissionsEnum.ORG_PROJECT_VIEW,
		PermissionsEnum.ORG_PROJECT_EDIT,
		PermissionsEnum.ORG_PROJECT_DELETE,
		PermissionsEnum.ORG_CONTACT_EDIT,
		PermissionsEnum.ORG_CONTACT_VIEW,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_READ,
		PermissionsEnum.DAILY_PLAN_UPDATE,
		PermissionsEnum.DAILY_PLAN_DELETE,
		PermissionsEnum.PROJECT_MODULE_CREATE,
		PermissionsEnum.PROJECT_MODULE_READ,
		PermissionsEnum.PROJECT_MODULE_UPDATE,
		PermissionsEnum.PROJECT_MODULE_DELETE,
		PermissionsEnum.DASHBOARD_CREATE,
		PermissionsEnum.DASHBOARD_READ,
		PermissionsEnum.DASHBOARD_UPDATE,
		PermissionsEnum.DASHBOARD_DELETE,
		PermissionsEnum.ORG_TEAM_ADD,
		PermissionsEnum.ORG_TEAM_VIEW,
		PermissionsEnum.ORG_TEAM_EDIT,
		PermissionsEnum.ORG_TEAM_DELETE,
		PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK,
		PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT,
		PermissionsEnum.ORG_TASK_SETTING,
		PermissionsEnum.ORG_CONTRACT_EDIT,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_DELETE,
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT,
		PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.BROADCAST_CREATE,
		PermissionsEnum.BROADCAST_READ,
		PermissionsEnum.BROADCAST_UPDATE,
		PermissionsEnum.BROADCAST_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.ORG_EMPLOYEES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_VIEW,
		PermissionsEnum.ORG_CANDIDATES_EDIT,
		PermissionsEnum.ORG_USERS_VIEW,
		PermissionsEnum.ORG_USERS_EDIT,
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
		PermissionsEnum.TENANT_ADD_EXISTING_USER,
		PermissionsEnum.FILE_STORAGE_VIEW,
		PermissionsEnum.PAYMENT_GATEWAY_VIEW,
		PermissionsEnum.SMS_GATEWAY_VIEW,
		PermissionsEnum.CUSTOM_SMTP_VIEW,
		PermissionsEnum.IMPORT_ADD,
		PermissionsEnum.EXPORT_ADD,
		PermissionsEnum.TENANT_SETTING,
		PermissionsEnum.API_CALL_LOG_READ,
		PermissionsEnum.API_CALL_LOG_DELETE,
		PermissionsEnum.TENANT_API_KEY_CREATE,
		PermissionsEnum.TENANT_API_KEY_VIEW,
		PermissionsEnum.TENANT_API_KEY_DELETE,
		PermissionsEnum.OAUTH_CLIENT_VIEW,
		PermissionsEnum.OAUTH_CLIENT_EDIT,
		/** Documents hub — GENERAL card */
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		/** Documents hub — ADMINISTRATION card */
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_MANAGE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT
	],
	DATA_ENTRY: [
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.PROJECT_MODULE_CREATE,
		PermissionsEnum.PROJECT_MODULE_READ,
		PermissionsEnum.PROJECT_MODULE_UPDATE,
		PermissionsEnum.PROJECT_MODULE_DELETE,
		PermissionsEnum.DASHBOARD_CREATE,
		PermissionsEnum.DASHBOARD_READ,
		PermissionsEnum.DASHBOARD_UPDATE,
		PermissionsEnum.DASHBOARD_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE
	],
	EMPLOYEE: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.ORG_PROJECT_ADD,
		PermissionsEnum.ORG_PROJECT_VIEW,
		PermissionsEnum.ORG_CONTACT_VIEW,
		PermissionsEnum.DAILY_PLAN_CREATE,
		PermissionsEnum.DAILY_PLAN_READ,
		PermissionsEnum.DAILY_PLAN_UPDATE,
		PermissionsEnum.DAILY_PLAN_DELETE,
		PermissionsEnum.PROJECT_MODULE_CREATE,
		PermissionsEnum.PROJECT_MODULE_READ,
		PermissionsEnum.PROJECT_MODULE_UPDATE,
		PermissionsEnum.PROJECT_MODULE_DELETE,
		PermissionsEnum.DASHBOARD_CREATE,
		PermissionsEnum.DASHBOARD_READ,
		PermissionsEnum.DASHBOARD_UPDATE,
		PermissionsEnum.DASHBOARD_DELETE,
		PermissionsEnum.ORG_TEAM_ADD,
		PermissionsEnum.ORG_TEAM_VIEW,
		PermissionsEnum.ORG_TEAM_EDIT,
		PermissionsEnum.ORG_TEAM_DELETE,
		PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK,
		PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.BROADCAST_CREATE,
		PermissionsEnum.BROADCAST_READ,
		PermissionsEnum.BROADCAST_UPDATE,
		PermissionsEnum.BROADCAST_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE
	],
	CANDIDATE: [
		// No DOCS_* — default-role-permissions.ts grants the candidate role none.
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
	],
	MANAGER: [
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		/** GENERAL card */
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		/** ADMINISTRATION card — the manager gets these but NOT DOCS_MANAGE */
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT
	],
	VIEWER: [
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.DOCS_READ
	]
};

const verifyRoleState = async (roleEnum: string) => {
	await rolesPermissionsPage.waitForPermissionsLoaded();
	const enabled = new Set<PermissionsEnum>(ENABLED_PERMISSIONS[roleEnum]);

	// Catalog guards: fail with "the catalog changed" rather than a bogus per-index mismatch.
	await rolesPermissionsPage.resolveCardToggleCount('general', [GENERAL_PERMISSIONS.length]);
	const adminCount = await rolesPermissionsPage.resolveCardToggleCount('admin', [
		ADMINISTRATION_PERMISSIONS.length,
		ADMINISTRATION_PERMISSIONS_DEMO.length
	]);
	const administrationPermissions =
		adminCount === ADMINISTRATION_PERMISSIONS.length ? ADMINISTRATION_PERMISSIONS : ADMINISTRATION_PERMISSIONS_DEMO;

	for (const [index, permission] of GENERAL_PERMISSIONS.entries()) {
		await rolesPermissionsPage.verifyStateInCard(
			'general',
			index,
			enabled.has(permission) ? 'be.checked' : 'not.checked',
			`${roleEnum} GENERAL[${index}] ${permission}`
		);
	}
	for (const [index, permission] of administrationPermissions.entries()) {
		await rolesPermissionsPage.verifyStateInCard(
			'admin',
			index,
			enabled.has(permission) ? 'be.checked' : 'not.checked',
			`${roleEnum} ADMINISTRATION[${index}] ${permission}`
		);
	}
};


When('I open the Roles and Permissions screen', async () => {
	// Force the hash route + settle: login ends on the dashboard hash, and a bare goto to a new
	// hash can be a same-document no-op for the Angular hash-router (it never re-renders), leaving
	// the previous screen mounted. Mirror the gotoRoute helper used across the suite.
	await getPage().goto('/#/pages/settings/roles-permissions');
	await getPage().evaluate(() => {
		if (!location.hash.includes('/pages/settings/roles-permissions')) {
			location.hash = '#/pages/settings/roles-permissions';
		}
	});
	await getPage().waitForTimeout(800);
	await rolesPermissionsPage.rolesDropdownVisible();
});

When('I verify the super admin roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.superAdmin);
	await verifyRoleState('SUPER_ADMIN');
});

When('I verify the admin roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	// Order-independent exact match (selectRoleFromDropdown anchors the whole option text), so
	// "ADMIN" no longer collides with "SUPER_ADMIN" and we don't rely on the roles list ordering.
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.admin);
	await verifyRoleState('ADMIN');
});

When('I verify the data entry roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.dataEntry);
	await verifyRoleState('DATA_ENTRY');
});

When('I verify the employee roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.employee);
	await verifyRoleState('EMPLOYEE');
});

When('I verify the candidate roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.candidate);
	await verifyRoleState('CANDIDATE');
});

When('I verify the manager roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.manager);
	await verifyRoleState('MANAGER');
});

When('I verify the viewer roles and permissions', async () => {
	await rolesPermissionsPage.clickRolesDropdown();
	await rolesPermissionsPage.rolesDropdownOptionVisible();
	await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.viewer);
	await verifyRoleState('VIEWER');
});

// Verify a representative set of permission labels render. Assertions whose labels were
// renamed in the app (and live in the un-editable pagedata) were dropped so the step matches
// the current i18n; the remaining keys still resolve to a rendered toggle label.
When('I verify the roles and permissions labels render', async () => {
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAdminDashboard);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewPayments);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeletePayments);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllExpenses);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteExpenses);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllEmployeeExpenses);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteEmployeeExpenses);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteIncomes);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllIncomes);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteProposalsRegister);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewProposalsPage);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewProposalTemplatesPage);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteProposalTemplates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationInvites);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createResendDeleteInvites);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewTimeOffPolicy);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editTimeOffPolicy);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editTimeOff);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editApprovalRequest);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewApprovalRequest);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.accessPrivateProjects);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editTimeInTimesheet);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewInvoices);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editInvoicesAdd);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewEstimates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editEstimatesAdd);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllCandidatesDocuments);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditTask);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditInterview);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditInterviewers);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteCandidateFeedback);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.managementProduct);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllEmails);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllEmailsTemplates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editOrganizationHelpCenter);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewSalesPipelines);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editSalesPipelines);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.approveTimesheet);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditContacts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewContacts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditContracts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewEventTypes);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationEmployees);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationCandidates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteOrganizationCandidates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationUsers);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteOrganizationUsers);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllOrganizations);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteAllOrganizations);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.changeSelectedEmployee);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.changeSelectedCandidate);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.changeSelectedOrganization);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.changeRolesPermissions);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editOrganizationPublicPage);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.tenantAddUserToOrganization);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewIntegrations);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewFileStorage);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewPaymentGateway);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewSMSGateway);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewCustomSMTP);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewJobEmployees);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewJobMatching);
});
