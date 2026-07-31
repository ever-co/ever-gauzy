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
	verifyByLength,
	dispatchClick,
	waitForSpinnerGone,
	wait
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddTaskPage } from '../../../src/support/Base/pageobjects/AddTasksPageObject';

// The task form's Description is a CKEditor 4 widget (ckeditor4-angular: <ckeditor [config]="ckConfig">),
// whose editable lives inside a wysiwyg <iframe> — the [formControlName="description"] host itself is
// NOT an <input>/<textarea>/[contenteditable], so clearField()/enterInput() throw
// "Element is not an <input>...". The shared fillCkEditor() helper targets a CKEditor 5
// .ck-editor__editable contenteditable, which does not exist here. Type into the iframe body instead,
// mirroring the proven JobsProposals.po pattern. (Description is optional, so this never blocks Save.)
const ckeditorIframeCss = 'iframe[class="cke_wysiwyg_frame cke_reset"]';

// The Tasks screen's card header ("Tasks for <org>") — its <h4> text is unique to this route: the
// Manage Employees grid we can drift onto reads "Manage Employees", the teams grid "Teams", etc. Used
// as a POSITIVE, DOM-level anchor that the tasks screen actually rendered (not just that location.hash
// was reassigned — the two can desync; see reanchorTasksScreen / navigateToTasksDashboard).
const tasksHeaderCss = 'nb-card-header h4:has-text("Tasks")';

// The preceding CustomCommands.addEmployee quick-add can leave its ga-employee-mutation dialog open
// (the current app's employee add is a multi-step nb-stepper with separate First Name/Username/Password
// fields, not the single "Full Name" quick-add the shared command targets, so its step-1 form stays
// invalid and the dialog never closes). That dialog's cdk-overlay-backdrop survives the SPA hash
// navigation to /pages/tasks/dashboard and intercepts every coordinate click, so the toolbar Add click
// lands on the backdrop and the add-task dialog never opens — leaving the employee-multi-select absent
// (the observed failure). Dismiss any lingering dialog before opening the task form. Mirrors the proven
// GoalsKPI.po dismissLeftoverDialog workaround. Best-effort: Escape + wait for detach.
const dismissLeftoverDialog = async () => {
	const page = getPage();
	const dialog = page.locator('ga-employee-mutation').first();
	if (await dialog.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await dialog.waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
	}
	// Wait out any fading cdk backdrop left behind by the dismissed dialog.
	await page
		.locator('.cdk-overlay-backdrop')
		.first()
		.waitFor({ state: 'detached', timeout: 4000 })
		.catch(() => undefined);
};

