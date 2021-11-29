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
	vefiryByLength
} from '../utils/util';
import { ClientsPage } from '../pageobjects/ClientsPageObject';

export const gridBtnExists = () => {
	cy.intercept('/api/organization-contact*').as('waitClient');
	verifyElementIsVisible(ClientsPage.gridButtonCss);
	cy.wait('@waitClient');
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ClientsPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButtonByIndex(ClientsPage.addButtonCss, 0);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(ClientsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(ClientsPage.nameInputCss);
	enterInput(ClientsPage.nameInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(ClientsPage.emailInputCss);
};

export const enterEmailInputData = (data) => {
	clearField(ClientsPage.emailInputCss);
	enterInput(ClientsPage.emailInputCss, data);
};

export const phoneInputVisible = () => {
	verifyElementIsVisible(ClientsPage.phoneInputCss);
};

export const enterPhoneInputData = (data) => {
	clearField(ClientsPage.phoneInputCss);
	enterInput(ClientsPage.phoneInputCss, data);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(ClientsPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(ClientsPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(ClientsPage.dropdownOptionCss, text);
};

export const nextButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.nextButtonCss);
};

export const clickNextButton = () => {
	clickButton(ClientsPage.nextButtonCss);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(ClientsPage.cityInpuCss);
};

export const enterCityInputData = (data) => {
	clearField(ClientsPage.cityInpuCss);
	enterInput(ClientsPage.cityInpuCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(ClientsPage.postcodeinputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(ClientsPage.postcodeinputCss);
	enterInput(ClientsPage.postcodeinputCss, data);
};

export const streetInputVisible = () => {
	verifyElementIsVisible(ClientsPage.streetInputCss);
};

export const enterStreetInputData = (data) => {
	clearField(ClientsPage.streetInputCss);
	enterInput(ClientsPage.streetInputCss, data);
};

export const projectDropdownVisible = () => {
	verifyElementIsVisible(ClientsPage.projectsDropdownCss);
};

export const clickProjectDropdown = () => {
	clickButton(ClientsPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = (text) => {
	clickElementByText(ClientsPage.projectsDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ClientsPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(ClientsPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(ClientsPage.dropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = (name) => {
	clickElementByText(
		ClientsPage.dropdownOptionCss,
		name
	);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(ClientsPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(ClientsPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(ClientsPage.tagsDropdownOption, index);
};

export const websiteInputVisible = () => {
	verifyElementIsVisible(ClientsPage.websiteInputCss);
};

export const enterWebsiteInputData = (data) => {
	clearField(ClientsPage.websiteInputCss);
	enterInput(ClientsPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ClientsPage.saveButtonCss);
};

export const inviteButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(ClientsPage.inviteButtonCss);
};

export const saveInvitebuttonVisible = () => {
	verifyElementIsVisible(ClientsPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = () => {
	clickButton(ClientsPage.saveInviteButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ClientsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ClientsPage.selectTableRowCss, index);
};

export const clickTabelRowByText = (text) => {
	clickElementByText(ClientsPage.selectTableRowCss, text);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(ClientsPage.editButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(ClientsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(ClientsPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(ClientsPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ClientsPage.toastrMessageCss);
};

export const contactNameInputVisible = () => {
	verifyElementIsVisible(ClientsPage.clientNameCss);
};

export const enterClientNameData = (data) => {
	clearField(ClientsPage.clientNameCss);
	enterInput(ClientsPage.clientNameCss, data);
};

export const clientPhoneInputVisible = () => {
	verifyElementIsVisible(ClientsPage.clientPhoneCss);
};

export const enterClientPhoneData = (data) => {
	clearField(ClientsPage.clientPhoneCss);
	enterInput(ClientsPage.clientPhoneCss, data);
};

export const clientEmailInputVisible = () => {
	verifyElementIsVisible(ClientsPage.clientEmailCss);
};

export const enterClientEmailData = (data) => {
	clearField(ClientsPage.clientEmailCss);
	enterInput(ClientsPage.clientEmailCss, data);
};

export const verifyClientExists = (text) => {
	verifyText(ClientsPage.verifyClientCss, text);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(ClientsPage.verifyClientCss, text);
};

export const lastStepBtnVisible = () =>{
	verifyElementIsVisible(ClientsPage.lastStepBtnCss)
}

export const clickLastStepBtn = () => {
	clickButton(ClientsPage.lastStepBtnCss)
}

export const budgetInputVisible = () => {
	verifyElementIsVisible(ClientsPage.budgetInpuCss);
};

export const enterBudgetData = (data) => {
	clearField(ClientsPage.budgetInpuCss);
	enterInput(ClientsPage.budgetInpuCss, data);
};

export const verifyNameInput = () => {
	verifyElementIsVisible(ClientsPage.searchNameInputCss);
};

export const searchClientName = (name: string) => {
	clearField(ClientsPage.searchNameInputCss);
	enterInput(ClientsPage.searchNameInputCss, name);
};

export const verifyClientNameInTable = (name: string) => {
	verifyByText(ClientsPage.clientsTableData, name)
	vefiryByLength(ClientsPage.clientsTableRow, 1)
};

export const clearSearchInput = () => {
	clearField(ClientsPage.searchNameInputCss);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(ClientsPage.viewButtonCss);
};

export const clickViewButton = () => {
	cy.intercept('GET','/api/employee*').as('waitClient');
	clickButton(ClientsPage.viewButtonCss);
	cy.wait('@waitClient')
};

export const verifyClientNameView = (name: string) => {
	verifyByText(ClientsPage.clientNameViewCss, name)
};

export const verifyContactType = (type: string) => {
	verifyByText(ClientsPage.clientTypeViewCss, type)
};

export const verifyBackBtn = () => {
	verifyElementIsVisible(ClientsPage.backBtn)
};

export const clickOnBackBtn = () => {
	clickButton(ClientsPage.backBtn);
};

export const verifySearchResult = (length: number) =>{
	vefiryByLength(ClientsPage.selectTableRowCss, length);
};