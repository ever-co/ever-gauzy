import {
	verifyText,
	verifyStateByIndex,
	verifyElementIsVisible,
	clickElementByText,
	clickButton,
	triggerSlider,
	verifyTextNotExisting,
	forceClickElementByText
} from '../utils/util';
import { ReportsPage } from '../pageobjects/ReportsPageObject';

export const verifyHeader = (text) => {
	verifyText(ReportsPage.headerTextCss, text);
};

export const verifySubheader = (text) => {
	verifyText(ReportsPage.subheaderTextCss, text);
};

export const verifyTitle = (text) => {
	verifyText(ReportsPage.titleCss, text);
};

export const verifyCheckboxState = (index, state) => {
	verifyStateByIndex(ReportsPage.checkboxCss, index, state);
};

export const sidebarBtnVidible = () => {
	verifyElementIsVisible(ReportsPage.sidebarBtnCss);
};

export const clickSidebarBtn = (text) => {
	clickElementByText(ReportsPage.sidebarBtnCss, text);
};

export const clickInnerSidebarBtn = (text) => {
	forceClickElementByText(ReportsPage.sidebarBtnCss, text);
};

export const activityLevelBtnVisible = () => {
	verifyElementIsVisible(ReportsPage.sliderBtnCss);
};

export const clickActivityLevelBtn = () => {
	clickButton(ReportsPage.sliderBtnCss);
};

export const sliderVisible = () => {
	verifyElementIsVisible(ReportsPage.sliderCss);
};

export const changeSliderValue = () => {
	triggerSlider(ReportsPage.sliderCss);
};

export const verifyTimeLogged = (time) => {
	verifyTextNotExisting(ReportsPage.totalHoursCss, time);
};

export const verifyTimeAndActivityProject = (project) => {
	verifyText(ReportsPage.timeAndActivityProjectCss, project);
};

export const verifyEmployeeWorked = (employee) => {
	verifyText(ReportsPage.amountOwedEmployeeCss, employee);
};

export const verifyProjectBudgetsProject = (project) => {
	verifyText(ReportsPage.projectsBudgetsProjectCss, project);
};

export const verifyClientsBudgetsClient = (client) => {
	verifyText(ReportsPage.clientsBudgetsClientCss, client);
};

export const verifyClientsBudgetsProgress = (progress) => {
	verifyTextNotExisting(ReportsPage.progressContainerCss, progress);
};
