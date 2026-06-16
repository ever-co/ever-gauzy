import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	enterInput,
	clickButtonByIndex,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	compareTwoTexts
} from '../util';
import { getPage } from '../page-context';
import type { Response } from '@playwright/test';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { MyTasksTrackedInTimesheets } from '../../../src/support/Base/pageobjects/MyTasksTrackedInTimesheetsPageObject';
import dayjs from 'dayjs';

// Mirrors the Cypress intercept/alias: clickTaskSelect arms the wait, selectOptionFromDropdown consumes it.
let waitTasksXhr: Promise<Response> | undefined;

export const verifyAddButton = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.addButtonCss);

export const clickOnAddTaskButton = async () => clickButton(MyTasksTrackedInTimesheets.addButtonCss);

export const selectProjectDropdownVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.projectDropdownCss);

export const clickSelectProjectDropdown = async () => clickButton(MyTasksTrackedInTimesheets.projectDropdownCss);

export const selectProjectOptionDropdown = async (text: string) =>
	clickElementByText(MyTasksTrackedInTimesheets.dropdownOptionCss, text);

export const selectStatusDropdownVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.statusDropdownCss);

export const clickStatusDropdown = async () => clickButton(MyTasksTrackedInTimesheets.statusDropdownCss);

export const selectStatusFromDropdown = async (text: string) =>
	clickElementByText(MyTasksTrackedInTimesheets.dropdownOptionCss, text);

export const addTitleInputVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.addTitleInputCss);

export const enterTitleInputData = async (data: string) => {
	await clearField(MyTasksTrackedInTimesheets.addTitleInputCss);
	await enterInput(MyTasksTrackedInTimesheets.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.tagsSelectCss);

export const clickTagsMultiSelect = async () => clickButton(MyTasksTrackedInTimesheets.tagsSelectCss);

export const selectTagsFromDropdown = async (index: number) =>
	clickButtonByIndex(MyTasksTrackedInTimesheets.tagsSelectOptionCss, index);

export const clickCardBody = async () => clickButton(MyTasksTrackedInTimesheets.cardBodyCss);

export const dueDateInputVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.dueDateInputCss);

export const enterDueDateData = async () => {
	await clearField(MyTasksTrackedInTimesheets.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(MyTasksTrackedInTimesheets.dueDateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const estimateDaysInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateDaysInputCss);

export const enterEstimateDaysInputData = async (days: string) => {
	await clearField(MyTasksTrackedInTimesheets.estimateDaysInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateHoursInputCss);

export const enterEstimateHoursInputData = async (hours: string) => {
	await clearField(MyTasksTrackedInTimesheets.estimateHoursInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateMinsInputCss);

export const enterEstimateMinutesInputData = async (mins: string) => {
	await clearField(MyTasksTrackedInTimesheets.estimateMinsInputCss);
	await enterInput(MyTasksTrackedInTimesheets.estimateMinsInputCss, mins);
};

export const taskDescriptionTextareaVisible = async () =>
	verifyElementIsVisible(MyTasksTrackedInTimesheets.descriptionTextareaCss);

export const enterTaskDescriptionTextareaData = async (data: string) => {
	await clearField(MyTasksTrackedInTimesheets.descriptionTextareaCss);
	await enterInput(MyTasksTrackedInTimesheets.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);

export const clickSaveTaskButton = async () => clickButton(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);

export const waitMessageToHide = async () => waitElementToHide(MyTasksTrackedInTimesheets.toastrMessageCss);

export const timerVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.timerCss);

export const clickTimer = async () => clickButton(MyTasksTrackedInTimesheets.timerCss);

export const timerBtnVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.timerBtnCss);

export const taskSelectVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.taskSelectCss);

export const clickTaskSelect = async () => {
	waitTasksXhr = getPage().waitForResponse((res) => /\/api\/tasks\/employee\//.test(res.url()));
	await clickButton(MyTasksTrackedInTimesheets.taskSelectCss);
};

export const selectOptionFromDropdown = async (index: number) => {
	if (waitTasksXhr) {
		await waitTasksXhr;
		waitTasksXhr = undefined;
	}
	await clickButtonByIndex(MyTasksTrackedInTimesheets.dropdownOptionCss, index);
};

export const clickStartTimerBtn = async () => clickButton(MyTasksTrackedInTimesheets.startTimerBtnCss);

export const stopTimerBtnVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.stopTimerBtnCss);

export const clickStopTimerBtn = async () => clickButton(MyTasksTrackedInTimesheets.stopTimerBtnCss);

export const viewTimesheetBtnVisible = async () => verifyElementIsVisible(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);

export const clickViewTimesheetBtn = async () => clickButton(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);

export const verifyProjectText = async (text: string) =>
	compareTwoTexts(MyTasksTrackedInTimesheets.projectNameCss, text);
