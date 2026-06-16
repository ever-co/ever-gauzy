import dayjs from 'dayjs';
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
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { TimeTrackingPage } from '../../../src/support/Base/pageobjects/TimeTrackingPageObject';

export const headerTextExist = async (text: string) => {
	await verifyText(TimeTrackingPage.headerTextCss, text);
};

export const topCardTextExist = async (text: string) => {
	await verifyText(TimeTrackingPage.topCardHeaderTextCss, text);
};

export const bottomCardTextExist = async (text: string) => {
	await verifyText(TimeTrackingPage.bottomCardHeaderTextCss, text);
};

export const timerVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.timerCss);
};

export const clickTimer = async () => {
	await clickButton(TimeTrackingPage.timerCss);
};

export const timerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.timerBtnCss);
};

export const clickTimerBtn = async (index: number) => {
	await clickButtonByIndex(TimeTrackingPage.timerBtnCss, index);
};

export const startTimerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.startTimerBtnCss);
};

export const clickStartTimerBtn = async () => {
	await clickButton(TimeTrackingPage.startTimerBtnCss);
};

export const stopTimerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.stopTimerBtnCss);
};

export const clickStopTimerBtn = async () => {
	await clickButton(TimeTrackingPage.stopTimerBtnCss);
};

export const viewTimesheetBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = async () => {
	await clickButton(TimeTrackingPage.viewTimesheetBtnCss);
};

export const closeBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.closeBtnCss);
};

export const clickCloseBtn = async () => {
	await clickButton(TimeTrackingPage.closeBtnCss);
};

export const clientSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.clientSelectCss);
};

export const clickClientSelect = async () => {
	await clickButton(TimeTrackingPage.clientSelectCss);
};

export const selectOptionFromDropdown = async (index: number) => {
	await clickButtonByIndex(TimeTrackingPage.dropdownOptionCss, index);
};

export const projectSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.projectSelectCss);
};

export const clickProjectSelect = async () => {
	await clickButton(TimeTrackingPage.projectSelectCss);
};

export const taskSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.taskSelectCss);
};

export const clickTaskSelect = async () => {
	await clickButton(TimeTrackingPage.taskSelectCss);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.descriptionInputCss);
};

export const enterDescription = async (desc: string) => {
	await clearField(TimeTrackingPage.descriptionInputCss);
	await enterInput(TimeTrackingPage.descriptionInputCss, desc);
};

export const manualBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.manualBtnCss);
};

export const clickManualBtn = async () => {
	await clickButton(TimeTrackingPage.manualBtnCss);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.dateInputCss);
};

export const enterDate = async () => {
	await clearField(TimeTrackingPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(TimeTrackingPage.dateInputCss, date);
};

export const startTimeSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.startTimeSelectCss);
};

export const clickStartTimeSelect = async () => {
	await clickButton(TimeTrackingPage.startTimeSelectCss);
};

export const endTimeSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.endTimeSelectCss);
};

export const clickEndTimeSelect = async () => {
	await clickButton(TimeTrackingPage.endTimeSelectCss);
};

export const addTimeBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.addTimeBtnCss);
};

export const clickAddTimeBtn = async () => {
	await clickButton(TimeTrackingPage.addTimeBtnCss);
};

export const verifyTimeWasRecorded = async (index: number, time: string) => {
	await verifyTextNotExistByIndex(TimeTrackingPage.verifyTimeCss, index, time);
};

export const tabBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingPage.tabBtnCss);
};

export const clickTabBtn = async (index: number) => {
	await clickButtonByIndex(TimeTrackingPage.tabBtnCss, index);
};

export const verifyWork = async (work: string) => {
	await verifyText(TimeTrackingPage.verifyWorkCss, work);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(TimeTrackingPage.toastrMessageCss);
};

export const verifyManualTime = async (text: string) => {
	await verifyText(TimeTrackingPage.verifyManualTimeCss, text);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const waitMainDashboard = async (url: string) => {
	// waits for response then continue
	await getPage().waitForResponse((res) => res.url().includes(url));
	await verifyElementIsVisible(TimeTrackingPage.headerImgCss);
};
