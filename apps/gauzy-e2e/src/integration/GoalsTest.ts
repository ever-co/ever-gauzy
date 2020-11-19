import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as goalsPage from '../support/Base/pages/Goals.po';
import { GoalsPageData } from '../support/Base/pagedata/GoalsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Goals test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new goal', () => {
		cy.visit('/#/pages/goals');
		goalsPage.addButtonVisible();
		goalsPage.clickAddButton(0);
		goalsPage.selectOptionFromDropdown(0);
		goalsPage.nameInputVisible();
		goalsPage.enterNameInputData(GoalsPageData.name);
		goalsPage.ownerDropdownVisible();
		goalsPage.clickOwnerDropdown();
		goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
		goalsPage.leadDropdownVisible();
		goalsPage.clickLeadDropdown();
		goalsPage.selectLeadFromDropdown(0);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
	});
	it('Should be able to add key result', () => {
		goalsPage.waitMessageToHide();
		goalsPage.tableRowVisible();
		goalsPage.clickTableRow(0);
		goalsPage.addButtonVisible();
		goalsPage.clickAddButton(1);
		goalsPage.keyResultInputVisible();
		goalsPage.enterKeyResultNameData(GoalsPageData.keyResultName);
		goalsPage.keyResultOwnerDropdownVisible();
		goalsPage.clickKeyResultOwnerDropdown();
		goalsPage.selectKeyResultOwnerFromDropdown(0);
		goalsPage.keyResultLeadDropdownVisible();
		goalsPage.clickKeyResultLeadDropdown();
		goalsPage.selectKeyResultLeadFromDropdown(0);
		goalsPage.toggleButtonVisible();
		goalsPage.clickToggleButton();
		goalsPage.clickToggleButton();
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
	});
	it('Should be able to add new deadline', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		goalsPage.waitMessageToHide();
		goalsPage.clickTableRow(0);
		goalsPage.viewButtonVisible();
		goalsPage.clickViewButton(1);
		goalsPage.addNewDeadlineButtonVisible();
		goalsPage.clickAddDeadlineButton();
		goalsPage.updatedValueInputVisible();
		goalsPage.enterUpdatedValueData(1);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
		goalsPage.saveDeadlineButtonVisible();
		goalsPage.clickSaveDeadlineButton();
	});
	it('Should be able to add weight parameter', () => {
		goalsPage.waitMessageToHide();
		goalsPage.progressBarVisible();
		goalsPage.clickProgressBar(0);
		goalsPage.weightTypeButtonVisible();
		goalsPage.clickWeightTypeButton(0);
		goalsPage.weightParameterDropdwonVisible();
		goalsPage.clickWeightParameterDropdown();
		goalsPage.selectWeightParameterFromDropdown(
			GoalsPageData.weightParameter
		);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
	});
	it('Should be able to edit goal', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		goalsPage.waitMessageToHide();
		goalsPage.editButtonVisible();
		goalsPage.clickEditButton(0);
		goalsPage.ownerDropdownVisible();
		goalsPage.clickOwnerDropdown();
		goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
	});
	it('Should be able to delete goal', () => {
		goalsPage.waitMessageToHide();
		goalsPage.viewButtonVisible();
		goalsPage.clickViewButton(0);
		goalsPage.deleteButtonVisible();
		goalsPage.clickDeleteButton();
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
	});
});
