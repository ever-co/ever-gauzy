import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationRecurringExpensesPage } from '../../../src/support/Base/pageobjects/OrganizationRecurringExpensesPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	await clickButton(OrganizationRecurringExpensesPage.expenseDropdownCss);
};

export const selectExpenseOptionDropdown = async (text) => {
	await clickElementByText(OrganizationRecurringExpensesPage.dropdownOptionCss, text);
};

export const expenseValueInputVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.valueInputCss);
};

export const enterExpenseValueInputData = async (data) => {
	await clearField(OrganizationRecurringExpensesPage.valueInputCss);
	await enterInput(OrganizationRecurringExpensesPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.saveButtonCss);
};

export const clickSaveExpenseButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.saveButtonCss);
};

export const settingsButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	await getLastElement(OrganizationRecurringExpensesPage.settingsButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.editButtonCss);
};

export const clickEditButton = async () => {
	await getLastElement(OrganizationRecurringExpensesPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await getLastElement(OrganizationRecurringExpensesPage.deleteButtonCss);
};

export const deleteOnlyThisRadioButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss);
};

export const clickDeleteOnlyThisRadioButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationRecurringExpensesPage.toastrMessageCss);
};

export const verifyExpenseExists = async (text) => {
	await verifyText(OrganizationRecurringExpensesPage.verifyExpenseCss, text);
};

export const verifyExpenseIsDeleted = async () => {
	await verifyElementNotExist(OrganizationRecurringExpensesPage.verifyExpenseCss);
};
