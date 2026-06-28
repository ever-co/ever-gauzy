import { test } from './support/fixtures';
import { faker } from '@faker-js/faker';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as goalsPage from './support/pages/Goals.po';
import { GoalsPageData } from '../src/support/Base/pagedata/GoalsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Goals test', () => {
	test('Goals test', async () => {
		// POLLUTION RESILIENCE: the suite shares ONE stateful DB and runs serially, so the static
		// GoalsPageData.name can collide with objectives left by an earlier spec/run. A faker suffix makes
		// THIS run's objective unique, and every downstream select-row / verify-exists / verify-deleted is
		// scoped to it (order-independent).
		const goalName = `${GoalsPageData.name} ${faker.string.uuid()}`;

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new goal', async () => {
			await getPage().goto('/#/pages/goals');
			// A hash-only goto() is a Playwright no-op when origin+path are unchanged, so the
			// SPA router can stay on the previous screen. Force the hash route explicitly.
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/goals')) {
					location.hash = '#/pages/goals';
				}
			});
			await goalsPage.addButtonVisible();
			await goalsPage.clickAddButton(0);
			await goalsPage.selectOptionFromDropdown(0);
			await goalsPage.nameInputVisible();
			await goalsPage.enterNameInputData(goalName);
			await goalsPage.ownerDropdownVisible();
			await goalsPage.clickOwnerDropdown();
			await goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
			await goalsPage.leadDropdownVisible();
			await goalsPage.clickLeadDropdown();
			await goalsPage.selectLeadFromDropdown(0);
			// Deadline (time frame) is a REQUIRED field on the objective form — Save stays disabled until
			// it is set, so without this the goal is never created and verifyGoalExists fails.
			await goalsPage.deadlineDropdownVisible();
			await goalsPage.clickDeadlineDropdown();
			await goalsPage.selectDeadlineFromDropdown(0);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.waitMessageToHide();
			await goalsPage.verifyGoalExists(goalName);
		});

		await test.step('Should be able to add key result', async () => {
			await goalsPage.tableRowVisible();
			await goalsPage.clickTableRow(0, goalName);
			await goalsPage.addButtonVisible();
			await goalsPage.clickAddButton(1, goalName);
			await goalsPage.keyResultInputVisible();
			await goalsPage.enterKeyResultNameData(GoalsPageData.keyResultName);
			await goalsPage.keyResultOwnerDropdownVisible();
			await goalsPage.clickKeyResultOwnerDropdown();
			await goalsPage.selectKeyResultOwnerFromDropdown(0);
			await goalsPage.keyResultLeadDropdownVisible();
			await goalsPage.clickKeyResultLeadDropdown();
			await goalsPage.selectKeyResultLeadFromDropdown(0);
			await goalsPage.toggleButtonVisible();
			await goalsPage.clickToggleButton();
			await goalsPage.clickToggleButton();
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to add new deadline', async () => {
			await goalsPage.waitMessageToHide();
			// Saving the key result reloaded the page (accordion collapsed, selection cleared). Re-expand
			// the objective, then select the KEY-RESULT row so the toolbar exposes the key-result View
			// (openKeyResultDetails) — the objective View only opens goal details, which has no deadline UI.
			await goalsPage.clickTableRow(0, goalName);
			await goalsPage.keyResultRowVisible(goalName);
			await goalsPage.clickKeyResultRow(0, goalName);
			await goalsPage.viewButtonVisible();
			await goalsPage.clickViewButton(0);
			await goalsPage.addNewDeadlineButtonVisible();
			await goalsPage.clickAddDeadlineButton();
			await goalsPage.updatedValueInputVisible();
			await goalsPage.enterUpdatedValueData(1);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.saveDeadlineButtonVisible();
			await goalsPage.clickSaveDeadlineButton();
		});

		await test.step('Should be able to add weight parameter', async () => {
			await goalsPage.waitMessageToHide();
			// Closing the key-result details reloaded the page (selection cleared). The Weight (%) toolbar
			// button lives only in the key-result actions template, so re-expand the objective and select
			// the key-result row before it becomes visible.
			await goalsPage.clickTableRow(0, goalName);
			await goalsPage.keyResultRowVisible(goalName);
			await goalsPage.clickKeyResultRow(0, goalName);
			await goalsPage.weightTypeButtonVisible();
			await goalsPage.clickWeightTypeButton(0);
			await goalsPage.weightParameterDropdownVisible();
			await goalsPage.clickWeightParameterDropdown();
			await goalsPage.selectWeightParameterFromDropdown(GoalsPageData.weightParameter);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to edit goal', async () => {
			await goalsPage.waitMessageToHide();
			// A key result is still selected from the weight step, so the toolbar shows the key-result
			// actions. Force the OBJECTIVE actions template so Edit opens the objective (not the key result).
			await goalsPage.ensureObjectiveSelected(0, goalName);
			await goalsPage.editButtonVisible();
			await goalsPage.clickEditButton(0);
			await goalsPage.ownerDropdownVisible();
			await goalsPage.clickOwnerDropdown();
			await goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to delete goal', async () => {
			await goalsPage.waitMessageToHide();
			// Make sure the OBJECTIVE actions template is up so View opens goal details (which hosts the
			// delete action), not the key-result details.
			await goalsPage.ensureObjectiveSelected(0, goalName);
			await goalsPage.viewButtonVisible();
			await goalsPage.clickViewButton(0);
			await goalsPage.deleteButtonVisible();
			await goalsPage.clickDeleteButton();
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.waitMessageToHide();
			await getPage().reload();
			await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
			await getPage().goto('/#/pages/goals');
			// Scope the verify-deleted to OUR goal name: the shared seed can carry objectives from earlier
			// specs/runs, so a blanket empty-grid check would be flaky.
			await goalsPage.verifyElementIsDeleted(goalName);
		});
	});
});
