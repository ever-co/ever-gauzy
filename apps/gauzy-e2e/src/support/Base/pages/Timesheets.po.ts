import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clickElementByText,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { TimesheetsPage } from '../pageobjects/TimesheetsPageObject';

export const addTimeButtonVisible = () => {
	verifyElementIsVisible(TimesheetsPage.addTimeButtonCss);
};

export const clickAddTimeButton = () => {
	clickButton(TimesheetsPage.addTimeButtonCss);
};

export const closeAddTimeLogPopoverButtonVisible = () => {
	verifyElementIsVisible(TimesheetsPage.closeAddTimeLogPopoverCss);
};

export const clickCloseAddTimeLogPopoverButton = () => {
	clickButton(TimesheetsPage.closeAddTimeLogPopoverCss);
};

export const viewEmployeeTimeLogButtonVisible = () => {
	verifyElementIsVisible(TimesheetsPage.viewEmployeeTimeCss);
};

export const clickViewEmployeeTimeLogButton = () => {
	clickButton(TimesheetsPage.viewEmployeeTimeCss);
};

export const editEmployeeTimeLogButtonVisible = () => {
	verifyElementIsVisible(TimesheetsPage.editEmployeeTimeCss);
};

export const clickEditEmployeeTimeLogButton = () => {
	clickButton(TimesheetsPage.editEmployeeTimeCss);
};

export const deleteEmployeeTimeLogButtonVisible = () => {
	verifyElementIsVisible(TimesheetsPage.deleteEmployeeTimeCss);
};

export const clickDeleteEmployeeTimeLogButton = () => {
	clickButton(TimesheetsPage.deleteEmployeeTimeCss);
};
