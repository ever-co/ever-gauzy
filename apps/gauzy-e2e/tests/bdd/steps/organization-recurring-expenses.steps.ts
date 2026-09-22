import { When } from '../../support/bdd';
import * as organizationRecurringExpensesPage from '../../support/pages/OrganizationRecurringExpenses.po';
import { OrganizationRecurringExpensesPageData } from '../../../src/support/Base/pagedata/OrganizationRecurringExpensesPageData';

// Converted 1:1 from the plain OrganizationRecurringExpensesTest.spec.ts: the single test() -> one
// Scenario, each test.step() -> one When step whose body is the verbatim .po call sequence
// (verification folded in), so runtime behaviour is identical to the already-CI-tested spec. The
// `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

When('I add a new organization recurring expense', async () => {
	await organizationRecurringExpensesPage.navigateToRecurringExpenses();
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

When('I edit the organization recurring expense', async () => {
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

When('I delete the organization recurring expense', async () => {
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
