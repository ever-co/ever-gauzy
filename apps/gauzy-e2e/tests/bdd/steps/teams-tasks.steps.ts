import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as loginPage from '../../support/pages/Login.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import * as teamsTasksPage from '../../support/pages/TeamsTasks.po';
import { TeamsTasksPageData } from '../../../src/support/Base/pagedata/TeamsTasksPageData';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../support/commands';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationTeamsPage from '../../support/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../../../src/support/Base/pagedata/OrganizationTeamsPageData';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain TeamsTasksTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts. The two identically-labelled
// "Should be able to delete task" test.steps are given distinct, feature-specific step wording
// (delete the duplicated / delete the edited team task) so the Gherkin text stays unique.

// Unique per-run task titles. The suite shares ONE stateful DB and runs SERIALLY (CI too), so the
// STATIC pagedata titles collide with rows this same spec left on an earlier run — and they are BYTE-FOR-BYTE
// identical to AddTasksPageData's titles, so the two specs' rows can co-mingle in the shared task table. A
// faker suffix makes EVERY downstream row-select / verify-exists / verify-deleted scope to THIS run's task
// only (order-independent) and, crucially, makes the final verifyTaskIsDeleted's count-0 assertion immune to
// a leftover same-base-title row from a prior run. Mirrors the proven AddTasksTest.spec pattern. (Round 6 —
// pollution resilience is the #1 remaining failure cause.)
let taskTitle = ' ';
let editedTaskTitle = ' ';

// Dismiss any leftover add-mutation dialog + let its fading cdk-overlay-backdrop fully detach before the
// next screen opens a dialog. Mirrors the inline cleanup the proven-passing OrganizationTeamsTest does prior
// to opening the team dialog: a surviving backdrop from addTag's ngx-tags-mutation lands a delayed backdrop
// click that closes the team-mutation nb-dialog (closeOnBackdropClick:true) mid-fill. Best-effort throughout
// so it never blocks the run.
const settleLeftoverOverlays = async () => {
	const page = getPage();
	for (let i = 0; i < 3 && (await page.locator('ngx-tags-mutation').count()) > 0; i++) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await page
			.locator('ngx-tags-mutation')
			.first()
			.waitFor({ state: 'detached', timeout: 4000 })
			.catch(() => undefined);
	}
	// Wait for the fading backdrop overlay itself to detach — the input can be gone while the overlay is
	// still animating out, and that overlay is what closes the next dialog.
	await page
		.locator('.cdk-overlay-backdrop')
		.first()
		.waitFor({ state: 'detached', timeout: 4000 })
		.catch(() => undefined);
};

// Was a team with `name` actually created? Read the teams grid (force the hash + settle) and check for a row
// containing the name. Used to decide whether addTeam's dialog got killed by a fading backdrop and must be
// retried. Best-effort/boolean — never throws.
const teamRowExists = async (name: string): Promise<boolean> => {
	const page = getPage();
	await page.goto('/#/pages/organization/teams');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/organization/teams')) {
			location.hash = '#/pages/organization/teams';
		}
	});
	await page.waitForTimeout(800);
	return page
		.locator('table > tbody > tr.angular2-smart-row')
		.filter({ hasText: name })
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.then(() => true)
		.catch(() => false);
};

