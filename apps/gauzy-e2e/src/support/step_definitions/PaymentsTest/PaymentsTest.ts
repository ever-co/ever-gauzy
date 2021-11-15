import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as paymentsPage from '../../Base/pages/Payments.po';
import { PaymentsPageData } from '../../Base/pagedata/PaymentsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
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

// Add employee
And('User can add new employee', () => {
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

// Add new project
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
});

// Add new payment
Then('User can visit Accounting payments page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/accounting/payments', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	paymentsPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	paymentsPage.gridBtnClick(1);
});

And('User can see add payment button', () => {
	paymentsPage.addPaymentButtonVisible();
});

When('User click on add payment button', () => {
	paymentsPage.clickAddPaymentButton();
});

Then('User can see project dropdown', () => {
	paymentsPage.projectDropdownVisible();
});

When('User click on project dropdown', () => {
	paymentsPage.clickProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
});

And('User can see date input field', () => {
	paymentsPage.dateInputVisible();
});

And('User can enter value for date', () => {
	paymentsPage.enterDateInputData();
});

And('User can see payment method dropdown', () => {
	paymentsPage.paymentMethodDropdownVisible();
});

When('User click on payment method dropdown', () => {
	paymentsPage.clickPaymentMethodDropdown();
});

Then('User can select payment method from dropdown options', () => {
	paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
});

And('User can see amount input field', () => {
	paymentsPage.amountInputVisible();
});

And('User can enter value for amount', () => {
	paymentsPage.enterAmountInputData(PaymentsPageData.defaultAmount);
});

And('User can see note textarea input field', () => {
	paymentsPage.noteTextareaVisible();
});

And('User can enter value for note', () => {
	paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
});

And('User can see save button', () => {
	paymentsPage.savePaymentButtonVisible();
});

When('User click on save button', () => {
	paymentsPage.clickSavePaymentButton();
});

Then('Notification message will appear', () => {
	paymentsPage.waitMessageToHide();
});

// Verify payment reports
And('User can see Reports sidebar button', () => {
	paymentsPage.sidebarBtnVisible();
});

When('User click on Reports sidebar button', () => {
	paymentsPage.clickSidebarBtn(PaymentsPageData.reports);
});

Then('User can click on Payments sidebar button', () => {
	paymentsPage.clickReportsInnerSidebarBtn(PaymentsPageData.payments);
});

And('User can see Group by select', () => {
	paymentsPage.groupBySelectVisible();
});

When('User click on Group by select', () => {
	paymentsPage.clickGroupBySelect();
});

Then('User can see option for Date', () => {
	paymentsPage.verifyDropdownOption(PaymentsPageData.date);
});

And('User can see option for Client', () => {
	paymentsPage.verifyDropdownOption(PaymentsPageData.client);
});

And('User can see option for Project', () => {
	paymentsPage.verifyDropdownOption(PaymentsPageData.project);
});

When('User click on Date dropdown option', () => {
	paymentsPage.selectOptionFromDropdown(PaymentsPageData.date);
});

Then('User can verify project', () => {
	paymentsPage.verifyPaymentProject(PaymentsPageData.defaultProject);
});

And('User can verify amount', () => {
	paymentsPage.verifyPaymentAmount(PaymentsPageData.verifyAmount);
});

When('User click again on Reports sidebar button', () => {
	paymentsPage.clickSidebarBtn(PaymentsPageData.reports);
});

Then('User can click on Accounting sidebar button', () => {
	paymentsPage.clickSidebarBtn(PaymentsPageData.accounting);
});

When('User click on Payments sidebar button', () => {
	paymentsPage.clickAccountingPaymentsSidebarBtn(PaymentsPageData.payments);
});

// Edit payment
Then('User can see payments table', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	paymentsPage.tableRowVisible();
});

When('User select table row', () => {
	paymentsPage.selectTableRow(0);
});

Then('Edit payment button will become active', () => {
	paymentsPage.editPaymentButtonVisible();
});

When('User click on edit payment button', () => {
	paymentsPage.clickEditPaymentButton();
});

Then('User can see project dropdown', () => {
	paymentsPage.projectDropdownVisible();
});

When('User click on project dropdown', () => {
	paymentsPage.clickProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
});

And('User can see date input field', () => {
	paymentsPage.dateInputVisible();
});

And('User can enter value for date', () => {
	paymentsPage.enterDateInputData();
});

And('User can see payment method dropdown', () => {
	paymentsPage.paymentMethodDropdownVisible();
});

When('User click on payment method dropdown', () => {
	paymentsPage.clickPaymentMethodDropdown();
});

Then('User can select payment method from dropdown options', () => {
	paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
});

And('User can see amount input field', () => {
	paymentsPage.amountInputVisible();
});

And('User can enter value for amount', () => {
	paymentsPage.enterAmountInputData(PaymentsPageData.defaultAmount);
});

And('User can see note textarea input field', () => {
	paymentsPage.noteTextareaVisible();
});

And('User can enter value for note', () => {
	paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
});

And('User can see save button', () => {
	paymentsPage.savePaymentButtonVisible();
});

When('User click on save button', () => {
	paymentsPage.clickSavePaymentButton();
});

Then('Notification message will appear again', () => {
	paymentsPage.waitMessageToHide();
});

// Delete payment
Then('User can see again payments table', () => {
	paymentsPage.tableRowVisible();
});

When('User select table row again', () => {
	paymentsPage.selectTableRowByNote(PaymentsPageData.defaultNote);
});

Then('Delete payment button will become active', () => {
	paymentsPage.deletePaymentButtonVisible();
});

When('User can click on Delete payment button', () => {
	paymentsPage.clickDeletePaymentButton();
});

Then('User can see confirm delete button', () => {
	paymentsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	paymentsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	paymentsPage.waitMessageToHide();
});

And('User can verify payment was deleted', () => {
	paymentsPage.verifyElementIsDeleted(PaymentsPageData.defaultNote);
});
