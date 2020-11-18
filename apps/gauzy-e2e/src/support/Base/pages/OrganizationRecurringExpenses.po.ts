import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	getLastElement,
	waitElementToHide
} from '../utils/util';
import { OrganizationRecurringExpensesPage } from '../pageobjects/OrganizationRecurringExpensesPageObject';

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = () => {
	verifyElementIsVisible(
		OrganizationRecurringExpensesPage.expenseDropdownCss
	);
};

export const clickExpenseDropdown = () => {
	clickButton(OrganizationRecurringExpensesPage.expenseDropdownCss);
};

export const selectExpenseOptionDropdown = (text) => {
	clickElementByText(
		OrganizationRecurringExpensesPage.dropdownOptionCss,
		text
	);
};

export const expenseValueInputVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.valueInputCss);
};

export const enterExpenseValueInputData = (data) => {
	clearField(OrganizationRecurringExpensesPage.valueInputCss);
	enterInput(OrganizationRecurringExpensesPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.saveButtonCss);
};

export const clickSaveExpenseButton = () => {
	clickButton(OrganizationRecurringExpensesPage.saveButtonCss);
};

export const settingsButtonVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.settingsButtonCss);
};

export const clickSettingsButton = () => {
	getLastElement(OrganizationRecurringExpensesPage.settingsButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.editButtonCss);
};

export const clickEditButton = () => {
	getLastElement(OrganizationRecurringExpensesPage.editButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationRecurringExpensesPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	getLastElement(OrganizationRecurringExpensesPage.deleteButtonCss);
};

export const deleteOnlyThisRadioButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss
	);
};

export const clickDeleteOnlyThisRadioButton = () => {
	clickButton(OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss
	);
};

export const clickConfirmDeleteButton = () => {
	clickButton(
		OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss
	);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationRecurringExpensesPage.toastrMessageCss);
};
