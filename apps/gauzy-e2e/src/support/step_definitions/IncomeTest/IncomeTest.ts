import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as incomePage from '../../Base/pages/Income.po';
import * as faker from 'faker';
import { IncomePageData } from '../../Base/pagedata/IncomePageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let name = faker.name.firstName();
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

// Add income
Then('User can visit Income page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.intercept('GET', '/api/income/pagination*').as('waitTable');
	cy.visit('/#/pages/accounting/income', { timeout: pageLoadTimeout });
	cy.wait('@waitTable');
});

And('User can see grid button', () => {
	incomePage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	incomePage.gridBtnClick(1);
});

And('User can see add income button', () => {
	incomePage.addIncomeButtonVisible();
});

When('User click on add income button', () => {
	incomePage.clickAddIncomeButton();
});

Then('User can see employee dropdown', () => {
	incomePage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	incomePage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	incomePage.selectEmployeeFromDrodpwon(1);
});

And('User can see date input field', () => {
	incomePage.dateInputVisible();
});

And('User can enter value for date', () => {
	incomePage.enterDateInputData();
	incomePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see contact input field', () => {
	incomePage.contactInputVisible();
});

And('User can enter value for contact', () => {
	incomePage.enterContactInputData(name);
});

And('User can see amount input field', () => {
	incomePage.amountInputVisible();
});

And('User can enter value for amount', () => {
	incomePage.enterAmountInputData(IncomePageData.defaultAmount);
});

And('User can see notes textarea input field', () => {
	incomePage.notesTextareaVisible();
});

And('User can add value for notes', () => {
	incomePage.enterNotesInputData(IncomePageData.defaultNote);
});

And('User can see save button', () => {
	incomePage.saveIncomeButtonVisible();
});

When('User click on save button', () => {
	incomePage.clickSaveIncomeButton();
});

Then('Notification message will appear', () => {
	incomePage.waitMessageToHide();
});

And('User can verify income was created', () => {
	incomePage.verifyIncomeExists(IncomePageData.defaultNote);
});

// Edit income
When('User select incomes first table row', () => {
	incomePage.selectTableRow(0);
});

Then('Edit income button will become active', () => {
	incomePage.editIncomeButtonVisible();
});

When('User click on edit income button', () => {
	incomePage.clickEditIncomeButton();
});

Then('User can see date input field', () => {
	incomePage.dateInputVisible();
});

And('User can enter value for date', () => {
	incomePage.enterDateInputData();
	incomePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see contact input field', () => {
	incomePage.contactInputVisible();
});

And('User can enter value for contact', () => {
	incomePage.enterContactInputData(name);
});

And('User can see amount input field', () => {
	incomePage.amountInputVisible();
});

And('User can enter value for amount', () => {
	incomePage.enterAmountInputData(IncomePageData.defaultAmount);
});

And('User can see notes textarea input field', () => {
	incomePage.notesTextareaVisible();
});

And('User can add value for notes', () => {
	incomePage.enterNotesInputData(IncomePageData.defaultNote);
});

And('User can see save button', () => {
	incomePage.saveIncomeButtonVisible();
});

When('User click on save button', () => {
	incomePage.clickSaveIncomeButton();
});

Then('Notification message will appear', () => {
	incomePage.waitMessageToHide();
});

And('User can verify income was created', () => {
	incomePage.verifyIncomeExists(IncomePageData.defaultNote);
});

// Delete income
When('User select incomes first table row', () => {
	incomePage.selectTableRow(0);
});

Then('Delete income button will become active', () => {
	incomePage.deleteIncomeButtonVisible();
});

When('User click delete income button', () => {
	incomePage.clickDeleteIncomeButton();
});

Then('User can see confirm delete button', () => {
	incomePage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	incomePage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	incomePage.waitMessageToHide();
});
