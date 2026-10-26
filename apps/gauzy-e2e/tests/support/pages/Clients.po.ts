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
	verifyByText,
	verifyByLength
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Clients, Leads and Customers all render the same ga-contact-mutation wizard: its drivers live once, in
// ContactsLeads.po.
import { clickWizardForward, pickContactMember, settleWizardForm } from './ContactsLeads.po';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ClientsPage } from '../../../src/support/Base/pageobjects/ClientsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation load spinner so the Add stepper reliably opens; confirmed on
	// the wizard's Name field (re-dispatched once if the click was swallowed), then let the wizard's
	// delayed form patch land before filling (see ContactsLeads.po settleWizardForm).
	await dispatchClickWhenSettled(ClientsPage.addButtonCss, ClientsPage.nameInputCss);
	await settleWizardForm();
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ClientsPage.nameInputCss);
	await enterInput(ClientsPage.nameInputCss, data);
};

// Raw re-fill (no clearField) of the stepper Name, scoped to nb-stepper to dodge the lingering invite
// dialog's duplicate formcontrolname. The form resets Name when a later field is cleared-then-filled,
// so call this as the last step-1 action before advancing. Mirrors ContactsLeads.po.
export const reenterNameInputData = async (data) => {
	await getPage().locator('nb-stepper [formcontrolname="name"]').first().fill(String(data));
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.emailInputCss);
};

export const enterEmailInputData = async (data) => {
	await clearField(ClientsPage.emailInputCss);
	await enterInput(ClientsPage.emailInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.phoneInputCss);
};

