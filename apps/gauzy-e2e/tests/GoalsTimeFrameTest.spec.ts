import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import * as goalsTimeFramePage from './support/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../src/support/Base/pagedata/GoalsTimeFramePageData';

test.describe('Goals Time Frame test', () => {
	test('Goals Time Frame test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new time frame', async () => {
			await getPage().goto('/#/pages/goals/settings');
			await goalsTimeFramePage.tabButtonVisible();
			await goalsTimeFramePage.clickTabButton(1);
			await goalsTimeFramePage.addTimeFrameButtonVisible();
			await goalsTimeFramePage.clickAddTimeFrameButton();
			await goalsTimeFramePage.nameInputVisible();
			await goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
			await goalsTimeFramePage.startDateInputVisible();
			await goalsTimeFramePage.enterStartDateData();
			await goalsTimeFramePage.endDateInputVisible();
			await goalsTimeFramePage.enterEndDateData();
			await goalsTimeFramePage.clickKeyboardButtonByKeyCode(9);
			await goalsTimeFramePage.saveTimeFrameButtonVisible();
			await goalsTimeFramePage.clickSaveTimeFrameButton();
		});

		await test.step('Should be able to edit time frame', async () => {
			await goalsTimeFramePage.waitMessageToHide();
			await goalsTimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
			await goalsTimeFramePage.tableRowVisible();
			await goalsTimeFramePage.selectTableRow(0);
			await goalsTimeFramePage.editTimeFrameButtonVisible();
			await goalsTimeFramePage.clickEditTimeFrameButton();
			await goalsTimeFramePage.nameInputVisible();
			await goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
			await goalsTimeFramePage.startDateInputVisible();
			await goalsTimeFramePage.enterStartDateData();
			await goalsTimeFramePage.endDateInputVisible();
			await goalsTimeFramePage.enterEndDateData();
			await goalsTimeFramePage.clickKeyboardButtonByKeyCode(9);
			await goalsTimeFramePage.saveTimeFrameButtonVisible();
			await goalsTimeFramePage.clickSaveTimeFrameButton();
		});

		await test.step('Should be able to delete time frame', async () => {
			await goalsTimeFramePage.waitMessageToHide();
			await goalsTimeFramePage.verifyTimeFrameExists(GoalsTimeFramePageData.name);
			await goalsTimeFramePage.tableRowVisible();
			await goalsTimeFramePage.selectTableRow(0);
			await goalsTimeFramePage.deleteTimeFrameButtonVisible();
			await goalsTimeFramePage.clickDeleteTimeFrameButton();
			await goalsTimeFramePage.confirmDeleteButtonVisible();
			await goalsTimeFramePage.clickConfirmDeleteButton();
			await goalsTimeFramePage.verifyElementDeleted(GoalsTimeFramePageData.emptyTableText);
		});
	});
});