When('I add a new team task', async () => {
	taskTitle = `${TeamsTasksPageData.defaultTaskTitle} ${faker.string.uuid()}`;
	editedTaskTitle = `${TeamsTasksPageData.editTaskTitle} ${faker.string.uuid()}`;

	await CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
	await CustomCommands.addTag(
		organizationTagsUserPage,
		OrganizationTagsPageData
	);
	// ROOT CAUSE of the round-1..6 TeamsTasksTest failure (dump: dialog gone + "You have not created
	// any teams." + timeout on the manager nb-select): addTeam runs right after addTag, which only
	// BEST-EFFORT-detaches its ngx-tags-mutation dialog. A still-fading cdk-overlay-backdrop from that
	// tags dialog survives addTeam's gotoRoute, then lands a delayed backdrop click on the freshly
	// opened ga-teams-mutation nb-dialog (closeOnBackdropClick:true) — closing it mid-fill, so the
	// manager multi-select is never reached and NO team is created. addTeam is a shared CustomCommand
	// (can't edit); the proven-passing OrganizationTeamsTest avoids this by dismissing the leftover tags
	// dialog + waiting for its overlay to detach BEFORE opening the team dialog. Replicate that cleanup
	// here (spec-local), then verify a team actually persisted and retry addTeam once if the dialog got
	// killed on the first pass — so the prerequisite is deterministic regardless of backdrop timing.
	await settleLeftoverOverlays();
	await CustomCommands.addTeam(
		organizationTeamsPage,
		OrganizationTeamsPageData
	);
	// Confirm the team persisted (its row appears in the grid). If the fading backdrop still closed the
	// dialog before Save, no row exists — clean up and add it again once.
	if (!(await teamRowExists(OrganizationTeamsPageData.name))) {
		await settleLeftoverOverlays();
		await CustomCommands.addTeam(
			organizationTeamsPage,
			OrganizationTeamsPageData
		);
	}
	// A bare goto('/#/pages/tasks/team') right after addTeam (which ends on
	// /#/pages/organization/teams) is a same-document hash NO-OP: the SPA stays on the teams grid
	// and the Add click would re-open the teams dialog, so ga-project-selector never renders. Force
	// the hash through the router and wait for the Team's Tasks screen to mount. (Playbook pattern 8.)
	await teamsTasksPage.navigateToTeamsTasks();
	await teamsTasksPage.gridBtnExists();
	await teamsTasksPage.gridBtnClick(1);
	await teamsTasksPage.addTaskButtonVisible();
	await teamsTasksPage.clickAddTaskButton();
	await teamsTasksPage.selectProjectDropdownVisible();
	await teamsTasksPage.clickSelectProjectDropdown();
	await teamsTasksPage.selectProjectOptionDropdown(
		TeamsTasksPageData.defaultTaskProject
	);
	await teamsTasksPage.selectStatusDropdownVisible();
	await teamsTasksPage.clickStatusDropdown();
	await teamsTasksPage.selectStatusFromDropdown(
		TeamsTasksPageData.defaultStatus
	);
	await teamsTasksPage.selectTeamDropdownVisible();
	await teamsTasksPage.clickSelectTeamDropdown();
	await teamsTasksPage.selectTeamDropdownOption(0);
	await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
	await teamsTasksPage.addTitleInputVisible();
	await teamsTasksPage.enterTitleInputData(taskTitle);
	await teamsTasksPage.tagsMultiSelectVisible();
	await teamsTasksPage.clickTagsMultiSelect();
	await teamsTasksPage.selectTagsFromDropdown(0);
	await teamsTasksPage.clickCardBody();
	await teamsTasksPage.dueDateInputVisible();
	await teamsTasksPage.enterDueDateData();
	await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
	await teamsTasksPage.estimateDaysInputVisible();
	await teamsTasksPage.enterEstimateDaysInputData(
		TeamsTasksPageData.defaultTaskEstimateDays
	);
	await teamsTasksPage.estimateHoursInputVisible();
	await teamsTasksPage.enterEstimateHoursInputData(
		TeamsTasksPageData.defaultTaskEstimateHours
	);
	await teamsTasksPage.estimateMinutesInputVisible();
	await teamsTasksPage.enterEstimateMinutesInputData(
		TeamsTasksPageData.defaultTaskEstimateMinutes
	);
	await teamsTasksPage.taskDescriptionTextareaVisible();
	await teamsTasksPage.enterTaskDescriptionTextareaData(
		TeamsTasksPageData.defaultTaskDescription
	);
	await teamsTasksPage.saveTaskButtonVisible();
	await teamsTasksPage.clickSaveTaskButton();
	await teamsTasksPage.waitMessageToHide();
	await teamsTasksPage.verifyTaskExists(taskTitle);
});

