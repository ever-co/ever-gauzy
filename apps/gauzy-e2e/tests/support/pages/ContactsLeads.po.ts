import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	verifyByLength,
	verifyByText
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ContactsLeadsPage } from '../../../src/support/Base/pageobjects/ContactsLeadsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.addButtonCss);
};

export const clickAddButton = async () => {
	// the leads page shows a load spinner over the toolbar right after navigation; wait it out then
	// dispatch the click so the Add stepper reliably opens (a coordinate click can land on the spinner).
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ContactsLeadsPage.nameInputCss);
	await enterInput(ContactsLeadsPage.nameInputCss, data);
};

// Raw re-fill (no clearField) of the Name control. The contact-mutation form resets Name whenever a
// later field is cleared-then-filled (an Angular re-render on valueChanges); call this as the LAST
// step-1 action before advancing so the intended name actually persists. Mirrors the addContact fix.
export const reenterNameInputData = async (data) => {
	await getPage().locator(ContactsLeadsPage.nameInputCss).first().fill(String(data));
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.emailInputCss);
};

export const enterEmailInputData = async (data) => {
	await clearField(ContactsLeadsPage.emailInputCss);
	await enterInput(ContactsLeadsPage.emailInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.phoneInputCss);
};

export const enterPhoneInputData = async (data) => {
	await clearField(ContactsLeadsPage.phoneInputCss);
	await enterInput(ContactsLeadsPage.phoneInputCss, data);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(ContactsLeadsPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	const page = getPage();
	const input = page.locator(ContactsLeadsPage.countryDropdownCss).locator('input').first();
	const option = page.locator(ContactsLeadsPage.countryDropdownOptionCss);
	// Open the ng-select via the keyboard (focus the search input + type the country), NOT a click:
	// stale cdk-overlay backdrops lingering from the add-project/add-tag dialogs sit over this step and
	// swallow a coordinate click on the control (ng-select opens on mousedown, so dispatchClick can't
	// help either). Typing also filters the list so the wanted option renders. Retry until it shows.
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await input.pressSequentially(String(text).slice(0, 4), { delay: 60 }).catch(() => {});
		await page.waitForTimeout(900);
	}
	await clickElementByText(ContactsLeadsPage.countryDropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(ContactsLeadsPage.cityInputCss);
	await enterInput(ContactsLeadsPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(ContactsLeadsPage.postCodeInputCss);
	await enterInput(ContactsLeadsPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.streetInputCss);
};

export const enterStreetInputData = async (data) => {
	await clearField(ContactsLeadsPage.streetInputCss);
	await enterInput(ContactsLeadsPage.streetInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.projectsDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(ContactsLeadsPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = async (text) => {
	await clickElementByText(ContactsLeadsPage.projectsDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	// Wait out the full-card spinner first (it overlays the select, swallowing the open click), then
	// open the employee multi-select. Its options are the org's employees "working" in the header date
	// range (EmployeeSelectComponent.getWorkingEmployees), loaded async — selectEmployeeDropdownOption
	// handles an empty/slow list best-effort.
	await waitForSpinnerGone();
	await clickButton(ContactsLeadsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	const page = getPage();
	const option = page.locator(ContactsLeadsPage.dropdownOptionCss);
	// Best-effort employee pick: the option list loads async and can legitimately be empty (no
	// employee "working" in the selected date range). Select one if it shows; otherwise leave members
	// empty — a contact saves fine without members — so the stepper still finishes. This avoids a hard
	// 60s timeout on an empty list, which was the main flake on the contact-mutation employees step.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(ContactsLeadsPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(ContactsLeadsPage.tagsDropdownOption, index);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data) => {
	await clearField(ContactsLeadsPage.websiteInputCss);
	await enterInput(ContactsLeadsPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Stepper-advance buttons (nbStepperNext) only move on a click when the step's form is valid; a
	// full-card nb-spinner (async geocode on the location step, employee load on the last) overlays the
	// button so a coordinate click lands on the spinner. Wait briefly, then dispatch the click straight
	// to the button — nbStepperNext fires on the click event and still gates on form validity.
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// dispatchClick (not force-click): the preceding add-contact/toastr flow leaves fading cdk-overlay
	// backdrops over the toolbar that intercept a coordinate click; dispatch fires invite() directly.
	await dispatchClick(ContactsLeadsPage.inviteButtonCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	// dispatchClick: a leftover stepper backdrop can sit over the dialog footer and swallow the click,
	// leaving the invite dialog open (so the grid behind it stays hidden from the next assertion).
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.saveInviteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Let the grid settle first: after the preceding mutation it re-renders/refetches, and a click
	// during that window is lost or immediately cleared. Then click the row ONCE and poll for the Edit
	// button to enable — clicking the row TOGGLES selection, so a second click would turn it back off;
	// only re-click if the first click was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ContactsLeadsPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(ContactsLeadsPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

// Select the grid row whose name link contains `name` (pollution-resilient row pick). The suite runs
// serially on ONE seed, so by the time the edit/delete steps run the grid has MORE than one lead:
// the toolbar Invite creates a SECOND contact with the same name as the one Add created, so a plain
// nth(0) row pick can grab the wrong record. Filtering by the unique faker name targets exactly the
// record this spec is acting on (the rename / the delete), instead of whichever row happens to sort
// first. Same settle-then-click-once-and-poll-Edit handling as selectTableRow.
export const selectTableRowByName = async (name: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page
		.locator(ContactsLeadsPage.selectTableRowCss)
		.filter({ hasText: name })
		.first();
	const editBtn = page.locator(ContactsLeadsPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.editButtonCss);
};

export const clickEditButton = async (_index: number = 0) => {
	// dispatchClick: the preceding mutation dialogs (add/invite) leave fading cdk-overlay backdrops over
	// the toolbar that swallow a coordinate click on Edit; dispatch fires editOrganizationContact().
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(ContactsLeadsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ContactsLeadsPage.toastrMessageCss);
};

export const contactNameInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.contactNameCss);
};

export const enterContactNameData = async (data) => {
	await clearField(ContactsLeadsPage.contactNameCss);
	await enterInput(ContactsLeadsPage.contactNameCss, data);
};

export const contactPhoneInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.contactPhoneCss);
};

export const enterContactPhoneData = async (data) => {
	await clearField(ContactsLeadsPage.contactPhoneCss);
	await enterInput(ContactsLeadsPage.contactPhoneCss, data);
};

export const contactEmailInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.contactEmailCss);
};

export const enterContactEmailData = async (data) => {
	await clearField(ContactsLeadsPage.contactEmailCss);
	await enterInput(ContactsLeadsPage.contactEmailCss, data);
};

export const verifyLeadExists = async (text) => {
	await verifyText(ContactsLeadsPage.verifyLeadCss, text);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(ContactsLeadsPage.verifyLeadCss, text);
};

export const verifyNextButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.nextButtonCss);
};

export const clickNextButton = async () => {
	// see clickSaveButton: wait out the location-step geocode spinner, then dispatch (the overlay
	// otherwise swallows a coordinate click and the stepper silently stays on the current step).
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.nextButtonCss);
};

export const verifyFinishButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.finishButtonCss);
};

