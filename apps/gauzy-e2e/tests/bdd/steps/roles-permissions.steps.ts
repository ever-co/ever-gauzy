import * as fs from 'fs';
import * as path from 'path';
import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { RolesPermissionsPageData } from '../../../src/support/Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from '../../support/pages/RolesPermissions.po';
// The permission CATALOG (which permissions each card renders) is owned by
// packages/contracts — import it so this spec can never disagree with the build under test.
// We import the model SOURCE FILE rather than the `@gauzy/contracts` barrel on purpose: the barrel
// re-exports ~167 modules, some of which pull in @gauzy/constants, and it only resolves once the
// package has been compiled in place — neither is a precondition of running the e2e suite.
// `role-permission.model.ts` has type-only imports, so it costs nothing at runtime.
// Stale `@nrwl/nx` rule id fixed (TASK 8): the flat config (eslint.config.js) registers this rule
// as `@nx`, so the old id was silently not suppressing anything — the disable directive must be
// the line immediately above the suppressed import, not separated from it by more comment lines.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { PermissionGroups, PermissionsEnum } from '../../../../../packages/contracts/src/lib/role-permission.model';

/**
 * Roles & permissions screen test.
 *
 * The screen renders the permissions of PermissionGroups.GENERAL in one card and those of
 * PermissionGroups.ADMINISTRATION in the other. A toggle is checked iff its permission is enabled for
 * the selected role, which on the e2e database is what role-permission.seed.ts provisions:
 * enabled = DEFAULT_ROLE_PERMISSIONS[role] includes it, OR a loaded plugin declares it with
 * `defaultFor: [role]` (packages/plugins/<commerce plugin>/src/lib/*.permissions.ts).
 *
 * HOW A TOGGLE IS TIED TO ITS PERMISSION
 * --------------------------------------
 * Since the roles & permissions polish (#10526, 09ecd8e5aa) the cards are split into titled sections
 * (apps/gauzy/.../roles-permissions/permission-sections.ts, toPermissionSections): the toggles are in
 * SECTION order, not PermissionGroups order, and every permission is rendered ONCE — PermissionGroups.GENERAL
 * lists ORG_TAGS_EDIT twice, which is why the card rendered 306 toggles for a 307-entry list. An index into
 * PermissionGroups therefore no longer names the toggle at that position. So each toggle is identified by
 * the label it renders, `ORGANIZATIONS_PAGE.PERMISSIONS.<permission>` in en.json (the suite runs in
 * English; the labels of all catalogue permissions are distinct), and per card the test asserts:
 *
 *   - every rendered label is the label of a permission of THAT group (no unknown/foreign toggle);
 *   - no permission is rendered twice;
 *   - the rendered permissions are exactly the group's distinct permissions — so a permission the UI
 *     silently drops fails here, by name (the ADMINISTRATION card may legitimately miss what
 *     getAdministrationPermissions() hides when the web bundle is built with DEMO on:
 *     ACCESS_DELETE_ALL_DATA);
 *   - every toggle's checked state equals "is it in ENABLED_PERMISSIONS[role]".
 *
 * ENABLED_PERMISSIONS below is generated from origin/develop: for each role,
 * (DEFAULT_ROLE_PERMISSIONS[role] in packages/core/src/lib/role-permission/default-role-permissions.ts
 *  + the plugin-declared defaultFor grants) intersected with the rendered catalogue. Anything not listed
 * for a role is expected UNCHECKED — so a newly added permission that a role really does get fails loudly
 * rather than silently passing. Cross-checked against the stage run's DOM (d365fbe9e6, SUPER_ADMIN):
 * 306 + 61 toggles, every label mapped to exactly one permission, every state as listed here.
 */
const GENERAL_PERMISSIONS: readonly PermissionsEnum[] = [...new Set(PermissionGroups.GENERAL)];
const ADMINISTRATION_PERMISSIONS: readonly PermissionsEnum[] = [...new Set(PermissionGroups.ADMINISTRATION)];
// roles-permissions.component.ts#getAdministrationPermissions() hides these when the WEB bundle is built
// with environment.DEMO on (the stage/CI bundle is: its ADMINISTRATION card shows 61 of 62). The test
// cannot know which bundle it is pointed at, so it accepts either variant of that card (see verifyCard).
const DEMO_HIDDEN_PERMISSIONS = new Set<PermissionsEnum>([
	PermissionsEnum.ACCESS_DELETE_ACCOUNT,
	PermissionsEnum.ACCESS_DELETE_ALL_DATA
]);
const ADMINISTRATION_PERMISSIONS_DEMO = ADMINISTRATION_PERMISSIONS.filter(
	(permission) => !DEMO_HIDDEN_PERMISSIONS.has(permission)
);

/**
 * label -> permission for every catalogue permission, from the English translation file the web
 * bundle is built with. Read lazily (first role check), never at module load: every step file is
 * loaded for every scenario, so a throw here must not take the other features down with it.
 */
let permissionByLabel: Map<string, PermissionsEnum> | undefined;
const normaliseLabel = (label: string) => label.replace(/\s+/g, ' ').trim();
const getPermissionByLabel = (): Map<string, PermissionsEnum> => {
	if (permissionByLabel) return permissionByLabel;
	const enJsonPath = path.resolve(__dirname, '../../../../../packages/ui-core/i18n/assets/i18n/en.json');
	const labels: Record<string, string> = JSON.parse(fs.readFileSync(enJsonPath, 'utf8')).ORGANIZATIONS_PAGE.PERMISSIONS;
	let map = new Map<string, PermissionsEnum>();
	for (const permission of new Set([...GENERAL_PERMISSIONS, ...ADMINISTRATION_PERMISSIONS])) {
		const label = labels[permission];
		if (typeof label !== 'string' || !label.trim()) {
			throw new Error(`en.json has no ORGANIZATIONS_PAGE.PERMISSIONS.${permission} label to find its toggle by.`);
		}
		const other = map.get(normaliseLabel(label));
		if (other) {
			throw new Error(
				`${permission} and ${other} share the label '${label}', so their toggles cannot be told apart.`
			);
		}
		map.set(normaliseLabel(label), permission);
	}
	permissionByLabel = map;
	return map;
};

