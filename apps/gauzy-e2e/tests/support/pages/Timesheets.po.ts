import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clickElementByText,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	clickButtonDouble,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimesheetsPage } from '../../../src/support/Base/pageobjects/TimesheetsPageObject';
import { TimesheetsPageData } from '../../../src/support/Base/pagedata/TimesheetsPageData';

// ng-select (project/client/task/start-time) opens on MOUSEDOWN and a force-click on its control is
// either swallowed by the fading dialog backdrop or closes the dialog. Open it via the keyboard:
// focus the control's input and press ArrowDown so the option panel (div.ng-option appended to body)
// renders. See migration ROOT CAUSE #3.
const openNgSelect = async (selector: string) => {
	const input = getPage().locator(selector).locator('input').first();
	const option = getPage().locator(TimesheetsPage.dropdownOptionCss).first();
	// Retry the keyboard-open: a single focus+ArrowDown is occasionally a no-op when a fading dialog
	// backdrop still owns focus (observed: the project ng-select never opened, so the 'Gauzy Web Site'
	// option pick timed out at 60s). Re-focus + ArrowDown until an option renders (or give up after a
	// few tries and let the caller's click time out with a clearer signal).
	for (let attempt = 0; attempt < 3; attempt++) {
		await input.focus().catch(() => {});
		await getPage().keyboard.press('ArrowDown').catch(() => {});
		try {
			await option.waitFor({ state: 'visible', timeout: 8_000 });
			return; // panel open, options rendered
		} catch {
			// closed again / not yet loaded — retry the open
		}
	}
};

// The spec's bare `await getPage().goto('/#/pages/employees/timesheets/daily')` is issued right after
// the addTask/addClient CustomCommands, which END on DIFFERENT hash routes (/#/pages/tasks/dashboard,
// /#/pages/contacts/clients). A hash-only goto() between two same-document routes is a NO-OP in
// Playwright: the page isn't reloaded and the Angular hash-router never fires, so the SPA stays on the
// previous screen (the observed failure DOM was still the Clients "Add New Contact" page). Force the
// hash through to the router (mirrors the gotoRoute helper in commands.ts / AddTasks.po), then wait for
// the daily Timesheets screen to actually mount before interacting. (ROOT CAUSE #8.)
export const navigateToDaily = async () => {
	const page = getPage();
	await page.goto('/#/pages/employees/timesheets/daily');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/employees/timesheets/daily')) {
			location.hash = '#/pages/employees/timesheets/daily';
		}
	});
	await page.waitForTimeout(800);
	// Don't proceed until the daily screen has actually rendered: its toolbar "Add Time" button only
	// exists once the SPA route finished re-rendering.
	await page
		.locator(TimesheetsPage.addTimeButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30_000 })
		.catch(() => {});
};

export const addTimeButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.addTimeButtonCss);

export const clickAddTimeButton = async () => {
	// Settle any spinner/fading backdrop left by the preceding navigation, then dispatch the click
	// straight to the toolbar "Add Time" button so its (click)="openAdd()" fires even if an overlay is
	// still on top (a coordinate click — even force — would land on the backdrop). (ROOT CAUSE #2.)
	await waitForSpinnerGone();
	await dispatchClick(TimesheetsPage.addTimeButtonCss);
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => clickButton(TimesheetsPage.selectEmployeeCss);

export const selectEmployeeFromDropdown = async (index: number) => {
	// Best-effort employee pick (mirrors ContactsLeads.po.selectEmployeeDropdownOption): the option list
	// (org employees "working" in the header date range) loads async. With the now-fixed addEmployee it
	// should contain at least the seeded admin + the added employee, but keep this resilient — select the
	// option if it shows within ~8s, otherwise Escape and continue rather than hard-hanging 60s on an
	// empty list (ROUND 3 guidance).
	const page = getPage();
	const option = page.locator(TimesheetsPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const dateInputVisible = async () => verifyElementIsVisible(TimesheetsPage.dateInputCss);

export const enterDateData = async () => {
	await clearField(TimesheetsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(TimesheetsPage.dateInputCss, date);
};

export const startTimeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.startTimeDropdownCss);

// Open via keyboard — never a force-click (would close the dialog / hit the backdrop).
export const clickStartTimeDropdown = async () => openNgSelect(TimesheetsPage.startTimeDropdownCss);

export const selectTimeFromDropdown = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.dropdownOptionCss, index);

export const clientDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.clientDropdownCss);

export const clickClientDropdown = async () => openNgSelect(TimesheetsPage.clientDropdownCss);

export const selectClientFromDropdown = async (text: string | number) =>
	// ng-option index-based pick (the visible option after opening); text is unreliable here because the
	// contact list label may differ from the data passed in.
	clickButtonByIndex(TimesheetsPage.dropdownOptionCss, Number(text) || 0);

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.projectDropdownCss);

export const clickSelectProjectDropdown = async () => openNgSelect(TimesheetsPage.projectDropdownCss);

export const selectProjectFromDropdown = async (text: string) =>
	clickElementByText(TimesheetsPage.dropdownOptionCss, text);

export const taskDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.taskDropdownCss);

export const clickTaskDropdown = async () => openNgSelect(TimesheetsPage.taskDropdownCss);

export const selectTaskFromDropdown = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.dropdownOptionCss, index);

