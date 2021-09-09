import {
	clickButton,
	clickButtonByIndex,
	verifyElementIsVisible,
    verifyByText
} from '../utils/util';

import { TimeTrackingForClient } from '../pageobjects/TimeTrackingForClientPageObject';


export const timerVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.timerCss);
};

export const clickTimer = () => {
	clickButton(TimeTrackingForClient.timerCss);
};

export const timerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.timerBtnCss);
};

export const clientSelectVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.clientSelectCss);
};

export const clickClientSelect = () => {
	clickButton(TimeTrackingForClient.clientSelectCss);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(TimeTrackingForClient.dropdownOptionCss, index);
};

export const clickStartTimerBtn = () => {
	clickButton(TimeTrackingForClient.startTimerBtnCss);
};

export const stopTimerBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.stopTimerBtnCss);
};

export const clickStopTimerBtn = () => {
	clickButton(TimeTrackingForClient.stopTimerBtnCss);
};

export const viewTimesheetbtnVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const viewViewBtnVisible = () => {
    verifyElementIsVisible(TimeTrackingForClient.viewViewBtnCss)
};

export const clickOnViewBtn = () => {
    clickButton(TimeTrackingForClient.viewViewBtnCss)
};

export const verifyCustomerName = (name) => {
    verifyByText(TimeTrackingForClient.clientNameCss, name)
}
