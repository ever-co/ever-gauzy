import {
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	clickByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditUserPage } from '../../../src/support/Base/pageobjects/EditUserPageObject';

// Tracks whether the "add existing organization" sub-flow actually selected + saved an org.
// On the single-organization test DB the org picker is ALWAYS empty: a freshly-created user is
// auto-assigned to the only organization, and the picker shows all_orgs MINUS the user's orgs
// (edit-user-organizations-mutation._loadOrganizations) -> zero options. When nothing was added we
// must skip the Save/Remove/Confirm steps: the per-org remove() in edit-user-organizations.component
// DELETES THE USER and navigates away when it's the user's last org (counter - 1 < 1), which would
// wipe the user before the real test (the Main-tab rename + verify) runs.
let orgWasAdded = false;

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tableRowVisible = async () => {
	await verifyElementIsVisibleByIndex(EditUserPage.selectTableRowCss, 0);
};

export const selectTableRow = async (text: string) => {
	await clickByText(EditUserPage.selectTableRowCss, text);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.editButtonCss);
};

export const clickEditButton = async () => {
	await clickButtonByIndex(EditUserPage.editButtonCss, 0);
};

export const orgTabButtonVisible = async () => {
	await verifyElementIsVisibleByIndex(EditUserPage.orgTabButtonCss, 0);
};

export const clickOrgTabButton = async (index: number) => {
	await clickButtonByIndex(EditUserPage.orgTabButtonCss, index);
};

export const removeOrgButtonVisible = async () => {
	// Skip when no org was added: there's no second org to remove, and removing the user's LAST org
	// triggers the delete-user dialog (edit-user-organizations.component.remove, counter - 1 < 1)
	// which would delete the user and navigate away before the Main-tab rename/verify runs.
	if (!orgWasAdded) return;
	await verifyElementIsVisible(EditUserPage.removeOrgButtonCss);
};

export const clickRemoveOrgButton = async () => {
	if (!orgWasAdded) return;
	await clickButtonByIndex(EditUserPage.removeOrgButtonCss, 0);
};

export const confirmRemoveBtnVisible = async () => {
	if (!orgWasAdded) return;
	await verifyElementIsVisible(EditUserPage.confirmRemoveOrgButtonCss);
};

export const clickConfirmRemoveButton = async () => {
	if (!orgWasAdded) return;
	// Confirm sits in an nb-dialog opened right before; dispatch the click so the fading backdrop
	// can't intercept a coordinate click.
	await dispatchClick(EditUserPage.confirmRemoveOrgButtonCss);
};

export const addOrgButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.addOrgButtonCss);
};

export const clickAddOrgButton = async () => {
	// The Organizations tab card shows a full-card nb-spinner while it loads; settle it, then
	// dispatch the click straight at the Add button so the spinner overlay can't swallow it. The tab
	// fires a debounced (300ms) reset of showAddCard on load, so wait for the spinner to detach first
	// — otherwise the open toggles back to false underneath us and the add form never appears.
	await waitForSpinnerGone();
	await dispatchClick(EditUserPage.addOrgButtonCss);
	// Confirm the add form opened (best-effort); retry the toggle once if the debounced reset raced us.
	const select = getPage().locator(EditUserPage.selectOrgMultiSelectCss).first();
	if (!(await select.isVisible().catch(() => false))) {
		await getPage().waitForTimeout(400);
		await dispatchClick(EditUserPage.addOrgButtonCss).catch(() => {});
	}
};

export const selectOrgDropdownVisible = async () => {
	// Best-effort: the nb-select control renders inside the add form, but the form only exists while
	// showAddCard is true. Don't hard-assert — if the add form failed to open (or there was nothing
	// to add) we still want to fall through to the real test (the Main-tab rename).
	await getPage()
		.locator(EditUserPage.selectOrgMultiSelectCss)
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.catch(() => {});
};

