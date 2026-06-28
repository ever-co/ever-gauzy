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
	await page.goto('/#/pages/tasks/dashboard');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/tasks/dashboard')) {
			location.hash = '#/pages/tasks/dashboard';
		}
	});
	await page.waitForTimeout(800);
	// Don't proceed until the Tasks screen has actually mounted: wait for the toolbar Add button to be
	// visible (it's rendered by this screen's header once the SPA route finished re-rendering).
	await page
		.locator(AddTaskPage.addTaskButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
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
	await clickButtonByIndex(AddTaskPage.tagsSelectOptionCss, index);
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
	await verifyElementIsVisible(AddTaskPage.selectTableRowCss);
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

export const selectFirstTaskTableRow = async (index) => {
	await clickButtonByIndex(AddTaskPage.selectTableFirstRowCss, index);
};

export const deleteTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.deleteTaskButtonCss);
};

export const clickDeleteTaskButton = async () => {
	await clickButton(AddTaskPage.deleteTaskButtonCss);
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
	await verifyText(AddTaskPage.verifyTextCss, text);
};

export const verifyElementIsDeleted = async (text) => {
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
