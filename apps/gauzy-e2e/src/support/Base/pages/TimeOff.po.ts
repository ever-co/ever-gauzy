import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clickElementIfVisible
} from '../utils/util';
import { TimeOffPage } from '../pageobjects/TimeOffPageObject';

export const requestButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.requestButtonCss);
};

export const clickRequestButton = () => {
	clickButton(TimeOffPage.requestButtonCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(TimeOffPage.employeeSelectorDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(TimeOffPage.employeeSelectorDropdownCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickElementIfVisible(TimeOffPage.checkEmployeeMultyselectCss, index);
};