When('I duplicate the team task', async () => {
	await teamsTasksPage.tasksTableVisible();
	// Pollution-resilient: select THIS run's row by its unique title (the shared grid can hold rows
	// from earlier specs/runs, so index 0 would grab the wrong row). (Round 5.)
	await teamsTasksPage.selectTaskRowByName(taskTitle);
	await teamsTasksPage.duplicateOrEditTaskButtonVisible();
	await teamsTasksPage.clickDuplicateOrEditTaskButton(0);
	await teamsTasksPage.confirmDuplicateOrEditTaskButtonVisible();
	await teamsTasksPage.clickConfirmDuplicateOrEditTaskButton();
});

When('I delete the duplicated team task', async () => {
	await teamsTasksPage.waitMessageToHide();
	await teamsTasksPage.tasksTableVisible();
	// One of the two identical-title rows from the duplicate step — delete it by title, not index.
	await teamsTasksPage.selectTaskRowByName(taskTitle);
	await teamsTasksPage.deleteTaskButtonVisible();
	await teamsTasksPage.clickDeleteTaskButton();
	await teamsTasksPage.confirmDeleteTaskButtonVisible();
	await teamsTasksPage.clickConfirmDeleteTaskButton();
});

When('I edit the team task', async () => {
	await teamsTasksPage.waitMessageToHide();
	await teamsTasksPage.tasksTableVisible();
	// Select the remaining original task by title to edit it.
	await teamsTasksPage.selectTaskRowByName(taskTitle);
	await teamsTasksPage.duplicateOrEditTaskButtonVisible();
	await teamsTasksPage.clickDuplicateOrEditTaskButton(1);
	await teamsTasksPage.selectProjectDropdownVisible();
	await teamsTasksPage.clickSelectProjectDropdown();
	await teamsTasksPage.selectProjectOptionDropdown(
		TeamsTasksPageData.defaultTaskProject
	);
	await teamsTasksPage.addTitleInputVisible();
	await teamsTasksPage.enterTitleInputData(editedTaskTitle);
	await teamsTasksPage.dueDateInputVisible();
	await teamsTasksPage.enterDueDateData();
	await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
	await teamsTasksPage.estimateDaysInputVisible();
	await teamsTasksPage.enterEstimateDaysInputData(
		TeamsTasksPageData.defaultTaskEstimateDays
	);
	await teamsTasksPage.estimateHoursInputVisible();
	await teamsTasksPage.enterEstimateHoursInputData(
		TeamsTasksPageData.defaultTaskEstimateHours
	);
	await teamsTasksPage.estimateMinutesInputVisible();
	await teamsTasksPage.enterEstimateMinutesInputData(
		TeamsTasksPageData.defaultTaskEstimateMinutes
	);
	await teamsTasksPage.taskDescriptionTextareaVisible();
	await teamsTasksPage.enterTaskDescriptionTextareaData(
		TeamsTasksPageData.defaultTaskDescription
	);
	await teamsTasksPage.saveTaskButtonVisible();
	await teamsTasksPage.clickSaveTaskButton();
	await teamsTasksPage.waitMessageToHide();
	await teamsTasksPage.verifyTaskExists(editedTaskTitle);
});

When('I delete the edited team task', async () => {
	await teamsTasksPage.waitMessageToHide();
	await teamsTasksPage.tasksTableVisible();
	// Delete the just-edited task by its unique title (not index). (Round 5.)
	await teamsTasksPage.selectTaskRowByName(editedTaskTitle);
	await teamsTasksPage.deleteTaskButtonVisible();
	await teamsTasksPage.clickDeleteTaskButton();
	await teamsTasksPage.confirmDeleteTaskButtonVisible();
	await teamsTasksPage.clickConfirmDeleteTaskButton();
	await teamsTasksPage.waitMessageToHide();
	// Scope the deleted-check to the edited task's title (the row we just removed) so leftover rows
	// from intra-run pollution don't flake the assertion. (Round 3 anti-pollution guidance.)
	await teamsTasksPage.verifyTaskIsDeleted(editedTaskTitle);
});
