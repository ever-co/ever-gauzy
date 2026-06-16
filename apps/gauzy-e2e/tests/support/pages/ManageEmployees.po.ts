import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	clickButtonWithForce
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageEmployeesPage } from '../../../src/support/Base/pageobjects/ManageEmployeesPageObject';

// INVITE EMPLOYEE BY EMAIL
export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(ManageEmployeesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailsInputCss);
};

export const enterEmailData = async (data) => {
	await enterInputConditionally(ManageEmployeesPage.emailsInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.dateInputCss);
};

export const enterDateData = async () => {
	await clearField(ManageEmployeesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageEmployeesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectProjectDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectProjectDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(ManageEmployeesPage.selectProjectDropdownCss);
};

export const selectProjectFromDropdown = async (text) => {
	await clickElementByText(
		ManageEmployeesPage.selectProjectDropdownOptionCss,
		text
	);
};

export const sendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = async () => {
	await clickButton(ManageEmployeesPage.sendInviteButtonCss);
};

// ADD NEW EMPLOYEE
export const addEmployeeButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addEmployeeButtonCss);
};

export const clickAddEmployeeButton = async () => {
	await clickButtonWithForce(ManageEmployeesPage.addEmployeeButtonCss);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameInputCss);
};

export const enterFirstNameData = async (data) => {
	await enterInput(ManageEmployeesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameInputCss);
};

export const enterLastNameData = async (data) => {
	await enterInput(ManageEmployeesPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameInputCss);
};

export const enterUsernameData = async (data) => {
	await enterInput(ManageEmployeesPage.usernameInputCss, data);
};

export const employeeEmailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailInputCss);
};

export const enterEmployeeEmailData = async (data) => {
	await enterInput(ManageEmployeesPage.emailInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await enterInput(ManageEmployeesPage.passwordInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ManageEmployeesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ManageEmployeesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(ManageEmployeesPage.cardBodyCss);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.imgInputCss);
};

export const enterImageDataUrl = async (url) => {
	await enterInput(ManageEmployeesPage.imgInputCss, url);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextButtonCss);
};

export const clickNextButton = async () => {
	await clickButton(ManageEmployeesPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	await clickButton(ManageEmployeesPage.nextStepButtonCss);
};

export const lastStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastStepButtonCss);
};

export const clickLastStepButton = async () => {
	await clickButton(ManageEmployeesPage.lastStepButtonCss);
};

// EDIT EMPLOYEE

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(ManageEmployeesPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.editEmployeeButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(ManageEmployeesPage.editEmployeeButtonCss);
};

export const usernameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameEditSecondInputCss);
};

export const enterUsernameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.usernameEditSecondInputCss);
	await enterInput(ManageEmployeesPage.usernameEditSecondInputCss, data);
};

export const emailEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailEditSecondInputCss);
};

export const enterEmailEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.emailEditSecondInputCss);
	await enterInput(ManageEmployeesPage.emailEditSecondInputCss, data);
};

export const firstNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameSecondEditInputCss);
};

export const enterFirstNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.firstNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.firstNameSecondEditInputCss, data);
};

export const lastNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameSecondEditInputCss);
};

export const enterLastNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.lastNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.lastNameSecondEditInputCss, data);
};

export const preferredLanguageDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.preferredLanguageDropdownCss);
};

export const clickPreferredLanguageDropdown = async () => {
	await clickButton(ManageEmployeesPage.preferredLanguageDropdownCss);
};

export const selectLanguageFromDropdown = async (text) => {
	await clickElementByText(ManageEmployeesPage.preferredLanguageOptionCss, text);
};

export const saveEditButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.saveEditButtonCss);
};

export const clickSaveEditButton = async () => {
	await clickButton(ManageEmployeesPage.saveEditButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(ManageEmployeesPage.backButtonCss);
};

// END WORK

export const endWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.endWorkButtonCss);
};

export const clickEndWorkButton = async () => {
	await clickButton(ManageEmployeesPage.endWorkButtonCss);
};

export const confirmEndWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmEndWorkButtonCss);
};

export const clickConfirmEndWorkButton = async () => {
	await clickButton(ManageEmployeesPage.confirmEndWorkButtonCss);
};

// DELETE EMPLOYEE

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ManageEmployeesPage.confirmDeleteButtonCss);
};

// COPY INVITE LINK

export const manageInvitesButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.manageInvitesButtonCss);
};

export const clickManageInviteButton = async () => {
	await clickButton(ManageEmployeesPage.manageInvitesButtonCss);
};

export const copyLinkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.copyLinkButtonCss);
};

export const clickCopyLinkButton = async () => {
	await clickButton(ManageEmployeesPage.copyLinkButtonCss);
};

// RESEND INVITE

export const resendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.resendInviteButtonCss);
};

export const clickResendInviteButton = async () => {
	await clickButton(ManageEmployeesPage.resendInviteButtonCss);
};

export const confirmResendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmResendInviteButtonCss);
};

export const clickConfirmResendInviteButton = async () => {
	await clickButton(ManageEmployeesPage.confirmResendInviteButtonCss);
};

// DELETE INVITE

export const deleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteInviteButtonCss);
};

export const clickDeleteInviteButton = async () => {
	await clickButton(ManageEmployeesPage.deleteInviteButtonCss);
};

export const confirmDeleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteInviteButtonCss);
};

export const clickConfirmDeleteInviteButton = async () => {
	await clickButton(ManageEmployeesPage.confirmDeleteInviteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageEmployeesPage.toastrMessageCss);
};

export const verifyEmployeeExists = async (text) => {
	await verifyText(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyEmployeeIsDeleted = async (text) => {
	await verifyTextNotExisting(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyInviteExists = async (text) => {
	await verifyText(ManageEmployeesPage.verifyInviteCss, text);
};

export const verifyInviteIsDeleted = async (text) => {
	await verifyTextNotExisting(ManageEmployeesPage.verifyInviteCss, text);
};
