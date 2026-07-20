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
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ProjectTrackedInTimesheetPage } from '../../../src/support/Base/pageobjects/ProjectTrackedInTimesheetPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const requestProjectButtonVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.requestNewProjectButtonCss);
};

export const clickRequestProjectButton = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.requestNewProjectButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.projectNameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(ProjectTrackedInTimesheetPage.projectNameInputCss);
	await enterInput(ProjectTrackedInTimesheetPage.projectNameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (text: string) => {
	await clickByText(ProjectTrackedInTimesheetPage.selectEmployeeDropdownOptionCss, text);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveProjectButtonVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.saveProjectButtonCss);
};

export const clickSaveProjectButton = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.saveProjectButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ProjectTrackedInTimesheetPage.toastrMessageCss);
};

export const timerVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.timerCss);
};

export const clickTimer = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.timerCss);
};

export const timerBtnVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.timerBtnCss);
};

export const projectSelectVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.projectSelectCss);
};

export const clickProjectSelect = async () => {
	const waitProjectLoad = getPage().waitForResponse((res) =>
		/\/api\/organization-projects\/employee\//.test(res.url())
	);
	await clickButton(ProjectTrackedInTimesheetPage.projectSelectCss);
	await waitProjectLoad;
};

export const selectOptionFromDropdown = async (index: number, projectName: string) => {
	await verifyText(ProjectTrackedInTimesheetPage.dropdownOptionCss, projectName);
	await clickButtonByIndex(ProjectTrackedInTimesheetPage.dropdownOptionCss, index);
};

export const clickStartTimerBtn = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.startTimerBtnCss);
};

export const stopTimerBtnVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.stopTimerBtnCss);
};

export const clickStopTimerBtn = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.stopTimerBtnCss);
};

export const viewTimesheetBtnVisible = async () => {
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.viewTimesheetBtnCss);
};

export const clickViewTimesheetBtn = async () => {
	await clickButton(ProjectTrackedInTimesheetPage.viewTimesheetBtnCss);
};

export const verifyProjectText = async (text: string) => {
	await compareTwoTexts(ProjectTrackedInTimesheetPage.projectNameCss, text);
};

export const waitMainDashboard = async (url: string) => {
	// waits for response then continue
	await getPage().waitForResponse((res) => res.url().includes(url));
	await verifyElementIsVisible(ProjectTrackedInTimesheetPage.headerImgCss);
};
