import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationDepartmentsPage from '../../support/pages/OrganizationDepartments.po';
import { OrganizationDepartmentsPageData } from '../../../src/support/Base/pagedata/OrganizationDepartmentsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain OrganizationDepartmentsTest.spec.ts: the single test() -> one Scenario,
// each test.step() -> one When step whose body is the verbatim .po call sequence (verification folded
// in), so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as
// the default user` Background step is defined once in common.steps.ts.

// The suite shares one DB, so prior runs leave duplicate departments behind. Use a unique
// name per run so add/edit/delete target exactly the department this run created and the
// delete verification is unambiguous.
let departmentName = ' ';

When('I add a new department', async () => {
	departmentName = `${OrganizationDepartmentsPageData.departmentName} ${Date.now()}`;

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

When('I edit the department', async () => {
	await organizationDepartmentsPage.tableRowVisible();
	await organizationDepartmentsPage.selectRowByText(departmentName);
	await organizationDepartmentsPage.editButtonVisible();
	await organizationDepartmentsPage.clickEditButton();
	await organizationDepartmentsPage.nameInputVisible();
	await organizationDepartmentsPage.enterNameInputData(departmentName);
	await organizationDepartmentsPage.saveDepartmentButtonVisible();
	await organizationDepartmentsPage.clickSaveDepartmentButton();
});

When('I delete the department', async () => {
	await organizationDepartmentsPage.selectRowByText(departmentName);
	await organizationDepartmentsPage.deleteButtonVisible();
	await organizationDepartmentsPage.clickDeleteButton();
	await organizationDepartmentsPage.confirmDeleteButtonVisible();
	await organizationDepartmentsPage.clickConfirmDeleteButton();
	await organizationDepartmentsPage.verifyDepartmentIsDeleted(departmentName);
});
