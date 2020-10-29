import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clickElementByText,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { TimeOffPage } from '../pageobjects/TimeOffPageObject';

export const requestButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.requestButtonCss);
};

export const clickRequestButton = () => {
	clickButton(TimeOffPage.requestButtonCss);
};

export const employeeSelectorVisible = () => {
	verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
};

export const clickEmployeeSelector = () => {
	clickButton(TimeOffPage.employeeDropdownCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(TimeOffPage.employeeDropdownOptionCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(TimeOffPage.employeeDropdownOptionCss, index);
};

export const selectTiemOffPolicyVisible = () => {
	verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownCss);
};

export const clickTimeOffPolicyDropdown = () => {
	clickButton(TimeOffPage.timeOffPolicyDropdownCss);
};

export const timeOffPolicyDropdownOptionVisible = () => {
	verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownOptionCss);
};

export const selectTimeOffPolicy = (data) => {
	clickElementByText(TimeOffPage.timeOffPolicyDropdownOptionCss, data);
};

export const startDateInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.startDateInputCss);
};

export const enterStartDateData = () => {
	clearField(TimeOffPage.startDateInputCss);
	const date = Cypress.moment().add(1, 'days').format('MMM D, YYYY');
	enterInput(TimeOffPage.startDateInputCss, date);
};

export const endDateInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.startDateInputCss);
};

export const enterEndDateData = () => {
	clearField(TimeOffPage.endDateInputCss);
	const date = Cypress.moment().add(5, 'days').format('MMM D, YYYY');
	enterInput(TimeOffPage.endDateInputCss, date);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.descriptionInputCss);
};

export const enterDdescriptionInputData = (data) => {
	clearField(TimeOffPage.descriptionInputCss);
	enterInput(TimeOffPage.descriptionInputCss, data);
};

export const saveRequestButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.saveRequestButtonCss);
};

export const clickSaveRequestButton = () => {
	clickButton(TimeOffPage.saveRequestButtonCss);
};

export const addHolidayButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.addHolidayButtonCss);
};

export const clickAddHolidayButton = () => {
	clickButton(TimeOffPage.addHolidayButtonCss);
};

export const selectHolidayNameVisible = () => {
	verifyElementIsVisible(TimeOffPage.descriptionInputCss);
};

export const clickSelectHolidayName = () => {
	clickButton(TimeOffPage.descriptionInputCss);
};

export const selectHolidayOption = (data) => {
	clickElementByText(TimeOffPage.selectHolidayDropdownOptionCss, data);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(TimeOffPage.selectEmloyeeCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(TimeOffPage.selectEmloyeeCss);
};

export const selectEmployeeFromHolidayDropdown = (index) => {
	clickButtonByIndex(TimeOffPage.selectEmployeeDropdownOptionCss, index);
};

export const startHolidayDateInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.startHolidayDateCss);
};

export const enterStartHolidayDate = () => {
	clearField(TimeOffPage.startHolidayDateCss);
	const date = Cypress.moment()
		.add(1, 'years')
		.startOf('year')
		.format('MMM D, YYYY');
	enterInput(TimeOffPage.startHolidayDateCss, date);
};

export const endHolidayDateInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.endHolidayDateCss);
};

export const enterEndHolidayDate = () => {
	clearField(TimeOffPage.endHolidayDateCss);
	const date = Cypress.moment()
		.add(1, 'years')
		.startOf('year')
		.add(1, 'days')
		.format('MMM D, YYYY');
	enterInput(TimeOffPage.endHolidayDateCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveHolidayButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.saveHolidayButtonCss);
};

export const clickSaveHolidayButton = () => {
	clickButton(TimeOffPage.saveHolidayButtonCss);
};

export const timeOffTableRowVisible = () => {
	verifyElementIsVisible(TimeOffPage.selectTableRowCss);
};

export const selectTimeOffTableRow = (index) => {
	clickButtonByIndex(TimeOffPage.selectTableRowCss, index);
};

export const deleteTimeOffBtnVisible = () => {
	verifyElementIsVisible(TimeOffPage.deleteTimeOfRequestCss);
};

export const clickDeleteTimeOffButton = () => {
	clickButton(TimeOffPage.deleteTimeOfRequestCss);
};

export const confirmDeleteTimeOffBtnVisible = () => {
	verifyElementIsVisible(TimeOffPage.confirmDeleteTimeOfButtonCss);
};

export const clickConfirmDeleteTimeOffButoon = () => {
	clickButton(TimeOffPage.confirmDeleteTimeOfButtonCss);
};
