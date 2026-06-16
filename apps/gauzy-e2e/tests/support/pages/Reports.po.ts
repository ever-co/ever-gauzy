import {
	verifyText,
	verifyStateByIndex,
	verifyElementIsVisible,
	clickElementByText,
	clickButton,
	triggerSlider,
	verifyTextNotExisting,
	forceClickElementByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ReportsPage } from '../../../src/support/Base/pageobjects/ReportsPageObject';

export const verifyHeader = async (text) => {
	await verifyText(ReportsPage.headerTextCss, text);
};

export const verifySubheader = async (text) => {
	await verifyText(ReportsPage.subheaderTextCss, text);
};

export const verifyTitle = async (text) => {
	await verifyText(ReportsPage.titleCss, text);
};

export const verifyCheckboxState = async (index, state) => {
	await verifyStateByIndex(ReportsPage.checkboxCss, index, state);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(ReportsPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text) => {
	await clickElementByText(ReportsPage.sidebarBtnCss, text);
};

export const clickInnerSidebarBtn = async (text) => {
	await forceClickElementByText(ReportsPage.sidebarBtnCss, text);
};

export const clickInnerSidebarBtnAmounts = async (text) => {
	await forceClickElementByText(ReportsPage.sidebarBtnCss, text);
};

export const activityLevelBtnVisible = async () => {
	await verifyElementIsVisible(ReportsPage.sliderBtnCss);
};

export const clickActivityLevelBtn = async () => {
	await clickButton(ReportsPage.sliderBtnCss);
};

export const sliderVisible = async () => {
	await verifyElementIsVisible(ReportsPage.sliderCss);
};

export const changeSliderValue = async () => {
	await triggerSlider(ReportsPage.sliderCss);
};

export const verifyTimeLogged = async (time) => {
	await verifyTextNotExisting(ReportsPage.totalHoursCss, time);
};

export const verifyTimeAndActivityProject = async (project) => {
	await verifyText(ReportsPage.timeAndActivityProjectCss, project);
};

export const verifyEmployeeWorked = async (employee) => {
	await verifyText(ReportsPage.amountOwedEmployeeCss, employee);
};

export const verifyProjectBudgetsProject = async (project) => {
	await verifyText(ReportsPage.projectsBudgetsProjectCss, project);
};

export const verifyClientsBudgetsClient = async (client) => {
	await verifyText(ReportsPage.clientsBudgetsClientCss, client);
};

export const verifyClientsBudgetsProgress = async (progress) => {
	await verifyTextNotExisting(ReportsPage.progressContainerCss, progress);
};
