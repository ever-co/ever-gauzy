import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationRecurringExpensesPage from './support/pages/OrganizationRecurringExpenses.po';
import { OrganizationRecurringExpensesPageData } from '../src/support/Base/pagedata/OrganizationRecurringExpensesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Organization recurring expenses test', () => {
	test('Organization recurring expenses test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new expense', async () => {
			await getPage().goto('/#/pages/organization/expense-recurring');
			await organizationRecurringExpensesPage.addButtonVisible();
			await organizationRecurringExpensesPage.clickAddButton();
			await organizationRecurringExpensesPage.expenseDropdownVisible();
			await organizationRecurringExpensesPage.clickExpenseDropdown();
			await organizationRecurringExpensesPage.selectExpenseOptionDropdown(
				OrganizationRecurringExpensesPageData.defaultExpense
			);
			await organizationRecurringExpensesPage.expenseValueInputVisible();
			await organizationRecurringExpensesPage.enterExpenseValueInputData(
				OrganizationRecurringExpensesPageData.defaultValue
			);
			await organizationRecurringExpensesPage.saveExpenseButtonVisible();
			await organizationRecurringExpensesPage.clickSaveExpenseButton();
			await organizationRecurringExpensesPage.waitMessageToHide();
			await organizationRecurringExpensesPage.verifyExpenseExists(
				OrganizationRecurringExpensesPageData.defaultExpense
			);
		});

		await test.step('Should be able to edit expense', async () => {
			await organizationRecurringExpensesPage.settingsButtonVisible();
			await organizationRecurringExpensesPage.clickSettingsButton();
			await organizationRecurringExpensesPage.editButtonVisible();
			await organizationRecurringExpensesPage.clickEditButton();
			await organizationRecurringExpensesPage.expenseDropdownVisible();
			await organizationRecurringExpensesPage.clickExpenseDropdown();
			await organizationRecurringExpensesPage.selectExpenseOptionDropdown(
				OrganizationRecurringExpensesPageData.editExpense
			);
			await organizationRecurringExpensesPage.expenseValueInputVisible();
			await organizationRecurringExpensesPage.enterExpenseValueInputData(
				OrganizationRecurringExpensesPageData.defaultValue
			);
			await organizationRecurringExpensesPage.saveExpenseButtonVisible();
			await organizationRecurringExpensesPage.clickSaveExpenseButton();
		});

		await test.step('Should be able to delete expense', async () => {
			await organizationRecurringExpensesPage.waitMessageToHide();
			await organizationRecurringExpensesPage.settingsButtonVisible();
			await organizationRecurringExpensesPage.clickSettingsButton();
			await organizationRecurringExpensesPage.deleteButtonVisible();
			await organizationRecurringExpensesPage.clickDeleteButton();
			await organizationRecurringExpensesPage.deleteOnlyThisRadioButtonVisible();
			await organizationRecurringExpensesPage.clickDeleteOnlyThisRadioButton();
			await organizationRecurringExpensesPage.confirmDeleteButtonVisible();
			await organizationRecurringExpensesPage.clickConfirmDeleteButton();
			await organizationRecurringExpensesPage.waitMessageToHide();
			await organizationRecurringExpensesPage.verifyExpenseIsDeleted();
		});
	});
});