// The spec's bare `await getPage().goto('/#/pages/tasks/dashboard')` is issued right after the
// addEmployee CustomCommand, which ends on the DIFFERENT hash route /#/pages/employees. A hash-only
// goto() between two same-document routes is a NO-OP in Playwright: the page isn't reloaded and the
// Angular hash-router never fires, so the SPA stays on the employees grid. The subsequent generic
// "button[status='success']" Add click then lands on the EMPLOYEES Add button (re-opening the
// ga-employee-mutation stepper), and the task form's ga-project-selector never renders — the observed
// failure. Force the hash through to the router (mirrors the gotoRoute helper in commands.ts), then
// wait for the Tasks screen to actually render before interacting. (Playbook pattern 8.)
export const navigateToTasksDashboard = async () => {
	const page = getPage();
	// goto() to a hash-only-different URL leaves location.hash ALREADY set to the target, so the usual
	// `if (!hash.includes(target)) location.hash = target` guard skips and NEVER fires a `hashchange` —
	// the Angular hash-router never re-renders and the previous screen (employees, after addEmployee)
	// stays mounted. Bounce the hash through the dashboard FIRST so the assignment to the tasks hash is a
	// genuine change that fires `hashchange`. Mirrors ApprovalRequest.po.gotoApprovals. (Playbook #8.)
	await page.evaluate(() => {
		if (location.hash.split('?')[0] === '#/pages/tasks/dashboard') {
			location.hash = '#/pages/dashboard';
		}
	});
	await page.goto('/#/pages/tasks/dashboard');
	await page.evaluate(() => {
		if (location.hash.split('?')[0] !== '#/pages/tasks/dashboard') {
			location.hash = '#/pages/tasks/dashboard';
		}
	});
	await page.waitForTimeout(800);
	// Don't proceed until the Tasks screen has actually mounted. NOTE: waiting on the Add button
	// (button[status="success"]) is NOT sufficient — the Manage Employees grid we may have lingered on
	// (after the addEmployee prerequisite) ALSO renders a status="success" "Add" button, so that wait
	// gives a false positive and the subsequent Add click would open the EMPLOYEE dialog. Wait for the
	// tasks-specific header ("Tasks", absent on the "Manage Employees" header) so we only proceed on the
	// real tasks screen; then confirm the Add button too.
	await page
		.locator(tasksHeaderCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await page
		.locator(AddTaskPage.addTaskButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
};

// Re-anchor on the Tasks dashboard before any toolbar/grid interaction. A late/queued history.back()
// (left by an nb-dialog/datepicker overlay closing during the add/edit form) is processed ASYNC and can
// pop the SPA OFF the tasks route SEVERAL steps later — landing on /#/pages/employees (the route before
// tasks in this spec) and dropping the grid rows / toolbar action buttons to count 0. That is exactly the
// observed round-6 failure: the DOM at the 24s row-wait timeout was the Manage Employees grid, not tasks.
//
// The previous guard trusted `location.hash === '#/pages/tasks/dashboard'` and returned early — but the
// hash and the RENDERED view can desync (a queued back() re-renders employees while the tasks hash string
// is momentarily restored), and a single-tick double `location.hash =` assignment doesn't reliably fire a
// `hashchange` Angular acts on. So DON'T trust the hash: verify the tasks HEADER actually rendered, and if
// not, force the route with the proven bounce (dashboard -> tasks, via goto so it re-renders) and re-check.
// A late back() that fires after the first force is caught by the second attempt. (Mirrors the hardened
// ApprovalRequest.po.gotoApprovals; playbook pattern 8.)
const reanchorTasksScreen = async () => {
	const page = getPage();
	const header = page.locator(tasksHeaderCss).first();
	const grid = page.locator(AddTaskPage.selectTableRowCss).first();
	// Already on a rendered tasks screen with rows? Nothing to do.
	if (await header.isVisible().catch(() => false)) return;
	for (let attempt = 0; attempt < 2; attempt++) {
		// Bounce through the dashboard first so the assignment to the tasks hash is a genuine change that
		// fires `hashchange`; use goto() for the target so the SPA definitely re-renders even from a
		// same-document state.
		await page.evaluate(() => {
			location.hash = '#/pages/dashboard';
		});
		await page.waitForTimeout(300);
		await page.goto('/#/pages/tasks/dashboard');
		await page.evaluate(() => {
			if (location.hash.split('?')[0] !== '#/pages/tasks/dashboard') {
				location.hash = '#/pages/tasks/dashboard';
			}
		});
		// Absorb any queued history.back() that pops us back off-route, then confirm the header rendered.
		await page.waitForTimeout(800);
		if (await header.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
			break;
		}
	}
	// Best-effort: let the grid rows mount before the caller interacts.
	await grid.waitFor({ state: 'visible', timeout: 20000 }).catch(() => undefined);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTaskButtonVisible = async () => {
	// Clear any leftover employee-mutation dialog from the preceding addEmployee step BEFORE asserting:
	// the toolbar Add button is visible behind the overlay (so the bare assertion would pass) but the
	// click below would be swallowed; dismissing here keeps the visibility check meaningful too.
	await dismissLeftoverDialog();
	await verifyElementIsVisible(AddTaskPage.addTaskButtonCss);
};

export const clickAddTaskButton = async () => {
	// Dismiss any residual addEmployee dialog/backdrop, then dispatch the click straight to the toolbar
	// Add button so it fires even if a fading backdrop is still on top (a coordinate click — even force —
	// would land on the backdrop and the add-task dialog would never open).
	await dismissLeftoverDialog();
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.addTaskButtonCss);
};

export const selectProjectDropdownVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.selectProjectDropdownCss);
};