export const clickFinishButton = async () => {
	// The contact-mutation card shows a full-card nb-spinner while the final step loads its data; it
	// overlays the footer Save button, so a coordinate click (even force) lands on the spinner and the
	// save never fires. Wait for it to clear, then dispatch the click straight to the button.
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.finishButtonCss);
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	// see clickSaveButton: wait out the spinner, then dispatch to advance into the employees step.
	await waitForSpinnerGone();
	await dispatchClick(ContactsLeadsPage.lastStepBtnCss);
};

export const budgetInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.budgetInputCss);
};

export const enterBudgetData = async (data) => {
	await clearField(ContactsLeadsPage.budgetInputCss);
	await enterInput(ContactsLeadsPage.budgetInputCss, data);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.searchNameInputCss);
};

export const searchClientName = async (name: string) => {
	await clearField(ContactsLeadsPage.searchNameInputCss);
	await enterInput(ContactsLeadsPage.searchNameInputCss, name);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(ContactsLeadsPage.selectTableRowCss, length);
};

export const clearSearchInput = async () => {
	await clearField(ContactsLeadsPage.searchNameInputCss);
};

export const verifyClientNameInTable = async (name: string) => {
	await verifyByLength(ContactsLeadsPage.clientsTableRow, 1);
	await verifyByText(ContactsLeadsPage.clientsTableData, name);
};
