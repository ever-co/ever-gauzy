import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as goalsTimeFramePage from '../../support/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../../../src/support/Base/pagedata/GoalsTimeFramePageData';

// Converted 1:1 from the plain GoalsTimeFrameTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

// The suite shares one accumulating database, so a fixed name accumulates duplicate rows across runs
// (and a run that fails before its delete step leaves one behind). Use a unique name per run so
// add/edit/delete target exactly the time frame this run created and the delete verification is
// unambiguous — same approach as organization-departments.
let timeFrameName = ' ';

When('I add a new goal time frame', async () => {
	timeFrameName = `${GoalsTimeFramePageData.name} ${Date.now()}`;

	await getPage().goto('/#/pages/goals/settings');
	await goalsTimeFramePage.tabButtonVisible();
	await goalsTimeFramePage.clickTabButton(1);
	await goalsTimeFramePage.addTimeFrameButtonVisible();
	await goalsTimeFramePage.clickAddTimeFrameButton();
	await goalsTimeFramePage.nameInputVisible();
	await goalsTimeFramePage.enterNameInputData(timeFrameName);
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
	await goalsTimeFramePage.verifyTimeFrameExists(timeFrameName);
	await goalsTimeFramePage.tableRowVisible();
	// By name, not by index: the grid can hold time frames this spec did not create (the goals spec
	// has to create one, since the objective form's deadline is required and the database seeds none),
	// and row 0 would then edit/delete somebody else's.
	await goalsTimeFramePage.selectTableRowByName(timeFrameName);
	await goalsTimeFramePage.editTimeFrameButtonVisible();
	await goalsTimeFramePage.clickEditTimeFrameButton();
	await goalsTimeFramePage.nameInputVisible();
	await goalsTimeFramePage.enterNameInputData(timeFrameName);
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
	await goalsTimeFramePage.verifyTimeFrameExists(timeFrameName);
	await goalsTimeFramePage.tableRowVisible();
	// By name, not by index: the grid can hold time frames this spec did not create (the goals spec
	// has to create one, since the objective form's deadline is required and the database seeds none),
	// and row 0 would then edit/delete somebody else's.
	await goalsTimeFramePage.selectTableRowByName(timeFrameName);
	await goalsTimeFramePage.deleteTimeFrameButtonVisible();
	await goalsTimeFramePage.clickDeleteTimeFrameButton();
	await goalsTimeFramePage.confirmDeleteButtonVisible();
	await goalsTimeFramePage.clickConfirmDeleteButton();
	// Assert OUR time frame is gone rather than that the grid is empty — see verifyTimeFrameIsDeleted.
	await goalsTimeFramePage.verifyTimeFrameIsDeleted(timeFrameName);
});
