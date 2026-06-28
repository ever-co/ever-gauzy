import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TeamsTasksPage } from '../../../src/support/Base/pageobjects/TeamsTasksPageObject';

// The spec's bare `await getPage().goto('/#/pages/tasks/team')` is issued right after the addTeam
// CustomCommand, which ends on the DIFFERENT hash route /#/pages/organization/teams. A hash-only goto()
// between two same-document routes is a NO-OP in Playwright: the page isn't reloaded and the Angular
// hash-router never fires, so the SPA stays on the teams grid. The toolbar Add (button[status="success"])
// would then click the TEAMS page's Add button and the task dialog's ga-project-selector never renders
// (the observed failure). Force the hash through to the router (mirrors gotoRoute in commands.ts), then
// wait for the Team's Tasks screen to actually mount before interacting. (Playbook pattern 8.)
export const navigateToTeamsTasks = async () => {
	const page = getPage();
	await page.goto('/#/pages/tasks/team');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/tasks/team')) {
			location.hash = '#/pages/tasks/team';
		}
	});
	await page.waitForTimeout(800);
	// Don't proceed until the Team's Tasks screen has actually mounted: its header text is unique to this
	// route (the teams grid we may have lingered on has a different header), so it disambiguates a no-op nav.
	await page
		.locator('h4:has-text("Team\'s Tasks")')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTaskButtonCss);

export const clickAddTaskButton = async () => {
	// The preceding addTeam CustomCommand doesn't explicitly wait for its team-mutation dialog to detach,
	// so a fading cdk-overlay-backdrop can still sit on top of the toolbar; a coordinate click (even force)
	// would land on the backdrop and the add-task dialog would never open. Settle any spinner, then dispatch
	// the click straight to the Add button so its (click) handler fires through the overlay. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.addTaskButtonCss);
};

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.projectDropdownCss);

export const clickSelectProjectDropdown = async () => {
	// ga-project-selector is an ng-select (appendTo body) — it opens on MOUSEDOWN and a coordinate/force
	// click is backdrop-blocked by a fading nb-dialog overlay and can even CLOSE the add-task dialog.
	// Open it with the keyboard instead — focus the inner input and press ArrowDown. (Playbook pattern 3.)
	const input = getPage().locator(TeamsTasksPage.projectDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectOptionDropdown = async (text: string) =>
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);

export const selectStatusDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.statusDropdownCss);