/**
 * Compare one card against the catalogue and the role's expected states; returns the problems found
 * (empty = the card is exactly right).
 */
const cardProblems = (
	toggles: { label: string; checked: boolean }[],
	variants: readonly (readonly PermissionsEnum[])[],
	enabled: ReadonlySet<PermissionsEnum>
): string[] => {
	const byLabel = getPermissionByLabel();
	const accepted = new Set(variants.flat());
	let problems: string[] = [];
	let rendered: PermissionsEnum[] = [];
	for (const { label, checked } of toggles) {
		const permission = byLabel.get(normaliseLabel(label));
		if (!permission || !accepted.has(permission)) {
			problems.push(`toggle '${label}' is not a permission of this card`);
			continue;
		}
		if (rendered.includes(permission)) {
			problems.push(`${permission} ('${label}') is rendered more than once`);
		}
		rendered.push(permission);
		const expected = enabled.has(permission);
		if (checked !== expected) {
			problems.push(`${permission} ('${label}') is ${checked ? 'checked' : 'unchecked'}, expected ${expected ? 'checked' : 'unchecked'}`);
		}
	}
	// The rendered set must be exactly one of the catalogue variants; report against the closest one.
	const renderedSet = new Set(rendered);
	const diffs = variants.map((variant) => ({
		missing: variant.filter((permission) => !renderedSet.has(permission)),
		extra: rendered.filter((permission) => !variant.includes(permission))
	}));
	if (!diffs.some(({ missing, extra }) => missing.length === 0 && extra.length === 0)) {
		const closest = diffs.reduce((a, b) => (a.missing.length + a.extra.length <= b.missing.length + b.extra.length ? a : b));
		if (closest.missing.length) problems.push(`not rendered: ${closest.missing.join(', ')}`);
		if (closest.extra.length) problems.push(`rendered but not in the catalogue variant: ${closest.extra.join(', ')}`);
	}
	return problems;
};

/**
 * Poll one card until it matches (the freshly selected role's permissions arrive asynchronously and
 * repaint the toggles), then fail with every mismatch named.
 */
const verifyCard = async (
	card: 'general' | 'admin',
	roleEnum: string,
	variants: readonly (readonly PermissionsEnum[])[],
	enabled: ReadonlySet<PermissionsEnum>
) => {
	const deadline = Date.now() + 30_000;
	let problems: string[] = [];
	do {
		problems = cardProblems(await rolesPermissionsPage.readCardToggles(card), variants, enabled);
		if (!problems.length) return;
		await getPage().waitForTimeout(500);
	} while (Date.now() < deadline);
	throw new Error(
		`${roleEnum} ${card === 'general' ? 'GENERAL' : 'ADMINISTRATION'} card: ${problems.length} problem(s):\n  ` +
			problems.slice(0, 60).join('\n  ')
	);
};

