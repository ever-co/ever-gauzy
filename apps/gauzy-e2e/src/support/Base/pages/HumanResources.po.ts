import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickOutsideElement
} from '../utils/util';
import { HumanResourcesPage } from '../pageobjects/HumanResourcesPageObject';

export const selectEmployeeByName = (name) => {
	clickElementByText(HumanResourcesPage.employeeCss, name);
};

export const verifyEmployeeName = (text) => {
	verifyText(HumanResourcesPage.employeeNameCss, text);
};

export const verifyCardTextExist = (text) => {
	verifyText(HumanResourcesPage.infoTextCss, text);
};

export const verifyChartDropdownVisible = () => {
	verifyElementIsVisible(HumanResourcesPage.chartDropdownCss);
};

export const verifyPopupProfitHeaderText = (text) => {
	verifyText(HumanResourcesPage.popupProfitHeaderCss, text);
};

export const clickChartDropdown = () => {
	clickButton(HumanResourcesPage.chartDropdownCss);
};

export const verifyChartOptionText = (text) => {
	verifyText(HumanResourcesPage.dropdownOptionCss, text);
};

export const clickCardByHeaderText = (text) => {
	clickElementByText(HumanResourcesPage.infoTextCss, text);
};

export const verifyPopupHeaderText = (text) => {
	verifyText(HumanResourcesPage.popupHeaderCss, text);
};

export const verifyPopupTableHeaderText = (text) => {
	verifyText(HumanResourcesPage.popupTableHederCss, text);
};

export const clickCardBody = () => {
	clickOutsideElement();
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