export const enterPhoneInputData = async (data) => {
	await clearField(ClientsPage.phoneInputCss);
	await enterInput(ClientsPage.phoneInputCss, data);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(ClientsPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(ClientsPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (country) => {
	// Trimmed: ClientsData.country is ' Bulgaria ', and ga-country's searchFn matches the raw term, so the
	// padded value typed into an already-open panel would filter on ' Bul' and match nothing.
	const text = String(country).trim();
	const page = getPage();
	const input = page.locator(ClientsPage.countryDropdownCss).locator('input').first();
	const option = page.locator(ClientsPage.countryDropdownOptionCss);
	// Open the ng-select via keyboard typeahead, not a click — stale dialog backdrops swallow the click
	// and ng-select opens on mousedown. Typing also filters the list. See ContactsLeads.po.
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await input.pressSequentially(String(text).slice(0, 4), { delay: 60 }).catch(() => {});
		await page.waitForTimeout(900);
	}
	await clickElementByText(ClientsPage.countryDropdownOptionCss, text);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.nextButtonCss);
};

export const clickNextButton = async () => {
	// Stepper-advance buttons sit under a full-card spinner on async steps; wait briefly then dispatch
	// the click (nbStepperNext fires on click and still gates on form validity) once it is enabled.
	await clickWizardForward(ClientsPage.nextButtonCss);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(ClientsPage.cityInputCss);
	await enterInput(ClientsPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(ClientsPage.postCodeInputCss);
	await enterInput(ClientsPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.streetInputCss);
};

export const enterStreetInputData = async (data) => {
	await clearField(ClientsPage.streetInputCss);
	await enterInput(ClientsPage.streetInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(ClientsPage.projectsDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(ClientsPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = async (text) => {
	// Shared ng-select driver: re-opens by keyboard if the click above was lost, skips the
	// "Loading…/No items found" rows and proves the pick on `div.ng-value`. Strict, like the
	// clickElementByText it replaces.
	if (!(await selectNgOption(ClientsPage.projectsDropdownCss, ClientsPage.projectsDropdownOptionCss, String(text)))) {
		throw new Error(`Project "${text}" could not be selected in the contact wizard's Projects picker`);
	}
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ClientsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await waitForSpinnerGone();
	await clickButton(ClientsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	// Best-effort, as before: members are optional (a client saves fine without them), so an empty list
	// still lets the wizard finish. The Members picker is now ng-select.members-select — see
	// ContactsLeads.po pickContactMember for why the pick is confirmed on the option itself.
	await pickContactMember(ClientsPage.usersMultiSelectCss, ClientsPage.membersOptionCss, index);
};

export const selectEmployeeFromDropdownByName = async (name) => {
	// Strict, like the clickElementByText it replaces: a NAMED member must end up selected.
	if (!(await pickContactMember(ClientsPage.usersMultiSelectCss, ClientsPage.membersOptionCss, String(name)))) {
		throw new Error(`Employee "${name}" could not be added on the contact wizard's Members step`);
	}
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(ClientsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(ClientsPage.addTagsDropdownCss);
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
	await selectNgOption(ClientsPage.addTagsDropdownCss, ClientsPage.tagsDropdownOption, index);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data) => {
	await clearField(ClientsPage.websiteInputCss);
	await enterInput(ClientsPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Step 1's forward button ("Next"); waits for it to be enabled (Name valid) before dispatching.
	await clickWizardForward(ClientsPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// dispatchClick the toolbar Invite — a fading dialog backdrop otherwise swallows the coordinate click.
	// Confirmed on the Invite Contact dialog's name field (re-dispatched once if the click was lost).
	await dispatchClickWhenSettled(ClientsPage.inviteButtonCss, ClientsPage.clientNameCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	// The Email Invite button is [disabled]="form.invalid", but its primaryEmail control has an ASYNC
	// validator (usersService.getUserByEmail -> GET /user/email/:email). Right after the email is typed the
	// group is status PENDING: form.invalid is false (button NOT disabled) yet form.valid is ALSO false, and
	// inviteContact() -> addOrEditOrganizationContact() only persists when `this.form.valid`. So an early
	// click no-ops and the dialog stays open (grid never refreshes -> the following verifyClientExists on
	// the fresh invite name times out — the exact observed failure). Fix: let the async validator settle,
	// then dispatch and POLL the dialog host; re-dispatch until it actually closes (form has gone valid).
	const page = getPage();
	const dialog = page.locator(ClientsPage.inviteDialogCss);
	await waitForSpinnerGone();
	await page.waitForTimeout(1200); // allow the getUserByEmail async validator round-trip to resolve
	for (let attempt = 0; attempt < 6; attempt++) {
		if ((await dialog.count().catch(() => 0)) === 0) {
			return; // closed (a slow earlier dispatch landed) — never click into the page behind it
		}
		await page
			.locator(ClientsPage.saveInviteButtonCss)
			.first()
			.dispatchEvent('click', undefined, { timeout: 5000 })
			.catch(() => undefined);
		try {
			await dialog.first().waitFor({ state: 'detached', timeout: 5000 });
			return; // dialog closed -> invite persisted and the grid will refresh
		} catch {
			// still open (form was PENDING/invalid at click time) — settle again and retry the dispatch
			await page.waitForTimeout(900);
		}
	}
	// Fail here, naming the cause, instead of in the next grid assertion.
	await expect(dialog, 'the Invite Contact dialog never closed after "Email Invite"').toHaveCount(0, {
		timeout: 5000
	});
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ClientsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Settle after the preceding mutation (the grid re-renders), then click the row ONCE and poll the
	// Edit button's disabled attr — the row click TOGGLES selection, so re-clicking turns it off.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ClientsPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(ClientsPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

// Select the grid row whose name link contains `name` (pollution-resilient row pick). The suite runs
// serially on ONE shared seed, so by the time the edit/delete steps run the clients grid holds MORE than
// one row: this spec's own addClient + toolbar-Invite create two records, and earlier specs leave others.
// A plain nth(0) then grabs whichever row sorts first — not deterministically ours — so the rename/delete
// would act on the wrong client and the verify would fail. Filtering by the unique faker name targets
// exactly the record this step means to act on. Same settle-then-click-once-and-poll-Edit handling as
// selectTableRow (the row click TOGGLES selection, so only re-click if the first click was lost).
export const selectTableRowByName = async (name: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ClientsPage.selectTableRowCss).filter({ hasText: name }).first();
	const editBtn = page.locator(ClientsPage.editButtonCss).first();
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

export const clickTabelRowByText = async (text) => {
	await clickElementByText(ClientsPage.selectTableRowCss, text);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.editButtonCss);
};

export const clickEditButton = async (_index: number = 0) => {
	// Confirmed on the wizard's Name field, then settled (see ContactsLeads.po settleWizardForm).
	await dispatchClickWhenSettled(ClientsPage.editButtonCss, ClientsPage.nameInputCss);
	await settleWizardForm();
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ClientsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ClientsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(ClientsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ClientsPage.toastrMessageCss);
};

export const contactNameInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.clientNameCss);
};

export const enterClientNameData = async (data) => {
	await clearField(ClientsPage.clientNameCss);
	await enterInput(ClientsPage.clientNameCss, data);
};

export const clientPhoneInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.clientPhoneCss);
};

export const enterClientPhoneData = async (data) => {
	await clearField(ClientsPage.clientPhoneCss);
	await enterInput(ClientsPage.clientPhoneCss, data);
};

export const clientEmailInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.clientEmailCss);
};

export const enterClientEmailData = async (data) => {
	await clearField(ClientsPage.clientEmailCss);
	await enterInput(ClientsPage.clientEmailCss, data);
};

export const verifyClientExists = async (text) => {
	await verifyText(ClientsPage.verifyClientCss, text);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(ClientsPage.verifyClientCss, text);
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(ClientsPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	await clickWizardForward(ClientsPage.lastStepBtnCss);
};

// The wizard is replaced by the grid only once addOrEditOrganizationContact() persisted the contact (on an
// API error it stays up with a danger toast): proves the save landed, and fails HERE if it did not.
export const verifyContactFormClosed = async () => {
	await expect(
		getPage().locator(ClientsPage.contactMutationCss),
		'the contact wizard is still open after Save — the client was not saved'
	).toHaveCount(0, { timeout: 24_000 });
};

export const budgetInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.budgetInputCss);
};

export const enterBudgetData = async (data) => {
	await clearField(ClientsPage.budgetInputCss);
	await enterInput(ClientsPage.budgetInputCss, data);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(ClientsPage.searchNameInputCss);
};

export const searchClientName = async (name: string) => {
	await clearField(ClientsPage.searchNameInputCss);
	await enterInput(ClientsPage.searchNameInputCss, name);
};

export const verifyClientNameInTable = async (name: string) => {
	await verifyByLength(ClientsPage.clientsTableRow, 1);
	await verifyByText(ClientsPage.clientsTableData, name);
};

export const clearSearchInput = async () => {
	await clearField(ClientsPage.searchNameInputCss);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.viewButtonCss);
};

export const clickViewButton = async () => {
	await clickButton(ClientsPage.viewButtonCss);
};

export const verifyClientNameView = async (name: string) => {
	await verifyByText(ClientsPage.clientNameViewCss, name);
};

export const verifyContactType = async (type: string) => {
	await verifyByText(ClientsPage.clientTypeViewCss, type);
};

export const verifyBackBtn = async () => {
	await verifyElementIsVisible(ClientsPage.backBtn);
};

export const clickOnBackBtn = async () => {
	await clickButton(ClientsPage.backBtn);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(ClientsPage.selectTableRowCss, length);
};