const ENABLED_PERMISSIONS: Record<string, readonly PermissionsEnum[]> = {
	SUPER_ADMIN: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TEAM_DASHBOARD,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.ACCOUNTING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_PAYROLL_VIEW,
		PermissionsEnum.ORG_PAYROLL_EDIT,
		PermissionsEnum.ORG_PAYROLL_APPROVE,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.ORG_TASK_SETTING,
		PermissionsEnum.ORG_EMPLOYEES_ADD,
		PermissionsEnum.ORG_EMPLOYEES_VIEW,
		PermissionsEnum.ORG_EMPLOYEES_EDIT,
		PermissionsEnum.ORG_EMPLOYEES_DELETE,
		PermissionsEnum.ORG_CANDIDATES_VIEW,
		PermissionsEnum.ORG_CANDIDATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.ORG_USERS_VIEW,
		PermissionsEnum.ORG_USERS_EDIT,
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_DELETE,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.TIME_OFF_ADD,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.TIME_OFF_EDIT,
		PermissionsEnum.TIME_OFF_DELETE,
		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
		PermissionsEnum.TIMESHEET_EDIT_TIME,
		PermissionsEnum.PUBLIC_PAGE_EDIT,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT,
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.VIEW_ALL_EMAILS,
		PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES,
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
		PermissionsEnum.ORG_CONTRACT_EDIT,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.EVENT_TYPES_EDIT,
		PermissionsEnum.GOALS_EDIT,
		PermissionsEnum.SKILLS_EDIT,
		PermissionsEnum.TENANT_ADD_EXISTING_USER,
		PermissionsEnum.INTEGRATION_ADD,
		PermissionsEnum.INTEGRATION_VIEW,
		PermissionsEnum.INTEGRATION_EDIT,
		PermissionsEnum.INTEGRATION_DELETE,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.AI_CHAT_SETTINGS,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_MANAGE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT,
		PermissionsEnum.IMPORT_ADD,
		PermissionsEnum.EXPORT_ADD,
		PermissionsEnum.FILE_STORAGE_VIEW,
		PermissionsEnum.PAYMENT_GATEWAY_VIEW,
		PermissionsEnum.SMS_GATEWAY_VIEW,
		PermissionsEnum.CUSTOM_SMTP_VIEW,
		PermissionsEnum.CUSTOM_SMTP_EDIT,
		PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW,
		PermissionsEnum.ORG_JOB_MATCHING_VIEW,
		PermissionsEnum.ORG_JOB_SEARCH,
		PermissionsEnum.ORG_JOB_APPLY,
		PermissionsEnum.ORG_JOB_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT,
		PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.TENANT_SETTING,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
		PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW,
		PermissionsEnum.API_CALL_LOG_READ,
		PermissionsEnum.API_CALL_LOG_DELETE,
		PermissionsEnum.TENANT_API_KEY_CREATE,
		PermissionsEnum.TENANT_API_KEY_VIEW,
		PermissionsEnum.TENANT_API_KEY_DELETE,
		PermissionsEnum.OAUTH_CLIENT_VIEW,
		PermissionsEnum.OAUTH_CLIENT_EDIT,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.BROADCAST_CREATE,
		PermissionsEnum.BROADCAST_READ,
		PermissionsEnum.BROADCAST_UPDATE,
		PermissionsEnum.BROADCAST_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.INBOX_VIEW,
		PermissionsEnum.INBOX_MAILBOX_MANAGE,
		PermissionsEnum.INBOX_MAILBOX_READ_ALL,
		PermissionsEnum.CHANNELS_VIEW,
		PermissionsEnum.CHANNELS_CREATE,
		PermissionsEnum.CHANNELS_EDIT,
		PermissionsEnum.CHANNELS_DELETE,
		PermissionsEnum.REGIONS_VIEW,
		PermissionsEnum.REGIONS_CREATE,
		PermissionsEnum.REGIONS_EDIT,
		PermissionsEnum.REGIONS_DELETE,
		PermissionsEnum.RULES_VIEW,
		PermissionsEnum.RULES_EDIT,
		PermissionsEnum.SEQUENCES_VIEW,
		PermissionsEnum.SEQUENCES_EDIT,
		PermissionsEnum.OPERATIONS_VIEW,
		PermissionsEnum.OPERATIONS_CANCEL,
		PermissionsEnum.EVENT_OUTBOX_VIEW,
		PermissionsEnum.EVENT_OUTBOX_RETRY,
		PermissionsEnum.IDEMPOTENCY_KEYS_VIEW,
		PermissionsEnum.IDEMPOTENCY_KEYS_DELETE,
		PermissionsEnum.UNITS_VIEW,
		PermissionsEnum.UNITS_EDIT,
		PermissionsEnum.PAYMENT_TERMS_VIEW,
		PermissionsEnum.PAYMENT_TERMS_EDIT,
		PermissionsEnum.PRODUCTS_VIEW,
		PermissionsEnum.PRODUCTS_EDIT,
		PermissionsEnum.PRODUCTS_DELETE,
		PermissionsEnum.PRODUCTS_BULK_IMPORT,
		PermissionsEnum.COLLECTIONS_VIEW,
		PermissionsEnum.COLLECTIONS_CREATE,
		PermissionsEnum.COLLECTIONS_EDIT,
		PermissionsEnum.COLLECTIONS_DELETE,
		PermissionsEnum.PRICE_LISTS_VIEW,
		PermissionsEnum.PRICE_LISTS_CREATE,
		PermissionsEnum.PRICE_LISTS_EDIT,
		PermissionsEnum.PRICE_LISTS_DELETE,
		PermissionsEnum.PRICE_LISTS_SIMULATE,
		PermissionsEnum.PRODUCT_PRICES_VIEW,
		PermissionsEnum.PRODUCT_PRICES_EDIT,
		PermissionsEnum.PRODUCT_PRICES_BULK_EDIT,
		PermissionsEnum.EXCHANGE_RATES_VIEW,
		PermissionsEnum.EXCHANGE_RATES_EDIT,
		PermissionsEnum.TAX_CATEGORIES_VIEW,
		PermissionsEnum.TAX_CATEGORIES_EDIT,
		PermissionsEnum.TAX_RATES_VIEW,
		PermissionsEnum.TAX_RATES_EDIT,
		PermissionsEnum.TAX_REGIMES_VIEW,
		PermissionsEnum.TAX_REGIMES_EDIT,
		PermissionsEnum.CONTACT_GROUPS_VIEW,
		PermissionsEnum.CONTACT_GROUPS_CREATE,
		PermissionsEnum.CONTACT_GROUPS_EDIT,
		PermissionsEnum.CONTACT_GROUPS_DELETE,
		PermissionsEnum.CONTACT_CREDENTIALS_VIEW,
		PermissionsEnum.CONTACT_CREDENTIALS_MANAGE,
		PermissionsEnum.CONTACT_CREDITS_EDIT,
		PermissionsEnum.CONTACT_TAX_IDENTITY_EDIT,
		PermissionsEnum.STOCK_VIEW,
		PermissionsEnum.STOCK_EDIT,
		PermissionsEnum.STOCK_RECONCILE,
		PermissionsEnum.STOCK_TRANSFER_VIEW,
		PermissionsEnum.STOCK_TRANSFER_CREATE,
		PermissionsEnum.STOCK_TRANSFER_APPROVE,
		PermissionsEnum.STOCK_TRANSFER_SHIP,
		PermissionsEnum.STOCK_TRANSFER_RECEIVE,
		PermissionsEnum.STOCK_TRANSFER_CANCEL,
		PermissionsEnum.WAREHOUSE_ZONES_VIEW,
		PermissionsEnum.WAREHOUSE_ZONES_CREATE,
		PermissionsEnum.WAREHOUSE_ZONES_EDIT,
		PermissionsEnum.WAREHOUSE_ZONES_DELETE,
		PermissionsEnum.WAREHOUSE_BINS_VIEW,
		PermissionsEnum.WAREHOUSE_BINS_CREATE,
		PermissionsEnum.WAREHOUSE_BINS_EDIT,
		PermissionsEnum.WAREHOUSE_BINS_DELETE,
		PermissionsEnum.PICK_LISTS_VIEW,
		PermissionsEnum.PICK_LISTS_EDIT,
		PermissionsEnum.PICK_LISTS_PICK,
		PermissionsEnum.PICK_LISTS_CANCEL,
		PermissionsEnum.FULFILLMENTS_VIEW,
		PermissionsEnum.FULFILLMENTS_CREATE,
		PermissionsEnum.FULFILLMENTS_EDIT,
		PermissionsEnum.SHIPPING_OPTIONS_VIEW,
		PermissionsEnum.SHIPPING_OPTIONS_CREATE,
		PermissionsEnum.SHIPPING_OPTIONS_EDIT,
		PermissionsEnum.SHIPPING_OPTIONS_DELETE,
		PermissionsEnum.RETURNS_VIEW,
		PermissionsEnum.RETURNS_CREATE,
		PermissionsEnum.RETURNS_APPROVE,
		PermissionsEnum.RETURNS_REJECT,
		PermissionsEnum.RETURNS_RECEIVE,
		PermissionsEnum.CLAIMS_VIEW,
		PermissionsEnum.CLAIMS_CREATE,
		PermissionsEnum.CLAIMS_RESOLVE,
		PermissionsEnum.EXCHANGES_VIEW,
		PermissionsEnum.EXCHANGES_CREATE,
		PermissionsEnum.EXCHANGES_RESOLVE,
		PermissionsEnum.ORDERS_VIEW,
		PermissionsEnum.ORDERS_CREATE,
		PermissionsEnum.ORDERS_EDIT,
		PermissionsEnum.ORDERS_CANCEL,
		PermissionsEnum.ORDERS_APPROVE,
		PermissionsEnum.CARTS_VIEW,
		PermissionsEnum.CARTS_EDIT,
		PermissionsEnum.CARTS_DELETE,
		PermissionsEnum.CARTS_CHECKOUT,
		PermissionsEnum.PROMOTIONS_VIEW,
		PermissionsEnum.PROMOTIONS_CREATE,
		PermissionsEnum.PROMOTIONS_EDIT,
		PermissionsEnum.PROMOTIONS_DELETE,
		PermissionsEnum.PROMOTIONS_SIMULATE,
		PermissionsEnum.COUPONS_VIEW,
		PermissionsEnum.COUPONS_CREATE,
		PermissionsEnum.COUPONS_EDIT,
		PermissionsEnum.COUPONS_DELETE,
		PermissionsEnum.GIFT_CARDS_VIEW,
		PermissionsEnum.GIFT_CARDS_ISSUE,
		PermissionsEnum.GIFT_CARDS_EDIT,
		PermissionsEnum.PAYMENT_PROVIDERS_VIEW,
		PermissionsEnum.PAYMENT_PROVIDERS_CREATE,
		PermissionsEnum.PAYMENT_PROVIDERS_EDIT,
		PermissionsEnum.PAYMENT_PROVIDERS_DELETE,
		PermissionsEnum.PAYMENT_SESSIONS_VIEW,
		PermissionsEnum.PAYMENT_SESSIONS_AUTHORIZE,
		PermissionsEnum.PAYMENT_SESSIONS_CAPTURE,
		PermissionsEnum.PAYMENT_SESSIONS_CANCEL,
		PermissionsEnum.REFUNDS_VIEW,
		PermissionsEnum.REFUNDS_CREATE,
		PermissionsEnum.REFUNDS_APPROVE,
		PermissionsEnum.PAYMENT_CALLBACKS_VIEW,
		PermissionsEnum.PAYMENT_CALLBACKS_REPROCESS,
		PermissionsEnum.PAYMENT_ACCOUNT_HOLDERS_VIEW,
		PermissionsEnum.PAYMENT_ACCOUNT_HOLDERS_EDIT,
		PermissionsEnum.PAYMENT_METHOD_TOKENS_VIEW,
		PermissionsEnum.PAYMENT_METHOD_TOKENS_EDIT,
		PermissionsEnum.PAYMENT_METHOD_TOKENS_CHARGE,
		PermissionsEnum.SUBSCRIPTIONS_VIEW,
		PermissionsEnum.SUBSCRIPTIONS_CREATE,
		PermissionsEnum.SUBSCRIPTIONS_EDIT,
		PermissionsEnum.SUBSCRIPTIONS_BILL,
		PermissionsEnum.PURCHASE_ORDERS_VIEW,
		PermissionsEnum.PURCHASE_ORDERS_CREATE,
		PermissionsEnum.PURCHASE_ORDERS_EDIT,
		PermissionsEnum.PURCHASE_ORDERS_APPROVE,
		PermissionsEnum.PURCHASE_ORDERS_SEND,
		PermissionsEnum.GOODS_RECEIPTS_VIEW,
		PermissionsEnum.GOODS_RECEIPTS_CREATE,
		PermissionsEnum.VENDOR_TERMS_VIEW,
		PermissionsEnum.VENDOR_TERMS_EDIT,
		PermissionsEnum.ENTITLEMENTS_VIEW,
		PermissionsEnum.ENTITLEMENTS_GRANT,
		PermissionsEnum.ENTITLEMENTS_EDIT,
		PermissionsEnum.SELLERS_VIEW,
		PermissionsEnum.SELLERS_CREATE,
		PermissionsEnum.SELLERS_EDIT,
		PermissionsEnum.SELLERS_DELETE,
		PermissionsEnum.SELLER_PAYOUTS_VIEW,
		PermissionsEnum.SELLER_PAYOUTS_CREATE,
		PermissionsEnum.SELLER_PAYOUTS_APPROVE,
		PermissionsEnum.SELLER_PAYOUTS_CANCEL,
		PermissionsEnum.SEARCH_VIEW,
		PermissionsEnum.SEARCH_REINDEX,
		PermissionsEnum.WEBHOOKS_VIEW,
		PermissionsEnum.WEBHOOKS_CREATE,
		PermissionsEnum.WEBHOOKS_EDIT,
		PermissionsEnum.WEBHOOKS_DELETE,
		PermissionsEnum.WEBHOOK_DELIVERIES_RETRY,
		PermissionsEnum.SELLER_OFFERINGS_VIEW,
		PermissionsEnum.SELLER_OFFERINGS_EDIT,
		PermissionsEnum.SELLER_COMMISSIONS_VIEW,
		PermissionsEnum.SELLER_COMMISSIONS_EDIT,
		PermissionsEnum.SELLER_TRANSACTIONS_VIEW,
		PermissionsEnum.SELLER_TRANSACTIONS_SETTLE,
		PermissionsEnum.SELLER_SETTLEMENTS_VIEW,
		PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		PermissionsEnum.SEARCH_INDEX_DEFINITIONS_VIEW,
		PermissionsEnum.SEARCH_INDEX_DEFINITIONS_EDIT,
		PermissionsEnum.PROVIDERS_VIEW
	],
	ADMIN: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TEAM_DASHBOARD,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.ACCOUNTING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_PAYROLL_VIEW,
		PermissionsEnum.ORG_PAYROLL_EDIT,
		PermissionsEnum.ORG_PAYROLL_APPROVE,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.ORG_TASK_SETTING,
		PermissionsEnum.ORG_EMPLOYEES_ADD,
		PermissionsEnum.ORG_EMPLOYEES_VIEW,
		PermissionsEnum.ORG_EMPLOYEES_EDIT,
		PermissionsEnum.ORG_EMPLOYEES_DELETE,
		PermissionsEnum.ORG_CANDIDATES_VIEW,
		PermissionsEnum.ORG_CANDIDATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.ORG_USERS_VIEW,
		PermissionsEnum.ORG_USERS_EDIT,
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_DELETE,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.TIME_OFF_ADD,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.TIME_OFF_EDIT,
		PermissionsEnum.TIME_OFF_DELETE,
		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
		PermissionsEnum.TIMESHEET_EDIT_TIME,
		PermissionsEnum.PUBLIC_PAGE_EDIT,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT,
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.VIEW_ALL_EMAILS,
		PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES,
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
		PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK,
		PermissionsEnum.ORG_TEAM_DELETE,
		PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW,
		PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT,
		PermissionsEnum.ORG_CONTRACT_EDIT,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.EVENT_TYPES_EDIT,
		PermissionsEnum.GOALS_EDIT,
		PermissionsEnum.SKILLS_EDIT,
		PermissionsEnum.TENANT_ADD_EXISTING_USER,
		PermissionsEnum.INTEGRATION_ADD,
		PermissionsEnum.INTEGRATION_VIEW,
		PermissionsEnum.INTEGRATION_EDIT,
		PermissionsEnum.INTEGRATION_DELETE,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.AI_CHAT_SETTINGS,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_MANAGE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT,
		PermissionsEnum.IMPORT_ADD,
		PermissionsEnum.EXPORT_ADD,
		PermissionsEnum.FILE_STORAGE_VIEW,
		PermissionsEnum.PAYMENT_GATEWAY_VIEW,
		PermissionsEnum.SMS_GATEWAY_VIEW,
		PermissionsEnum.CUSTOM_SMTP_VIEW,
		PermissionsEnum.CUSTOM_SMTP_EDIT,
		PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW,
		PermissionsEnum.ORG_JOB_MATCHING_VIEW,
		PermissionsEnum.ORG_JOB_SEARCH,
		PermissionsEnum.ORG_JOB_APPLY,
		PermissionsEnum.ORG_JOB_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_EDIT,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT,
		PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.TENANT_SETTING,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
		PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW,
		PermissionsEnum.API_CALL_LOG_READ,
		PermissionsEnum.API_CALL_LOG_DELETE,
		PermissionsEnum.TENANT_API_KEY_CREATE,
		PermissionsEnum.TENANT_API_KEY_VIEW,
		PermissionsEnum.TENANT_API_KEY_DELETE,
		PermissionsEnum.OAUTH_CLIENT_VIEW,
		PermissionsEnum.OAUTH_CLIENT_EDIT,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.BROADCAST_CREATE,
		PermissionsEnum.BROADCAST_READ,
		PermissionsEnum.BROADCAST_UPDATE,
		PermissionsEnum.BROADCAST_DELETE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.INBOX_VIEW,
		PermissionsEnum.INBOX_MAILBOX_MANAGE,
		PermissionsEnum.INBOX_MAILBOX_READ_ALL,
		PermissionsEnum.CHANNELS_VIEW,
		PermissionsEnum.REGIONS_VIEW,
		PermissionsEnum.RULES_VIEW,
		PermissionsEnum.SEQUENCES_VIEW,
		PermissionsEnum.OPERATIONS_VIEW,
		PermissionsEnum.EVENT_OUTBOX_VIEW,
		PermissionsEnum.IDEMPOTENCY_KEYS_VIEW,
		PermissionsEnum.UNITS_VIEW,
		PermissionsEnum.PAYMENT_TERMS_VIEW,
		PermissionsEnum.PRODUCTS_VIEW,
		PermissionsEnum.PRODUCTS_EDIT,
		PermissionsEnum.PRODUCTS_DELETE,
		PermissionsEnum.COLLECTIONS_VIEW,
		PermissionsEnum.COLLECTIONS_CREATE,
		PermissionsEnum.COLLECTIONS_EDIT,
		PermissionsEnum.COLLECTIONS_DELETE,
		PermissionsEnum.PRICE_LISTS_VIEW,
		PermissionsEnum.PRICE_LISTS_CREATE,
		PermissionsEnum.PRICE_LISTS_EDIT,
		PermissionsEnum.PRICE_LISTS_DELETE,
		PermissionsEnum.PRICE_LISTS_SIMULATE,
		PermissionsEnum.PRODUCT_PRICES_VIEW,
		PermissionsEnum.PRODUCT_PRICES_EDIT,
		PermissionsEnum.EXCHANGE_RATES_VIEW,
		PermissionsEnum.TAX_CATEGORIES_VIEW,
		PermissionsEnum.TAX_CATEGORIES_EDIT,
		PermissionsEnum.TAX_RATES_VIEW,
		PermissionsEnum.TAX_RATES_EDIT,
		PermissionsEnum.TAX_REGIMES_VIEW,
		PermissionsEnum.CONTACT_GROUPS_VIEW,
		PermissionsEnum.CONTACT_GROUPS_CREATE,
		PermissionsEnum.CONTACT_GROUPS_EDIT,
		PermissionsEnum.CONTACT_GROUPS_DELETE,
		PermissionsEnum.CONTACT_CREDENTIALS_VIEW,
		PermissionsEnum.STOCK_VIEW,
		PermissionsEnum.STOCK_EDIT,
		PermissionsEnum.STOCK_TRANSFER_VIEW,
		PermissionsEnum.STOCK_TRANSFER_CREATE,
		PermissionsEnum.STOCK_TRANSFER_APPROVE,
		PermissionsEnum.STOCK_TRANSFER_SHIP,
		PermissionsEnum.STOCK_TRANSFER_RECEIVE,
		PermissionsEnum.STOCK_TRANSFER_CANCEL,
		PermissionsEnum.WAREHOUSE_ZONES_VIEW,
		PermissionsEnum.WAREHOUSE_ZONES_CREATE,
		PermissionsEnum.WAREHOUSE_ZONES_EDIT,
		PermissionsEnum.WAREHOUSE_ZONES_DELETE,
		PermissionsEnum.WAREHOUSE_BINS_VIEW,
		PermissionsEnum.WAREHOUSE_BINS_CREATE,
		PermissionsEnum.WAREHOUSE_BINS_EDIT,
		PermissionsEnum.WAREHOUSE_BINS_DELETE,
		PermissionsEnum.PICK_LISTS_VIEW,
		PermissionsEnum.PICK_LISTS_EDIT,
		PermissionsEnum.PICK_LISTS_PICK,
		PermissionsEnum.PICK_LISTS_CANCEL,
		PermissionsEnum.FULFILLMENTS_VIEW,
		PermissionsEnum.FULFILLMENTS_CREATE,
		PermissionsEnum.FULFILLMENTS_EDIT,
		PermissionsEnum.SHIPPING_OPTIONS_VIEW,
		PermissionsEnum.SHIPPING_OPTIONS_CREATE,
		PermissionsEnum.SHIPPING_OPTIONS_EDIT,
		PermissionsEnum.SHIPPING_OPTIONS_DELETE,
		PermissionsEnum.RETURNS_VIEW,
		PermissionsEnum.RETURNS_CREATE,
		PermissionsEnum.RETURNS_APPROVE,
		PermissionsEnum.RETURNS_REJECT,
		PermissionsEnum.RETURNS_RECEIVE,
		PermissionsEnum.CLAIMS_VIEW,
		PermissionsEnum.CLAIMS_CREATE,
		PermissionsEnum.CLAIMS_RESOLVE,
		PermissionsEnum.EXCHANGES_VIEW,
		PermissionsEnum.EXCHANGES_CREATE,
		PermissionsEnum.EXCHANGES_RESOLVE,
		PermissionsEnum.ORDERS_VIEW,
		PermissionsEnum.ORDERS_CREATE,
		PermissionsEnum.ORDERS_EDIT,
		PermissionsEnum.ORDERS_CANCEL,
		PermissionsEnum.ORDERS_APPROVE,
		PermissionsEnum.CARTS_VIEW,
		PermissionsEnum.CARTS_EDIT,
		PermissionsEnum.CARTS_DELETE,
		PermissionsEnum.CARTS_CHECKOUT,
		PermissionsEnum.PROMOTIONS_VIEW,
		PermissionsEnum.PROMOTIONS_CREATE,
		PermissionsEnum.PROMOTIONS_EDIT,
		PermissionsEnum.PROMOTIONS_DELETE,
		PermissionsEnum.PROMOTIONS_SIMULATE,
		PermissionsEnum.COUPONS_VIEW,
		PermissionsEnum.COUPONS_CREATE,
		PermissionsEnum.COUPONS_EDIT,
		PermissionsEnum.COUPONS_DELETE,
		PermissionsEnum.GIFT_CARDS_VIEW,
		PermissionsEnum.GIFT_CARDS_ISSUE,
		PermissionsEnum.GIFT_CARDS_EDIT,
		PermissionsEnum.PAYMENT_PROVIDERS_VIEW,
		PermissionsEnum.PAYMENT_SESSIONS_VIEW,
		PermissionsEnum.PAYMENT_SESSIONS_AUTHORIZE,
		PermissionsEnum.PAYMENT_SESSIONS_CANCEL,
		PermissionsEnum.REFUNDS_VIEW,
		PermissionsEnum.REFUNDS_CREATE,
		PermissionsEnum.PAYMENT_CALLBACKS_VIEW,
		PermissionsEnum.PAYMENT_CALLBACKS_REPROCESS,
		PermissionsEnum.PAYMENT_ACCOUNT_HOLDERS_VIEW,
		PermissionsEnum.PAYMENT_METHOD_TOKENS_VIEW,
		PermissionsEnum.PAYMENT_METHOD_TOKENS_EDIT,
		PermissionsEnum.SUBSCRIPTIONS_VIEW,
		PermissionsEnum.SUBSCRIPTIONS_CREATE,
		PermissionsEnum.SUBSCRIPTIONS_EDIT,
		PermissionsEnum.SUBSCRIPTIONS_BILL,
		PermissionsEnum.PURCHASE_ORDERS_VIEW,
		PermissionsEnum.PURCHASE_ORDERS_CREATE,
		PermissionsEnum.PURCHASE_ORDERS_EDIT,
		PermissionsEnum.PURCHASE_ORDERS_APPROVE,
		PermissionsEnum.PURCHASE_ORDERS_SEND,
		PermissionsEnum.GOODS_RECEIPTS_VIEW,
		PermissionsEnum.GOODS_RECEIPTS_CREATE,
		PermissionsEnum.VENDOR_TERMS_VIEW,
		PermissionsEnum.VENDOR_TERMS_EDIT,
		PermissionsEnum.ENTITLEMENTS_VIEW,
		PermissionsEnum.ENTITLEMENTS_GRANT,
		PermissionsEnum.ENTITLEMENTS_EDIT,
		PermissionsEnum.SELLERS_VIEW,
		PermissionsEnum.SELLERS_CREATE,
		PermissionsEnum.SELLERS_EDIT,
		PermissionsEnum.SELLERS_DELETE,
		PermissionsEnum.SELLER_PAYOUTS_VIEW,
		PermissionsEnum.SELLER_PAYOUTS_CREATE,
		PermissionsEnum.SELLER_PAYOUTS_CANCEL,
		PermissionsEnum.SEARCH_VIEW,
		PermissionsEnum.WEBHOOKS_VIEW,
		PermissionsEnum.WEBHOOKS_CREATE,
		PermissionsEnum.WEBHOOKS_EDIT,
		PermissionsEnum.WEBHOOK_DELIVERIES_RETRY,
		PermissionsEnum.SELLER_OFFERINGS_VIEW,
		PermissionsEnum.SELLER_OFFERINGS_EDIT,
		PermissionsEnum.SELLER_COMMISSIONS_VIEW,
		PermissionsEnum.SELLER_COMMISSIONS_EDIT,
		PermissionsEnum.SELLER_TRANSACTIONS_VIEW,
		PermissionsEnum.SELLER_TRANSACTIONS_SETTLE,
		PermissionsEnum.SELLER_SETTLEMENTS_VIEW,
		PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		PermissionsEnum.SEARCH_INDEX_DEFINITIONS_VIEW,
		PermissionsEnum.SEARCH_INDEX_DEFINITIONS_EDIT,
		PermissionsEnum.PROVIDERS_VIEW,
		/** Declared by the inventory plugin with defaultFor ADMIN (granted by role-permission.seed.ts) */
		PermissionsEnum.STOCK_RECONCILE,
		/** Declared by the search plugin with defaultFor ADMIN (granted by role-permission.seed.ts) */
		PermissionsEnum.SEARCH_REINDEX
	],
	DATA_ENTRY: [
		PermissionsEnum.ORG_PAYMENT_VIEW,
		PermissionsEnum.ORG_PAYMENT_ADD_EDIT,
		PermissionsEnum.ORG_EXPENSES_EDIT,
		PermissionsEnum.ORG_EXPENSES_VIEW,
		PermissionsEnum.ORG_INCOMES_EDIT,
		PermissionsEnum.ORG_INCOMES_VIEW,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_TASK_DELETE,
		PermissionsEnum.PROJECT_MODULE_CREATE,
		PermissionsEnum.PROJECT_MODULE_READ,
		PermissionsEnum.PROJECT_MODULE_UPDATE,
		PermissionsEnum.PROJECT_MODULE_DELETE,
		PermissionsEnum.DASHBOARD_CREATE,
		PermissionsEnum.DASHBOARD_READ,
		PermissionsEnum.DASHBOARD_UPDATE,
		PermissionsEnum.DASHBOARD_DELETE,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT,
		PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW,
		PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
		PermissionsEnum.ORG_HELP_CENTER_EDIT,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
	],
	EMPLOYEE: [
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD,
		PermissionsEnum.TIME_TRACKING_DASHBOARD,
		PermissionsEnum.HUMAN_RESOURCE_DASHBOARD,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.ORG_PROPOSALS_VIEW,
		PermissionsEnum.ORG_PROPOSALS_EDIT,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW,
		PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT,
		PermissionsEnum.SELECT_EMPLOYEE,
		PermissionsEnum.AI_CHAT_ACCESS,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		PermissionsEnum.TIME_OFF_VIEW,
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT,
		PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW,
		PermissionsEnum.APPROVAL_POLICY_EDIT,
		PermissionsEnum.APPROVAL_POLICY_VIEW,
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.REQUEST_APPROVAL_VIEW,
		PermissionsEnum.ORG_TASK_ADD,
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
		PermissionsEnum.EVENT_TYPES_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ESTIMATES_VIEW,
		PermissionsEnum.ESTIMATES_EDIT,
		PermissionsEnum.ORG_CONTACT_VIEW,
		PermissionsEnum.ORG_PROJECT_ADD,
		PermissionsEnum.ORG_PROJECT_VIEW,
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
		PermissionsEnum.ORG_TAGS_ADD,
		PermissionsEnum.ORG_TAGS_VIEW,
		PermissionsEnum.ORG_TAGS_EDIT,
		PermissionsEnum.ORG_TAGS_DELETE,
		PermissionsEnum.ORG_TAG_TYPES_ADD,
		PermissionsEnum.ORG_TAG_TYPES_VIEW,
		PermissionsEnum.ORG_TAG_TYPES_EDIT,
		PermissionsEnum.ORG_TAG_TYPES_DELETE,
		PermissionsEnum.EMPLOYEE_EXPENSES_VIEW,
		PermissionsEnum.EMPLOYEE_EXPENSES_EDIT,
		PermissionsEnum.INVENTORY_GALLERY_VIEW,
		PermissionsEnum.INVENTORY_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_ADD,
		PermissionsEnum.MEDIA_GALLERY_VIEW,
		PermissionsEnum.MEDIA_GALLERY_EDIT,
		PermissionsEnum.MEDIA_GALLERY_DELETE,
		PermissionsEnum.ORG_INVENTORY_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_VIEW,
		PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW,
		PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
		PermissionsEnum.ORG_PRODUCT_TYPES_VIEW,
		PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW,
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ALLOW_DELETE_TIME,
		PermissionsEnum.ALLOW_MODIFY_TIME,
		PermissionsEnum.ALLOW_MANUAL_TIME,
		PermissionsEnum.DELETE_SCREENSHOTS,
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
		PermissionsEnum.INBOX_VIEW,
		/** Declared by the inventory plugin with defaultFor EMPLOYEE (granted by role-permission.seed.ts) */
		PermissionsEnum.STOCK_VIEW,
		/** Declared by the search plugin with defaultFor EMPLOYEE (granted by role-permission.seed.ts) */
		PermissionsEnum.SEARCH_VIEW
	],
	CANDIDATE: [
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
	],
	MANAGER: [
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.GOALS_EDIT,
		PermissionsEnum.SKILLS_EDIT,
		PermissionsEnum.EVENT_TYPES_EDIT,
		PermissionsEnum.ORG_TASK_SETTING,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
		PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.INBOX_VIEW,
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE,
		PermissionsEnum.DOCS_DELETE,
		PermissionsEnum.DOCS_REVIEW,
		PermissionsEnum.DOCS_AI_IMPORT,
		/** Declared by the inventory plugin with defaultFor MANAGER (granted by role-permission.seed.ts) */
		PermissionsEnum.STOCK_VIEW,
		PermissionsEnum.STOCK_EDIT,
		PermissionsEnum.STOCK_TRANSFER_VIEW,
		PermissionsEnum.STOCK_TRANSFER_CREATE,
		PermissionsEnum.STOCK_TRANSFER_APPROVE,
		PermissionsEnum.STOCK_TRANSFER_SHIP,
		PermissionsEnum.STOCK_TRANSFER_RECEIVE,
		PermissionsEnum.STOCK_TRANSFER_CANCEL
	],
	VIEWER: [
		PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
		PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
		PermissionsEnum.DOCS_READ
	]
};

