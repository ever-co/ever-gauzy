import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as recurringExpensesPage from '../../Base/pages/RecurringExpenses.po';
import { RecurringExpensesPageData } from '../../Base/pagedata/RecurringExpensesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new employee
And('User can add new employee', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addEmployee(
		manageEmployeesPage,
		firstName,
		lastName,
		username,
		employeeEmail,
		password,
		imgUrl
	);
});

// Add new expense
And('User can visit Employees recurring expense page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.intercept('/api/employee-recurring-expense*').as('waitTable');
	cy.visit('/#/pages/employees/recurring-expenses', {
		timeout: pageLoadTimeout
	});
	cy.wait('@waitTable');
});

And('User can see add new expense button', () => {
	recurringExpensesPage.addNewExpenseButtonVisible();
});

When('User click on add new expense button', () => {
	recurringExpensesPage.clickAddNewExpenseButton();
});

And('User can see employee dropdown', () => {
	recurringExpensesPage.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	recurringExpensesPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	recurringExpensesPage.selectEmployeeFromDropdown(0);
});

And('User can see expense dropdown', () => {
	recurringExpensesPage.expenseDropdownVisible();
});

When('User click on expense dropdown', () => {
	recurringExpensesPage.clickExpenseDropdown();
});

Then('User can select expense from dropdown options', () => {
	recurringExpensesPage.selectExpenseOptionDropdown(
		RecurringExpensesPageData.defaultExpense
	);
});

And('User can see expense value input field', () => {
	recurringExpensesPage.expenseValueInputVisible();
});

And('User can enter expense value', () => {
	recurringExpensesPage.enterExpenseValueInputData(
		RecurringExpensesPageData.defaultExpenseValue
	);
});

And('User can see save button', () => {
	recurringExpensesPage.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	recurringExpensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	recurringExpensesPage.waitMessageToHide();
});

// Edit expense
And('User can see settings button', () => {
	recurringExpensesPage.settingsButtonVisible();
});

When('User click on settings button', () => {
	recurringExpensesPage.clickSettingsButton();
});

Then('User can see edit button', () => {
	recurringExpensesPage.editButtonVisible();
});

When('User click on edit button', () => {
	recurringExpensesPage.clickEditButton();
});

Then('User can see expense value input field again', () => {
	recurringExpensesPage.expenseValueInputVisible();
});

And('User can enter new expense value', () => {
	recurringExpensesPage.enterExpenseValueInputData(
		RecurringExpensesPageData.editExpenseValue
	);
});

And('User can see save button again', () => {
	recurringExpensesPage.saveExpenseButtonVisible();
});

When('User click on save button again', () => {
	recurringExpensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	recurringExpensesPage.waitMessageToHide();
});

// Delete expense
And('User can see settings button again', () => {
	recurringExpensesPage.settingsButtonVisible();
});

When('User click on settings button again', () => {
	recurringExpensesPage.clickSettingsButton();
});

Then('User can see delete button', () => {
	recurringExpensesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	recurringExpensesPage.clickDeleteButton();
});

Then('User can see delete all button', () => {
	recurringExpensesPage.deleteAllButtonVisible();
});

When('User click on delete all button', () => {
	recurringExpensesPage.clickDeleteAllButton();
});

Then('User can see confirm delete button', () => {
	recurringExpensesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	recurringExpensesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	recurringExpensesPage.waitMessageToHide();
});
