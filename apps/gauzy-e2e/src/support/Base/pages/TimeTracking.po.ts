import {
	clearField,
	clickButton,
	clickButtonByIndex,
	clickKeyboardBtnByKeycode,
	enterInput,
	verifyElementIsVisible,
	verifyText,
	verifyTextNotExistByIndex,
	waitElementToHide
} from '../utils/util';
import { TimeTrackingPage } from '../pageobjects/TimeTrackingPageObject';

export const headerTextExist = (text) => {
	verifyText(TimeTrackingPage.headerTextCss, text);
};

export const topCardTextExist = (text) => {
	verifyText(TimeTrackingPage.topCardHeaderTextCss, text);
};

export const bottomCardTextExist = (text) => {
	verifyText(TimeTrackingPage.bottomCardHeaderTextCss, text);
};

export const timerVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.timerCss);
};

export const clickTimer = () => {
	clickButton(TimeTrackingPage.timerCss);
};

export const timerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.timerBtnCss);
};

export const clickTimerBtn = (index) => {
	clickButtonByIndex(TimeTrackingPage.timerBtnCss, index);
};

export const startTimerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.startTimerBtnCss);
};

export const clickStartTimerBtn = () => {
	clickButton(TimeTrackingPage.startTimerBtnCss);
};

export const stopTimerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.stopTimerBtnCss);
};

export const clickStopTimerBtn = () => {
	clickButton(TimeTrackingPage.stopTimerBtnCss);
};

export const viewTimesheetbtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(TimeTrackingPage.viewTimesheetBtnCss);
};

export const closeBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.closeBtnCss);
};

export const clickCloseBtn = () => {
	clickButton(TimeTrackingPage.closeBtnCss);
};

export const clientSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.clientSelectCss);
};

export const clickClientSelect = () => {
	clickButton(TimeTrackingPage.clientSelectCss);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(TimeTrackingPage.dropdownOptionCss, index);
};

export const projectSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.projectSelectCss);
};

export const clickProjectSelect = () => {
	clickButton(TimeTrackingPage.projectSelectCss);
};

export const taskSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.taskSelectCss);
};

export const clickTaskSelect = () => {
	clickButton(TimeTrackingPage.taskSelectCss);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.descriptionInputCss);
};

export const enterDescription = (desc) => {
	clearField(TimeTrackingPage.descriptionInputCss);
	enterInput(TimeTrackingPage.descriptionInputCss, desc);
};

export const manualBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.manualBtnCss);
};

export const clickManualBtn = () => {
	clickButton(TimeTrackingPage.manualBtnCss);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.dateInputCss);
};

export const enterDate = () => {
	clearField(TimeTrackingPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(TimeTrackingPage.dateInputCss, date);
};

export const startTimeSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.startTimeSelectCss);
};

export const clickStartTimeSelect = () => {
	clickButton(TimeTrackingPage.startTimeSelectCss);
};

export const endTimeSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.startTimeSelectCss);
};

export const clickEndTimeSelect = () => {
	clickButton(TimeTrackingPage.startTimeSelectCss);
};

export const addTimeBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.addTimeBtnCss);
};

export const clickAddTimeBtn = () => {
	clickButton(TimeTrackingPage.addTimeBtnCss);
};

export const verifyTimeWasRecorded = (index, time) => {
	verifyTextNotExistByIndex(TimeTrackingPage.verifyTimeCss, index, time);
};

export const tabBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingPage.tabBtnCss);
};

export const clickTabBtn = (index) => {
	clickButtonByIndex(TimeTrackingPage.tabBtnCss, index);
};

export const verifyWork = (work) => {
	verifyText(TimeTrackingPage.verifyWorkCss, work);
};

export const waitMessageToHide = () => {
	waitElementToHide(TimeTrackingPage.toastrMessageCss);
};

export const verifyManualTime = (text) => {
	verifyText(TimeTrackingPage.verifyManualTimeCss, text);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