const verifyRoleState = async (roleEnum: string) => {
	await rolesPermissionsPage.waitForPermissionsLoaded();
	const enabled = new Set<PermissionsEnum>(ENABLED_PERMISSIONS[roleEnum]);
	await verifyCard('general', roleEnum, [GENERAL_PERMISSIONS], enabled);
	await verifyCard('admin', roleEnum, [ADMINISTRATION_PERMISSIONS, ADMINISTRATION_PERMISSIONS_DEMO], enabled);
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

// Verify a representative set of permission labels render. The labels follow
// ORGANIZATIONS_PAGE.PERMISSIONS in en.json; the ones the app renamed (e.g. "Create/Edit Sprints" ->
// "Edit sprint") are updated in RolesPermissionsPageData and asserted again. Only "Edit Super Admin
// Users" (SUPER_ADMIN_EDIT) and "View Import/Export" (IMPORT_EXPORT_VIEW) are not asserted: neither
// permission is in PermissionGroups, so this screen has no toggle for them.
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
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewTimeOffPage);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationInvites);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createResendDeleteInvites);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewTimeOffPolicy);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editTimeOffPolicy);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editTimeOff);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editApprovalsPolicy);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewApprovalsPolicy);
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
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteTags);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllEmails);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewAllEmailsTemplates);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editOrganizationHelpCenter);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewSalesPipelines);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.editSalesPipelines);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.approveTimesheet);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditSprints);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewSprints);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditProjects);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditContacts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewContacts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditTeams);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditContracts);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewEventTypes);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.viewOrganizationEmployees);
	await rolesPermissionsPage.verifyTextExist(RolesPermissionsPageData.createEditDeleteOrganizationEmployees);
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
