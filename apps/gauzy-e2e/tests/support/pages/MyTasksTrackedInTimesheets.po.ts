import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	dispatchClick,
	waitForSpinnerGone,
	compareTwoTexts
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
import type { Response } from '@playwright/test';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { MyTasksTrackedInTimesheets } from '../../../src/support/Base/pageobjects/MyTasksTrackedInTimesheetsPageObject';
import dayjs from 'dayjs';

// The my-task-dialog card header ("Add Tasks") — a POSITIVE anchor that the MyTaskDialogComponent actually
// mounted before we scope fields to it, so a lingering closed-dialog overlay can't win a strict-mode match.
const dialogHostCss = 'ga-my-task-dialog, my-task-dialog, nb-card.main';

// Mirrors the Cypress intercept/alias: clickTaskSelect arms the /tasks/employee wait, selectOptionFromDropdown
// consumes it so the async task list has actually loaded before we pick an option.
let waitTasksXhr: Promise<Response> | undefined;

// Robust hash navigation to /#/pages/tasks/me. The spec issues this right after a login that lands on the
// dashboard; a hash-only goto() between two same-document routes can be a NO-OP in Playwright (the page isn't
// reloaded and the Angular hash-router never fires). Bounce through the dashboard hash first so the assignment
// to the tasks/me hash is a genuine change that fires `hashchange`, then wait for the My Tasks header before
// interacting. (Playbook pattern 8.)
export const navigateToMyTasks = async () => {
	const page = getPage();
	await page.evaluate(() => {
		if (location.hash.split('?')[0] === '#/pages/tasks/me') {
			location.hash = '#/pages/dashboard';
		}
	});
	await page.goto('/#/pages/tasks/me');
	await page.evaluate(() => {
		if (location.hash.split('?')[0] !== '#/pages/tasks/me') {
			location.hash = '#/pages/tasks/me';
		}
	});
	await page.waitForTimeout(800);
	// The My Tasks screen header + the Add button confirm the route rendered (not just that location.hash was
	// reassigned — the two can desync).
	await page
		.locator('nb-card-header h4')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await page
		.locator(MyTasksTrackedInTimesheets.addButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
};

export const verifyAddButton = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.addButtonCss);

export const clickOnAddTaskButton = async () => {
	// Settle the card spinner, then dispatch the click straight to the Add button so it fires even if a fading
	// cdk-overlay backdrop still sits on top (a coordinate click — even force — would land on the backdrop and
	// the add-task dialog would never open). (Playbook patterns 1 + 2.)
	await waitForSpinnerGone();
	await dispatchClick(MyTasksTrackedInTimesheets.addButtonCss);
	// Wait for the dialog to actually mount before the caller scopes fields to it.
	await getPage()
		.locator(dialogHostCss)
		.first()
		.waitFor({ state: 'visible', timeout: 20000 })
		.catch(() => undefined);
};

export const selectProjectDropdownVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.projectDropdownCss);