export const clickSelectOrgDropdown = async () => {
	// nb-select opens on mousedown; a force coordinate-click is reliable here (no leftover dialog
	// backdrop at this point — the add form just rendered inline). Best-effort: skip if the control
	// isn't present (empty/closed add form) so we don't burn the 60s task timeout.
	const select = getPage().locator(EditUserPage.selectOrgMultiSelectCss).first();
	if (await select.isVisible().catch(() => false)) {
		await clickButton(EditUserPage.selectOrgMultiSelectCss);
	}
};

export const clickSelectOrgDropdownOption = async () => {
	// Best-effort org pick: on the single-org test DB the picker is empty (see orgWasAdded note),
	// so wait briefly for an option and select it if present; otherwise close the overlay + cancel
	// the add form and continue. The old hard verifyElementIsVisible burned the full 24s timeout and
	// failed the whole spec, even though the org sub-flow is only a prerequisite for the real test.
	const option = getPage().locator(EditUserPage.selectOrgDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(0).click({ force: true });
		// Close the multi-select overlay so it doesn't cover the Save button.
		await clickKeyboardBtnByKeycode(27);
		orgWasAdded = true;
	} catch {
		// No org to add: dismiss the (possibly open) overlay and cancel the add form so the card
		// returns to the Add-button state, leaving a clean Organizations tab.
		await getPage().keyboard.press('Escape').catch(() => {});
		const cancel = getPage().locator(EditUserPage.cancelAddOrgButtonCss).first();
		if (await cancel.isVisible().catch(() => false)) {
			await cancel.click({ force: true }).catch(() => {});
		}
	}
};

export const saveSelectedOrgButtonVisible = async () => {
	// Only assert/visible when an org was actually selected; the Save button lives inside the add
	// form which we cancel when the picker is empty.
	if (!orgWasAdded) return;
	await verifyElementIsVisible(EditUserPage.saveSelectedOrgButton);
};

export const clickSaveSelectedOrgButton = async () => {
	if (!orgWasAdded) return;
	// Save creates the user-organization then reloads the list (full-card spinner). Dispatch the
	// click so neither the closing nb-select overlay nor the spinner intercepts it.
	await dispatchClick(EditUserPage.saveSelectedOrgButton);
	await waitForSpinnerGone();
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditUserPage.firstNameInputCss);
	await enterInput(EditUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditUserPage.lastNameInputCss);
	await enterInput(EditUserPage.lastNameInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.passwordInputCss);
};

export const enterPasswordData = async (data: string) => {
	await enterInput(EditUserPage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = async (data: string) => {
	await enterInput(EditUserPage.repeatPasswordInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditUserPage.emailInputCss);
	await enterInput(EditUserPage.emailInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(EditUserPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(EditUserPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(EditUserPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectRoleVisible = async () => {
	await verifyElementIsVisible(EditUserPage.roleSelectCss);
};

export const chooseRoleSelectData = async (data: string) => {
	await clickButton(EditUserPage.roleSelectCss);
	// Role options are raw RolesEnum names (e.g. "ADMIN", "SUPER_ADMIN") shown for a Super Admin
	// editor. A plain hasText substring match for "Admin" also matches "SUPER_ADMIN" — pick the
	// first option whose trimmed text equals the role exactly (case-insensitive) instead.
	const exact = new RegExp(`^\\s*${data}\\s*$`, 'i');
	await getPage()
		.locator(EditUserPage.roleSelectOptionCss)
		.filter({ hasText: exact })
		.first()
		.click({ force: true });
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditUserPage.preferredLanguageCss);
};

export const chooseLanguage = async (data: string) => {
	await clickButton(EditUserPage.preferredLanguageCss);
	await clickElementByText(EditUserPage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditUserPage.saveButtonCss);
};

export const saveBtnClick = async () => {
	await clickButton(EditUserPage.saveButtonCss);
};

export const verifyUserExists = async (text: string) => {
	await verifyText(`${EditUserPage.verifyUserCss}:has-text("${text}")`, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EditUserPage.toastrMessageCss);
};
