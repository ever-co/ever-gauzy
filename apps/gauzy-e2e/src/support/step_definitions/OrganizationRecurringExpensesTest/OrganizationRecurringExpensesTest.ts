import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationRecurringExpensesPage from '../../Base/pages/OrganizationRecurringExpenses.po';
import { OrganizationRecurringExpensesPageData } from '../../Base/pagedata/OrganizationRecurringExpensesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given(
	'Login with default credentials and visit Organization expenses page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/organization/expense-recurring', { timeout: pageLoadTimeout });
	}
);

// Add new expense
And('User can see add button', () => {
	organizationRecurringExpensesPage.addButtonVisible();
});

When('User click on add button', () => {
	organizationRecurringExpensesPage.clickAddButton();
});

Then('User can see expense dropdown', () => {
	organizationRecurringExpensesPage.expenseDropdownVisible();
});

When('User click expense dropdown', () => {
	organizationRecurringExpensesPage.clickExpenseDropdown();
});

Then('User can select expense from dropdown options', () => {
	organizationRecurringExpensesPage.selectExpenseOptionDropdown(
		OrganizationRecurringExpensesPageData.defaultExpense
	);
});

And('User can see expense value input field', () => {
	organizationRecurringExpensesPage.expenseValueInputVisible();
});

And('User can enter value for expense', () => {
	organizationRecurringExpensesPage.enterExpenseValueInputData(
		OrganizationRecurringExpensesPageData.defaultValue
	);
});

And('User can see save button', () => {
	organizationRecurringExpensesPage.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	organizationRecurringExpensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	organizationRecurringExpensesPage.waitMessageToHide();
});

And('User can verify expense was created', () => {
	organizationRecurringExpensesPage.verifyExpenseExists(
		OrganizationRecurringExpensesPageData.defaultExpense
	);
});

// Edit expense
And('User can see settings button', () => {
	organizationRecurringExpensesPage.settingsButtonVisible();
});

When('User click on settings button', () => {
	organizationRecurringExpensesPage.clickSettingsButton();
});

Then('User can see edit button', () => {
	organizationRecurringExpensesPage.editButtonVisible();
});

When('User click on edit button', () => {
	organizationRecurringExpensesPage.clickEditButton();
});

Then('User can see expense dropdown again', () => {
	organizationRecurringExpensesPage.expenseDropdownVisible();
});

When('User click on expense dropdown', () => {
	organizationRecurringExpensesPage.clickExpenseDropdown();
});

Then('User can select new expense from dropdown options', () => {
	organizationRecurringExpensesPage.selectExpenseOptionDropdown(
		OrganizationRecurringExpensesPageData.editExpense
	);
});

And('User can see expense value input field again', () => {
	organizationRecurringExpensesPage.expenseValueInputVisible();
});

And('User can enter new value for expense', () => {
	organizationRecurringExpensesPage.enterExpenseValueInputData(
		OrganizationRecurringExpensesPageData.defaultValue
	);
});

And('User can see save edited expense button', () => {
	organizationRecurringExpensesPage.saveExpenseButtonVisible();
});

When('User click on save edited expense button', () => {
	organizationRecurringExpensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	organizationRecurringExpensesPage.waitMessageToHide();
});

// Delete expense
And('User can see settings button again', () => {
	organizationRecurringExpensesPage.settingsButtonVisible();
});

When('User click on settings button again', () => {
	organizationRecurringExpensesPage.clickSettingsButton();
});

Then('User can see delete button', () => {
	organizationRecurringExpensesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationRecurringExpensesPage.clickDeleteButton();
});

Then('User can see radio button', () => {
	organizationRecurringExpensesPage.deleteOnlyThisRadioButtonVisible();
});

When('User click on radio button', () => {
	organizationRecurringExpensesPage.clickDeleteOnlyThisRadioButton();
});

Then('User can see confirm delete button', () => {
	organizationRecurringExpensesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationRecurringExpensesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationRecurringExpensesPage.waitMessageToHide();
});
