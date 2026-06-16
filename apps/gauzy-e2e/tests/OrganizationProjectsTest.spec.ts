import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Organization projects test', () => {
	test('Organization projects test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new project', async () => {
			await getPage().goto('/#/pages/organization/projects');
			await organizationProjectsPage.gridBtnExists();
			await organizationProjectsPage.gridBtnClick(1);
			await organizationProjectsPage.requestProjectButtonVisible();
			await organizationProjectsPage.clickRequestProjectButton();
			await organizationProjectsPage.nameInputVisible();
			await organizationProjectsPage.enterNameInputData(
				OrganizationProjectsPageData.name
			);
			await organizationProjectsPage.selectEmployeeDropdownVisible();
			await organizationProjectsPage.clickSelectEmployeeDropdown();
			await organizationProjectsPage.selectEmployeeDropdownOption(0);
			await organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
			await organizationProjectsPage.clickTabButton(1);
			await organizationProjectsPage.tagsMultiSelectVisible();
			await organizationProjectsPage.clickTagsMultiSelect();
			await organizationProjectsPage.selectTagsFromDropdown(0);
			await organizationProjectsPage.clickCardBody();
			await organizationProjectsPage.clickTabButton(3);
			await organizationProjectsPage.budgetHoursInputVisible();
			await organizationProjectsPage.enterBudgetHoursInputData(
				OrganizationProjectsPageData.hours
			);
			await organizationProjectsPage.clickTabButton(5);
			await organizationProjectsPage.colorInputVisible();
			await organizationProjectsPage.enterColorInputData(
				OrganizationProjectsPageData.color
			);
			await organizationProjectsPage.saveProjectButtonVisible();
			await organizationProjectsPage.clickSaveProjectButton();
			await organizationProjectsPage.waitMessageToHide();
			await organizationProjectsPage.verifyProjectExists(
				OrganizationProjectsPageData.name
			);
		});

		await test.step('Should be able to edit project', async () => {
			await organizationProjectsPage.tableRowVisible();
			await organizationProjectsPage.selectTableRow(0);
			await organizationProjectsPage.editButtonVisible();
			await organizationProjectsPage.clickEditButton();
			await organizationProjectsPage.nameInputVisible();
			await organizationProjectsPage.enterNameInputData(
				OrganizationProjectsPageData.editName
			);
			await organizationProjectsPage.clickTabButton(3);
			await organizationProjectsPage.budgetHoursInputVisible();
			await organizationProjectsPage.enterBudgetHoursInputData(
				OrganizationProjectsPageData.hours
			);
			await organizationProjectsPage.clickTabButton(5);
			await organizationProjectsPage.colorInputVisible();
			await organizationProjectsPage.enterColorInputData(
				OrganizationProjectsPageData.color
			);
			await organizationProjectsPage.saveProjectButtonVisible();
			await organizationProjectsPage.clickSaveProjectButton();
		});

		await test.step('Should be able to delete project', async () => {
			await organizationProjectsPage.waitMessageToHide();
			await organizationProjectsPage.selectTableRow(0);
			await organizationProjectsPage.deleteButtonVisible();
			await organizationProjectsPage.clickDeleteButton();
			await organizationProjectsPage.confirmDeleteButtonVisible();
			await organizationProjectsPage.clickConfirmDeleteButton();
			await organizationProjectsPage.waitMessageToHide();
			await organizationProjectsPage.verifyProjectIsDeleted(
				OrganizationProjectsPageData.editName
			);
		});
	});
});
