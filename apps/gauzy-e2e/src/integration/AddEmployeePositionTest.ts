import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addEmployeePositionPage from '../support/Base/pages/AddEmployeePosition.po';
import { AddEmployeePositionPageData } from '../support/Base/pagedata/AddEmployeePositionPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Add employee level test', () => {
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
		addEmployeePositionPage.addNewLevelButtonVisible();
		addEmployeePositionPage.clickAddNewLevelButton();
		addEmployeePositionPage.cancelNewLevelButtonVisible();
		addEmployeePositionPage.clickCancelNewLevelButton();
		addEmployeePositionPage.clickAddNewLevelButton();
		addEmployeePositionPage.newLevelInputVisible();
		addEmployeePositionPage.enterNewLevelData(
			AddEmployeePositionPageData.fullStackDeveloper
		);
		addEmployeePositionPage.tagsMultyselectVisible();
		addEmployeePositionPage.clickTagsMultyselect();
		addEmployeePositionPage.selectTagsFromDropdown(1);
		addEmployeePositionPage.selectTagsFromDropdown(2);
		addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
		addEmployeePositionPage.saveNewLevelButtonVisible();
		addEmployeePositionPage.clickSaveNewLevelButton();
	});
	it('Should be able to edit employee position', () => {
		addEmployeePositionPage.editEmployeeLevelButtonVisible();
		addEmployeePositionPage.clickEditEmployeeLevelButton(0);
		addEmployeePositionPage.editEmployeeLevelInpuVisible();
		addEmployeePositionPage.enterEditLevelData(
			AddEmployeePositionPageData.midLevelWebDeveloper
		);
		addEmployeePositionPage.tagsMultyselectVisible();
		addEmployeePositionPage.clickTagsMultyselect();
		addEmployeePositionPage.selectTagsFromDropdown(1);
		addEmployeePositionPage.selectTagsFromDropdown(2);
		addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
		addEmployeePositionPage.saveNewLevelButtonVisible();
		addEmployeePositionPage.clickSaveNewLevelButton();
	});
	it('Should be able to delete employee position', () => {
		addEmployeePositionPage.deleteLevelButtonVisible();
		addEmployeePositionPage.clickDeleteLevelButton(0);
		addEmployeePositionPage.confirmDeleteButtonVisible();
		addEmployeePositionPage.clickConfirmDeleteLevelButton();
	});
});
