import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clickElementByText,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
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
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	enterInput(TimeOffPage.startDateInputCss, date);
};

export const endDateInputVisible = () => {
	verifyElementIsVisible(TimeOffPage.startDateInputCss);
};

export const enterEndDateData = () => {
	clearField(TimeOffPage.endDateInputCss);
	const date = dayjs().add(5, 'days').format('MMM D, YYYY');
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

export const selectHolidayOption = (index) => {
	clickButtonByIndex(TimeOffPage.selectHolidayDropdownOptionCss, index);
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
	const date = dayjs()
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
	const date = dayjs()
		.add(1, 'years')
		.startOf('year')
		.add(1, 'days')
		.format('MMM D, YYYY');
	enterInput(TimeOffPage.endHolidayDateCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(TimeOffPage.saveButtonCss);
};

export const timeOffTableRowVisible = () => {
	verifyElementIsVisible(TimeOffPage.selectTableRowCss);
};

export const selectTimeOffTableRow = (index) => {
	clickButtonByIndex(TimeOffPage.selectTableRowCss, index);
};

export const editTimeOffRequestBtnVisible = () => {
	verifyElementIsVisible(TimeOffPage.editTimeOfRequestButtonCss);
};

export const clickEditTimeOffRequestButton = () => {
	clickButton(TimeOffPage.editTimeOfRequestButtonCss);
};

export const deleteTimeOffBtnVisible = () => {
	verifyElementIsVisible(TimeOffPage.deleteTimeOfRequestButtonCss);
};

export const clickDeleteTimeOffButton = () => {
	clickButton(TimeOffPage.deleteTimeOfRequestButtonCss);
};

export const denyTimeOffButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.denyTimeOffRequestButtonCss);
};

export const clickDenyTimeOffButton = () => {
	clickButton(TimeOffPage.denyTimeOffRequestButtonCss);
};

export const approveTimeOffButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.approveTimeOffRequestButtonCss);
};

export const clickApproveTimeOffButton = () => {
	clickButton(TimeOffPage.approveTimeOffRequestButtonCss);
};

export const confirmDeleteTimeOffBtnVisible = () => {
	verifyElementIsVisible(TimeOffPage.confirmDeleteTimeOfButtonCss);
};

export const clickConfirmDeleteTimeOffButoon = () => {
	clickButton(TimeOffPage.confirmDeleteTimeOfButtonCss);
};

export const timeOffSettingsButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.timeOffSettingsButtonCss);
};

export const clickTimeOffSettingsButton = (index) => {
	clickButtonByIndex(TimeOffPage.timeOffSettingsButtonCss, index);
};

export const addNewPolicyButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.addNewPolicyButtonCss);
};

export const clickAddNewPolicyButton = () => {
	clickButton(TimeOffPage.addNewPolicyButtonCss);
};

export const policyInputFieldVisible = () => {
	verifyElementIsVisible(TimeOffPage.addNewPolicyInputCss);
};

export const enterNewPolicyName = (data) => {
	clearField(TimeOffPage.addNewPolicyInputCss);
	enterInput(TimeOffPage.addNewPolicyInputCss, data);
};

export const waitMessageToHide = () => {
	waitElementToHide(TimeOffPage.toastrMessageCss);
};

export const verifyPolicyExists = (text) => {
	verifyText(TimeOffPage.verifyPolicyCss, text);
};

export const verifyPolicyIsDeleted = (text) => {
	verifyTextNotExisting(TimeOffPage.verifyPolicyCss, text);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(TimeOffPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(TimeOffPage.backButtonCss);
};