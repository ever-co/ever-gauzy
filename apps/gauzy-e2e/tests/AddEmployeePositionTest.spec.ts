import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addEmployeePositionPage from './support/pages/AddEmployeePosition.po';
import { AddEmployeePositionPageData } from '../src/support/Base/pagedata/AddEmployeePositionPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';

test.describe('Add employee position test', () => {
	test('Add employee position test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new employee position', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await getPage().goto('/#/pages/employees/positions');
			await addEmployeePositionPage.gridBtnExists();
			await addEmployeePositionPage.gridBtnClick(1);
			await addEmployeePositionPage.addNewPositionButtonVisible();
			await addEmployeePositionPage.clickAddNewPositionButton();
			await addEmployeePositionPage.cancelNewPositionButtonVisible();
			await addEmployeePositionPage.clickCancelNewPositionButton();
			await addEmployeePositionPage.clickAddNewPositionButton();
			await addEmployeePositionPage.newPositionInputVisible();
			await addEmployeePositionPage.enterNewPositionData(AddEmployeePositionPageData.fullStackDeveloper);
			await addEmployeePositionPage.tagsMultiSelectVisible();
			await addEmployeePositionPage.clickTagsMultiSelect();
			await addEmployeePositionPage.selectTagsFromDropdown(0);
			await addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeePositionPage.savePositionButtonVisible();
			await addEmployeePositionPage.clickSavePositionButton();
			await addEmployeePositionPage.waitMessageToHide();
			// Edit is disabled until a grid row is selected (selectPosition enables it).
			await addEmployeePositionPage.selectPositionRow();
			await addEmployeePositionPage.editEmployeePositionButtonVisible();
			await addEmployeePositionPage.clickEditEmployeePositionButton();
			await addEmployeePositionPage.verifyTitleExists(AddEmployeePositionPageData.fullStackDeveloper);
			await addEmployeePositionPage.cancelButtonVisible();
			await addEmployeePositionPage.clickCancelButton();
		});

		await test.step('Should be able to edit employee position', async () => {
			// Cancel reset disabled=true, so re-select the row to re-enable Edit.
			await addEmployeePositionPage.selectPositionRow();
			await addEmployeePositionPage.editEmployeePositionButtonVisible();
			await addEmployeePositionPage.clickEditEmployeePositionButton();
			await addEmployeePositionPage.editEmployeePositionInputVisible();
			await addEmployeePositionPage.enterEditPositionData(AddEmployeePositionPageData.midLevelWebDeveloper);
			await addEmployeePositionPage.tagsMultiSelectVisible();
			await addEmployeePositionPage.clickTagsMultiSelect();
			await addEmployeePositionPage.selectTagsFromDropdown(0);
			await addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeePositionPage.savePositionButtonVisible();
			await addEmployeePositionPage.clickSavePositionButton();
			await addEmployeePositionPage.waitMessageToHide();
			await addEmployeePositionPage.selectPositionRow();
			await addEmployeePositionPage.editEmployeePositionButtonVisible();
			await addEmployeePositionPage.clickEditEmployeePositionButton();
			await addEmployeePositionPage.verifyTitleExists(AddEmployeePositionPageData.midLevelWebDeveloper);
			await addEmployeePositionPage.cancelButtonVisible();
			await addEmployeePositionPage.clickCancelButton();
		});

		await test.step('Should be able to delete employee position', async () => {
			await addEmployeePositionPage.addNewPositionButtonVisible();
			await addEmployeePositionPage.clickAddNewPositionButton();
			await addEmployeePositionPage.cancelNewPositionButtonVisible();
			await addEmployeePositionPage.clickCancelNewPositionButton();
			await addEmployeePositionPage.clickAddNewPositionButton();
			await addEmployeePositionPage.newPositionInputVisible();
			await addEmployeePositionPage.enterNewPositionData(AddEmployeePositionPageData.fullStackDeveloper);
			await addEmployeePositionPage.tagsMultiSelectVisible();
			await addEmployeePositionPage.clickTagsMultiSelect();
			await addEmployeePositionPage.selectTagsFromDropdown(0);
			await addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
			await addEmployeePositionPage.savePositionButtonVisible();
			await addEmployeePositionPage.clickSavePositionButton();
			await addEmployeePositionPage.waitMessageToHide();
			// removePosition deletes the SELECTED row, so select the just-added Full Stack position first.
			await addEmployeePositionPage.selectPositionRowByText(AddEmployeePositionPageData.fullStackDeveloper);
			await addEmployeePositionPage.deletePositionButtonVisible();
			await addEmployeePositionPage.clickDeletePositionButton();
			await addEmployeePositionPage.confirmDeleteButtonVisible();
			await addEmployeePositionPage.clickConfirmDeletePositionButton();
			await addEmployeePositionPage.verifyElementIsDeleted(AddEmployeePositionPageData.fullStackDeveloper);
			await addEmployeePositionPage.waitMessageToHide();
			// Remove the remaining row (Mid Level, carried over from the edit step) to leave a clean grid.
			await addEmployeePositionPage.selectPositionRowByText(AddEmployeePositionPageData.midLevelWebDeveloper);
			await addEmployeePositionPage.deletePositionButtonVisible();
			await addEmployeePositionPage.clickDeletePositionButton();
			await addEmployeePositionPage.confirmDeleteButtonVisible();
			await addEmployeePositionPage.clickConfirmDeletePositionButton();
		});
	});
});
