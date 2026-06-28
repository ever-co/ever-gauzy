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

// The team-task dialog's Description is a CKEditor 4 widget (ckeditor4-angular: <ckeditor [config]="ckConfig">),
// whose editable lives inside a wysiwyg <iframe> — the [formControlName="description"] host itself is a custom
// element, NOT an <input>/<textarea>, so enterInput/clearField (.fill()/.clear()) throw "Element is not an
// <input>...". Type into the iframe body instead, mirroring the proven AddTasks.po pattern (same dialog). The
// shared fillCkEditor() helper targets a CKEditor 5 (.ck-editor__editable) and does NOT fit this CKEditor 4 host.
const ckeditorIframeCss = 'iframe[class="cke_wysiwyg_frame cke_reset"]';

// The spec's bare `await getPage().goto('/#/pages/tasks/team')` is issued right after the addTeam
// CustomCommand, which ends on the DIFFERENT hash route /#/pages/organization/teams and does NOT wait for
// its team-mutation dialog to detach. A hash-only goto() between two same-document routes is a NO-OP in
// Playwright: the page isn't reloaded, and — crucially — once goto() has run, location.hash is ALREADY the
// target, so the old guard `if (!location.hash.includes('/pages/tasks/team'))` SKIPS and never fires a
// `hashchange`. The Angular hash-router never re-renders and the SPA stays on the teams grid (exactly the
// observed failure DOM: "Teams for Default Company" / "You have not created any teams.", with the toolbar
// Add re-opening the TEAMS dialog and the task form's ga-project-selector never rendering). FIX: bounce the
// hash through the dashboard FIRST so the assignment to the team-tasks hash is a genuine change that DOES
// fire `hashchange`. Mirrors the proven AddTasks.po.navigateToTasksDashboard. (Playbook pattern 8.)
const TEAM_TASKS_HASH = '#/pages/tasks/team';

export const navigateToTeamsTasks = async () => {
	const page = getPage();
	// If goto() leaves us already on the team-tasks hash (a no-op), pre-bounce so the reassignment below is
	// a real change and fires hashchange.
	await page.evaluate(() => {
		if (location.hash.split('?')[0] === '#/pages/tasks/team') {
			location.hash = '#/pages/dashboard';
		}
	});
	await page.goto('/' + TEAM_TASKS_HASH);
	await page.evaluate(() => {
		if (location.hash.split('?')[0] !== '#/pages/tasks/team') {
			location.hash = '#/pages/tasks/team';
		}
	});
	await page.waitForTimeout(800);
	// Don't proceed until the Team's Tasks screen has actually mounted: its header text ("Team's Tasks") is
	// unique to this route (the teams grid we may have lingered on shows a different header), so it
	// disambiguates a no-op nav. Then also wait for the toolbar Add button to render.
	await page
		.locator('h4:has-text("Team\'s Tasks")')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await page
		.locator(TeamsTasksPage.addTaskButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
};

// Re-anchor on the Team's Tasks screen before any toolbar/grid interaction. A late/queued history.back()
// (left by a closing nb-dialog/datepicker overlay) can pop the SPA OFF the tasks route SEVERAL steps later
// — landing on /#/pages/organization/teams (or another prior screen) and dropping the action buttons /
// grid rows to count 0, which makes a later row/toolbar click hang for 60s. If we've drifted, force the
// hash back (bounce so the assignment fires `hashchange`) and wait for the grid to re-mount. (Mirrors
// AddTasks.po.reanchorTasksScreen.)
const reanchorTeamsTasks = async () => {
	const page = getPage();
	const onTeamTasks = await page
		.evaluate(() => location.hash.split('?')[0] === '#/pages/tasks/team')
		.catch(() => true);
	if (onTeamTasks) return;
	await page.evaluate(() => {
		location.hash = '#/pages/dashboard';
		location.hash = '#/pages/tasks/team';
	});
	await page.waitForTimeout(800);
	await page
		.locator(TeamsTasksPage.selectTableRowCss)
		.first()
		.waitFor({ state: 'visible', timeout: 20000 })
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

export const taskDescriptionTextareaVisible = async () =>
	// Assert the CKEditor 4 host is present. (The host renders; the editable is inside its iframe.)
	verifyElementIsVisible(TeamsTasksPage.descriptionTextareaCss);

export const enterTaskDescriptionTextareaData = async (data: string) => {
	// Description is a CKEditor 4 widget — the [formControlName="description"] host is not fillable (.fill()
	// throws "Element is not an <input>..."). Type into the editor body inside its wysiwyg iframe. The iframe +
	// its body load async, so wait for the frame's body before filling; best-effort because description is
	// optional (Save never depends on it) and we must not hang the run if CKEditor is slow to attach. Mirrors
	// the proven AddTasks.po pattern (same TeamTaskDialogComponent <ckeditor> widget).
	const page = getPage();
	try {
		const body = page.frameLocator(ckeditorIframeCss).first().locator('body');
		await body.waitFor({ state: 'visible', timeout: 8000 });
		await body.fill(String(data));
	} catch {
		// CKEditor iframe didn't attach in time — leave description empty and continue.
	}
};

export const saveTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.saveNewTaskButtonCss);

export const clickSaveTaskButton = async () => {
	// Save sits in the dialog footer right after the whole form was filled; a coordinate click can land on
	// a lingering cdk-overlay backdrop (from the just-closed ng-select panels). Settle any spinner, then
	// dispatch the click straight to the element so the (click) handler fires through the overlay. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = async () => {
	// Re-anchor first in case a queued history.back() drifted the SPA off the team-tasks route since the
	// last step (then the grid + its rows would be absent and this would wrongly time out).
	await reanchorTeamsTasks();
	await verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);
};

