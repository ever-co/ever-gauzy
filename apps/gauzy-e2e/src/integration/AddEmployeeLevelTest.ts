import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addEmployeeLevelPage from '../support/Base/pages/AddEmployeeLevel.po';
import { AddEmployeeLevelPageData } from '../support/Base/pagedata/AddEmployeeLevelPageData';
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
	it('Should be able to add new employee level', () => {
		cy.visit('/#/pages/employees/employee-level');
		addEmployeeLevelPage.gridBtnExists();
		addEmployeeLevelPage.gridBtnClick(1);
		addEmployeeLevelPage.addNewLevelButtonVisible();
		addEmployeeLevelPage.clickAddNewLevelButton();
		addEmployeeLevelPage.cancelNewLevelButtonVisible();
		addEmployeeLevelPage.clickCancelNewLevelButton();
		addEmployeeLevelPage.clickAddNewLevelButton();
		addEmployeeLevelPage.newLevelInputVisible();
		addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
		addEmployeeLevelPage.tagsMultyselectVisible();
		addEmployeeLevelPage.clickTagsMultyselect();
		addEmployeeLevelPage.selectTagsFromDropdown(1);
		addEmployeeLevelPage.selectTagsFromDropdown(2);
		addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
		addEmployeeLevelPage.saveNewLevelButtonVisible();
		addEmployeeLevelPage.clickSaveNewLevelButton();
	});
	it('Should be able to edit employee level', () => {
		addEmployeeLevelPage.editEmployeeLevelButtonVisible();
		addEmployeeLevelPage.clickEditEmployeeLevelButton(0);
		addEmployeeLevelPage.editEmployeeLevelInpuVisible();
		addEmployeeLevelPage.enterEditLevelData(
			AddEmployeeLevelPageData.levelF
		);
		addEmployeeLevelPage.tagsMultyselectVisible();
		addEmployeeLevelPage.clickTagsMultyselect();
		addEmployeeLevelPage.selectTagsFromDropdown(1);
		addEmployeeLevelPage.selectTagsFromDropdown(2);
		addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
		addEmployeeLevelPage.saveNewLevelButtonVisible();
		addEmployeeLevelPage.clickSaveNewLevelButton();
	});
	it('Should be able to delete employee level', () => {
		addEmployeeLevelPage.deleteLevelButtonVisible();
		addEmployeeLevelPage.clickDeleteLevelButton(0);
		addEmployeeLevelPage.confirmDeleteButtonVisible();
		addEmployeeLevelPage.clickConfirmDeleteLevelButton();
	});
});