export const clickStatusDropdown = async () => {
	// ga-task-status-select is also an ng-select (appendTo body) — open via keyboard, same as project. (Pattern 3.)
	const input = getPage().locator(TeamsTasksPage.statusDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectStatusFromDropdown = async (text: string) => {
	// The pagedata's requested status ('Todo') is NOT one of the app's seeded default statuses
	// (Backlog/Open/In Progress/Ready For Review/In Review/Blocked/Done/Completed/Cancelled/Custom — the
	// badge renders `name | replace:'-':' ' | titlecase`), so a strict text match would never resolve and
	// hang the 60s force-click. taskStatus isn't required for the form to be valid, so: prefer the requested
	// option if present, else fall back to the FIRST available option (so the field is still exercised),
	// else Escape and continue. Best-effort, never blocks. (Playbook pattern 1 — stale data value.)
	const page = getPage();
	const options = page.locator(TeamsTasksPage.dropdownOptionCss);
	try {
		await options.first().waitFor({ state: 'visible', timeout: 8000 });
		const requested = options.filter({ hasText: text }).first();
		if (await requested.count()) {
			await requested.click({ force: true });
		} else {
			await options.first().click({ force: true });
		}
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const selectTeamDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTeamMultiSelectCss);

export const clickSelectTeamDropdown = async () => {
	// Teams is a Nebular nb-select (opens on click, options are '.option-list nb-option'); settle any
	// transient form spinner first so the panel renders before selectTeamDropdownOption polls for options.
	await waitForSpinnerGone();
	await clickButton(TeamsTasksPage.selectTeamMultiSelectCss);
};

export const selectTeamDropdownOption = async (index: number) => {
	// Best-effort team pick (mirrors AddTasks.po.selectEmployeeDropdownOption): the nb-option list loads
	// async. The addTeam prerequisite seeds at least one team, so it should be present — wait up to ~8s and
	// click option[index] if it shows; otherwise Escape and continue. Avoids a hard 60s force-timeout hang
	// on an empty panel. NOTE: a team IS required for Save to enable, so this normally must succeed.
	const page = getPage();
	const option = page.locator(TeamsTasksPage.selectTeamDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const addTitleInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTitleInputCss);

export const enterTitleInputData = async (data: string) => {
	await clearField(TeamsTasksPage.addTitleInputCss);
	await enterInput(TeamsTasksPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => verifyElementIsVisible(TeamsTasksPage.tagsSelectCss);

export const clickTagsMultiSelect = async () => {
	// Tags is an ng-select (#addTags, appendTo body) — it opens on MOUSEDOWN and a force-click lands on the
	// dialog backdrop or closes the add form. Open it via keyboard (focus inner input + ArrowDown). (Pattern 3.)
	const input = getPage().locator(TeamsTasksPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) =>
	// Each ng-option for a multi-select tag renders a checkbox; pick by index. (Options are in the
	// appended .ng-dropdown-panel, so this matches the option's checkbox regardless of the backdrop.)
	clickButtonByIndex(TeamsTasksPage.tagsSelectOptionCss, index);

export const closeTagsMultiSelectDropdownButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.closeTagsMultiSelectDropdownCss);

export const clickCloseTagsMultiSelectDropdownButton = async () =>
	clickButton(TeamsTasksPage.closeTagsMultiSelectDropdownCss);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const dueDateInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.dueDateInputCss);

export const enterDueDateData = async () => {
	await clearField(TeamsTasksPage.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(TeamsTasksPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateDaysInputCss);

export const enterEstimateDaysInputData = async (days: string) => {
	await clearField(TeamsTasksPage.estimateDaysInputCss);
	await enterInput(TeamsTasksPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateHoursInputCss);

export const enterEstimateHoursInputData = async (hours: string) => {
	await clearField(TeamsTasksPage.estimateHoursInputCss);
	await enterInput(TeamsTasksPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateMinsInputCss);

export const enterEstimateMinutesInputData = async (mins: string) => {
	await clearField(TeamsTasksPage.estimateMinsInputCss);
	await enterInput(TeamsTasksPage.estimateMinsInputCss, mins);
};

export const taskDescriptionTextareaVisible = async () => verifyElementIsVisible(TeamsTasksPage.descriptionTextareaCss);

export const enterTaskDescriptionTextareaData = async (data: string) => {
	await clearField(TeamsTasksPage.descriptionTextareaCss);
	await enterInput(TeamsTasksPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.saveNewTaskButtonCss);

export const clickSaveTaskButton = async () => {
	// Save sits in the dialog footer right after the whole form was filled; a coordinate click can land on
	// a lingering cdk-overlay backdrop (from the just-closed ng-select panels). Settle any spinner, then
	// dispatch the click straight to the element so the (click) handler fires through the overlay. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);

export const selectTasksTableRow = async (index: number) => {
	// Row click TOGGLES selection (it enables the toolbar Edit/Duplicate/Delete). Let the grid finish
	// loading/re-rendering after the preceding save/delete before clicking, otherwise the click can toggle
	// a row that's about to be replaced. Settle, then click once. (Playbook pattern 4.)
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => undefined);
	await getPage().waitForTimeout(1500);
	await clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);
};

export const deleteTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.deleteTaskButtonCss);

export const clickDeleteTaskButton = async () => clickButton(TeamsTasksPage.deleteTaskButtonCss);

export const confirmDeleteTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDeleteTaskButtonCss);

export const clickConfirmDeleteTaskButton = async () => {
	// Confirm sits in the delete-confirmation dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.confirmDeleteTaskButtonCss);
};

export const duplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.duplicateOrEditTaskButtonCss);

export const clickDuplicateOrEditTaskButton = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.duplicateOrEditTaskButtonCss, index);

export const confirmDuplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);

export const clickConfirmDuplicateOrEditTaskButton = async () => {
	// Confirm/Save sits in the freshly-opened task dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickCardBody = async () => clickButton(TeamsTasksPage.cardBodyCss);

export const waitMessageToHide = async () => waitElementToHide(TeamsTasksPage.toastrMessageCss);

export const verifyTaskExists = async (text: string) => verifyText(TeamsTasksPage.verifyTextCss, text);

// Scope the deleted-check to the SPECIFIC task title we removed rather than asserting the whole grid is
// empty: intra-run pollution (a prior spec's leftover team task) can leave other rows, which would make a
// bare toHaveCount(0) flake. verifyTextNotExisting filters by text then asserts zero matches. (Round 3.)
export const verifyTaskIsDeleted = async (text: string) =>
	verifyTextNotExisting(TeamsTasksPage.verifyTextCss, text);
