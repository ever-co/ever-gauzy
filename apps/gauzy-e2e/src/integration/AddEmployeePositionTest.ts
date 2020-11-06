import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addEmployeePositionPage from '../support/Base/pages/AddEmployeePosition.po';
import { AddEmployeePositionPageData } from '../support/Base/pagedata/AddEmployeePositionPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Add employee position test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
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
	});
	it('Should be able to edit employee position', () => {
		addEmployeePositionPage.editEmployeePositionButtonVisible();
		addEmployeePositionPage.clickEditEmployeePositionButton(0);
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
	});
	it('Should be able to delete employee position', () => {
		addEmployeePositionPage.deletePositionButtonVisible();
		addEmployeePositionPage.clickDeletePositionButton(0);
		addEmployeePositionPage.confirmDeleteButtonVisible();
		addEmployeePositionPage.clickConfirmDeletePositionButton();
	});
});