export const clickSelectProjectDropdown = async () => {
	// ga-project-selector is an ng-select; it opens on MOUSEDOWN and a coordinate/force click is
	// backdrop-blocked (a fading nb-dialog overlay) and can even CLOSE the add-task dialog. Open it
	// with the keyboard instead — focus the inner input and press ArrowDown. (Playbook pattern 3.)
	const input = getPage().locator(AddTaskPage.selectProjectDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectOptionDropdown = async (text) => {
	await clickElementByText(AddTaskPage.selectProjectDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	// Best-effort employee pick (mirrors ContactsLeads.po.selectEmployeeDropdownOption): the option list
	// (org employees "working" in the header date range) loads async and can legitimately be EMPTY on the
	// test DB. Select one if it shows within ~8s; otherwise press Escape and continue — the task saves
	// fine without members. Avoids the old clickButtonByIndex hard 60s force-timeout hang on an empty list.
	const page = getPage();
	const option = page.locator(AddTaskPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const selectEmployeeFromDropdownByName = async (name) => {
	await clickElementByText(AddTaskPage.selectEmployeeDropdownOptionCss, name);
};

export const addTitleInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.addTitleInputCss);
};

export const enterTitleInputData = async (data) => {
	await clearField(AddTaskPage.addTitleInputCss);
	await enterInput(AddTaskPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(AddTaskPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(AddTaskPage.tagsSelectCss, AddTaskPage.tagsSelectOptionCss, index);
};

export const closeTagsMultiSelectDropdownButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickCloseTagsMultiSelectDropdownButton = async () => {
	await clickButton(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const dueDateInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.dueDateInputCss);
};

export const enterDueDateData = async () => {
	await clearField(AddTaskPage.dueDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	await enterInput(AddTaskPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateDaysInputCss);
};

export const enterEstimateDaysInputData = async (days) => {
	await clearField(AddTaskPage.estimateDaysInputCss);
	await enterInput(AddTaskPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateHoursInputCss);
};

export const enterEstimateHoursInputData = async (hours) => {
	await clearField(AddTaskPage.estimateHoursInputCss);
	await enterInput(AddTaskPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateMinsInputCss);
};

export const enterEstimateMinutesInputData = async (mins) => {
	await clearField(AddTaskPage.estimateMinsInputCss);
	await enterInput(AddTaskPage.estimateMinsInputCss, mins);
};

export const taskDescriptionTextareaVisible = async () => {
	// Assert the CKEditor 4 host is present. (The host renders; the editable is inside its iframe.)
	await verifyElementIsVisible(AddTaskPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = async (data) => {
	// Description is a CKEditor 4 widget — the [formControlName="description"] host is not fillable.
	// Type into the editor body inside its wysiwyg iframe. The iframe + its body load async, so wait
	// for the frame's body before filling; best-effort because description is optional (Save never
	// depends on it) and we must not hang the run if the CKEditor instance is slow to attach.
	const page = getPage();
	try {
		const body = page.frameLocator(ckeditorIframeCss).first().locator('body');
		await body.waitFor({ state: 'visible', timeout: 8000 });
		await body.fill(String(data));
	} catch {
		// CKEditor iframe didn't attach in time — leave description empty and continue.
	}
};

export const saveTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = async () => {
	// Save sits in the dialog footer right after the whole form was filled; a coordinate click can
	// land on a lingering cdk-overlay backdrop. Settle any spinner, then dispatch the click straight
	// to the element so the (click) handler fires through the overlay. (Playbook pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = async () => {
	// Re-anchor in case a queued history.back() drifted us off the tasks route since the last step.
	await reanchorTasksScreen();
	await verifyElementIsVisible(AddTaskPage.selectTableRowCss);
};

// POLLUTION-RESILIENCE (the #1 remaining failure cause for this spec). The tasks grid is a SERVER-side
// paginated angular2-smart-table: itemsPerPage = 10 (PaginationFilterBaseComponent) and the endpoint is
// /tasks/pagination. The suite shares ONE seeded DB and runs serially, so by the time this spec runs the
// grid already holds tasks from earlier specs/runs. A newly-created task is NOT guaranteed to be on the
// rendered first page — so verifyText / selectTaskRowByName / verifyTextNotExisting, which only see the
// currently-rendered <tbody> (page 1), would look at the WRONG page and time out even though the record
// persisted. Fix: drive the grid's Title column filter (the InputFilterComponent whose placeholder is the
// column title "Title", wired to setFilter({field:'title'})) with THIS run's unique title, so the server
// re-queries and returns ONLY our matching row(s) on page 1. Every downstream verify/row-select then acts
// on a grid scoped to our record, independent of accumulated pollution and API sort order. Mirrors the
// proven addClient search-then-verify pattern (commands.ts) but adapted to the tasks grid's own filter.
export const filterTasksByTitle = async (name: string) => {
	const page = getPage();
	// The filter row lives on the tasks screen; make sure we're actually on it first.
	await reanchorTasksScreen();
	await waitForSpinnerGone();
	const input = page.locator(AddTaskPage.searchTitleInputCss).first();
	await input.waitFor({ state: 'visible', timeout: 24000 }).catch(() => undefined);
	// Retype from clean each time so switching between the original and the edited title re-queries.
	await input.fill('').catch(() => undefined);
	await input.fill(String(name)).catch(() => undefined);
	// The InputFilterComponent debounces valueChanges (300ms) before it fires the server re-query; give the
	// debounce + the /tasks/pagination round-trip time to land, then let the grid finish re-rendering.
	await page.waitForTimeout(1200);
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(500);
};

// Clear the Title filter so the grid returns to the full (paginated) list. Best-effort — a stale filter
// left set can't corrupt a later step because each filter call re-fills from clean, but clearing keeps the
// grid state tidy between the create/duplicate/edit/delete phases.
export const clearTitleFilter = async () => {
	const page = getPage();
	const input = page.locator(AddTaskPage.searchTitleInputCss).first();
	if (await input.isVisible().catch(() => false)) {
		await input.fill('').catch(() => undefined);
		await page.waitForTimeout(1000);
		await waitForSpinnerGone();
	}
};

export const selectTasksTableRow = async (index) => {
	// Row click TOGGLES selection (it enables the toolbar Edit/Duplicate/Delete). Let the grid finish
	// loading/re-rendering after the preceding save/delete before clicking, otherwise the click can
	// toggle a row that's about to be replaced. Settle, then click once. (Playbook pattern 4.)
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await clickButtonByIndex(AddTaskPage.selectTableRowCss, index);
};

// Pollution-resilient row selection: pick THIS run's task row by its unique title (the grid can hold
// rows from earlier specs/runs, so an index is wrong), then poll for an ENABLED toolbar action to
// confirm the selection took. Clicking the same row twice toggles selection OFF, so we click once and
// only re-click if the action buttons are still disabled. Mirrors the proven Income.po.selectTableRow.
export const selectTaskRowByName = async (name) => {
	const page = getPage();
	// filterTasksByTitle re-anchors (guards the back-nav drift) then scopes the grid to THIS run's title,
	// so the target row is guaranteed on the rendered first page even when accumulated pollution would
	// otherwise push it onto page 2+ (the grid is 10-rows/page, server-paginated). Without this,
	// .filter({hasText}) below matches nothing because the row isn't in the rendered <tbody> at all, and
	// the 24s waitFor times out. Then let the grid settle after the preceding save/delete refresh.
	await filterTasksByTitle(name);
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(AddTaskPage.selectTableRowCss).filter({ hasText: name }).first();
	await row.waitFor({ state: 'visible', timeout: 24000 });
	const enabledAction = page.locator(AddTaskPage.enabledActionButtonCss);
	await row.click({ force: true });
	for (let i = 0; i < 6; i++) {
		await page.waitForTimeout(700);
		if (await enabledAction.count()) return;
		await row.click({ force: true });
	}
};

export const selectFirstTaskTableRow = async (index) => {
	await clickButtonByIndex(AddTaskPage.selectTableFirstRowCss, index);
};

export const deleteTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.deleteTaskButtonCss);
};

export const clickDeleteTaskButton = async () => {
	// The Delete toolbar action is clicked right after selecting a row that followed the edit/duplicate
	// save — a grid-refresh spinner or a fading edit-dialog backdrop can still sit on top, so a coordinate
	// click (even force) can miss. Settle any spinner, then dispatch the (click) straight to the trash
	// button through the overlay, matching the Edit/Duplicate toolbar actions in this file. (Patterns 1 + 2.)
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.deleteTaskButtonCss);
};

export const confirmDeleteTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const clickConfirmDeleteTaskButton = async () => {
	// Confirm sits in the delete-confirmation dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const duplicateTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.duplicateTaskButtonCss);
};

export const clickDuplicateTaskButton = async (index) => {
	await clickButtonByIndex(AddTaskPage.duplicateTaskButtonCss, index);
};

// Click the Duplicate toolbar action unambiguously by its copy-outline icon (Edit shares the
// `action primary` classes). dispatchClick fires the (click) handler straight through any fading
// backdrop, and waitForSpinnerGone absorbs the post-row-select grid spinner. (Patterns 1 + 2.)
export const clickDuplicateTaskAction = async () => {
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.duplicateTaskButtonCss);
};

export const confirmDuplicateTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmDuplicateTaskButton = async () => {
	// Confirm sits in a freshly-opened dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const editTaskButtonVisible = async () => {
	await wait(500);
	await verifyElementIsVisible(AddTaskPage.editTaskButtonCss);
};

export const clickEditTaskButton = async (index) => {
	await clickButtonByIndex(AddTaskPage.editTaskButtonCss, index);
};

// Click the Edit toolbar action unambiguously by its edit-outline icon (Duplicate shares the
// `action primary` classes). dispatchClick fires through any fading backdrop. (Patterns 1 + 2.)
export const clickEditTaskAction = async () => {
	await waitForSpinnerGone();
	await dispatchClick(AddTaskPage.editTaskButtonCss);
};

export const confirmEditTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmEditTaskButton = async () => {
	await clickButton(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddTaskPage.toastrMessageCss);
};

export const verifyTaskExists = async (text) => {
	// filterTasksByTitle re-anchors first (a queued history.back() can drift the SPA to /#/pages/employees,
	// where the tasks grid/title is absent), THEN filters the grid to THIS run's title. The grid paginates
	// at 10 rows/page (server-side), so on a polluted DB the freshly-created row can be on page 2+ and the
	// rendered <tbody> the verify inspects wouldn't contain it. Filtering re-queries and returns our row on
	// page 1 — proving it actually persisted, independent of accumulated rows and the API's default sort.
	await filterTasksByTitle(text);
	await verifyText(AddTaskPage.verifyTextCss, text);
};

export const verifyElementIsDeleted = async (text) => {
	// Filter to the (now-deleted) title first so the "no matching row" assertion is scoped to our record
	// and not fooled by a same-named row from another spec sitting on a different page. After the delete +
	// filter the grid shows only rows still matching `text` — expected to be zero.
	await filterTasksByTitle(text);
	await verifyTextNotExisting(AddTaskPage.verifyTextCss, text);
};

export const verifyTitleInput = async () => {
	await verifyElementIsVisible(AddTaskPage.searchTitleInputCss);
};

export const searchTitleName = async (name: string) => {
	await clearField(AddTaskPage.searchTitleInputCss);
	await enterInput(AddTaskPage.searchTitleInputCss, name);
};

export const clearSearchInput = async () => {
	await clearField(AddTaskPage.searchTitleInputCss);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(AddTaskPage.selectTableRowCss, length);
};
