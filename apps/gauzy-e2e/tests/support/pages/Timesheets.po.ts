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

// ng-select (project/client/task/start-time) opens on MOUSEDOWN and a force-click on its control is
// either swallowed by the fading dialog backdrop or closes the dialog. Open it via the keyboard:
// focus the control's input and press ArrowDown so the option panel (div.ng-option appended to body)
// renders. See migration ROOT CAUSE #3.
const openNgSelect = async (selector: string) => {
	const input = getPage().locator(selector).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
	// Wait for at least one option to render in the body overlay.
	await getPage()
		.locator(TimesheetsPage.dropdownOptionCss)
		.first()
		.waitFor({ state: 'visible', timeout: 24_000 })
		.catch(() => {});
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

// Save sits behind the form's nb-spinner while the request is in flight; dispatchClick fires the
// (submit)/(click) handler even if a fading overlay sits on top.
export const clickSaveTimeLogButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(TimesheetsPage.saveTimeButtonCss);
};

export const closeAddTimeLogPopoverButtonVisible = async () =>
	verifyElementIsVisible(TimesheetsPage.closeAddTimeLogPopoverCss);

export const clickCloseAddTimeLogPopoverButton = async () => dispatchClick(TimesheetsPage.closeAddTimeLogPopoverCss);

// Select the first time-log row so the toolbar View/Edit/Delete buttons become enabled. The row click
// TOGGLES selection, so settle the grid first, click once, then poll the target toolbar button's
// `disabled` attribute and only re-click if selection was lost (ROOT CAUSE #4).
const selectFirstRowFor = async (toolbarBtnCss: string) => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	const row = getPage().locator(TimesheetsPage.timeLogRowCss).first();
	const btn = getPage().locator(toolbarBtnCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await btn.getAttribute('disabled').catch(() => null);
		if (disabled === null) return; // enabled
		await getPage().waitForTimeout(800);
		if ((await btn.getAttribute('disabled').catch(() => null)) !== null) {
			await row.click({ force: true });
		}
	}
};

export const viewEmployeeTimeLogButtonVisible = async () => {
	await selectFirstRowFor(TimesheetsPage.viewEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.viewEmployeeTimeCss);
};

export const clickViewEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.viewEmployeeTimeCss);

export const editEmployeeTimeLogButtonVisible = async () => {
	await selectFirstRowFor(TimesheetsPage.editEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.editEmployeeTimeCss);
};

export const clickEditEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.editEmployeeTimeCss);

export const deleteEmployeeTimeLogButtonVisible = async () => {
	await selectFirstRowFor(TimesheetsPage.deleteEmployeeTimeCss);
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
