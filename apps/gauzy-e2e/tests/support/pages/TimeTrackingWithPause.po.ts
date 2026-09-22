import dayjs from 'dayjs';
import {
	clearField,
	clickButton,
	clickButtonByIndex,
	clickKeyboardBtnByKeycode,
	enterInput,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	verifyTextContentByIndex,
	verifyElementIsVisibleByIndex,
	verifyElementIsNotVisibleByIndex,
	clickButtonWithForce
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { TimeTrackingWithPausePage } from '../../../src/support/Base/pageobjects/TimeTrackingWithPausePageObjects';

export const headerTextExist = async (text: string) => {
	await verifyText(TimeTrackingWithPausePage.headerTextCss, text);
};

export const topCardTextExist = async (text: string) => {
	await verifyText(TimeTrackingWithPausePage.topCardHeaderTextCss, text);
};

export const bottomCardTextExist = async (text: string) => {
	await verifyText(TimeTrackingWithPausePage.bottomCardHeaderTextCss, text);
};

export const timerVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.timerCss);
};

export const clickTimer = async () => {
	await clickButton(TimeTrackingWithPausePage.timerCss);
};

export const timerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.timerBtnCss);
};

export const clickTimerBtn = async (index: number) => {
	await clickButtonByIndex(TimeTrackingWithPausePage.timerBtnCss, index);
};

export const startTimerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.startTimerBtnCss);
};

export const clickStartTimerBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.startTimerBtnCss);
};

export const stopTimerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.stopTimerBtnCss);
};

export const clickStopTimerBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.stopTimerBtnCss);
};

export const viewTimesheetBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.viewTimesheetBtnCss);
};

export const closeBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.closeBtnCss);
};

export const clickCloseBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.closeBtnCss);
};

export const clientSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.clientSelectCss);
};

export const clickClientSelect = async () => {
	await clickButton(TimeTrackingWithPausePage.clientSelectCss);
};

export const selectOptionFromDropdown = async (index: number) => {
	await clickButtonByIndex(TimeTrackingWithPausePage.dropdownOptionCss, index);
};

export const projectSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.projectSelectCss);
};

export const clickProjectSelect = async () => {
	await clickButton(TimeTrackingWithPausePage.projectSelectCss);
};

export const taskSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.taskSelectCss);
};

export const clickTaskSelect = async () => {
	await clickButton(TimeTrackingWithPausePage.taskSelectCss);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.descriptionInputCss);
};

export const enterDescription = async (desc: string) => {
	await clearField(TimeTrackingWithPausePage.descriptionInputCss);
	await enterInput(TimeTrackingWithPausePage.descriptionInputCss, desc);
};

export const manualBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.manualBtnCss);
};

export const clickManualBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.manualBtnCss);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.dateInputCss);
};

export const enterDate = async () => {
	await clearField(TimeTrackingWithPausePage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(TimeTrackingWithPausePage.dateInputCss, date);
};

export const startTimeSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.startTimeSelectCss);
};

export const clickStartTimeSelect = async () => {
	await clickButton(TimeTrackingWithPausePage.startTimeSelectCss);
};

export const endTimeSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.endTimeSelectCss);
};

export const clickEndTimeSelect = async () => {
	await clickButton(TimeTrackingWithPausePage.endTimeSelectCss);
};

export const addTimeBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.addTimeBtnCss);
};

export const clickAddTimeBtn = async () => {
	await clickButton(TimeTrackingWithPausePage.addTimeBtnCss);
};

export const tabBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.tabBtnCss);
};

export const clickTabBtn = async (index: number) => {
	await clickButtonByIndex(TimeTrackingWithPausePage.tabBtnCss, index);
};

export const verifyWork = async (work: string) => {
	await verifyText(TimeTrackingWithPausePage.verifyWorkCss, work);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(TimeTrackingWithPausePage.toastrMessageCss);
};

export const verifyManualTime = async (text: string) => {
	await verifyText(TimeTrackingWithPausePage.verifyManualTimeCss, text);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const verifyWorkTimeRecorded = async (index: number, type: string) => {
	await verifyTextContentByIndex(TimeTrackingWithPausePage.verifyTrackedTimeCss, type, index);
};

export const viewRecordedTimeDeleteBtn = async (index: number) => {
	await verifyElementIsVisibleByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index);
};

export const clickRecordedTimeDeleteBtn = async (index: number) => {
	await clickButtonByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index);
};

export const notificationDialogVisible = async () => {
	await verifyElementIsVisible(TimeTrackingWithPausePage.confirmDialogBtnCss);
};

export const clickNotificationButton = async () => {
	await clickButtonWithForce(TimeTrackingWithPausePage.confirmDialogBtnCss);
};

export const notVisibleRecordedTimeDeleteBtn = async (index: number) => {
	await verifyElementIsNotVisibleByIndex(TimeTrackingWithPausePage.deleteTimeBtnCss, index);
};

export const verifyTimerTime = async (type: string) => {
	await verifyText(TimeTrackingWithPausePage.timerCss, type);
};

export const waitMainDashboard = async (url: string) => {
	// waits for response then continue
	await getPage().waitForResponse((res) => res.url().includes(url));
	await verifyElementIsVisible(TimeTrackingWithPausePage.headerImgCss);
};
