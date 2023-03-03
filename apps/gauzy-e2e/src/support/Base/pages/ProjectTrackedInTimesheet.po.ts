import {
	clearField,
	clickButton,
	clickButtonByIndex,
	clickKeyboardBtnByKeycode,
	enterInput,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	clickByText,
	compareTwoTexts
} from '../utils/util';
import { ProjectTrackedInTimesheetPage } from '../pageobjects/ProjectTrackedInTimesheetPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ProjectTrackedInTimesheetPage.gridButtonCss, index);
};

export const requestProjectButtonVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.requestNewProjectButtonCss);
};

export const clickRequestProjectButton = () => {
	clickButton(ProjectTrackedInTimesheetPage.requestNewProjectButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.projectNameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(ProjectTrackedInTimesheetPage.projectNameInputCss);
	enterInput(ProjectTrackedInTimesheetPage.projectNameInputCss, data);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(ProjectTrackedInTimesheetPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = (text) => {
	clickByText(ProjectTrackedInTimesheetPage.selectEmployeeDropdownOptionCss, text);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveProjectButtonVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.saveProjectButtonCss);
};

export const clickSaveProjectButton = () => {
	clickButton(ProjectTrackedInTimesheetPage.saveProjectButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ProjectTrackedInTimesheetPage.toastrMessageCss);
};

export const timerVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.timerCss);
};

export const clickTimer = () => {
	clickButton(ProjectTrackedInTimesheetPage.timerCss);
};

export const timerBtnVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.timerBtnCss);
};

export const projectSelectVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.projectSelectCss);
};

export const clickProjectSelect = () => {
	cy.intercept('GET', '/api/organization-projects/employee/*').as('waitProjectLoad');
	clickButton(ProjectTrackedInTimesheetPage.projectSelectCss);
};

export const selectOptionFromDropdown = (index, projectName: string) => {
	cy.wait('@waitProjectLoad').then(() => {
		verifyText(ProjectTrackedInTimesheetPage.dropdownOptionCss, projectName);
		clickButtonByIndex(ProjectTrackedInTimesheetPage.dropdownOptionCss, index);
	});
};

export const clickStartTimerBtn = () => {
	clickButton(ProjectTrackedInTimesheetPage.startTimerBtnCss);
};

export const stopTimerBtnVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.stopTimerBtnCss);
};

export const clickStopTimerBtn = () => {
	clickButton(ProjectTrackedInTimesheetPage.stopTimerBtnCss);
};

export const viewTimesheetBtnVisible = () => {
	verifyElementIsVisible(ProjectTrackedInTimesheetPage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = () => {
	clickButton(ProjectTrackedInTimesheetPage.viewTimesheetBtnCss);
};

export const verifyProjectText = (text) => {
	compareTwoTexts(ProjectTrackedInTimesheetPage.projectNameCss, text);
};

export const waitMainDashboard = (url: string) => {
	//waits for response then continue
	cy.intercept('GET', url).as('getUser');
	cy.wait('@getUser').then(() => {
		verifyElementIsVisible(ProjectTrackedInTimesheetPage.headerImgCss);
	});
};
