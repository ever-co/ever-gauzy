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
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditUserPage } from '../../../src/support/Base/pageobjects/EditUserPageObject';

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
	await verifyElementIsVisible(EditUserPage.removeOrgButtonCss);
};

export const clickRemoveOrgButton = async () => {
	await clickButtonByIndex(EditUserPage.removeOrgButtonCss, 0);
};

export const confirmRemoveBtnVisible = async () => {
	await verifyElementIsVisible(EditUserPage.confirmRemoveOrgButtonCss);
};

export const clickConfirmRemoveButton = async () => {
	// Confirm sits in an nb-dialog opened right before; dispatch the click so the fading backdrop
	// can't intercept a coordinate click.
	await dispatchClick(EditUserPage.confirmRemoveOrgButtonCss);
};

export const addOrgButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.addOrgButtonCss);
};

export const clickAddOrgButton = async () => {
	// The Organizations tab card shows a full-card nb-spinner while it loads; settle it, then
	// dispatch the click straight at the Add button so the spinner overlay can't swallow it.
	await waitForSpinnerGone();
	await dispatchClick(EditUserPage.addOrgButtonCss);
};

export const selectOrgDropdownVisible = async () => {
	await verifyElementIsVisible(EditUserPage.selectOrgMultiSelectCss);
};

export const clickSelectOrgDropdown = async () => {
	// nb-select opens on mousedown; a force coordinate-click is reliable here (no leftover dialog
	// backdrop at this point — the add form just rendered inline).
	await clickButton(EditUserPage.selectOrgMultiSelectCss);
};

export const clickSelectOrgDropdownOption = async () => {
	// Pick the first org option. The dropdown is open from clickSelectOrgDropdown; assert the
	// option is present (so submitForm has a selectedOrganizationsId) then click it — the old
	// clickElementIfVisible silently no-opped when the option list hadn't rendered, leaving the
	// selection empty and the add a no-op.
	await verifyElementIsVisible(EditUserPage.selectOrgDropdownOptionCss);
	await clickButtonByIndex(EditUserPage.selectOrgDropdownOptionCss, 0);
	// Close the multi-select overlay so it doesn't cover the Save button.
	await clickKeyboardBtnByKeycode(27);
};

export const saveSelectedOrgButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.saveSelectedOrgButton);
};

export const clickSaveSelectedOrgButton = async () => {
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
	await clickElementByText(EditUserPage.roleSelectOptionCss, data);
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
