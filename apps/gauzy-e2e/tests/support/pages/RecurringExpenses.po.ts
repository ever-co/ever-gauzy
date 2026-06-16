import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
	clickButtonDouble
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RecurringExpensesPage } from '../../../src/support/Base/pageobjects/RecurringExpensesPageObject';

export const addNewExpenseButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.addNewExpenseButtonCss);
};

export const clickAddNewExpenseButton = async () => {
	await clickButton(RecurringExpensesPage.addNewExpenseButtonCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(RecurringExpensesPage.employeeDropdownCss);
	await clickButtonDouble(RecurringExpensesPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(RecurringExpensesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	await clickButton(RecurringExpensesPage.expenseDropdownCss);
};

export const selectExpenseOptionDropdown = async (text) => {
	await clickElementByText(RecurringExpensesPage.dropdownOptionCss, text);
};

export const expenseValueInputVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.valueInputCss);
};

export const enterExpenseValueInputData = async (data) => {
	await clearField(RecurringExpensesPage.valueInputCss);
	await enterInput(RecurringExpensesPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = async () => {
	await clickButton(RecurringExpensesPage.saveExpenseButtonCss);
};

export const settingsButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	await getLastElement(RecurringExpensesPage.settingsButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.editExpenseButtonCss);
};

export const clickEditButton = async () => {
	await getLastElement(RecurringExpensesPage.editExpenseButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.deleteExpenseButtonCss);
};

export const clickDeleteButton = async () => {
	await getLastElement(RecurringExpensesPage.deleteExpenseButtonCss);
};

export const deleteAllButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.deleteAllButtonCss);
};

export const clickDeleteAllButton = async () => {
	await clickButton(RecurringExpensesPage.deleteAllButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(RecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(RecurringExpensesPage.toastrMessageCss);
};

export const verifyExpenseExists = async (text) => {
	await verifyText(RecurringExpensesPage.verifyExpenseCss, text);
};

export const verifyExpenseIsDeleted = async () => {
	await verifyElementNotExist(RecurringExpensesPage.verifyExpenseCss);
};
