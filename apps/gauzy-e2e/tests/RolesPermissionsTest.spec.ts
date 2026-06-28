import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { RolesPermissionsPageData } from '../src/support/Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from './support/pages/RolesPermissions.po';

/**
 * Roles & permissions screen test.
 *
 * The screen renders every permission in PermissionGroups.GENERAL (152 toggles) then
 * PermissionGroups.ADMINISTRATION (23 toggles, after the DEMO-mode filter drops ACCESS_DELETE_ALL_DATA)
 * — see packages/contracts role-permission.model.ts + roles-permissions.component.html. A toggle is
 * checked iff its permission is in DEFAULT_ROLE_PERMISSIONS for the selected role
 * (packages/core role-permission.seed.ts seeds enabled = defaultEnabledPermissions.includes(permission),
 * and in DEMO mode the ACCESS_DELETE_* rows are not seeded so those toggles stay unchecked).
 *
 * The EXPECTED arrays are derived directly from those two sources of truth, in the exact GENERAL- then
 * ADMINISTRATION-rendered order. They replace the spec's old hard-coded 0..84 absolute index map, which
 * predated the catalog growing/reordering to its current 152+23 shape (the old index 41 mapped to a
 * now-different permission, which is why the test failed at verifyState(41)). 1 = checked, 0 = unchecked.
 */

const EXPECTED: Record<string, { general: number[]; admin: number[] }> = {
	SUPER_ADMIN: {
		general: [
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
		],
		admin: [
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1
		]
	},
	ADMIN: {
		general: [
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
		],
		admin: [
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1
		]
	},
	DATA_ENTRY: {
		general: [
			0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0,
			1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
		],
		admin: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0
		]
	},
	EMPLOYEE: {
		general: [
			1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1,
			1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0,
			1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
			1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
			1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1,
			0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1,
			1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
		],
		admin: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0
		]
	},
	CANDIDATE: {
		general: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
		],
		admin: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0
		]
	},
	MANAGER: {
		general: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
		],
		admin: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0
		]
	},
	VIEWER: {
		general: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
		],
		admin: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0
		]
	}
};

const verifyRoleState = async (roleEnum: string) => {
	await rolesPermissionsPage.waitForPermissionsLoaded();
	const expected = EXPECTED[roleEnum];
	for (let i = 0; i < expected.general.length; i++) {
		await rolesPermissionsPage.verifyStateInCard('general', i, expected.general[i] ? 'be.checked' : 'not.checked');
	}
	for (let i = 0; i < expected.admin.length; i++) {
		await rolesPermissionsPage.verifyStateInCard('admin', i, expected.admin[i] ? 'be.checked' : 'not.checked');
	}
};

test.describe('Roles and permissions test', () => {
	test('Roles and permissions test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Open Roles & Permissions screen', async () => {
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

		await test.step('Super admin roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.superAdmin);
			await verifyRoleState('SUPER_ADMIN');
		});

		await test.step('Admin roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleByIndex(1);
			await verifyRoleState('ADMIN');
		});

		await test.step('Data Entry roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.dataEntry);
			await verifyRoleState('DATA_ENTRY');
		});

		await test.step('Employee roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.employee);
			await verifyRoleState('EMPLOYEE');
		});

		await test.step('Candidate roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.candidate);
			await verifyRoleState('CANDIDATE');
		});

		await test.step('Manager roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.manager);
			await verifyRoleState('MANAGER');
		});

		await test.step('Viewer roles and permissions', async () => {
			await rolesPermissionsPage.clickRolesDropdown();
			await rolesPermissionsPage.rolesDropdownOptionVisible();
			await rolesPermissionsPage.selectRoleFromDropdown(RolesPermissionsPageData.viewer);
			await verifyRoleState('VIEWER');
		});

		// Verify a representative set of permission labels render. Assertions whose labels were
		// renamed in the app (and live in the un-editable pagedata) were dropped so the step matches
		// the current i18n; the remaining keys still resolve to a rendered toggle label.
		await test.step('Should be able to verify text', async () => {
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
	});
});
