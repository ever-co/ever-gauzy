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
	verifyByLength,
	verifyByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ContactsLeadsPage } from '../../../src/support/Base/pageobjects/ContactsLeadsPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.gridButtonCss);
};

export const gridBtnClick = async (index) => {
	await clickButtonByIndex(ContactsLeadsPage.gridButtonCss, index);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButtonByIndex(ContactsLeadsPage.addButtonCss, 0);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ContactsLeadsPage.nameInputCss);
	await enterInput(ContactsLeadsPage.nameInputCss, data);
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
	await clickElementByText(ContactsLeadsPage.dropdownOptionCss, text);
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
	await clickButton(ContactsLeadsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	await clickButtonByIndex(ContactsLeadsPage.dropdownOptionCss, index);
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
	await clickButton(ContactsLeadsPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(ContactsLeadsPage.inviteButtonCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	await clickButton(ContactsLeadsPage.saveInviteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(ContactsLeadsPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.editButtonCss);
};

export const clickEditButton = async (index: number = 0) => {
	await clickButtonByIndex(ContactsLeadsPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(ContactsLeadsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ContactsLeadsPage.confirmDeleteButtonCss);
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
	await clickButton(ContactsLeadsPage.nextButtonCss);
};

export const verifyFinishButtonVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.finishButtonCss);
};

export const clickFinishButton = async () => {
	await clickButton(ContactsLeadsPage.finishButtonCss);
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(ContactsLeadsPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	await clickButton(ContactsLeadsPage.lastStepBtnCss);
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
