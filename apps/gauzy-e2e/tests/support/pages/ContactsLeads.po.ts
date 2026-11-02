import { expect } from '@playwright/test';
import {
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	dispatchClickWhenSettled,
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
import { selectNgOption, openNgSelect, realOptions } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ContactsLeadsPage } from '../../../src/support/Base/pageobjects/ContactsLeadsPageObject';

/**
 * Click the forward button of the contact wizard's CURRENT step ("Next" on steps 1-3, "Save" on step 4 —
 * see ContactsLeadsPage.lastStepBtnCss) once it is enabled. Steps 1-3 bind `[disabled]` to their form's
 * validity; a click dispatched while Angular has not yet re-enabled the button is lost and the stepper
 * silently stays put, so wait for the state that matters first. Dispatched (not a coordinate click) so a
 * transient card spinner cannot swallow it; nbStepperNext still gates on the step's form validity.
 * Shared with Clients.po / Customers.po — all three pages render the same ga-contact-mutation wizard.
 */
export const clickWizardForward = async (selector: string = ContactsLeadsPage.nextButtonCss) => {
	await waitForSpinnerGone();
	await expect(getPage().locator(selector).first()).toBeEnabled({ timeout: 24_000 });
	await dispatchClick(selector);
};

/**
 * Pick an employee on the wizard's Members step (step 4) and confirm it is a member.
 *
 * #10308 (e9e6bfd9fa) replaced `ga-employee-multi-select` (nb-select, `.option-list nb-option`) with a
 * searchable multi `ng-select.members-select` (appendTo="body", closeOnSelect=false). Its
 * `ng-multi-label-tmp` renders a fixed "Search employees" placeholder instead of `div.ng-value` chips, so
 * the generic ng-select driver's `div.ng-value` commit check can never see a pick (and would re-click,
 * i.e. TOGGLE the member off again). The pick is confirmed against the option's own
 * `ng-option-selected` state instead. An option that is already selected (the edit flow reopens a
 * contact saved with a member) is left as it is, never clicked off.
 *
 * Returns whether the target is a member afterwards. `false` only when the organization lists no
 * employees at all / no option matches — callers decide whether that is acceptable.
 */
export const pickContactMember = async (
	controlCss: string,
	optionCss: string,
	target: number | string
): Promise<boolean> => {
	const page = getPage();
	await waitForSpinnerGone();
	if (!(await openNgSelect(controlCss, optionCss))) {
		return false;
	}
	const options = realOptions(optionCss);
	const option = typeof target === 'string' ? options.filter({ hasText: target }).first() : options.nth(target);
	if ((await option.count().catch(() => 0)) === 0) {
		return false;
	}
	const isPicked = async () =>
		/(^|\s)ng-option-selected(\s|$)/.test((await option.getAttribute('class').catch(() => null)) || '');
	for (let attempt = 0; attempt < 2; attempt++) {
		if (await isPicked()) {
			return true;
		}
		// DOM-level click first (ng-select binds (click)="toggleItem(item)" on the option, and a dispatched
		// event cannot be intercepted); a real click only as the fallback.
		if (attempt === 0) {
			await option.dispatchEvent('click').catch(() => undefined);
		} else {
			await option.click({ force: true }).catch(() => undefined);
		}
		for (let i = 0; i < 10 && !(await isPicked()); i++) {
			await page.waitForTimeout(300);
		}
	}
	return isPicked();
};

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
	// dispatch the click so the Add stepper reliably opens (a coordinate click can land on the spinner),
	// and confirm the wizard's Name field rendered (re-dispatching once if the click was swallowed).
	await dispatchClickWhenSettled(ContactsLeadsPage.addButtonCss, ContactsLeadsPage.nameInputCss);
	await settleWizardForm();
};

