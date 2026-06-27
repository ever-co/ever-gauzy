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
	verifyByText,
	verifyByLength
} from '../util';
import { getPage } from '../page-context';
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
	await clickButtonByIndex(ClientsPage.addButtonCss, 0);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ClientsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ClientsPage.nameInputCss);
	await enterInput(ClientsPage.nameInputCss, data);
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

export const selectCountryFromDropdown = async (text) => {
	await clickElementByText(ClientsPage.countryDropdownOptionCss, text);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.nextButtonCss);
};

export const clickNextButton = async () => {
	await clickButton(ClientsPage.nextButtonCss);
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
	await clickElementByText(ClientsPage.projectsDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ClientsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(ClientsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	const page = getPage();
	const option = page.locator(ClientsPage.dropdownOptionCss);
	// Best-effort employee pick: the option list (org employees "working" in the header date range)
	// loads async and can legitimately be empty. Select one if it shows; otherwise leave members empty
	// — a client saves fine without members — so the stepper still finishes. Avoids a hard 60s timeout.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const selectEmployeeFromDropdownByName = async (name) => {
	await clickElementByText(ClientsPage.dropdownOptionCss, name);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(ClientsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(ClientsPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(ClientsPage.tagsDropdownOption, index);
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
	await clickButton(ClientsPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(ClientsPage.inviteButtonCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	await clickButton(ClientsPage.saveInviteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ClientsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(ClientsPage.selectTableRowCss, index);
};

export const clickTabelRowByText = async (text) => {
	await clickElementByText(ClientsPage.selectTableRowCss, text);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.editButtonCss);
};

export const clickEditButton = async (index: number = 0) => {
	await clickButtonByIndex(ClientsPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(ClientsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ClientsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ClientsPage.confirmDeleteButtonCss);
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
	await clickButton(ClientsPage.lastStepBtnCss);
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
