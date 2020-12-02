import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as recurringExpensesPage from '../support/Base/pages/RecurringExpenses.po';
import { RecurringExpensesPageData } from '../support/Base/pagedata/RecurringExpensesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Recurring expenses test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new expense', () => {
		cy.visit('/#/pages/employees/recurring-expenses');
		recurringExpensesPage.addNewExpenseButtonVisible();
		recurringExpensesPage.clickAddNewExpenseButton();
		recurringExpensesPage.employeeDropdownVisible();
		recurringExpensesPage.clickEmployeeDropdown();
		recurringExpensesPage.selectEmployeeFromDropdown(0);
		recurringExpensesPage.expenseDropdownVisible();
		recurringExpensesPage.clickExpenseDropdown();
		recurringExpensesPage.selectExpenseOptionDropdown(
			RecurringExpensesPageData.defaultExpense
		);
		recurringExpensesPage.expenseValueInputVisible();
		recurringExpensesPage.enterExpenseValueInputData(
			RecurringExpensesPageData.defaultExpenseValue
		);
		recurringExpensesPage.saveExpenseButtonVisible();
		recurringExpensesPage.clickSaveExpenseButton();
		recurringExpensesPage.waitMessageToHide();
		recurringExpensesPage.verifyExpenseExists(
			`BGN${RecurringExpensesPageData.defaultExpenseValue}`
		);
	});
	it('Should be able to edit expense', () => {
		recurringExpensesPage.settingsButtonVisible();
		recurringExpensesPage.clickSettingsButton();
		recurringExpensesPage.editButtonVisible();
		recurringExpensesPage.clickEditButton();
		recurringExpensesPage.expenseDropdownVisible();
		recurringExpensesPage.clickExpenseDropdown();
		recurringExpensesPage.selectExpenseOptionDropdown(
			RecurringExpensesPageData.defaultExpense
		);
		recurringExpensesPage.expenseValueInputVisible();
		recurringExpensesPage.enterExpenseValueInputData(
			RecurringExpensesPageData.editExpenseValue
		);
		recurringExpensesPage.saveExpenseButtonVisible();
		recurringExpensesPage.clickSaveExpenseButton();
		recurringExpensesPage.waitMessageToHide();
		recurringExpensesPage.verifyExpenseExists(
			`BGN${RecurringExpensesPageData.editExpenseValue}`
		);
	});
	it('Should be able to delete expense', () => {
		recurringExpensesPage.waitMessageToHide();
		recurringExpensesPage.settingsButtonVisible();
		recurringExpensesPage.clickSettingsButton();
		recurringExpensesPage.deleteButtonVisible();
		recurringExpensesPage.clickDeleteButton();
		recurringExpensesPage.deleteAllButtonVisible();
		recurringExpensesPage.clickDeleteAllButton();
		recurringExpensesPage.confirmDeleteButtonVisible();
		recurringExpensesPage.clickConfirmDeleteButton();
		recurringExpensesPage.waitMessageToHide();
		recurringExpensesPage.verifyExpenseIsDeleted(
			`BGN${RecurringExpensesPageData.editExpenseValue}`
		);
	});
});
