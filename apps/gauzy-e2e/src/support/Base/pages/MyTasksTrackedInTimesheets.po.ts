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

} from '../utils/util';
import { MyTasksTrackedInTimesheets } from '../pageobjects/MyTasksTrackedInTimesheetsPageObject';
import dayjs from 'dayjs'

export const verifyAddButton = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.addButtonCss);
};

export const clickOnAddTaskButton = () => {
    clickButton(MyTasksTrackedInTimesheets.addButtonCss);
}

export const selectProjectDropdownVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.projectDropdownCss);
};

export const clickSelectProjectDropdown = () => {
	clickButton(MyTasksTrackedInTimesheets.projectDropdownCss);
};

export const selectProjectOptionDropdown = (text) => {
	clickElementByText(MyTasksTrackedInTimesheets.drodownOptionCss, text);
};

export const selectStatusDropdownVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.statusDropdownCss);
};

export const clickStatusDropdown = () => {
	clickButton(MyTasksTrackedInTimesheets.statusDropdownCss);
};

export const selectStatusFromDropdown = (text) => {
	clickElementByText(MyTasksTrackedInTimesheets.drodownOptionCss, text);
};

export const addTitleInputVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.addTitleInputCss);
};

export const enterTitleInputData = (data) => {
	clearField(MyTasksTrackedInTimesheets.addTitleInputCss);
	enterInput(MyTasksTrackedInTimesheets.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(MyTasksTrackedInTimesheets.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(MyTasksTrackedInTimesheets.tagsSelectOptionCss, index);
};

export const clickCardBody = () => {
	clickButton(MyTasksTrackedInTimesheets.cardBodyCss);
};

export const dueDateInputVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.dueDateInputCss);
};

export const enterDueDateData = () => {
	clearField(MyTasksTrackedInTimesheets.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	enterInput(MyTasksTrackedInTimesheets.dueDateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const estimateDaysInputVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateDaysInputCss);
};

export const enterEstiamteDaysInputData = (days) => {
	clearField(MyTasksTrackedInTimesheets.estimateDaysInputCss);
	enterInput(MyTasksTrackedInTimesheets.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateHoursInputCss);
};

export const enterEstiamteHoursInputData = (hours) => {
	clearField(MyTasksTrackedInTimesheets.estimateHoursInputCss);
	enterInput(MyTasksTrackedInTimesheets.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.estimateMinsInputCss);
};

export const enterEstimateMinutesInputData = (mins) => {
	clearField(MyTasksTrackedInTimesheets.estimateMinsInputCss);
	enterInput(MyTasksTrackedInTimesheets.estimateMinsInputCss, mins);
};

export const taskDecriptionTextareaVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = (data) => {
	clearField(MyTasksTrackedInTimesheets.descriptionTextareaCss);
	enterInput(MyTasksTrackedInTimesheets.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = () => {
	clickButton(MyTasksTrackedInTimesheets.saveNewTaskButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(MyTasksTrackedInTimesheets.toastrMessageCss);
};

export const timerVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.timerCss);
};

export const clickTimer = () => {
	clickButton(MyTasksTrackedInTimesheets.timerCss);
};

export const timerBtnVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.timerBtnCss);
};

export const taskSelectVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.taskSelectCss);
};


export const clickTaskSelect = () => {
	clickButton(MyTasksTrackedInTimesheets.taskSelectCss);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(MyTasksTrackedInTimesheets.dropdownOptionCss, index);
};

export const clickStartTimerBtn = () => {
	clickButton(MyTasksTrackedInTimesheets.startTimerBtnCss);
};

export const stopTimerBtnVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.stopTimerBtnCss);
};

export const clickStopTimerBtn = () => {
	clickButton(MyTasksTrackedInTimesheets.stopTimerBtnCss);
};

export const viewTimesheetbtnVisible = () => {
	verifyElementIsVisible(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(MyTasksTrackedInTimesheets.viewTimesheetBtnCss);
};

export const verifyProjectText = (text) => {
    compareTwoTexts(MyTasksTrackedInTimesheets.projectNameCss, text)
}