import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as recurringExpensesPage from './support/pages/RecurringExpenses.po';
import { RecurringExpensesPageData } from '../src/support/Base/pagedata/RecurringExpensesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Recurring expenses test', () => {
	test('Recurring expenses test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new expense', async () => {
			await getPage().goto('/#/pages/employees/recurring-expenses');
			await recurringExpensesPage.addNewExpenseButtonVisible();
			await recurringExpensesPage.clickAddNewExpenseButton();
			await recurringExpensesPage.employeeDropdownVisible();
			await recurringExpensesPage.clickEmployeeDropdown();
			await recurringExpensesPage.selectEmployeeFromDropdown(0);
			await recurringExpensesPage.expenseDropdownVisible();
			await recurringExpensesPage.clickExpenseDropdown();
			await recurringExpensesPage.selectExpenseOptionDropdown(
				RecurringExpensesPageData.defaultExpense
			);
			await recurringExpensesPage.expenseValueInputVisible();
			await recurringExpensesPage.enterExpenseValueInputData(
				RecurringExpensesPageData.defaultExpenseValue
			);
			await recurringExpensesPage.saveExpenseButtonVisible();
			await recurringExpensesPage.clickSaveExpenseButton();
			await recurringExpensesPage.waitMessageToHide();
			await recurringExpensesPage.verifyExpenseExists(
				`BGN${RecurringExpensesPageData.defaultExpenseValue}`
			);
		});

		await test.step('Should be able to edit expense', async () => {
			await recurringExpensesPage.settingsButtonVisible();
			await recurringExpensesPage.clickSettingsButton();
			await recurringExpensesPage.editButtonVisible();
			await recurringExpensesPage.clickEditButton();
			await recurringExpensesPage.expenseDropdownVisible();
			await recurringExpensesPage.clickExpenseDropdown();
			await recurringExpensesPage.selectExpenseOptionDropdown(
				RecurringExpensesPageData.defaultExpense
			);
			await recurringExpensesPage.expenseValueInputVisible();
			await recurringExpensesPage.enterExpenseValueInputData(
				RecurringExpensesPageData.editExpenseValue
			);
			await recurringExpensesPage.saveExpenseButtonVisible();
			await recurringExpensesPage.clickSaveExpenseButton();
			await recurringExpensesPage.waitMessageToHide();
			await recurringExpensesPage.verifyExpenseExists(
				`BGN${RecurringExpensesPageData.editExpenseValue}`
			);
		});

		await test.step('Should be able to delete expense', async () => {
			await recurringExpensesPage.waitMessageToHide();
			await recurringExpensesPage.settingsButtonVisible();
			await recurringExpensesPage.clickSettingsButton();
			await recurringExpensesPage.deleteButtonVisible();
			await recurringExpensesPage.clickDeleteButton();
			await recurringExpensesPage.deleteAllButtonVisible();
			await recurringExpensesPage.clickDeleteAllButton();
			await recurringExpensesPage.confirmDeleteButtonVisible();
			await recurringExpensesPage.clickConfirmDeleteButton();
			await recurringExpensesPage.waitMessageToHide();
			await recurringExpensesPage.verifyExpenseIsDeleted();
		});
	});
});