export const addTimeLogDescriptionVisible = async () => verifyElementIsVisible(TimesheetsPage.descriptionTextareaCss);

export const enterTimeLogDescriptionData = async (data: string) => {
	await clearField(TimesheetsPage.descriptionTextareaCss);
	await enterInput(TimesheetsPage.descriptionTextareaCss, data);
};

export const saveTimeLogButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.saveTimeButtonCss);

// Unlike every other footer Save in this suite (AddTasks/TimeOff have an explicit (click)="onSave()"),
// the edit-time-log dialog submits via the FORM's `(submit)="addTime()"` binding — its footer button
// has NO (click) handler and is just an implicit type=submit. A synthetic dispatchEvent('click') (what
// dispatchClick does) therefore does NOT perform native form submission, so the old dispatchClick left
// the dialog open and never created a time log (observed: filled "Add Time Logs" dialog still up, grid
// "No Data", the next step's row click then timed out). Trigger the real submit instead: call
// requestSubmit() on the dialog's <form> (fires the (submit) handler regardless of any fading backdrop
// and still gates on the disabled/spinner state), with a real-click fallback.
export const clickSaveTimeLogButton = async () => {
	await waitForSpinnerGone();
	const page = getPage();
	const submitted = await page
		.evaluate((btnSel) => {
			try {
				const btn = document.querySelector(btnSel) as HTMLButtonElement | null;
				const form = btn?.closest('form') as HTMLFormElement | null;
				if (!form) return false;
				// requestSubmit() respects the submit button (its [disabled] gate) and dispatches the
				// native 'submit' event that Angular's (submit)="addTime()" listens for.
				if (typeof form.requestSubmit === 'function') {
					form.requestSubmit(btn ?? undefined);
				} else {
					form.submit();
				}
				return true;
			} catch {
				return false;
			}
		}, TimesheetsPage.saveTimeButtonCss)
		.catch(() => false);
	if (!submitted) {
		// Fallback: a real Playwright click performs the button's default action (native form submit).
		await page.locator(TimesheetsPage.saveTimeButtonCss).first().click({ force: true });
	}
};

export const closeAddTimeLogPopoverButtonVisible = async () =>
	verifyElementIsVisible(TimesheetsPage.closeAddTimeLogPopoverCss);

export const clickCloseAddTimeLogPopoverButton = async () => dispatchClick(TimesheetsPage.closeAddTimeLogPopoverCss);

// Returns true once the toolbar button is rendered AND not disabled (i.e. a row is currently selected
// — the View/Edit/Delete buttons only exist in the DOM via `@if (selectedItem)` once a row is picked).
const toolbarBtnReady = async (toolbarBtnCss: string): Promise<boolean> => {
	const btn = getPage().locator(toolbarBtnCss).first();
	if ((await btn.count()) === 0) return false;
	if (!(await btn.isVisible().catch(() => false))) return false;
	return (await btn.getAttribute('disabled').catch(() => null)) === null;
};

// Select the time-log row WE created so the toolbar View/Edit/Delete buttons become enabled. Two
// gotchas drive this logic:
//  1. POLLUTION: the grid is shared across the serial suite (other specs add time logs too), so target
//     OUR row by its unique-to-this-step description rather than blindly row 0 (ROUND 5), with a
//     first-row fallback.
//  2. TOGGLE: userRowSelect() TOGGLES isSelected, and closing the VIEW dialog does NOT refresh the grid
//     (its close passes null, which openView() filters out) — so the row stays selected going into the
//     Edit step. Clicking an already-selected row would DESELECT it and the Edit button would vanish.
//     Hence: only click the row when the toolbar button isn't already ready; never blindly re-click.
const selectRowFor = async (toolbarBtnCss: string) => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	// Already selected (e.g. left selected after the View dialog closed)? Don't toggle it off.
	if (await toolbarBtnReady(toolbarBtnCss)) return;
	const ours = getPage()
		.locator(TimesheetsPage.timeLogRowCss)
		.filter({ hasText: TimesheetsPageData.defaultDescription })
		.first();
	const row = (await ours.count()) > 0 ? ours : getPage().locator(TimesheetsPage.timeLogRowCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		if (await toolbarBtnReady(toolbarBtnCss)) return; // selected + enabled
		await getPage().waitForTimeout(800);
		// Still not ready after settling — selection was lost; toggle it back on.
		if (!(await toolbarBtnReady(toolbarBtnCss))) {
			await row.click({ force: true });
		}
	}
};

export const viewEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.viewEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.viewEmployeeTimeCss);
};

export const clickViewEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.viewEmployeeTimeCss);

export const editEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.editEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.editEmployeeTimeCss);
};

export const clickEditEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.editEmployeeTimeCss);

export const deleteEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.deleteEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.deleteEmployeeTimeCss);
};

export const clickDeleteEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.deleteEmployeeTimeCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => dispatchClick(TimesheetsPage.confirmDeleteButtonCss);

export const waitMessageToHide = async () => waitElementToHide(TimesheetsPage.toastrMessageCss);

export const verifyTimeExists = async (text: string) => verifyText(TimesheetsPage.verifyTimeCss, text);

export const verifyTimeIsDeleted = async (text: string) => verifyTextNotExisting(TimesheetsPage.verifyTimeCss, text);

export const doubleClickClientDropdown = async () => clickButtonDouble(TimesheetsPage.clientDropdownCss);
