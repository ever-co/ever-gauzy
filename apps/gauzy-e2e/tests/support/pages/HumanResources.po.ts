import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickOutsideElement,
	clickButtonByIndex
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { HumanResourcesPage } from '../../../src/support/Base/pageobjects/HumanResourcesPageObject';

export const verifyEmployeeCardVisible = async () => {
	await verifyElementIsVisible(HumanResourcesPage.employeeCss);
};

export const selectEmployee = async (index) => {
	await clickButtonByIndex(HumanResourcesPage.employeeCss, index);
};

// The Cypress spec referenced selectEmployeeByName (never defined in the old PO — a latent
// bug in the dormant suite). Select the employee card matching the full name.
export const selectEmployeeByName = async (name: string) => {
	await clickElementByText(HumanResourcesPage.employeeCss, name);
};

export const verifyEmployeeName = async (text) => {
	await verifyText(HumanResourcesPage.employeeNameCss, text);
};

export const verifyCardTextExist = async (text) => {
	await verifyText(HumanResourcesPage.infoTextCss, text);
};

export const verifyChartDropdownVisible = async () => {
	await verifyElementIsVisible(HumanResourcesPage.chartDropdownCss);
};

export const verifyPopupProfitHeaderText = async (text) => {
	await verifyText(HumanResourcesPage.popupProfitHeaderCss, text);
};

export const clickChartDropdown = async () => {
	await clickButton(HumanResourcesPage.chartDropdownCss);
};

export const verifyChartOptionText = async (text) => {
	await verifyText(HumanResourcesPage.dropdownOptionCss, text);
};

export const clickCardByHeaderText = async (text) => {
	await clickElementByText(HumanResourcesPage.infoTextCss, text);
};

export const verifyPopupHeaderText = async (text) => {
	await verifyText(HumanResourcesPage.popupHeaderCss, text);
};

export const verifyPopupTableHeaderText = async (text) => {
	await verifyText(HumanResourcesPage.popupTableHederCss, text);
};

export const clickCardBody = async () => {
	await clickOutsideElement();
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};
