import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addEmployeePositionPage from '../support/Base/pages/AddEmployeePosition.po';
import { AddEmployeePositionPageData } from '../support/Base/pagedata/AddEmployeePositionPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Add employee position test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new employee position', () => {
		cy.visit('/#/pages/employees/positions');
		addEmployeePositionPage.gridBtnExists();
		addEmployeePositionPage.gridBtnClick(1);
		addEmployeePositionPage.addNewPositionButtonVisible();
		addEmployeePositionPage.clickAddNewPositionButton();
		addEmployeePositionPage.cancelNewPositionButtonVisible();
		addEmployeePositionPage.clickCancelNewPositionButton();
		addEmployeePositionPage.clickAddNewPositionButton();
		addEmployeePositionPage.newPositionInputVisible();
		addEmployeePositionPage.enterNewPositionData(
			AddEmployeePositionPageData.fullStackDeveloper
		);
		addEmployeePositionPage.tagsMultyselectVisible();
		addEmployeePositionPage.clickTagsMultyselect();
		addEmployeePositionPage.selectTagsFromDropdown(0);
		addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
		addEmployeePositionPage.savePositionButtonVisible();
		addEmployeePositionPage.clickSavePositionButton();
		addEmployeePositionPage.waitMessageToHide();
		addEmployeePositionPage.editEmployeePositionButtonVisible();
		addEmployeePositionPage.clickEditEmployeePositionButton();
		addEmployeePositionPage.verifyTitleExists(
			AddEmployeePositionPageData.fullStackDeveloper
		);
		addEmployeePositionPage.cancelButtonVisible();
		addEmployeePositionPage.clickCancelButton();
	});
	it('Should be able to edit employee position', () => {
		addEmployeePositionPage.clickEditEmployeePositionButton();
		addEmployeePositionPage.editEmployeePositionInpuVisible();
		addEmployeePositionPage.enterEditPositionData(
			AddEmployeePositionPageData.midLevelWebDeveloper
		);
		addEmployeePositionPage.tagsMultyselectVisible();
		addEmployeePositionPage.clickTagsMultyselect();
		addEmployeePositionPage.selectTagsFromDropdown(0);
		addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
		addEmployeePositionPage.savePositionButtonVisible();
		addEmployeePositionPage.clickSavePositionButton();
		addEmployeePositionPage.waitMessageToHide();
		addEmployeePositionPage.editEmployeePositionButtonVisible();
		addEmployeePositionPage.clickEditEmployeePositionButton();
		addEmployeePositionPage.verifyTitleExists(
			AddEmployeePositionPageData.midLevelWebDeveloper
		);
		addEmployeePositionPage.cancelButtonVisible();
		addEmployeePositionPage.clickCancelButton();
	});
	it('Should be able to delete employee position', () => {
		addEmployeePositionPage.addNewPositionButtonVisible();
		addEmployeePositionPage.clickAddNewPositionButton();
		addEmployeePositionPage.cancelNewPositionButtonVisible();
		addEmployeePositionPage.clickCancelNewPositionButton();
		addEmployeePositionPage.clickAddNewPositionButton();
		addEmployeePositionPage.newPositionInputVisible();
		addEmployeePositionPage.enterNewPositionData(
			AddEmployeePositionPageData.fullStackDeveloper
		);
		addEmployeePositionPage.tagsMultyselectVisible();
		addEmployeePositionPage.clickTagsMultyselect();
		addEmployeePositionPage.selectTagsFromDropdown(0);
		addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
		addEmployeePositionPage.savePositionButtonVisible();
		addEmployeePositionPage.clickSavePositionButton();
		addEmployeePositionPage.waitMessageToHide();
		addEmployeePositionPage.deletePositionButtonVisible();
		addEmployeePositionPage.clickDeletePositionButton();
		addEmployeePositionPage.confirmDeleteButtonVisible();
		addEmployeePositionPage.clickConfirmDeletePositionButton();
		addEmployeePositionPage.verifyElementIsDeleted(
			AddEmployeePositionPageData.fullStackDeveloper
		);
		addEmployeePositionPage.waitMessageToHide();
		addEmployeePositionPage.deletePositionButtonVisible();
		addEmployeePositionPage.clickDeletePositionButton();
		addEmployeePositionPage.confirmDeleteButtonVisible();
		addEmployeePositionPage.clickConfirmDeletePositionButton();
	});
});
