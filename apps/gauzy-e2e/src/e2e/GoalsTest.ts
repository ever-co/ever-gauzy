import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as goalsPage from '../support/Base/pages/Goals.po';
import { GoalsPageData } from '../support/Base/pagedata/GoalsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

//! Expected to find element: nb-actions > nb-action[icon="plus-circle"], but never found it.
describe('Goals test', { testIsolation: false }, () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		goalsPage.visit();
		goalsPage.clearGoalsTable();
	});
	it('Should be able to add new goal', () => {
		goalsPage.addButtonVisible();
		goalsPage.clickAddButton();
		goalsPage.selectOptionFromDropdown(0);
		goalsPage.nameInputVisible();
		goalsPage.enterNameInputData(GoalsPageData.name);
		goalsPage.ownerDropdownVisible();
		goalsPage.clickOwnerDropdown();
		goalsPage.selectOwnerFromDropdown(0);
		goalsPage.leadDropdownVisible();
		goalsPage.clickLeadDropdown();
		goalsPage.selectLeadFromDropdown(0);
		goalsPage.deadlineDropdownVisible();
		goalsPage.clickDeadlineDropdown();
		goalsPage.selectDeadlineFromDropdown(0);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
		goalsPage.waitMessageToHide();
		goalsPage.verifyGoalExists(GoalsPageData.name);
	});
	// TODO: fix add key result feature in order to be able to fix the test case
	// it('Should be able to add key result', () => {
	// 	goalsPage.tableRowVisible();
	// 	goalsPage.clickTableRow(0);
	// 	goalsPage.addNewKeyResultButtonVisible();
	// 	goalsPage.clickAddNewKeyResultButton();
	// 	goalsPage.keyResultInputVisible();
	// 	goalsPage.enterKeyResultNameData(GoalsPageData.keyResultName);
	// 	goalsPage.keyResultOwnerDropdownVisible();
	// 	goalsPage.clickKeyResultOwnerDropdown();
	// 	goalsPage.selectKeyResultOwnerFromDropdown(0);
	// 	goalsPage.keyResultLeadDropdownVisible();
	// 	goalsPage.clickKeyResultLeadDropdown();
	// 	goalsPage.selectKeyResultLeadFromDropdown(0);
	// 	goalsPage.toggleButtonVisible();
	// 	goalsPage.clickToggleButton();
	// 	goalsPage.clickToggleButton();
	// 	goalsPage.confirmButtonVisible();
	// 	goalsPage.clickConfirmButton();
	// 	goalsPage.waitMessageToHide();
	// });
	// TODO: the app doesn't seem to allow adding new deadline from this context
	// it.only('Should be able to add new deadline', () => {
	// 	cy.on('uncaught:exception', (err, runnable) => {
	// 		return false;
	// 	});
	// 	goalsPage.clickTableRow(0);
	// 	goalsPage.viewButtonVisible();
	// 	goalsPage.clickViewButton(1);
	// 	goalsPage.addNewDeadlineButtonVisible();
	// 	goalsPage.clickAddDeadlineButton();
	// 	goalsPage.updatedValueInputVisible();
	// 	goalsPage.enterUpdatedValueData(1);
	// 	goalsPage.confirmButtonVisible();
	// 	goalsPage.clickConfirmButton();
	// 	goalsPage.saveDeadlineButtonVisible();
	// 	goalsPage.clickSaveDeadlineButton();
	// 	goalsPage.waitMessageToHide();
	// });

	// TODO: the app doesn't seem to allow adding weight parameter from this context
	// it('Should be able to add weight parameter', () => {
	// 	goalsPage.progressBarVisible();
	// 	goalsPage.clickProgressBar(0);
	// 	goalsPage.weightTypeButtonVisible();
	// 	goalsPage.clickWeightTypeButton(0);
	// 	goalsPage.weightParameterDropdownVisible();
	// 	goalsPage.clickWeightParameterDropdown();
	// 	goalsPage.selectWeightParameterFromDropdown(GoalsPageData.weightParameter);
	// 	goalsPage.confirmButtonVisible();
	// 	goalsPage.clickConfirmButton();
	// goalsPage.waitMessageToHide();
	// });
	it('Should be able to edit goal', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		goalsPage.tableRowVisible();
		goalsPage.clickTableRow(0);
		goalsPage.editButtonVisible();
		goalsPage.clickEditButton();
		goalsPage.nameInputVisible();
		goalsPage.enterNameInputData(GoalsPageData.updatedName);
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
		goalsPage.waitMessageToHide();
		goalsPage.verifyGoalExists(GoalsPageData.updatedName);
	});
	it('Should be able to delete goal', () => {
		goalsPage.tableRowVisible();
		goalsPage.clickTableRow(0);
		goalsPage.viewButtonVisible();
		goalsPage.clickViewButton();
		goalsPage.viewModalDeleteButtonVisible();
		goalsPage.clickViewModalDeleteButton();
		goalsPage.confirmButtonVisible();
		goalsPage.clickConfirmButton();
		goalsPage.waitMessageToHide();
		cy.reloadAndWait();
		goalsPage.verifyElementIsDeleted();
	});
});
