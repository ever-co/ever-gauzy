import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as recurringExpensesPage from '../../support/pages/RecurringExpenses.po';
import { RecurringExpensesPageData } from '../../../src/support/Base/pagedata/RecurringExpensesPageData';

// Converted 1:1 from the plain RecurringExpensesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts.

When('I add a new recurring expense', async () => {
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

When('I edit the recurring expense', async () => {
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

When('I delete the recurring expense', async () => {
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
