import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickButtonDouble,
	waitElementToHide,
	clickByText,
	verifyByText,
	verifyText,
	enterInputConditionally
} from '../util';
import { selectNgOption } from '../ng-select';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EmployeeDashboardPage } from '../../../src/support/Base/pageobjects/EmployeeDashboardPageObject';

export const addNewExpenseButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.addNewExpenseButtonCss);
};

export const clickAddNewExpenseButton = async () => {
	await clickButton(EmployeeDashboardPage.addNewExpenseButtonCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(EmployeeDashboardPage.employeeDropdownCss);
	await clickButtonDouble(EmployeeDashboardPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (name: string) => {
	await clickByText(EmployeeDashboardPage.dropdownOptionCss, name);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	await clickButton(EmployeeDashboardPage.expenseDropdownCss);
};

export const selectExpenseOptionDropdown = async (text) => {
	await clickElementByText(EmployeeDashboardPage.dropdownOptionCss, text);
};

export const expenseValueInputVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.valueInputCss);
};

export const enterExpenseValueInputData = async (data) => {
	await clearField(EmployeeDashboardPage.valueInputCss);
	await enterInput(EmployeeDashboardPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = async () => {
	await clickButton(EmployeeDashboardPage.saveExpenseButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EmployeeDashboardPage.toastrMessageCss);
};

export const verifyMenuBtnByText = async (text: string) => {
	await verifyByText(EmployeeDashboardPage.menuButtonsCss, text);
};

export const clickMenuButtonsByText = async (text: string) => {
	await clickElementByText(EmployeeDashboardPage.menuButtonsCss, text);
};

export const verifyEmployeeSelector = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.employeeSelectorCss);
};

export const clickOnEmployeeSelector = async () => {
	await clickButton(EmployeeDashboardPage.employeeSelectorCss);
	await clickButtonDouble(EmployeeDashboardPage.employeeSelectorCss);
};

export const verifyEmployeeSelectorDropdown = async (text: string) => {
	await verifyByText(EmployeeDashboardPage.selectEmployeeDropdownOptionCss, text);
};

export const clickOnEmployeeSelectorDropdown = async (text: string) => {
	await clickByText(EmployeeDashboardPage.selectEmployeeDropdownOptionCss, text);
};

export const verifyEmployeeSalary = async (salary: string) => {
	await verifyByText(EmployeeDashboardPage.salaryCss, salary);
};

export const clickOnIncomeBtn = async () => {
	await clickButton(EmployeeDashboardPage.incomeBtn);
};

export const verifyIncomeAddButton = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.addNewIncomeBtnCss);
};

export const clickIncomeAddButton = async () => {
	await clickButton(EmployeeDashboardPage.addNewIncomeBtnCss);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.selectEmployeeDropdownCss);
};

export const clickEmployeeSelector = async () => {
	await clickButton(EmployeeDashboardPage.selectEmployeeDropdownCss);
	await clickButtonDouble(EmployeeDashboardPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdownByName = async (name: string) => {
	await clickByText(EmployeeDashboardPage.selectEmployeeDropdownOptCss, name);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(EmployeeDashboardPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(EmployeeDashboardPage.dateInputCss, date);
};

export const contactInputVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.organizationContactCss);
};

export const clickContactInput = async () => {
	await clickButton(EmployeeDashboardPage.organizationContactCss);
};

export const enterContactInputData = async (data) => {
	await enterInputConditionally(EmployeeDashboardPage.organizationContactCss, data);
};

export const amountInputVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.amountInputCss);
};

export const enterAmountInputData = async (data) => {
	await clearField(EmployeeDashboardPage.amountInputCss);
	await enterInput(EmployeeDashboardPage.amountInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(EmployeeDashboardPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(EmployeeDashboardPage.addTagsDropdownCss, EmployeeDashboardPage.tagsDropdownOption, index);
};

export const notesTextareaVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.notesInputCss);
};

export const enterNotesInputData = async (data) => {
	await clearField(EmployeeDashboardPage.notesInputCss);
	await enterInput(EmployeeDashboardPage.notesInputCss, data);
};

export const saveIncomeButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeDashboardPage.saveIncomeButtonCss);
};

export const clickSaveIncomeButton = async () => {
	await clickButton(EmployeeDashboardPage.saveIncomeButtonCss);
};

export const verifyIncomeExists = async (text) => {
	await verifyText(EmployeeDashboardPage.verifyIncomeCss, text);
};

export const verifyEmployeeIncome = async (text: string) => {
	await verifyByText(EmployeeDashboardPage.verifyDashboardIncomeCss, text);
};

export const verifyEmployeeBonus = async (text: string) => {
	await verifyByText(EmployeeDashboardPage.verifyDashboardBonusCss, text);
};

export const clickOnCurrencyField = async () => {
	await clickButton(EmployeeDashboardPage.currencyFieldCss);
};

export const selectCurrency = async (currency: string) => {
	await clickByText(EmployeeDashboardPage.currencyOptionCss, currency);
};
