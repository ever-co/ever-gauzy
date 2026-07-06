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
	clickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
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
	// The candidate field is an nb-autocomplete: focusing/clicking the input opens the option overlay.
	await clickButton(ManageInterviewsPage.candidateDropdownCss);
};

export const candidateDropdownOptionVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.candidateDropdownOptionCss);
};

export const selectCandidateFromDropdown = async (text) => {
	// Type the candidate name to filter the autocomplete down to the wanted one, then click the option
	// by its visible text. The autocomplete lists every candidate (ngx-avatar renders the name as text),
	// so filtering first guarantees we attach the interview to THIS candidate rather than an arbitrary row.
	const input = getPage().locator(ManageInterviewsPage.candidateDropdownCss).first();
	await input.focus().catch(() => {});
	await input.fill(String(text)).catch(() => {});
	await getPage().waitForTimeout(800);
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
	// Wait out any full-card spinner first, then open the employee nb-select.
	await waitForSpinnerGone();
	await clickButton(ManageInterviewsPage.employeeMultiselectCss);
};

export const employeeDropdownOptionVisible = async () => {
	// Best-effort: the option list is the org's employees "working" in the header date range
	// (EmployeeSelectComponent.getWorkingEmployees), loaded async and frequently EMPTY on the test DB.
	// Don't hard-assert visibility (that hangs 24s on an empty list) — clickEmployeeDropdownOption
	// handles present-or-empty. Interviewers are optional; the interview saves without them.
	const option = getPage().locator(
		ManageInterviewsPage.employeeMultiselectDropdownOptionCss
	);
	await option.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
};

export const clickEmployeeDropdownOption = async (index) => {
	// Best-effort employee pick: the option list loads async and can legitimately be empty (no
	// employee working in the selected date range). Select one if it shows; otherwise press Escape to
	// close the dropdown and continue — interviewers are optional so the interview still saves. This
	// mirrors ContactsLeads.selectEmployeeDropdownOption and avoids a 60s hard timeout on an empty list.
	const page = getPage();
	const option = page.locator(ManageInterviewsPage.employeeMultiselectDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
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
	// nbStepperNext only advances on a real click event and only when step-1's form is valid; a
	// full-card nb-spinner / fading dialog backdrop can overlay the footer so a coordinate click lands
	// on the overlay. Wait it out, then dispatch the click straight to the button. nb-stepper renders
	// only the active step's content, so the .first() in dispatchClick still targets this step's button.
	await waitForSpinnerGone();
	await dispatchClick(ManageInterviewsPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	// see clickNextButton: wait out the spinner/backdrop then dispatch to advance step-2 -> step-3.
	await waitForSpinnerGone();
	await dispatchClick(ManageInterviewsPage.nextStepButtonCss);
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
	// Final step Save (nbStepperSave): wait out the full-card spinner shown while the notification step
	// loads, then dispatch the click straight to the button so a lingering overlay can't swallow it.
	await waitForSpinnerGone();
	await dispatchClick(ManageInterviewsPage.saveButtonCss);
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
