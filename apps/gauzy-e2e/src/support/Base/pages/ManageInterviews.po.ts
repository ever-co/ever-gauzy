import dayjs from 'dayjs';
import {
	verifyByText,
	verifyElementIsVisibleByIndex,
	waitUntil
} from './../utils/util';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	clickKeyboardBtnByKeycode,
	scrollDown,
	clickElementByText
} from '../utils/util';
import { ManageInterviewsPage } from '../pageobjects/ManageInterviewsPageObject';

export const addInterviewButtonVisible = () => {
	cy.intercept('GET', '/api/employee/working*').as('waitScheduleLoad');
	cy.intercept('GET', '/api/employee*').as('waitEmployee');
	cy.wait(['@waitScheduleLoad','@waitEmployee']);
	verifyElementIsVisible(ManageInterviewsPage.addInterviewButtonCss);
};

export const addInterviewButtonVisibleSecond = () => {
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

export const selectCandidateFromDropdown = (text) => {
	clickElementByText(ManageInterviewsPage.candidateDropdownOptionCss, text);
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
	const date = dayjs().format('MMM D, YYYY');
	enterInput(ManageInterviewsPage.dateInputCss, date);
};

export const enterFutureDateInputData = (days: number) => {
	clearField(ManageInterviewsPage.dateInputCss);
	const futureDate = dayjs().add(days, 'days').format('MMM D, YYYY');
	enterInput(ManageInterviewsPage.dateInputCss, futureDate);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageInterviewsPage.toastrMessageCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.employeeMultiselectCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(ManageInterviewsPage.employeeMultiselectCss);
};

export const employeeDropdownOptionVisible = () => {
	verifyElementIsVisible(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss
	);
};

export const clickEmployeeDropdownOption = (index) => {
	clickButtonByIndex(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss,
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

// Filter functions
export const nameFilterInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.nameFilterInputCss);
};

export const enterNameFilterInputData = (text: string) => {
	clearField(ManageInterviewsPage.nameFilterInputCss);
	enterInput(ManageInterviewsPage.nameFilterInputCss, text);
	waitUntil(2000);
};

export const titleFilterInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.titleFilterInputCss);
};

export const enterTitleFilterInputData = (text: string) => {
	enterInput(ManageInterviewsPage.titleFilterInputCss, text);
};

export const verifyNameFilterContains = (text: string) => {
	verifyByText(ManageInterviewsPage.nameTableCellCss, text);
};

export const verifyTitleFilterContains = (text: string) => {
	verifyByText(ManageInterviewsPage.titleTableCellCss, text);
};

export const clearFilterInputField = () => {
	clearField(ManageInterviewsPage.titleFilterInputCss);
	clearField(ManageInterviewsPage.nameFilterInputCss);
	waitUntil(1000);
};
// End of Filter functions

export const verifyAddFeedbackButtonVisisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.tableOptionsButtonsCss);
};

export const clickAddFeedbackButton = () => {
	clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 0);
};

export const interviewDropdownVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.addInterviewerDropdownCss);
};

export const clickInterviewerDropdown = () => {
	clickButton(ManageInterviewsPage.addInterviewerDropdownCss);
};

export const clickInterviewerFromDropdown = (index: number) => {
	clickButtonByIndex(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss,
		index
	);
};

export const verifyRating = () => {
	verifyElementIsVisible(ManageInterviewsPage.ratingInputCss);
};

export const clickRating = () => {
	clickButtonByIndex(ManageInterviewsPage.ratingInputCss, 4);
};

export const verifyHireRejectRadioGroup = () => {
	verifyElementIsVisible(ManageInterviewsPage.radioGroupCss);
};

export const clickRadioOption = () => {
	clickButtonByIndex(ManageInterviewsPage.radioGroupInputCss, 0);
};

export const verifyFeedbackDescription = () => {
	verifyElementIsVisible(ManageInterviewsPage.feedbackDescriptionCss);
};

export const enterFeedBackDescription = (text: string) => {
	enterInput(ManageInterviewsPage.feedbackDescriptionCss, text);
};

export const feedbackSaveButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.feedbackSaveButtonCss);
};

export const clickFeedbackSaveButton = () => {
	clickButton(ManageInterviewsPage.feedbackSaveButtonCss);
};

// Edit future interview
export const verifyOnlyFutureCheckboxVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.interviewCheckboxFiltersCss);
};

export const clickOnlyFutureCheckbox = () => {
	clickButtonByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersInputsCss,
		1
	);
	waitUntil(1500);
};

export const verifyEditButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.tableOptionsButtonsCss);
};

export const clickEditButton = () => {
	clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 1);
};

export const verifyUpdatedNoteContains = (text: string) => {
	verifyByText(ManageInterviewsPage.notesTableCellCss, text);
};

export const verifyArchiveOptionVisible = () => {
	verifyElementIsVisibleByIndex(
		ManageInterviewsPage.tableOptionsButtonsCss,
		2
	);
};

export const clickArchiveOption = () => {
	clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 2);
};

export const verifyOkButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.archiveInterviewOkButtonCss);
};

export const clickOkButton = () => {
	clickButton(ManageInterviewsPage.archiveInterviewOkButtonCss);
};

export const verifyInludeArchivedCheckboxVisible = () => {
	verifyElementIsVisibleByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersCss,
		2
	);
};

export const clickInludeArchivedCheckbox = () => {
	clickButtonByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersInputsCss,
		2
	);
	waitUntil(1000);
};

export const verifyArchivedBadgeContains = (text: string) => {
	verifyByText(ManageInterviewsPage.archiveBadgeCss, text);
};

// Delete future interview
export const verifyDeleteOptionVisible = () => {
	verifyElementIsVisibleByIndex(
		ManageInterviewsPage.tableOptionsButtonsCss,
		3
	);
};

export const clickDeleteOption = () => {
	clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 3);
};

export const verifyDeleteButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(ManageInterviewsPage.deleteButtonCss);
};

export const clearFieldForSearch = () => {
	clearField(ManageInterviewsPage.titleFilterInputCss);
}