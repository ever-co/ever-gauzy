import {
	clickButton,
	clickButtonByIndex,
	verifyElementIsVisible,
	verifyByText,
	clickButtonDouble
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { TimeTrackingForClient } from '../../../src/support/Base/pageobjects/TimeTrackingForClientPageObject';

export const timerVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.timerCss);
};

export const clickTimer = async () => {
	await clickButton(TimeTrackingForClient.timerCss);
};

export const timerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.timerBtnCss);
};

export const clientSelectVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.clientSelectCss);
};

export const clickClientSelect = async () => {
	// Mirrors the Cypress intercept/alias: arm the wait before the click, then consume it.
	const waitClient = getPage().waitForResponse((res) => /\/api\/tasks\/employee\//.test(res.url()));
	await clickButton(TimeTrackingForClient.clientSelectCss);
	await waitClient;
	await clickButtonDouble(TimeTrackingForClient.clientSelectCss);
};

export const selectOptionFromDropdown = async (index: number) => {
	await clickButtonByIndex(TimeTrackingForClient.dropdownOptionCss, index);
};

export const clickStartTimerBtn = async () => {
	await clickButton(TimeTrackingForClient.startTimerBtnCss);
};

export const stopTimerBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.stopTimerBtnCss);
};

export const clickStopTimerBtn = async () => {
	await clickButton(TimeTrackingForClient.stopTimerBtnCss);
};

export const viewTimesheetBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = async () => {
	await clickButton(TimeTrackingForClient.viewTimesheetBtnCss);
};

export const viewViewBtnVisible = async () => {
	await verifyElementIsVisible(TimeTrackingForClient.viewViewBtnCss);
};

export const clickOnViewBtn = async () => {
	await clickButton(TimeTrackingForClient.viewViewBtnCss);
};

export const verifyCustomerName = async (name: string) => {
	await verifyByText(TimeTrackingForClient.clientNameCss, name);
};

export const waitMainDashboard = async (url: string) => {
	// waits for response then continue
	await getPage().waitForResponse((res) => res.url().includes(url));
	await verifyElementIsVisible(TimeTrackingForClient.headerImgCss);
};
