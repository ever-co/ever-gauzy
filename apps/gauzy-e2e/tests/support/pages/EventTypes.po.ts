import {
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	waitUntil
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EventTypesPage } from '../../../src/support/Base/pageobjects/EventTypesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.addEventTypeButtonCss);
};

export const clickAddEventTypeButton = async () => {
	// The list card shows a full-card nb-spinner (loading) over the toolbar right after navigation;
	// wait it out then dispatch the click so the Add dialog reliably opens (a coordinate click can
	// otherwise land on the spinner).
	await waitForSpinnerGone();
	await dispatchClick(EventTypesPage.addEventTypeButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.selectEmployeeDropdownCss);
};

export const clickSelectEmployeeDropdown = async () => {
	// The employee field is an nb-select inside ga-employee-multi-select; wait out the card spinner
	// first (it overlays the control, swallowing the open click) then open it. Its options are the
	// org's employees "working" in the header date range, loaded async — selectEmployeeFromDropdown
	// handles an empty/slow list best-effort.
	await waitForSpinnerGone();
	await waitUntil(3000);
	await clickButton(EventTypesPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(EventTypesPage.selectEmployeeDropdownOptionCss);
	// Best-effort employee pick (mirrors ContactsLeads.selectEmployeeDropdownOption): the option list
	// loads async and can legitimately be empty (no employee "working" in the selected date range).
	// Select one if it shows; otherwise leave it unset — an event type saves fine without an employee
	// (employeeId is optional) — so the form still finishes. Avoids the hard 60s timeout on an empty list.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const titleInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.titleInputCss);
};

export const enterTitleInputData = async (data) => {
	await clearField(EventTypesPage.titleInputCss);
	await enterInput(EventTypesPage.titleInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(EventTypesPage.descriptionInputCss);
	await enterInput(EventTypesPage.descriptionInputCss, data);
};

export const durationInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.durationInputCss);
};

export const enterDurationInputData = async (data) => {
	await clearField(EventTypesPage.durationInputCss);
	await enterInput(EventTypesPage.durationInputCss, data);
};

export const checkboxVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.activeCheckboxCss);
};

export const clickCheckbox = async () => {
	await clickButton(EventTypesPage.activeCheckboxCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// dispatchClick after the spinner clears: saving from the mutation dialog leaves a fading
	// cdk-overlay backdrop that intercepts a coordinate click on the footer Save; dispatch fires
	// addOrEditEventType() straight on the button. The button gates on form validity regardless.
	await waitForSpinnerGone();
	await dispatchClick(EventTypesPage.saveButtonCss);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisibleByIndex(EventTypesPage.selectTableRowCss, 0);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Let the grid settle first: after the preceding mutation it re-renders/refetches and a click in
	// that window is lost or immediately cleared. The row click TOGGLES selection, so this is made
	// idempotent — if the Edit button is already enabled the row is already selected and we leave it
	// alone (the spec calls this repeatedly). Only click + poll when Edit is still disabled, so the
	// row ends up selected regardless of how many times this runs (mirrors ContactsLeads.selectTableRow).
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(EventTypesPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(EventTypesPage.editEventTypeButtonCss).first();
	if (!(await editBtn.isDisabled().catch(() => true))) return;
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.editEventTypeButtonCss);
};

export const clickEditEventTypeButton = async () => {
	// dispatchClick: the preceding add-mutation dialog leaves a fading cdk-overlay backdrop over the
	// toolbar that swallows a coordinate click on Edit; dispatch fires openEditEventTypeDialog().
	await waitForSpinnerGone();
	await dispatchClick(EventTypesPage.editEventTypeButtonCss);
};

export const deleteEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.deleteEventTypeButtonCss);
};

export const clickDeleteEventTypeButton = async () => {
	// dispatchClick: the preceding edit-mutation dialog leaves a fading cdk-overlay backdrop over the
	// toolbar that swallows a coordinate click on Delete; dispatch fires deleteEventType().
	await waitForSpinnerGone();
	await dispatchClick(EventTypesPage.deleteEventTypeButtonCss);
};

export const confirmDeleteEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const clickConfirmDeleteEventTypeButton = async () => {
	// dispatchClick: the confirm dialog's own backdrop can intercept a coordinate click on its footer
	// button; dispatch fires the confirm handler straight on the element.
	await waitForSpinnerGone();
	await dispatchClick(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EventTypesPage.toastrMessageCss);
};
