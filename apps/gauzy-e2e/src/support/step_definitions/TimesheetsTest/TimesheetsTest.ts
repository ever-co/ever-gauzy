import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as timesheetsPage from '../../Base/pages/Timesheets.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { TimesheetsPageData } from '../../Base/pagedata/TimesheetsPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as faker from 'faker';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();

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

// Add new tag
Then('User can add new tag', () => {
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add employee
And('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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

// Add new client
And('User can add new client', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addClient(
		clientsPage,
		fullName,
		email,
		website,
		city,
		postcode,
		street,
		ClientsData
	);
});

// Add time
And('User can visit Employees timesheets daily page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/timesheets/daily', {
		timeout: pageLoadTimeout
	});
});

And('User can see add time log button', () => {
	timesheetsPage.addTimeButtonVisible();
});

When('User click on add time log button', () => {
	timesheetsPage.clickAddTimeButton();
});

Then('User can see date input field', () => {
	timesheetsPage.dateInputVisible();
});

And('User can enter date', () => {
	timesheetsPage.enterDateData();
	timesheetsPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see start time dropdown', () => {
	timesheetsPage.startTimeDropdownVisible();
});

When('User click on start time dropdown', () => {
	timesheetsPage.clickStartTimeDropdown();
});

Then('User can select time from dropdown options', () => {
	timesheetsPage.selectTimeFromDropdown(0);
});

And('User can see client dropdown', () => {
	timesheetsPage.clientDropdownVisible();
});

When('User click on client dropdown', () => {
	timesheetsPage.clickClientDropdown();
});

Then('User can select client from dropdown options', () => {
	timesheetsPage.selectClientFromDropdown(0);
});

And('User can see employee dropdown', () => {
	timesheetsPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	timesheetsPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	timesheetsPage.selectEmployeeFromDropdown(0);
});

And('User can see time log description input field', () => {
	timesheetsPage.addTimeLogDescriptionVisible();
});

And('User can enter time log description', () => {
	timesheetsPage.enterTimeLogDescriptionData(
		TimesheetsPageData.defaultDescription
	);
});

And('User can see save time log button', () => {
	timesheetsPage.saveTimeLogButtonVisible();
});

When('User click on save time log button', () => {
	timesheetsPage.clickSaveTimeLogButton();
});

Then('Notification message will appear', () => {
	timesheetsPage.waitMessageToHide();
});

// View time
And('User can see view time log button', () => {
	timesheetsPage.viewEmployeeTimeLogButtonVisible();
});

When('User click on view time log button', () => {
	timesheetsPage.clickViewEmployeeTimeLogButton(0);
});

Then('User can see close time log popover button', () => {
	timesheetsPage.closeAddTimeLogPopoverButtonVisible();
});

When('User click on close time log popover button', () => {
	timesheetsPage.clickCloseAddTimeLogPopoverButton();
});

// Edit time
Then('User can see edit time log button', () => {
	timesheetsPage.editEmployeeTimeLogButtonVisible();
});

When('User click on edit time log button', () => {
	timesheetsPage.clickEditEmployeeTimeLogButton(0);
});

And('User can see description input field again', () => {
	timesheetsPage.addTimeLogDescriptionVisible();
});

And('User can enter new description', () => {
	timesheetsPage.enterTimeLogDescriptionData(
		TimesheetsPageData.editDescription
	);
});

And('User can see save edited time log button', () => {
	timesheetsPage.saveTimeLogButtonVisible();
});

When('User click on save edited time log button', () => {
	timesheetsPage.clickSaveTimeLogButton();
});

Then('Notification message will appear', () => {
	timesheetsPage.waitMessageToHide();
});

// Delete time
And('User can see delete time log button', () => {
	timesheetsPage.deleteEmployeeTimeLogButtonVisible();
});

When('User click on delete time log button', () => {
	timesheetsPage.clickDeleteEmployeeTimeLogButton(0);
});

Then('User can see confirm delete button', () => {
	timesheetsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	timesheetsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	timesheetsPage.waitMessageToHide();
});
