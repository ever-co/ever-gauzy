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
} from '../utils/util';
import { ContactsLeadsPage } from '../pageobjects/ContactsLeadsPageObject';

export const gridBtnExists = () => {
	cy.intercept('GET', '/api/organization-projects*').as('waitToLoad');
	verifyElementIsVisible(ContactsLeadsPage.gridButtonCss);
	cy.wait('@waitToLoad');
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ContactsLeadsPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButtonByIndex(ContactsLeadsPage.addButtonCss,0);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(ContactsLeadsPage.nameInputCss);
	enterInput(ContactsLeadsPage.nameInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.emailInputCss);
};

export const enterEmailInputData = (data) => {
	clearField(ContactsLeadsPage.emailInputCss);
	enterInput(ContactsLeadsPage.emailInputCss, data);
};

export const phoneInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.phoneInputCss);
};

export const enterPhoneInputData = (data) => {
	clearField(ContactsLeadsPage.phoneInputCss);
	enterInput(ContactsLeadsPage.phoneInputCss, data);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(ContactsLeadsPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(ContactsLeadsPage.dropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.cityInpuCss);
};

export const enterCityInputData = (data) => {
	clearField(ContactsLeadsPage.cityInpuCss);
	enterInput(ContactsLeadsPage.cityInpuCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.postcodeinputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(ContactsLeadsPage.postcodeinputCss);
	enterInput(ContactsLeadsPage.postcodeinputCss, data);
};

export const streetInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.streetInputCss);
};

export const enterStreetInputData = (data) => {
	clearField(ContactsLeadsPage.streetInputCss);
	enterInput(ContactsLeadsPage.streetInputCss, data);
};

export const projectDropdownVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.projectsDropdownCss);
};

export const clickProjectDropdown = () => {
	clickButton(ContactsLeadsPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = (text) => {
	clickElementByText(ContactsLeadsPage.projectsDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(ContactsLeadsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(ContactsLeadsPage.dropdownOptionCss, index);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(ContactsLeadsPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(ContactsLeadsPage.tagsDropdownOption, index);
};

export const websiteInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.websiteInputCss);
};

export const enterWebsiteInputData = (data) => {
	clearField(ContactsLeadsPage.websiteInputCss);
	enterInput(ContactsLeadsPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ContactsLeadsPage.saveButtonCss);
};

export const inviteButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(ContactsLeadsPage.inviteButtonCss);
};

export const saveInvitebuttonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = () => {
	clickButton(ContactsLeadsPage.saveInviteButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ContactsLeadsPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(ContactsLeadsPage.editButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(ContactsLeadsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(ContactsLeadsPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(ContactsLeadsPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ContactsLeadsPage.toastrMessageCss);
};

export const contactNameInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.contactNameCss);
};

export const enterContactNameData = (data) => {
	clearField(ContactsLeadsPage.contactNameCss);
	enterInput(ContactsLeadsPage.contactNameCss, data);
};

export const contactPhoneInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.contactPhoneCss);
};

export const enterContactPhoneData = (data) => {
	clearField(ContactsLeadsPage.contactPhoneCss);
	enterInput(ContactsLeadsPage.contactPhoneCss, data);
};

export const contactEmailInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.contactEmailCss);
};

export const enterContactEmailData = (data) => {
	clearField(ContactsLeadsPage.contactEmailCss);
	enterInput(ContactsLeadsPage.contactEmailCss, data);
};

export const verifyLeadExists = (text) => {
	verifyText(ContactsLeadsPage.verifyLeadCss, text);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(ContactsLeadsPage.verifyLeadCss, text);
};

export const verifyNextButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.nextButtonCss);
};

export const clickNextButton = () => {
	clickButton(ContactsLeadsPage.nextButtonCss);
};

export const verifyFinishButtonVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.finishButtonCss);
};

export const clickFinishButton = () => {
	clickButton(ContactsLeadsPage.finishButtonCss);
};

export const lastStepBtnVisible = () =>{
	verifyElementIsVisible(ContactsLeadsPage.lastStepBtnCss)
}

export const clickLastStepBtn = () => {
	clickButton(ContactsLeadsPage.lastStepBtnCss)
}

export const budgetInputVisible = () => {
	verifyElementIsVisible(ContactsLeadsPage.budgetInpuCss);
};

export const enterBudgetData = (data) => {
	clearField(ContactsLeadsPage.budgetInpuCss);
	enterInput(ContactsLeadsPage.budgetInpuCss, data);
};