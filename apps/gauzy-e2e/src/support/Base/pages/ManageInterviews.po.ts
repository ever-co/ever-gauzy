import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	clickKeyboardBtnByKeycode,
	scrollDown
} from '../utils/util';
import { ManageInterviewsPage } from '../pageobjects/ManageInterviewsPageObject';

export const addInterviewButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.addInterviewButtonCss);
};

export const clickAddInterviewButton = () => {
	clickButton(ManageInterviewsPage.addInterviewButtonCss);
};

export const candidateDropdownVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.candidateDropdownCss);
};

export const clickCandidateDropdown = () => {
	clickButton(ManageInterviewsPage.candidateDropdownCss);
};

export const candidateDropdownOptionVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.candidateDropdownOptionCss);
};

export const selectCandidateFromDropdown = (index) => {
	clickButtonByIndex(ManageInterviewsPage.candidateDropdownOptionCss, index);
};

export const titleInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.titleInputCss);
};

export const enterTitleInputData = (data) => {
	clearField(ManageInterviewsPage.titleInputCss);
	enterInput(ManageInterviewsPage.titleInputCss, data);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(ManageInterviewsPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(ManageInterviewsPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageInterviewsPage.toastrMessageCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.employeeMultyselectCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(ManageInterviewsPage.employeeMultyselectCss);
};

export const employeeDropdownOptionVisible = () => {
	verifyElementIsVisible(
		ManageInterviewsPage.employeeMultyselectDropdownOptionCss
	);
};

export const clickEmployeeDropdownOption = (index) => {
	clickButtonByIndex(
		ManageInterviewsPage.employeeMultyselectDropdownOptionCss,
		index
	);
};

export const interviewTypeButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.radioButtonCss);
};

export const clickInterviewTypeButton = (index) => {
	clickButtonByIndex(ManageInterviewsPage.radioButtonCss, index);
};

export const locationinputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.locationInputCss);
};

export const enterLocationInputData = (data) => {
	clearField(ManageInterviewsPage.locationInputCss);
	enterInput(ManageInterviewsPage.locationInputCss, data);
};

export const noteInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.noteInputCss);
};

export const enterNoteInputData = (data) => {
	clearField(ManageInterviewsPage.noteInputCss);
	enterInput(ManageInterviewsPage.noteInputCss, data);
};

export const nextButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.nextButtonCss);
};

export const clickNextButton = () => {
	clickButton(ManageInterviewsPage.nextButtonCss);
};

export const nextStepButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.nextStepButtonCss);
};

export const clickNextStepButton = () => {
	clickButton(ManageInterviewsPage.nextStepButtonCss);
};

export const notifyCandidateCheckboxVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.notifyCandidateCss);
};

export const clickNotifyCandidateCheckbox = (index) => {
	clickButtonByIndex(ManageInterviewsPage.notifyCandidateCss, index);
};

export const scrollElement = () => {
	scrollDown(ManageInterviewsPage.scrollElementCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ManageInterviewsPage.saveButtonCss);
};

export const verifySheduleExist = (text) => {
	verifyText(ManageInterviewsPage.verifyCandidateCss, text);
};
