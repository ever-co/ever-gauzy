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
	verifyTextNotExisting,
	clickButtonDouble
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimeOffPage } from '../../../src/support/Base/pageobjects/TimeOffPageObject';

export const requestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.requestButtonCss);

export const clickRequestButton = async () => clickButton(TimeOffPage.requestButtonCss);

export const employeeSelectorVisible = async () => {
	const waitForUsers = getPage().waitForResponse((response) => /\/api\/employee\/working/.test(response.url()));
	await verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
	await waitForUsers;
};

export const clickEmployeeSelector = async () => {
	await clickButton(TimeOffPage.employeeDropdownCss);
	await clickButtonDouble(TimeOffPage.employeeDropdownCss);
};

export const employeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownOptionCss);

export const selectEmployeeFromDropdown = async (index: number) =>
	clickButtonByIndex(TimeOffPage.employeeDropdownOptionCss, index);

export const selectTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownCss);

export const clickTimeOffPolicyDropdown = async () => clickButton(TimeOffPage.timeOffPolicyDropdownCss);

export const timeOffPolicyDropdownOptionVisible = async () =>
	verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownOptionCss);

export const selectTimeOffPolicy = async (data: string) =>
	clickElementByText(TimeOffPage.timeOffPolicyDropdownOptionCss, data);

export const startDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterStartDateData = async () => {
	await clearField(TimeOffPage.startDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startDateInputCss, date);
};

export const endDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterEndDateData = async () => {
	await clearField(TimeOffPage.endDateInputCss);
	const date = dayjs().add(5, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endDateInputCss, date);
};

export const descriptionInputVisible = async () => verifyElementIsVisible(TimeOffPage.descriptionInputCss);

export const enterDescriptionInputData = async (data: string) => {
	await clearField(TimeOffPage.descriptionInputCss);
	await enterInput(TimeOffPage.descriptionInputCss, data);
};

export const saveRequestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveRequestButtonCss);

export const clickSaveRequestButton = async () => clickButton(TimeOffPage.saveRequestButtonCss);

export const addHolidayButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addHolidayButtonCss);

export const clickAddHolidayButton = async () => {
	const waitForm = getPage().waitForResponse((response) => /\/api\/employee/.test(response.url()));
	await clickButton(TimeOffPage.addHolidayButtonCss);
	await waitForm;
};

export const selectHolidayNameVisible = async () => verifyElementIsVisible(TimeOffPage.holidayNameSelectCss);

export const clickSelectHolidayName = async () => clickButton(TimeOffPage.holidayNameSelectCss);

export const selectHolidayOption = async (option: string | number) =>
	typeof option === 'number'
		? clickButtonByIndex(TimeOffPage.selectHolidayDropdownOptionCss, option)
		: clickElementByText(TimeOffPage.selectHolidayDropdownOptionCss, option);

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => clickButton(TimeOffPage.selectEmployeeCss);

export const selectEmployeeFromHolidayDropdown = async (index: number) =>
	clickButtonByIndex(TimeOffPage.selectEmployeeDropdownOptionCss, index);

export const startHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startHolidayDateCss);

export const enterStartHolidayDate = async () => {
	await clearField(TimeOffPage.startHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startHolidayDateCss, date);
};

export const endHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.endHolidayDateCss);

export const enterEndHolidayDate = async () => {
	await clearField(TimeOffPage.endHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endHolidayDateCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const saveButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveButtonCss);

export const clickSaveButton = async () => clickButton(TimeOffPage.saveButtonCss);

export const timeOffTableRowVisible = async () => verifyElementIsVisible(TimeOffPage.selectTableRowCss);

export const selectTimeOffTableRow = async (index: number) =>
	clickButtonByIndex(TimeOffPage.selectTableRowCss, index);

export const editTimeOffRequestBtnVisible = async () => verifyElementIsVisible(TimeOffPage.editTimeOfRequestButtonCss);

export const clickEditTimeOffRequestButton = async () => clickButton(TimeOffPage.editTimeOfRequestButtonCss);

export const deleteTimeOffBtnVisible = async () => verifyElementIsVisible(TimeOffPage.deleteTimeOfRequestButtonCss);

export const clickDeleteTimeOffButton = async () => clickButton(TimeOffPage.deleteTimeOfRequestButtonCss);

export const denyTimeOffButtonVisible = async () => verifyElementIsVisible(TimeOffPage.denyTimeOffRequestButtonCss);

export const clickDenyTimeOffButton = async () => clickButton(TimeOffPage.denyTimeOffRequestButtonCss);

export const approveTimeOffButtonVisible = async () =>
	verifyElementIsVisible(TimeOffPage.approveTimeOffRequestButtonCss);

export const clickApproveTimeOffButton = async () => clickButton(TimeOffPage.approveTimeOffRequestButtonCss);

export const confirmDeleteTimeOffBtnVisible = async () =>
	verifyElementIsVisible(TimeOffPage.confirmDeleteTimeOfButtonCss);

export const clickConfirmDeleteTimeOffButton = async () => clickButton(TimeOffPage.confirmDeleteTimeOfButtonCss);

export const timeOffSettingsButtonVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffSettingsButtonCss);

export const clickTimeOffSettingsButton = async (index: number) =>
	clickButtonByIndex(TimeOffPage.timeOffSettingsButtonCss, index);

export const addNewPolicyButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyButtonCss);

export const clickAddNewPolicyButton = async () => clickButton(TimeOffPage.addNewPolicyButtonCss);

export const policyInputFieldVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyInputCss);

export const enterNewPolicyName = async (data: string) => {
	await clearField(TimeOffPage.addNewPolicyInputCss);
	await enterInput(TimeOffPage.addNewPolicyInputCss, data);
};

export const waitMessageToHide = async () => waitElementToHide(TimeOffPage.toastrMessageCss);

export const verifyPolicyExists = async (text: string) => verifyText(TimeOffPage.verifyPolicyCss, text);

export const verifyPolicyIsDeleted = async (text: string) => verifyTextNotExisting(TimeOffPage.verifyPolicyCss, text);

export const backButtonVisible = async () => verifyElementIsVisible(TimeOffPage.backButtonCss);

export const clickBackButton = async () => clickButton(TimeOffPage.backButtonCss);

export const verifyEmployeeSelectorVisible = async () => verifyElementIsVisible(TimeOffPage.employeeSelectorCss);

export const clickEmployeeSelectorDropdown = async () => clickButton(TimeOffPage.employeeSelectorCss);

export const verifyTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicySelectorCss);

export const clickTimeOffPolicySelector = async () => clickButton(TimeOffPage.timeOffPolicySelectorCss);

export const employeeSelectorVisibleAgain = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
