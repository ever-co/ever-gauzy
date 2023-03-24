import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as goalsTimeFramePage from '../support/Base/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../support/Base/pagedata/GoalsTimeFramePageData';

describe('Goals Time Frame test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add new time frame', () => {
		cy.visit('/#/pages/goals/settings');
		goalsTimeFramePage.tabButtonVisible();
		goalsTimeFramePage.clickTabButton(1);
		goalsTimeFramePage.addTimeFrameButtonVisible();
		goalsTimeFramePage.clickAddTimeFrameButton();
		goalsTimeFramePage.nameInputVisible();
		goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
		goalsTimeFramePage.startDateInputVisible();
		goalsTimeFramePage.enterStartDateData();
		goalsTimeFramePage.endDateInputVisible();
		goalsTimeFramePage.enterEndDateData();
		goalsTimeFramePage.clickKeyboardButtonByKeyCode(9);
		goalsTimeFramePage.saveTimeFrameButtonVisible();
		goalsTimeFramePage.clickSaveTimeFrameButton();
	});
	it('Should be able to edit time frame', () => {
		goalsTimeFramePage.waitMessageToHide();
		goalsTimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
		goalsTimeFramePage.tableRowVisible();
		goalsTimeFramePage.selectTableRow(0);
		goalsTimeFramePage.editTimeFrameButtonVisible();
		goalsTimeFramePage.clickEditTimeFrameButton();
		goalsTimeFramePage.nameInputVisible();
		goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
		goalsTimeFramePage.startDateInputVisible();
		goalsTimeFramePage.enterStartDateData();
		goalsTimeFramePage.endDateInputVisible();
		goalsTimeFramePage.enterEndDateData();
		goalsTimeFramePage.clickKeyboardButtonByKeyCode(9);
		goalsTimeFramePage.saveTimeFrameButtonVisible();
		goalsTimeFramePage.clickSaveTimeFrameButton();
	});
	it('Should be able to delete time frame', () => {
		goalsTimeFramePage.waitMessageToHide();
		goalsTimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
		goalsTimeFramePage.tableRowVisible();
		goalsTimeFramePage.selectTableRow(0);
		goalsTimeFramePage.deleteTimeFrameButtonVisible();
		goalsTimeFramePage.clickDeleteTimeFrameButton();
		goalsTimeFramePage.confirmDeleteButtonVisible();
		goalsTimeFramePage.clickConfirmDeleteButton();
		goalsTimeFramePage.verifyElementDeleted(
			GoalsTimeFramePageData.emptyTableText
		);
	});
});
