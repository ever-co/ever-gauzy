import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addEmployeeLevelPage from './support/pages/AddEmployeeLevel.po';
import { AddEmployeeLevelPageData } from '../src/support/Base/pagedata/AddEmployeeLevelPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Add employee level test', () => {
	test('Add employee level test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new employee level', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await getPage().goto('/#/pages/employees/employee-level');
			await addEmployeeLevelPage.gridBtnExists();
			await addEmployeeLevelPage.gridBtnClick(1);
			await addEmployeeLevelPage.addNewLevelButtonVisible();
			await addEmployeeLevelPage.clickAddNewLevelButton();
			await addEmployeeLevelPage.newLevelInputVisible();
			await addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
			await addEmployeeLevelPage.tagsMultiSelectVisible();
			await addEmployeeLevelPage.clickTagsMultiSelect();
			await addEmployeeLevelPage.selectTagsFromDropdown(0);
			await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeeLevelPage.saveNewLevelButtonVisible();
			await addEmployeeLevelPage.clickSaveNewLevelButton();
			await addEmployeeLevelPage.waitMessageToHide();
			await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
			await addEmployeeLevelPage.clickEditEmployeeLevelButton();
			await addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelE);
			await addEmployeeLevelPage.cancelButtonVisible();
			await addEmployeeLevelPage.clickCancelButton();
		});

		await test.step('Should be able to edit employee level', async () => {
			await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
			await addEmployeeLevelPage.clickEditEmployeeLevelButton();
			await addEmployeeLevelPage.editEmployeeLevelInpuVisible();
			await addEmployeeLevelPage.enterEditLevelData(AddEmployeeLevelPageData.levelF);
			await addEmployeeLevelPage.tagsMultiSelectVisible();
			await addEmployeeLevelPage.clickTagsMultiSelect();
			await addEmployeeLevelPage.selectTagsFromDropdown(0);
			await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeeLevelPage.saveNewLevelButtonVisible();
			await addEmployeeLevelPage.clickSaveNewLevelButton();
			await addEmployeeLevelPage.waitMessageToHide();
			await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
			await addEmployeeLevelPage.clickEditEmployeeLevelButton();
			await addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelF);
			await addEmployeeLevelPage.cancelButtonVisible();
			await addEmployeeLevelPage.clickCancelButton();
		});

		await test.step('Should be able to delete employee level', async () => {
			await addEmployeeLevelPage.addNewLevelButtonVisible();
			await addEmployeeLevelPage.clickAddNewLevelButton();
			await addEmployeeLevelPage.newLevelInputVisible();
			await addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
			await addEmployeeLevelPage.tagsMultiSelectVisible();
			await addEmployeeLevelPage.clickTagsMultiSelect();
			await addEmployeeLevelPage.selectTagsFromDropdown(0);
			await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeeLevelPage.saveNewLevelButtonVisible();
			await addEmployeeLevelPage.clickSaveNewLevelButton();
			await addEmployeeLevelPage.waitMessageToHide();
			await addEmployeeLevelPage.deleteLevelButtonVisible();
			await addEmployeeLevelPage.clickDeleteLevelButton();
			await addEmployeeLevelPage.confirmDeleteButtonVisible();
			await addEmployeeLevelPage.clickConfirmDeleteLevelButton();
			await addEmployeeLevelPage.verifyElementIsDeleted(AddEmployeeLevelPageData.levelE);
			await addEmployeeLevelPage.waitMessageToHide();
			await addEmployeeLevelPage.deleteLevelButtonVisible();
			await addEmployeeLevelPage.clickDeleteLevelButton();
			await addEmployeeLevelPage.confirmDeleteButtonVisible();
			await addEmployeeLevelPage.clickConfirmDeleteLevelButton();
		});
	});
});
