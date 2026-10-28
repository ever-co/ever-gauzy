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
	waitForSpinnerGone,
	scopeGridTo
} from '../util';
import { expect } from '@playwright/test';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageInterviewsPage } from '../../../src/support/Base/pageobjects/ManageInterviewsPageObject';

// Open a Manage Interviews tab (calendar / interview_panel / criterion). The scenario arrives here from
// another hash route of the same document (the candidates grid, or the calendar tab), and a bare goto() of
// a hash-only change can be a same-document no-op for the Angular hash router. Force the hash when the
// route did not change, then wait for the tab's host to render before acting.
export const openInterviewsTab = async (tab: 'calendar' | 'interview_panel' | 'criterion') => {
	const page = getPage();
	const hash = `#/pages/employees/candidates/interviews/${tab}`;
	await page.goto(`/${hash}`);
	await page.evaluate((h) => {
		if (location.hash.split('?')[0] !== h) location.hash = h;
	}, hash);
	const host = {
		calendar: 'ga-interview-calendar',
		interview_panel: ManageInterviewsPage.interviewPanelCss,
		criterion: 'ga-interview-criterions'
	}[tab];
	await page.locator(host).first().waitFor({ state: 'attached', timeout: 30000 });
	await waitForSpinnerGone();
};

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
	// The interview form's interviewer select is fed the org's employees directly
	// (CandidateInterviewFormComponent.loadEmployees -> [allEmployees]), not the date-range "working
	// employees", so on the seeded org it is populated. Picking one is REQUIRED now: the form's hidden
	// `valid` control (Validators.required) is only set by onMembersSelected, and step 1's Next is
	// [disabled] while the form is invalid (candidate-interview-form.component.ts loadFormData()).
	await verifyElementIsVisible(ManageInterviewsPage.employeeMultiselectDropdownOptionCss);
};

export const clickEmployeeDropdownOption = async (index) => {
	// Mandatory pick (see employeeDropdownOptionVisible): select the interviewer. No Escape fallback any
	// more — Escape is a keyup on document, which the nb-dialog (closeOnEsc) treats as "close the whole
	// Schedule Interview dialog", and without an interviewer the step cannot advance anyway.
	await clickButtonByIndex(ManageInterviewsPage.employeeMultiselectDropdownOptionCss, index);
};

// The multi nb-select keeps its option list open after a pick; it overlays the rows below it (the
// interview-type radios). It normally closes on the Tab the scenario sends; if it is still open, close it
// with a click on the dialog title (nb-select hides on any click outside itself), never with Escape.
const closeEmployeeDropdownIfOpen = async () => {
	const page = getPage();
	const list = page.locator('nb-option-list').first();
	if (await list.isVisible().catch(() => false)) {
		await page
			.locator(`${ManageInterviewsPage.interviewDialogCss} nb-card-header h5.dialog-title`)
			.first()
			.click({ force: true })
			.catch(() => {});
		await list.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
	}
};

export const interviewTypeButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.radioButtonCss);
};

export const clickInterviewTypeButton = async (index) => {
	await closeEmployeeDropdownIfOpen();
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

// Dispatch a footer step button once it is genuinely enabled, then confirm the stepper reached the step
// whose content `reachedCss` belongs to (nb-stepper renders only the selected step's content). One retry
// if the dispatch was swallowed by a transient overlay.
const advanceStep = async (buttonCss: string, reachedCss: string) => {
	const page = getPage();
	const reached = page.locator(reachedCss).first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await waitForSpinnerGone();
		const button = page.locator(buttonCss).first();
		await expect(button).toBeEnabled({ timeout: 24000 });
		await button.dispatchEvent('click');
		if (await reached.waitFor({ state: 'attached', timeout: 8000 }).then(() => true).catch(() => false)) {
			return;
		}
	}
	await expect(reached).toBeAttached({ timeout: 4000 });
};

export const clickNextButton = async () => {
	// Step 1 -> step 2. The footer Next is [disabled]="candidateInterviewForm?.form?.invalid || isTitleExist"
	// and runs (click)="next(); stepper.next()". A fading select/datepicker overlay can sit over the footer,
	// so the click is dispatched straight to the button, but only once it is enabled (a click on a disabled
	// button is dropped), and the move to the criterions step is confirmed.
	await closeEmployeeDropdownIfOpen();
	await advanceStep(ManageInterviewsPage.nextButtonCss, ManageInterviewsPage.criterionsStepCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	// Step 2 (criterions) -> step 3 (summary + email notification); see clickNextButton.
	await advanceStep(ManageInterviewsPage.nextStepButtonCss, ManageInterviewsPage.notificationStepCss);
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
	// Final step Save ((click)="save()": creates the interview, its interviewers and criterions, then
	// closes the dialog). Dispatched straight to the button so a lingering overlay can't swallow it, then
	// wait for the dialog to close (save() awaits the API calls first). Not re-dispatched: a second save()
	// would create a second interview. Whether it persisted is asserted on the interviews panel.
	await waitForSpinnerGone();
	await expect(getPage().locator(ManageInterviewsPage.saveButtonCss).first()).toBeEnabled({ timeout: 24000 });
	await dispatchClick(ManageInterviewsPage.saveButtonCss);
	await getPage()
		.locator(ManageInterviewsPage.interviewDialogCss)
		.first()
		.waitFor({ state: 'detached', timeout: 30000 })
		.catch(() => {});
};

export const verifyScheduleExist = async (text) => {
	// The panel's table is a 10-row-per-page LocalDataSource over every interview of the org; narrow it to
	// this candidate first (best-effort Candidate-column filter) so the new interview is on the rendered page.
	await scopeGridTo(ManageInterviewsPage.interviewPanelNameFilterCss, text);
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