// ga-contact-mutation patches its whole main form (`_patchForm`: name/email/phone/projects/tags…) from
// the selected organization 200 ms (debounceTime) after it renders — values typed before that are wiped.
// Let that land before the caller starts filling (the Name re-fill before "Next" stays as the backstop).
export const settleWizardForm = async () => {
	await getPage().waitForTimeout(1000);
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

export const selectCountryFromDropdown = async (country) => {
	// Trimmed: ga-country's searchFn matches the raw term, so a padded value (' Bulgaria ') typed into an
	// already-open panel would filter on ' Bul' and match nothing.
	const text = String(country).trim();
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
	// Through the shared ng-select driver: it re-opens the panel by keyboard if the click above did not
	// (card spinner), ignores the "Loading…/No items found" rows and proves the pick on `div.ng-value`.
	// Strict, like the clickElementByText it replaces (which threw when the option never appeared).
	if (!(await selectNgOption(ContactsLeadsPage.projectsDropdownCss, ContactsLeadsPage.projectsDropdownOptionCss, String(text)))) {
		throw new Error(`Project "${text}" could not be selected in the contact wizard's Projects picker`);
	}
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	// Wait out the full-card spinner first (it overlays the select, swallowing the open click), then
	// open the Members picker (ng-select.members-select, opens on mousedown). If the click is lost,
	// selectEmployeeDropdownOption re-opens it via the keyboard.
	await waitForSpinnerGone();
	await clickButton(ContactsLeadsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	// Best-effort, as before: members are optional and a contact saves fine without them, so an
	// organization with no employees leaves the list empty and the wizard still finishes. What changed
	// is the control (see pickContactMember): no more Escape — the wizard is not a dialog, and the pick is
	// confirmed on the option instead of being a blind click.
	await pickContactMember(ContactsLeadsPage.usersMultiSelectCss, ContactsLeadsPage.membersOptionCss, index);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(ContactsLeadsPage.addTagsDropdownCss);
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
	await selectNgOption(ContactsLeadsPage.addTagsDropdownCss, ContactsLeadsPage.tagsDropdownOption, index);
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
	await clickWizardForward(ContactsLeadsPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// dispatchClick (not force-click): the preceding add-contact/toastr flow leaves fading cdk-overlay
	// backdrops over the toolbar that intercept a coordinate click; dispatch fires invite() directly.
	// Confirmed on the Invite Contact dialog's name field (re-dispatched once if the click was lost).
	await dispatchClickWhenSettled(ContactsLeadsPage.inviteButtonCss, ContactsLeadsPage.contactNameCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	// "Email Invite" is [disabled]="form.invalid", but the dialog's form has an ASYNC validator
	// (usersService.getUserByEmail): while it is PENDING the button is enabled yet inviteContact() only
	// persists when `form.valid`, so an early click is a silent no-op and the dialog stays open. Let the
	// validator settle, dispatch, and re-dispatch until the dialog (ga-invite-contact) actually closes —
	// the same handling as Clients.po, which drives this very dialog.
	const page = getPage();
	const dialog = page.locator(ContactsLeadsPage.inviteDialogCss);
	await waitForSpinnerGone();
	await page.waitForTimeout(1200);
	for (let attempt = 0; attempt < 6; attempt++) {
		if ((await dialog.count().catch(() => 0)) === 0) {
			return; // closed (a slow earlier dispatch landed) — never click into the page behind it
		}
		await page
			.locator(ContactsLeadsPage.saveInviteButtonCss)
			.first()
			.dispatchEvent('click', undefined, { timeout: 5000 })
			.catch(() => undefined);
		try {
			await dialog.first().waitFor({ state: 'detached', timeout: 5000 });
			return;
		} catch {
			await page.waitForTimeout(900);
		}
	}
	// Fail here, naming the cause, instead of in the next step's grid assertion.
	await expect(dialog, 'the Invite Contact dialog never closed after "Email Invite"').toHaveCount(0, {
		timeout: 5000
	});
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
	// Fail on the missing row itself (24 s), not on a click that would wait out the whole test.
	await row.waitFor({ state: 'visible', timeout: 24_000 });
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
	// Confirmed on the wizard's Name field, then settled (see settleWizardForm).
	await dispatchClickWhenSettled(ContactsLeadsPage.editButtonCss, ContactsLeadsPage.nameInputCss);
	await settleWizardForm();
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
	await clickWizardForward(ContactsLeadsPage.nextButtonCss);
};

export const verifyFinishButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.finishButtonCss);
};

export const clickFinishButton = async () => {
	// The contact-mutation card shows a full-card nb-spinner while the final step loads its data; it
	// overlays the footer Save button, so a coordinate click (even force) lands on the spinner and the
	// save never fires. Wait for it to clear, then dispatch the click straight to the button.
	await clickWizardForward(ContactsLeadsPage.finishButtonCss);
};

// The wizard is replaced by the grid only once addOrEditOrganizationContact() has persisted the contact
// (on an API error it stays up with a danger toast), so this proves the save landed — and fails HERE,
// naming the cause, instead of in whatever the caller does with the contact next.
export const verifyContactFormClosed = async () => {
	await expect(
		getPage().locator(ContactsLeadsPage.contactMutationCss),
		'the contact wizard is still open after Save — the contact was not saved'
	).toHaveCount(0, { timeout: 24_000 });
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	// see clickSaveButton: wait out the spinner, then dispatch to advance into the employees step.
	await clickWizardForward(ContactsLeadsPage.lastStepBtnCss);
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
