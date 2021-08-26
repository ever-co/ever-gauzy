import {
	clearField,
	clickButton,
	clickButtonByIndex,
	clickKeyboardBtnByKeycode,
	enterInput,
	verifyElementIsVisible,
	verifyText,
	verifyTextNotExistByIndex,
	waitElementToHide,
	verifyTextByIndex,
	verifyTextContentByIndex,
	verifyElementIsVisibleByIndex,
	verifyElementIsNotVisibleByIndex,
	clickButtonWithForce
} from '../utils/util';
import { TimeTrackingWithPausePage } from '../pageobjects/TimeTrackingWithPausePageObjects';

export const headerTextExist = (text) => {
	verifyText(TimeTrackingWithPausePage.headerTextCss, text);
};

export const topCardTextExist = (text) => {
	verifyText(TimeTrackingWithPausePage.topCardHeaderTextCss, text);
};

export const bottomCardTextExist = (text) => {
	verifyText(TimeTrackingWithPausePage.bottomCardHeaderTextCss, text);
};

export const timerVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.timerCss);
};

export const clickTimer = () => {
	clickButton(TimeTrackingWithPausePage.timerCss);
};


export const timerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.timerBtnCss);
};

export const clickTimerBtn = (index) => {
	clickButtonByIndex(TimeTrackingWithPausePage.timerBtnCss, index);
};

export const startTimerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.startTimerBtnCss);
};

export const clickStartTimerBtn = () => {
	clickButton(TimeTrackingWithPausePage.startTimerBtnCss);
};

export const stopTimerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.stopTimerBtnCss);
};

export const clickStopTimerBtn = () => {
	clickButton(TimeTrackingWithPausePage.stopTimerBtnCss);
};

export const viewTimesheetbtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(TimeTrackingWithPausePage.viewTimesheetBtnCss);
};

export const closeBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.closeBtnCss);
};

export const clickCloseBtn = () => {
	clickButton(TimeTrackingWithPausePage.closeBtnCss);
};

export const clientSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.clientSelectCss);
};

export const clickClientSelect = () => {
	clickButton(TimeTrackingWithPausePage.clientSelectCss);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(TimeTrackingWithPausePage.dropdownOptionCss, index);
};

export const projectSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.projectSelectCss);
};

export const clickProjectSelect = () => {
	clickButton(TimeTrackingWithPausePage.projectSelectCss);
};

export const taskSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.taskSelectCss);
};

export const clickTaskSelect = () => {
	clickButton(TimeTrackingWithPausePage.taskSelectCss);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.descriptionInputCss);
};

export const enterDescription = (desc) => {
	clearField(TimeTrackingWithPausePage.descriptionInputCss);
	enterInput(TimeTrackingWithPausePage.descriptionInputCss, desc);
};

export const manualBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.manualBtnCss);
};

export const clickManualBtn = () => {
	clickButton(TimeTrackingWithPausePage.manualBtnCss);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.dateInputCss);
};

export const enterDate = () => {
	clearField(TimeTrackingWithPausePage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(TimeTrackingWithPausePage.dateInputCss, date);
};

export const startTimeSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.startTimeSelectCss);
};

export const clickStartTimeSelect = () => {
	clickButton(TimeTrackingWithPausePage.startTimeSelectCss);
};

export const endTimeSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.endTimeSelectCss);
};

export const clickEndTimeSelect = () => {
	clickButton(TimeTrackingWithPausePage.endTimeSelectCss);
};

export const addTimeBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.addTimeBtnCss);
};

export const clickAddTimeBtn = () => {
	clickButton(TimeTrackingWithPausePage.addTimeBtnCss);
};

export const tabBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.tabBtnCss);
};

export const clickTabBtn = (index) => {
	clickButtonByIndex(TimeTrackingWithPausePage.tabBtnCss, index);
};

export const verifyWork = (work) => {
	verifyText(TimeTrackingWithPausePage.verifyWorkCss, work);
};

export const waitMessageToHide = () => {
	waitElementToHide(TimeTrackingWithPausePage.toastrMessageCss);
};

export const verifyManualTime = (text) => {
	verifyText(TimeTrackingWithPausePage.verifyManualTimeCss, text);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const verifyWorkTimeRecorded = (index, type) => {
	verifyTextContentByIndex(TimeTrackingWithPausePage.verifyTrackedTimeCss, type, index);
};

export const viewRecordedTimeDeleteBtn = (index) => {
	verifyElementIsVisibleByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index);
};

export const clickRecordedTimeDeleteBtn = (index) => {
	clickButtonByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index);
};

export const notificationDialogVisible = () => {
	verifyElementIsVisible(TimeTrackingWithPausePage.confirmDialogBtnCss);
};

export const clickNotificationButton = () => {
	clickButtonWithForce(TimeTrackingWithPausePage.confirmDialogBtnCss);
};

export const notVisibleRecordedTimeDeleteBtn = (index) =>{
	verifyElementIsNotVisibleByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index)
};

export const verifyTimerTime = (type) => {
	verifyText(TimeTrackingWithPausePage.timerCss, type);
};


