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
	verifyTextNotExisting
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CustomersPage } from '../../../src/support/Base/pageobjects/CustomersPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(CustomersPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(CustomersPage.gridButtonCss, index);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.addButtonCss);
};

export const clickAddButton = async (index: number = 0) => {
	await clickButtonByIndex(CustomersPage.addButtonCss, index);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(CustomersPage.nameInputCss);
	await enterInput(CustomersPage.nameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.emailInputCss);
};

export const enterEmailInputData = async (data: string) => {
	await clearField(CustomersPage.emailInputCss);
	await enterInput(CustomersPage.emailInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.phoneInputCss);
};

export const enterPhoneInputData = async (data: string) => {
	await clearField(CustomersPage.phoneInputCss);
	await enterInput(CustomersPage.phoneInputCss, data);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(CustomersPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(CustomersPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickElementByText(CustomersPage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(CustomersPage.cityInputCss);
	await enterInput(CustomersPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(CustomersPage.postCodeInputCss);
	await enterInput(CustomersPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.streetInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(CustomersPage.streetInputCss);
	await enterInput(CustomersPage.streetInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(CustomersPage.projectsDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(CustomersPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = async (text: string) => {
	await clickElementByText(CustomersPage.projectsDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(CustomersPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(CustomersPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index: number) => {
	await clickButtonByIndex(CustomersPage.dropdownOptionCss, index);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(CustomersPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(CustomersPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(CustomersPage.tagsDropdownOption, index);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data: string) => {
	await clearField(CustomersPage.websiteInputCss);
	await enterInput(CustomersPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(CustomersPage.saveButtonCss);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(CustomersPage.inviteButtonCss);
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	await clickButton(CustomersPage.saveInviteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(CustomersPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(CustomersPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.editButtonCss);
};

export const clickEditButton = async (index: number = 0) => {
	await clickButtonByIndex(CustomersPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(CustomersPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(CustomersPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(CustomersPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(CustomersPage.toastrMessageCss);
};

export const customerNameInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerNameCss);
};

export const enterCustomerNameData = async (data: string) => {
	await clearField(CustomersPage.customerNameCss);
	await enterInput(CustomersPage.customerNameCss, data);
};

export const customerPhoneInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerPhoneCss);
};

export const enterCustomerPhoneData = async (data: string) => {
	await clearField(CustomersPage.customerPhoneCss);
	await enterInput(CustomersPage.customerPhoneCss, data);
};

export const customerEmailInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerEmailCss);
};

export const enterCustomerEmailData = async (data: string) => {
	await clearField(CustomersPage.customerEmailCss);
	await enterInput(CustomersPage.customerEmailCss, data);
};

export const verifyCustomerExists = async (text: string) => {
	await verifyText(CustomersPage.verifyCustomerCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(CustomersPage.verifyCustomerCss, text);
};

export const verifyNextButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.nextButtonCss);
};

export const clickNextButton = async () => {
	await clickButton(CustomersPage.nextButtonCss);
};

export const verifyFinishButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.finishButtonCss);
};

export const clickFinishButton = async () => {
	await clickButton(CustomersPage.finishButtonCss);
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(CustomersPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	await clickButton(CustomersPage.lastStepBtnCss);
};

export const budgetInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.budgetInputCss);
};

export const enterBudgetData = async (data: string) => {
	await clearField(CustomersPage.budgetInputCss);
	await enterInput(CustomersPage.budgetInputCss, data);
};
