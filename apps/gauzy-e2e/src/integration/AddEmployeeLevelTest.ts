import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addEmployeeLevelPage from '../support/Base/pages/AddEmployeeLevel.po';
import { AddEmployeeLevelPageData } from '../support/Base/pagedata/AddEmployeeLevelPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Add employee level test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new employee level', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/employees/employee-level');
		addEmployeeLevelPage.gridBtnExists();
		addEmployeeLevelPage.gridBtnClick(1);
		addEmployeeLevelPage.addNewLevelButtonVisible();
		addEmployeeLevelPage.clickAddNewLevelButton();
		addEmployeeLevelPage.newLevelInputVisible();
		addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
		addEmployeeLevelPage.tagsMultyselectVisible();
		addEmployeeLevelPage.clickTagsMultyselect();
		addEmployeeLevelPage.selectTagsFromDropdown(0);
		addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
		addEmployeeLevelPage.saveNewLevelButtonVisible();
		addEmployeeLevelPage.clickSaveNewLevelButton();
		addEmployeeLevelPage.waitMessageToHide();
		addEmployeeLevelPage.editEmployeeLevelButtonVisible();
		addEmployeeLevelPage.clickEditEmployeeLevelButton();
		addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelE);
		addEmployeeLevelPage.cancelButtonVisible();
		addEmployeeLevelPage.clickCancelButton();
	});
	it('Should be able to edit employee level', () => {
		addEmployeeLevelPage.editEmployeeLevelButtonVisible();
		addEmployeeLevelPage.clickEditEmployeeLevelButton();
		addEmployeeLevelPage.editEmployeeLevelInpuVisible();
		addEmployeeLevelPage.enterEditLevelData(
			AddEmployeeLevelPageData.levelF
		);
		addEmployeeLevelPage.tagsMultyselectVisible();
		addEmployeeLevelPage.clickTagsMultyselect();
		addEmployeeLevelPage.selectTagsFromDropdown(0);
		addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
		addEmployeeLevelPage.saveNewLevelButtonVisible();
		addEmployeeLevelPage.clickSaveNewLevelButton();
		addEmployeeLevelPage.waitMessageToHide();
		addEmployeeLevelPage.editEmployeeLevelButtonVisible();
		addEmployeeLevelPage.clickEditEmployeeLevelButton();
		addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelF);
		addEmployeeLevelPage.cancelButtonVisible();
		addEmployeeLevelPage.clickCancelButton();
	});
	it('Should be able to delete employee level', () => {
		addEmployeeLevelPage.deleteLevelButtonVisible();
		addEmployeeLevelPage.clickDeleteLevelButton();
		addEmployeeLevelPage.confirmDeleteButtonVisible();
		addEmployeeLevelPage.clickConfirmDeleteLevelButton();
		addEmployeeLevelPage.verifyElementIsDeleted(
			AddEmployeeLevelPageData.levelF
		);
	});
});
