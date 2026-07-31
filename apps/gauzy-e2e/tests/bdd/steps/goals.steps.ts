import { When } from '../../support/bdd';
import { faker } from '@faker-js/faker';
import { getPage } from '../../support/page-context';
import * as loginPage from '../../support/pages/Login.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import * as goalsPage from '../../support/pages/Goals.po';
import { GoalsPageData } from '../../../src/support/Base/pagedata/GoalsPageData';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain GoalsTest.spec.ts: the single test() -> one Scenario, each test.step()
// -> one When step whose body is the verbatim .po call sequence (verification folded in), so runtime
// behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default user`
// Background step is defined once in common.steps.ts. `goalName` is shared across steps, so it lives at
// module scope and is initialised at the start of the first step (one scenario per feature = no bleed).

// POLLUTION RESILIENCE: the suite shares ONE stateful DB and runs serially, so the static
// GoalsPageData.name can collide with objectives left by an earlier spec/run. A faker suffix makes
// THIS run's objective unique, and every downstream select-row / verify-exists / verify-deleted is
// scoped to it (order-independent).
let goalName = ' ';

When('I add a new goal', async () => {
	goalName = `${GoalsPageData.name} ${faker.string.uuid()}`;

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

When('I add a key result to the goal', async () => {
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

When('I add a new deadline to the key result', async () => {
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
	// Dialog-scoped: the update dialog is stacked on the details dialog, so the generic confirm/save
	// selectors are ambiguous and were leaving both overlays open over the toolbar the next step needs.
	await goalsPage.confirmUpdateKeyResultVisible();
	await goalsPage.clickConfirmUpdateKeyResult();
	await goalsPage.saveDeadlineButtonVisible();
	await goalsPage.clickSaveDeadlineButton();
});

When('I add a weight parameter to the key result', async () => {
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

When('I edit the goal', async () => {
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

When('I delete the goal', async () => {
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
