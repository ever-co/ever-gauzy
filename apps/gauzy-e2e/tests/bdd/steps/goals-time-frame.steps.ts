import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as goalsTimeFramePage from '../../support/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../../../src/support/Base/pagedata/GoalsTimeFramePageData';

// Converted 1:1 from the plain GoalsTimeFrameTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I add a new goal time frame', async () => {
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

When('I edit the goal time frame', async () => {
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

When('I delete the goal time frame', async () => {
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
