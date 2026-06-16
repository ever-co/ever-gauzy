import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	waitUntil,
	verifyText,
	verifyByText,
	clickKeyboardBtnByKeycode,
	scrollDown,
	clickElementByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageInterviewsPage } from '../../../src/support/Base/pageobjects/ManageInterviewsPageObject';

export const addInterviewButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.addInterviewButtonCss);
};

export const addInterviewButtonVisibleSecond = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.addInterviewButtonCss);
};

export const clickAddInterviewButton = async () => {
	await clickButton(ManageInterviewsPage.addInterviewButtonCss);
};

export const candidateDropdownVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.candidateDropdownCss);
};

export const clickCandidateDropdown = async () => {
	await clickButton(ManageInterviewsPage.candidateDropdownCss);
};

export const candidateDropdownOptionVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.candidateDropdownOptionCss);
};

export const selectCandidateFromDropdown = async (text) => {
	await clickElementByText(ManageInterviewsPage.candidateDropdownOptionCss, text);
};

export const titleInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.titleInputCss);
};

export const enterTitleInputData = async (data) => {
	await clearField(ManageInterviewsPage.titleInputCss);
	await enterInput(ManageInterviewsPage.titleInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ManageInterviewsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageInterviewsPage.dateInputCss, date);
};

export const enterFutureDateInputData = async (days: number) => {
	await clearField(ManageInterviewsPage.dateInputCss);
	const futureDate = dayjs().add(days, 'days').format('MMM D, YYYY');
	await enterInput(ManageInterviewsPage.dateInputCss, futureDate);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageInterviewsPage.toastrMessageCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.employeeMultiselectCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(ManageInterviewsPage.employeeMultiselectCss);
};

export const employeeDropdownOptionVisible = async () => {
	await verifyElementIsVisible(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss
	);
};

export const clickEmployeeDropdownOption = async (index) => {
	await clickButtonByIndex(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss,
		index
	);
};

export const interviewTypeButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.radioButtonCss);
};

export const clickInterviewTypeButton = async (index) => {
	await clickButtonByIndex(ManageInterviewsPage.radioButtonCss, index);
};

export const locationInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.locationInputCss);
};

export const enterLocationInputData = async (data) => {
	await clearField(ManageInterviewsPage.locationInputCss);
	await enterInput(ManageInterviewsPage.locationInputCss, data);
};

export const noteInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.noteInputCss);
};

export const enterNoteInputData = async (data) => {
	await clearField(ManageInterviewsPage.noteInputCss);
	await enterInput(ManageInterviewsPage.noteInputCss, data);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.nextButtonCss);
};

export const clickNextButton = async () => {
	await clickButton(ManageInterviewsPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	await clickButton(ManageInterviewsPage.nextStepButtonCss);
};

export const notifyCandidateCheckboxVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.notifyCandidateCss);
};

export const clickNotifyCandidateCheckbox = async (index) => {
	await clickButtonByIndex(ManageInterviewsPage.notifyCandidateCss, index);
};

export const scrollElement = async () => {
	await scrollDown(ManageInterviewsPage.scrollElementCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(ManageInterviewsPage.saveButtonCss);
};

export const verifyScheduleExist = async (text) => {
	await verifyText(ManageInterviewsPage.verifyCandidateCss, text);
};

// Filter functions
export const nameFilterInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.nameFilterInputCss);
};

export const enterNameFilterInputData = async (text: string) => {
	await clearField(ManageInterviewsPage.nameFilterInputCss);
	await enterInput(ManageInterviewsPage.nameFilterInputCss, text);
	await waitUntil(2000);
};

export const titleFilterInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.titleFilterInputCss);
};

export const enterTitleFilterInputData = async (text: string) => {
	await enterInput(ManageInterviewsPage.titleFilterInputCss, text);
};

export const verifyNameFilterContains = async (text: string) => {
	await verifyByText(ManageInterviewsPage.nameTableCellCss, text);
};

export const verifyTitleFilterContains = async (text: string) => {
	await verifyByText(ManageInterviewsPage.titleTableCellCss, text);
};

export const clearFilterInputField = async () => {
	await clearField(ManageInterviewsPage.titleFilterInputCss);
	await clearField(ManageInterviewsPage.nameFilterInputCss);
	await waitUntil(1000);
};
// End of Filter functions

export const verifyAddFeedbackButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.tableOptionsButtonsCss);
};

export const clickAddFeedbackButton = async () => {
	await clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 0);
};

export const interviewDropdownVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.addInterviewerDropdownCss);
};

export const clickInterviewerDropdown = async () => {
	await clickButton(ManageInterviewsPage.addInterviewerDropdownCss);
};

export const clickInterviewerFromDropdown = async (index: number) => {
	await clickButtonByIndex(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss,
		index
	);
};

export const verifyRating = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.ratingInputCss);
};

export const clickRating = async () => {
	await clickButtonByIndex(ManageInterviewsPage.ratingInputCss, 4);
};

export const verifyHireRejectRadioGroup = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.radioGroupCss);
};

export const clickRadioOption = async () => {
	await clickButtonByIndex(ManageInterviewsPage.radioGroupInputCss, 0);
};

export const verifyFeedbackDescription = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.feedbackDescriptionCss);
};

export const enterFeedBackDescription = async (text: string) => {
	await enterInput(ManageInterviewsPage.feedbackDescriptionCss, text);
};

export const feedbackSaveButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.feedbackSaveButtonCss);
};

export const clickFeedbackSaveButton = async () => {
	await clickButton(ManageInterviewsPage.feedbackSaveButtonCss);
};

// Edit future interview
export const verifyOnlyFutureCheckboxVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.interviewCheckboxFiltersCss);
};

export const clickOnlyFutureCheckbox = async () => {
	await clickButtonByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersInputsCss,
		1
	);
	await waitUntil(1500);
};

export const verifyEditButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.tableOptionsButtonsCss);
};

export const clickEditButton = async () => {
	await clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 1);
};

export const verifyUpdatedNoteContains = async (text: string) => {
	await verifyByText(ManageInterviewsPage.notesTableCellCss, text);
};

export const verifyArchiveOptionVisible = async () => {
	await verifyElementIsVisibleByIndex(
		ManageInterviewsPage.tableOptionsButtonsCss,
		2
	);
};

export const clickArchiveOption = async () => {
	await clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 2);
};

export const verifyOkButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.archiveInterviewOkButtonCss);
};

export const clickOkButton = async () => {
	await clickButton(ManageInterviewsPage.archiveInterviewOkButtonCss);
};

export const verifyIncludeArchivedCheckboxVisible = async () => {
	await verifyElementIsVisibleByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersCss,
		2
	);
};

export const clickIncludeArchivedCheckbox = async () => {
	await clickButtonByIndex(
		ManageInterviewsPage.interviewCheckboxFiltersInputsCss,
		2
	);
	await waitUntil(1000);
};

export const verifyArchivedBadgeContains = async (text: string) => {
	await verifyByText(ManageInterviewsPage.archiveBadgeCss, text);
};

// Delete future interview
export const verifyDeleteOptionVisible = async () => {
	await verifyElementIsVisibleByIndex(
		ManageInterviewsPage.tableOptionsButtonsCss,
		3
	);
};

export const clickDeleteOption = async () => {
	await clickButtonByIndex(ManageInterviewsPage.tableOptionsButtonsCss, 3);
};

export const verifyDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(ManageInterviewsPage.deleteButtonCss);
};

export const clearFieldForSearch = async () => {
	await clearField(ManageInterviewsPage.titleFilterInputCss);
};