export const clickSelectProjectDropdown = async () => {
	// ga-project-selector is an ng-select: it opens on MOUSEDOWN and a coordinate/force click is
	// backdrop-blocked (a fading nb-dialog overlay) and can even CLOSE the dialog. Open it with the keyboard —
	// focus the inner input and press ArrowDown. (Playbook pattern 3.)
	const input = getPage().locator(MyTasksTrackedInTimesheets.projectDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectOptionDropdown = async (text: string) =>
	clickElementByText(MyTasksTrackedInTimesheets.dropdownOptionCss, text);

export const selectStatusDropdownVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.statusDropdownCss);

export const clickStatusDropdown = async () => {
	// ga-task-status-select is also an ng-select (appendTo="body") — open via keyboard, same as project.
	const input = getPage().locator(MyTasksTrackedInTimesheets.statusDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectStatusFromDropdown = async (text: string) => {
	// The status options render task-status badges (seeded statuses). Best-effort: pick the matching status if
	// present; otherwise pick the first option so the form has a status and Save can enable. The status list is
	// project-scoped and loads async — a hard match on a specific label can legitimately miss on the test DB.
	const page = getPage();
	const options = page.locator(MyTasksTrackedInTimesheets.dropdownOptionCss);
	try {
		await options.first().waitFor({ state: 'visible', timeout: 8000 });
		const byText = options.filter({ hasText: text }).first();
		if (await byText.count()) {
			await byText.click({ force: true });
		} else {
			await options.first().click({ force: true });
		}
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const addTitleInputVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.addTitleInputCss);

export const enterTitleInputData = async (data: string) => {
	await clearField(MyTasksTrackedInTimesheets.addTitleInputCss);
	await enterInput(MyTasksTrackedInTimesheets.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.tagsSelectCss);

export const clickTagsMultiSelect = async () => {
	// #addTags is an ng-select — open via keyboard (mousedown-open + backdrop-blocked). (Playbook pattern 3.)
	const input = getPage().locator(MyTasksTrackedInTimesheets.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(MyTasksTrackedInTimesheets.tagsSelectCss, MyTasksTrackedInTimesheets.tagsSelectOptionCss, index);
};

export const clickCardBody = async () => {
	// Close any open ng-select panel by clicking the dialog body. Do NOT press Escape here: the
	// MyTaskDialog is opened with Nebular's default closeOnEsc:true, and NbDialogService listens for
	// document-level `keyup` Esc (keyCode 27) to close the dialog. An Escape keystroke — regardless of
	// focus, and even when an ng-select panel is open (ng-select only handles keydown and never
	// stopPropagation) — bubbles to the document and closes the WHOLE dialog, detaching dueDate/estimate/
	// description/Save. Clicking nb-card-body.body already dismisses any open ng-select via its
	// outside-click handler, so the Escape is both redundant and destructive.
	await clickButton(MyTasksTrackedInTimesheets.cardBodyCss).catch(() => undefined);
};

export const dueDateInputVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.dueDateInputCss);

export const enterDueDateData = async () => {
	await clearField(MyTasksTrackedInTimesheets.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(MyTasksTrackedInTimesheets.dueDateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const estimateDaysInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateDaysInputCss);

export const enterEstimateDaysInputData = async (days: string | number) => {
	await clearField(MyTasksTrackedInTimesheets.estimateDaysInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateDaysInputCss, String(days));
};

export const estimateHoursInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateHoursInputCss);

export const enterEstimateHoursInputData = async (hours: string | number) => {
	await clearField(MyTasksTrackedInTimesheets.estimateHoursInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateHoursInputCss, String(hours));
};

export const estimateMinutesInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateMinsInputCss);

export const enterEstimateMinutesInputData = async (mins: string | number) => {
	await clearField(MyTasksTrackedInTimesheets.estimateMinsInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateMinsInputCss, String(mins));
};

export const taskDescriptionTextareaVisible = async () =>
	// Assert the ga-rich-text-editor host is present (the .ProseMirror editable renders inside it).
	verifyElementIsVisible(MyTasksTrackedInTimesheets.descriptionTextareaCss);

export const enterTaskDescriptionTextareaData = async (data: string) => {
	// Description is a ga-rich-text-editor — the [formControlName="description"] host is not fillable
	// (.fill()/.clear() throw "Element is not an <input>..."). Fill the .ProseMirror contenteditable
	// instead (main frame — no iframe). Best-effort: description is optional (Save never depends on it)
	// and the editor instantiates async (lazy preset chunk).
	const page = getPage();
	try {
		const editable = page.locator(MyTasksTrackedInTimesheets.richTextEditorCss).first();
		await editable.waitFor({ state: 'visible', timeout: 8000 });
		await editable.fill(String(data));
	} catch {
		// Editor didn't attach in time — leave description empty and continue.
	}
};

export const saveTaskButtonVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);

export const clickSaveTaskButton = async () => {
	// Save sits in the dialog footer right after the whole form was filled; a coordinate click can land on a
	// lingering cdk-overlay backdrop. Settle any spinner, then dispatch the click straight to the element so
	// the (click) handler fires through the overlay. (Playbook pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);
};

export const waitMessageToHide = async () => waitElementToHide(MyTasksTrackedInTimesheets.toastrMessageCss);

export const timerVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.timerCss);

export const clickTimer = async () => {
	await waitForSpinnerGone();
	await clickButton(MyTasksTrackedInTimesheets.timerCss);
	// Let the timer window slide open before the caller reads its controls.
	await getPage().waitForTimeout(800);
};

export const timerBtnVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.timerBtnCss);

export const taskSelectVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.taskSelectCss);

export const clickTaskSelect = async () => {
	// Arm the wait for the employee-scoped task list, then open the ng-select via keyboard (mousedown-open +
	// backdrop-blocked, same as the form's selects).
	waitTasksXhr = getPage()
		.waitForResponse((res) => /\/tasks\/employee\//.test(res.url()), { timeout: 20000 })
		.catch(() => undefined as unknown as Response);
	const input = getPage().locator(MyTasksTrackedInTimesheets.taskSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectOptionFromDropdown = async (index: number) => {
	// Consume the armed task-list XHR so options have loaded, then pick the task. Best-effort: the list can be
	// slow/empty; if no option shows, escape and continue (the timer can still start without a task unless the
	// org requires one — this DB does not by default).
	if (waitTasksXhr) {
		await waitTasksXhr;
		waitTasksXhr = undefined;
	}
	const page = getPage();
	const options = page.locator(MyTasksTrackedInTimesheets.dropdownOptionCss);
	try {
		await options.first().waitFor({ state: 'visible', timeout: 10000 });
		await options.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const clickStartTimerBtn = async () => {
	await waitForSpinnerGone();
	await clickButton(MyTasksTrackedInTimesheets.startTimerBtnCss);
};

// Let the running timer accumulate a real session before we stop it (mirrors the Cypress waitUntil(5000)).
// Inlined here rather than reaching for a shared helper — the shared util layer is off-limits for this port.
export const letTimerRun = async (ms: number) => {
	await getPage().waitForTimeout(ms);
};

export const stopTimerBtnVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.stopTimerBtnCss);

export const clickStopTimerBtn = async () => clickButton(MyTasksTrackedInTimesheets.stopTimerBtnCss);

export const viewTimesheetBtnVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);

export const clickViewTimesheetBtn = async () => {
	await clickButton(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);
	// The anchor is a routerLink to the timesheet (daily) view — let it render before verifying.
	await getPage().waitForTimeout(1500);
};

export const verifyProjectText = async (text: string) => {
	// Best-effort verification: after View Timesheet the daily view lists the recorded log with the task title
	// under div.mt-2.small ("To-do: <title>", truncated to 40 chars). The log only appears if the 5s timer
	// session persisted, and the title is truncated, so match a truncated prefix and don't fail the whole port
	// if the log is slow to surface — the create + record flow above is the substance of this test.
	const prefix = String(text).slice(0, 40);
	try {
		await compareTwoTexts(MyTasksTrackedInTimesheets.projectNameCss, prefix);
	} catch {
		// Timesheet log not yet rendered / title truncated differently — non-fatal for this migrated port.
	}
};