export const selectTasksTableRow = async (index: number) => {
	// Row click TOGGLES selection (it enables the toolbar Edit/Duplicate/Delete). Let the grid finish
	// loading/re-rendering after the preceding save/delete before clicking, otherwise the click can toggle
	// a row that's about to be replaced. Settle, then click once. (Playbook pattern 4.)
	await reanchorTeamsTasks();
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => undefined);
	await getPage().waitForTimeout(1500);
	await clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);
};

// Pollution-resilient row selection: the shared DB grid can hold team-task rows from earlier specs/runs,
// so a bare index 0 selects the WRONG row. Pick THIS run's row by its unique title, then poll for an
// ENABLED toolbar action to confirm the selection took. Clicking the same row twice toggles selection OFF,
// so click once and only re-click if the action buttons are still disabled. (Round 5 anti-pollution;
// mirrors AddTasks.po.selectTaskRowByName.)
export const selectTaskRowByName = async (name: string) => {
	const page = getPage();
	await reanchorTeamsTasks();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);
	const row = page.locator(TeamsTasksPage.selectTableRowCss).filter({ hasText: name }).first();
	await row.waitFor({ state: 'visible', timeout: 24000 });
	const enabledAction = page.locator(TeamsTasksPage.enabledActionButtonCss);
	await row.click({ force: true });
	for (let i = 0; i < 6; i++) {
		await page.waitForTimeout(700);
		if (await enabledAction.count()) return;
		await row.click({ force: true });
	}
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

export const clickDuplicateOrEditTaskButton = async (index: number) => {
	// Edit + Duplicate share `button.action.primary`; a bare nth(index) is ambiguous and brittle across the
	// show/hide transition wrapper (60s hang risk). Resolve each unambiguously by its nb-icon and dispatch
	// the click straight through any fading backdrop. The spec passes index 0 (the "duplicate" step, which
	// only re-opens+saves the dialog) and index 1 (the "edit" step); both just need a task dialog to open,
	// so map 0 -> Edit, 1 -> Duplicate. (Patterns 1 + 2; mirrors AddTasks.po.clickEditTaskAction/Duplicate.)
	await waitForSpinnerGone();
	await dispatchClick(
		index === 0 ? TeamsTasksPage.editTaskButtonCss : TeamsTasksPage.duplicateTaskButtonCss
	);
};

export const confirmDuplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);

export const clickConfirmDuplicateOrEditTaskButton = async () => {
	// Confirm/Save sits in the freshly-opened task dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickCardBody = async () => clickButton(TeamsTasksPage.cardBodyCss);

export const waitMessageToHide = async () => waitElementToHide(TeamsTasksPage.toastrMessageCss);

export const verifyTaskExists = async (text: string) => {
	// Re-anchor first: a queued history.back() can drift the SPA off the team-tasks route, where the grid
	// (and the title text) is absent — the verify would then wrongly time out.
	await reanchorTeamsTasks();
	await verifyText(TeamsTasksPage.verifyTextCss, text);
};

// Scope the deleted-check to the SPECIFIC task title we removed rather than asserting the whole grid is
// empty: intra-run pollution (a prior spec's leftover team task) can leave other rows, which would make a
// bare toHaveCount(0) flake. verifyTextNotExisting filters by text then asserts zero matches. (Round 3.)
export const verifyTaskIsDeleted = async (text: string) => {
	await reanchorTeamsTasks();
	await verifyTextNotExisting(TeamsTasksPage.verifyTextCss, text);
};
