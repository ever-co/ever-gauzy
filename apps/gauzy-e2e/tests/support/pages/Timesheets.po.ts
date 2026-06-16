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
	clickByText,
	clickButtonDouble
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimesheetsPage } from '../../../src/support/Base/pageobjects/TimesheetsPageObject';

export const addTimeButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.addTimeButtonCss);

export const clickAddTimeButton = async () => clickButton(TimesheetsPage.addTimeButtonCss);

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => clickButton(TimesheetsPage.selectEmployeeCss);

export const selectEmployeeFromDropdown = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.selectEmployeeDropdownOptionCss, index);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const dateInputVisible = async () => verifyElementIsVisible(TimesheetsPage.dateInputCss);

export const enterDateData = async () => {
	await clearField(TimesheetsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(TimesheetsPage.dateInputCss, date);
};

export const startTimeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.startTimeDropdownCss);

export const clickStartTimeDropdown = async () => clickButton(TimesheetsPage.startTimeDropdownCss);

export const selectTimeFromDropdown = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.dropdownOptionCss, index);

export const clientDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.clientDropdownCss);

export const clickClientDropdown = async () => clickButton(TimesheetsPage.clientDropdownCss);

export const selectClientFromDropdown = async (text: string | number) =>
	clickByText(TimesheetsPage.dropdownOptionCss, String(text));

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.projectDropdownCss);

export const clickSelectProjectDropdown = async () => clickButton(TimesheetsPage.projectDropdownCss);

export const selectProjectFromDropdown = async (text: string) =>
	clickElementByText(TimesheetsPage.dropdownOptionCss, text);

export const taskDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.taskDropdownCss);

export const clickTaskDropdown = async () => clickButton(TimesheetsPage.taskDropdownCss);

export const selectTaskFromDropdown = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.dropdownOptionCss, index);

export const addTimeLogDescriptionVisible = async () => verifyElementIsVisible(TimesheetsPage.descriptionTextareaCss);

export const enterTimeLogDescriptionData = async (data: string) => {
	await clearField(TimesheetsPage.descriptionTextareaCss);
	await enterInput(TimesheetsPage.descriptionTextareaCss, data);
};

export const saveTimeLogButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.saveTimeButtonCss);

export const clickSaveTimeLogButton = async () => clickButton(TimesheetsPage.saveTimeButtonCss);

export const closeAddTimeLogPopoverButtonVisible = async () =>
	verifyElementIsVisible(TimesheetsPage.closeAddTimeLogPopoverCss);

export const clickCloseAddTimeLogPopoverButton = async () => clickButton(TimesheetsPage.closeAddTimeLogPopoverCss);

export const viewEmployeeTimeLogButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.viewEmployeeTimeCss);

export const clickViewEmployeeTimeLogButton = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.viewEmployeeTimeCss, index);

export const editEmployeeTimeLogButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.editEmployeeTimeCss);

export const clickEditEmployeeTimeLogButton = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.editEmployeeTimeCss, index);

export const deleteEmployeeTimeLogButtonVisible = async () =>
	verifyElementIsVisible(TimesheetsPage.deleteEmployeeTimeCss);

export const clickDeleteEmployeeTimeLogButton = async (index: number) =>
	clickButtonByIndex(TimesheetsPage.deleteEmployeeTimeCss, index);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => clickButton(TimesheetsPage.confirmDeleteButtonCss);

export const waitMessageToHide = async () => waitElementToHide(TimesheetsPage.toastrMessageCss);

export const verifyTimeExists = async (text: string) => verifyText(TimesheetsPage.verifyTimeCss, text);

export const verifyTimeIsDeleted = async (text: string) => verifyTextNotExisting(TimesheetsPage.verifyTimeCss, text);

export const doubleClickClientDropdown = async () => clickButtonDouble(TimesheetsPage.clientDropdownCss);
