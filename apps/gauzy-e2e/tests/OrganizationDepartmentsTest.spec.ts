import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationDepartmentsPage from './support/pages/OrganizationDepartments.po';
import { OrganizationDepartmentsPageData } from '../src/support/Base/pagedata/OrganizationDepartmentsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

// The suite shares one DB, so prior runs leave duplicate departments behind. Use a unique
// name per run so add/edit/delete target exactly the department this run created and the
// delete verification is unambiguous.
let departmentName = ' ';

test.describe('Organization departments test', () => {
	test('Organization departments test', async () => {
		departmentName = `${OrganizationDepartmentsPageData.departmentName} ${Date.now()}`;

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new department', async () => {
			// The shared organization (42 seeded employees) already provides selectable
			// employees for the department form, so we no longer create an employee/project
			// here: the current "Add Employee" quick-add escalates to a multi-step wizard
			// that leaves a modal backdrop open and blocks the following steps. We only need
			// a tag for the department's Tags field.
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/organization/departments');
			await organizationDepartmentsPage.gridBtnExists();
			await organizationDepartmentsPage.gridBtnClick(1);
			await organizationDepartmentsPage.addDepartmentButtonVisible();
			await organizationDepartmentsPage.clickAddDepartmentButton();
			await organizationDepartmentsPage.nameInputVisible();
			await organizationDepartmentsPage.enterNameInputData(departmentName);
			await organizationDepartmentsPage.selectEmployeeDropdownVisible();
			await organizationDepartmentsPage.clickEmployeeDropdown();
			await organizationDepartmentsPage.selectEmployeeFromDropdown(0);
			await organizationDepartmentsPage.clickKeyboardButtonByKeyCode(9);
			await organizationDepartmentsPage.tagsDropdownVisible();
			await organizationDepartmentsPage.clickTagsDropdown();
			await organizationDepartmentsPage.selectTagFromDropdown(0);
			await organizationDepartmentsPage.clickCardBody();
			await organizationDepartmentsPage.saveDepartmentButtonVisible();
			await organizationDepartmentsPage.clickSaveDepartmentButton();
			await organizationDepartmentsPage.verifyDepartmentExists(departmentName);
		});

		await test.step('Should be able to edit department', async () => {
			await organizationDepartmentsPage.tableRowVisible();
			await organizationDepartmentsPage.selectRowByText(departmentName);
			await organizationDepartmentsPage.editButtonVisible();
			await organizationDepartmentsPage.clickEditButton();
			await organizationDepartmentsPage.nameInputVisible();
			await organizationDepartmentsPage.enterNameInputData(departmentName);
			await organizationDepartmentsPage.saveDepartmentButtonVisible();
			await organizationDepartmentsPage.clickSaveDepartmentButton();
		});

		await test.step('Should be able to delete department', async () => {
			await organizationDepartmentsPage.selectRowByText(departmentName);
			await organizationDepartmentsPage.deleteButtonVisible();
			await organizationDepartmentsPage.clickDeleteButton();
			await organizationDepartmentsPage.confirmDeleteButtonVisible();
			await organizationDepartmentsPage.clickConfirmDeleteButton();
			await organizationDepartmentsPage.verifyDepartmentIsDeleted(departmentName);
		});
	});
});
