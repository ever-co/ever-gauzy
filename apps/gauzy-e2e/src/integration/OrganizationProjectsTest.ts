import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Organization projects test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add new project', () => {
		cy.visit('/#/pages/organization/projects');
		organizationProjectsPage.gridBtnExists();
		organizationProjectsPage.gridBtnClick(1);
		organizationProjectsPage.requestProjectButtonVisible();
		organizationProjectsPage.clickRequestProjectButton();
		organizationProjectsPage.nameInputVisible();
		organizationProjectsPage.enterNameInputData(OrganizationProjectsPageData.name);
		organizationProjectsPage.selectEmployeeDropdownVisible();
		organizationProjectsPage.clickSelectEmployeeDropdown();
		organizationProjectsPage.selectEmployeeDropdownOption(0);
		organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
		organizationProjectsPage.clickTabButton(1);
		organizationProjectsPage.tagsMultiSelectVisible();
		organizationProjectsPage.clickTagsMultiSelect();
		organizationProjectsPage.selectTagsFromDropdown(0);
		organizationProjectsPage.clickCardBody();
		organizationProjectsPage.clickTabButton(3);
		organizationProjectsPage.budgetHoursInputVisible();
		organizationProjectsPage.enterBudgetHoursInputData(OrganizationProjectsPageData.hours);
		organizationProjectsPage.clickTabButton(5);
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(OrganizationProjectsPageData.color);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
		organizationProjectsPage.waitMessageToHide();
		organizationProjectsPage.verifyProjectExists(OrganizationProjectsPageData.name);
	});
	it('Should be able to edit project', () => {
		organizationProjectsPage.tableRowVisible();
		organizationProjectsPage.selectTableRow(0);
		organizationProjectsPage.editButtonVisible();
		organizationProjectsPage.clickEditButton();
		organizationProjectsPage.nameInputVisible();
		organizationProjectsPage.enterNameInputData(OrganizationProjectsPageData.editName);
		organizationProjectsPage.clickTabButton(3);
		organizationProjectsPage.budgetHoursInputVisible();
		organizationProjectsPage.enterBudgetHoursInputData(OrganizationProjectsPageData.hours);
		organizationProjectsPage.clickTabButton(5);
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(OrganizationProjectsPageData.color);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
	});
	it('Should be able to delete project', () => {
		organizationProjectsPage.waitMessageToHide();
		organizationProjectsPage.selectTableRow(0);
		organizationProjectsPage.deleteButtonVisible();
		organizationProjectsPage.clickDeleteButton();
		organizationProjectsPage.confirmDeleteButtonVisible();
		organizationProjectsPage.clickConfirmDeleteButton();
		organizationProjectsPage.waitMessageToHide();
		organizationProjectsPage.verifyProjectIsDeleted(OrganizationProjectsPageData.editName);
	});
});
