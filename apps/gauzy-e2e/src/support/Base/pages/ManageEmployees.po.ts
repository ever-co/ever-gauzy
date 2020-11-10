import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex
} from '../utils/util';
import { ManageEmployeesPage } from '../pageobjects/ManageEmployeesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ManageEmployeesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ManageEmployeesPage.gridButtonCss, index);
};

export const inviteButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(ManageEmployeesPage.inviteButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.emailsInputCss);
};

export const enterEmailData = (data) => {
	enterInputConditionally(ManageEmployeesPage.emailsInputCss, data);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.dateInputCss);
};

export const enterDateData = () => {
	clearField(ManageEmployeesPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(ManageEmployeesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const selectProjectDropdownVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.selectProjectDropdownCss);
};

export const clickProjectDropdown = () => {
	clickButton(ManageEmployeesPage.selectProjectDropdownCss);
};

export const selectProjectFromDropdown = (text) => {
	clickButton(ManageEmployeesPage.selectProjectDropdownOptionCss);
	clickElementByText(
		ManageEmployeesPage.selectProjectDropdownOptionCss,
		text
	);
};

export const sendInviteButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = () => {
	clickButton(ManageEmployeesPage.sendInviteButtonCss);
};

///////////////////////////////
export const addEmployeeButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.addEmployeeButtonCss);
};

export const clickAddEmployeeButton = () => {
	clickButton(ManageEmployeesPage.addEmployeeButtonCss);
};

export const firstNameInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.firstNameInputCss);
};

export const enterFirstNameData = (data) => {
	clearField(ManageEmployeesPage.firstNameInputCss);
	enterInput(ManageEmployeesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.lastNameInputCss);
};

export const enterLastNameData = (data) => {
	clearField(ManageEmployeesPage.lastNameInputCss);
	enterInput(ManageEmployeesPage.lastNameInputCss, data);
};

export const usernameInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.usernameInputCss);
};

export const enterUsernameData = (data) => {
	clearField(ManageEmployeesPage.usernameInputCss);
	enterInput(ManageEmployeesPage.usernameInputCss, data);
};

export const employeeEmailInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.emailInputCss);
};

export const enterEmployeeEmailData = (data) => {
	clearField(ManageEmployeesPage.emailInputCss);
	enterInput(ManageEmployeesPage.emailInputCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.passwordInputCss);
};

export const enterPasswordInputData = (data) => {
	clearField(ManageEmployeesPage.passwordInputCss);
	enterInput(ManageEmployeesPage.passwordInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(ManageEmployeesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(ManageEmployeesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(ManageEmployeesPage.cardBodyCss);
};

export const imageInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.imgInputCss);
};

export const enterImageDataUrl = (url) => {
	enterInput(ManageEmployeesPage.imgInputCss, url);
};

export const nextButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.nextButtonCss);
};

export const clickNextButton = () => {
	clickButton(ManageEmployeesPage.nextButtonCss);
};

export const nextStepButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.nextStepButtonCss);
};

export const clickNextStepButton = () => {
	clickButton(ManageEmployeesPage.nextStepButtonCss);
};

export const lastStepButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.lastStepButtonCss);
};

export const clickLastStepButton = () => {
	clickButton(ManageEmployeesPage.lastStepButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ManageEmployeesPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.editEmployeeButtonCss);
};

export const clickEditButton = () => {
	clickButton(ManageEmployeesPage.editEmployeeButtonCss);
};

export const usernameEditInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.usernameEditInputCss);
};

export const enterUsernameEditInputData = (data) => {
	clearField(ManageEmployeesPage.usernameEditInputCss);
	enterInput(ManageEmployeesPage.usernameEditInputCss, data);
};

export const emailEditInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.emailEditInputCss);
};

export const enterEmailEditInputData = (data) => {
	clearField(ManageEmployeesPage.emailEditInputCss);
	enterInput(ManageEmployeesPage.emailEditInputCss, data);
};

export const firstNameEditInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.firstNameEditInputCss);
};

export const enterFirstNameEditInputData = (data) => {
	clearField(ManageEmployeesPage.firstNameEditInputCss);
	enterInput(ManageEmployeesPage.firstNameEditInputCss, data);
};

export const lastNameEditInputVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.lastNameEditInputCss);
};

export const enterLastNameEditInputData = (data) => {
	clearField(ManageEmployeesPage.lastNameEditInputCss);
	enterInput(ManageEmployeesPage.lastNameEditInputCss, data);
};

export const preferedLanguageDropdownVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.preferedLanguageDropdownCss);
};

export const selectLanguageFromDropdown = (text) => {
	clickElementByText(ManageEmployeesPage.preferedLanguageOptionCss, text);
};

export const saveEditButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.saveEditButtonCss);
};

export const clickSaveEditButton = () => {
	clickButton(ManageEmployeesPage.saveEditButtonCss);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(ManageEmployeesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(ManageEmployeesPage.backButtonCss);
};
