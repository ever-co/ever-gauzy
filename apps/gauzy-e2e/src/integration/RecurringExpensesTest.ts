import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as recurringExpensesPage from '../support/Base/pages/RecurringExpenses.po';
import { RecurringExpensesPageData } from '../support/Base/pagedata/RecurringExpensesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Recurring expenses test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
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
			RecurringExpensesPageData.defaultExpenseValue
		);
		recurringExpensesPage.saveExpenseButtonVisible();
		recurringExpensesPage.clickSaveExpenseButton();
	});
	it('Should be able to delete expense', () => {
		cy.wait(5000);
		recurringExpensesPage.settingsButtonVisible();
		recurringExpensesPage.clickSettingsButton();
		recurringExpensesPage.deleteButtonVisible();
		recurringExpensesPage.clickDeleteButton();
		recurringExpensesPage.deleteOnlyThisRadioButtonVisible();
		recurringExpensesPage.clickDeleteOnlyThisRadioButton();
	});
});
