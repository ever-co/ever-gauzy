import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as goalstimeFramePage from '../support/Base/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../support/Base/pagedata/GoalsTimeFramePageData';

describe('Goals Time Frame test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new time frame', () => {
		cy.visit('/#/pages/goals/settings');
		goalstimeFramePage.tabButtonVisible();
		goalstimeFramePage.clickTabButton(1);
		goalstimeFramePage.addtimeFrameButtonVisible();
		goalstimeFramePage.clickAddtimeFrameButton();
		goalstimeFramePage.nameInputVisible();
		goalstimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
		goalstimeFramePage.startDateInputVisible();
		goalstimeFramePage.enterStartDateData();
		goalstimeFramePage.endDateInputVisible();
		goalstimeFramePage.enterEndDateData();
		goalstimeFramePage.clickKeyboardButtonByKeyCode(9);
		goalstimeFramePage.saveTimeFrameButtonVisible();
		goalstimeFramePage.clickSaveTimeFrameButton();
	});
	it('Should be able to edit time frame', () => {
		goalstimeFramePage.waitMessageToHide();
		goalstimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
		goalstimeFramePage.tableRowVisible();
		goalstimeFramePage.selectTableRow(0);
		goalstimeFramePage.editTimeFrameButtonVisible();
		goalstimeFramePage.clickEditTimeFrameButton();
		goalstimeFramePage.nameInputVisible();
		goalstimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
		goalstimeFramePage.startDateInputVisible();
		goalstimeFramePage.enterStartDateData();
		goalstimeFramePage.endDateInputVisible();
		goalstimeFramePage.enterEndDateData();
		goalstimeFramePage.clickKeyboardButtonByKeyCode(9);
		goalstimeFramePage.saveTimeFrameButtonVisible();
		goalstimeFramePage.clickSaveTimeFrameButton();
	});
	it('Should be able to delete time frame', () => {
		goalstimeFramePage.waitMessageToHide();
		goalstimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
		goalstimeFramePage.tableRowVisible();
		goalstimeFramePage.selectTableRow(0);
		goalstimeFramePage.deleteTimeFrameButtonVisible();
		goalstimeFramePage.clickDeleteTimeFrameButton();
		goalstimeFramePage.confirmDeleteButtonVisible();
		goalstimeFramePage.clickConfirmDeleteButton();
		goalstimeFramePage.verifyElementDeleted(
			GoalsTimeFramePageData.emptyTableText
		);
	});
});
