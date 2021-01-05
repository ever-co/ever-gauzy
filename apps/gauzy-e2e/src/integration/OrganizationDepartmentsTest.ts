import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationDepartmentsPage from '../support/Base/pages/OrganizationDepartments.po';
import { OrganizationDepartmentsPageData } from '../support/Base/pagedata/OrganizationDepartmentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Organization departments test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new department', () => {
		cy.visit('/#/pages/organization/departments');
		organizationDepartmentsPage.gridBtnExists();
		organizationDepartmentsPage.gridBtnClick(1);
		organizationDepartmentsPage.addDepaartmentButtonVisible();
		organizationDepartmentsPage.clickAddDepartmentButton();
		organizationDepartmentsPage.nameInputVisible();
		organizationDepartmentsPage.enterNameInputData(
			OrganizationDepartmentsPageData.departmentName
		);
		organizationDepartmentsPage.selectEmployeeDropdownVisible();
		organizationDepartmentsPage.clickEmployeeDropdown();
		organizationDepartmentsPage.selectEmployeeFromDrodpwon(0);
		organizationDepartmentsPage.clickKeyboardButtonByKeyCode(9);
		organizationDepartmentsPage.tagsDropdownVisible();
		organizationDepartmentsPage.clickTagsDropdwon();
		organizationDepartmentsPage.selectTagFromDropdown(0);
		organizationDepartmentsPage.clickCardBody();
		organizationDepartmentsPage.saveDepartmentButtonVisible();
		organizationDepartmentsPage.clickSaveDepartmentButton();
		organizationDepartmentsPage.verifyDepartmentExists(
			OrganizationDepartmentsPageData.departmentName
		);
	});
	it('Should be able to edit department', () => {
		organizationDepartmentsPage.tableRowVisible();
		organizationDepartmentsPage.selectTableRow(0);
		organizationDepartmentsPage.editButtonVisible();
		organizationDepartmentsPage.clickEditButton();
		organizationDepartmentsPage.nameInputVisible();
		organizationDepartmentsPage.enterNameInputData(
			OrganizationDepartmentsPageData.departmentName
		);
		organizationDepartmentsPage.saveDepartmentButtonVisible();
		organizationDepartmentsPage.clickSaveDepartmentButton();
	});
	it('Should be able to delete department', () => {
		organizationDepartmentsPage.selectTableRow(0);
		organizationDepartmentsPage.deleteButtonVisible();
		organizationDepartmentsPage.clickDeleteButton();
		organizationDepartmentsPage.confirmDeleteButtonVisible();
		organizationDepartmentsPage.clickConfirmDeleteButton();
		organizationDepartmentsPage.verifyDepartmentIsDeleted(
			OrganizationDepartmentsPageData.departmentName
		);
	});
});
