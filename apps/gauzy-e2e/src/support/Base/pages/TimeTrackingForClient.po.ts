import {
	clickButton,
	clickButtonByIndex,
	verifyElementIsVisible,
	verifyByText,
	clickButtonDouble
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
	cy.intercept('GET', '/api/tasks/employee/*').as('waitClient');
	clickButton(TimeTrackingForClient.clientSelectCss);
	cy.wait('@waitClient');
	clickButtonDouble(TimeTrackingForClient.clientSelectCss);
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

export const viewTimesheetBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const viewViewBtnVisible = () => {
	verifyElementIsVisible(TimeTrackingForClient.viewViewBtnCss);
};

export const clickOnViewBtn = () => {
	clickButton(TimeTrackingForClient.viewViewBtnCss);
};

export const verifyCustomerName = (name) => {
	verifyByText(TimeTrackingForClient.clientNameCss, name);
};

export const waitMainDashboard = (url: string) => {
	//waits for responce then continue
	cy.intercept('GET', url).as('getUser');
	cy.wait('@getUser').then(() => {
		verifyElementIsVisible(TimeTrackingForClient.headerImgCss);
	});
};
