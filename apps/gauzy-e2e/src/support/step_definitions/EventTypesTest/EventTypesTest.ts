import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as eventTypesPage from '../../Base/pages/EventTypes.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { EventTypePageData } from '../../Base/pagedata/EventTypesPageData';
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

// Add new employee
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

// Add new event type
And('User can visit Event types page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/event-types', { timeout: pageLoadTimeout });
});

Then('User can see grid button', () => {
	eventTypesPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	eventTypesPage.gridBtnClick(1);
});

And('User can see add event type button', () => {
	eventTypesPage.addEventTypeButtonVisible();
});

When('User click on add event type button', () => {
	eventTypesPage.clickAddEventTypeButton();
});

Then('User can see employee dropdown', () => {
	eventTypesPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	eventTypesPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	eventTypesPage.selectEmployeeFromDropdown(1);
});

And('User can see title input field', () => {
	eventTypesPage.titleInputVisible();
});

And('User can enter value for title', () => {
	eventTypesPage.enterTitleInputData(EventTypePageData.dafaultEventTitle);
});

And('User can see description input field', () => {
	eventTypesPage.descriptionInputVisible();
});

And('User can enter value for description', () => {
	eventTypesPage.enterDescriptionInputData(
		EventTypePageData.defaultDescription
	);
});

And('User can see duration input field', () => {
	eventTypesPage.durationInputVisible();
});

And('User can select value for duration', () => {
	eventTypesPage.enterDurationInputData(EventTypePageData.defaultDuration);
});

And('User can checkbox', () => {
	eventTypesPage.checkboxVisible();
});

And('User can click on checkbox', () => {
	eventTypesPage.clickCheckbox();
});

And('User can see save button', () => {
	eventTypesPage.saveButtonVisible();
});

When('User click on save button', () => {
	eventTypesPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	eventTypesPage.waitMessageToHide();
});

// Edit event type
And('User can see events table', () => {
	eventTypesPage.selectTableRowVisible();
});

When('User click on table first row', () => {
	eventTypesPage.selectTableRow(0);
	eventTypesPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	eventTypesPage.editEventTypeButtonVisible();
});

When('User click on edit button', () => {
	eventTypesPage.clickEditEventTypeButton();
});

Then('User can see title input field', () => {
	eventTypesPage.titleInputVisible();
});

And('User can enter value for title', () => {
	eventTypesPage.enterTitleInputData(EventTypePageData.dafaultEventTitle);
});

And('User can see description input field', () => {
	eventTypesPage.descriptionInputVisible();
});

And('User can enter value for description', () => {
	eventTypesPage.enterDescriptionInputData(
		EventTypePageData.defaultDescription
	);
});

And('User can see duration input field', () => {
	eventTypesPage.durationInputVisible();
});

And('User can select value for duration', () => {
	eventTypesPage.enterDurationInputData(EventTypePageData.defaultDuration);
});

And('User can checkbox', () => {
	eventTypesPage.checkboxVisible();
});

And('User can click on checkbox', () => {
	eventTypesPage.clickCheckbox();
});

And('User can see save button', () => {
	eventTypesPage.saveButtonVisible();
});

When('User click on save button', () => {
	eventTypesPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	eventTypesPage.waitMessageToHide();
});

// Delete event type
And('User can see events table', () => {
	eventTypesPage.selectTableRowVisible();
});

When('User click on first table row', () => {
	eventTypesPage.selectTableRow(0);
	eventTypesPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	eventTypesPage.deleteEventTypeButtonVisible();
});

When('User click on delete button', () => {
	eventTypesPage.clickDeleteEventTypeButton();
});

Then('User can see confirm delete button', () => {
	eventTypesPage.confirmDeleteEventTypeButtonVisible();
});

When('User click on confirm delete button', () => {
	eventTypesPage.clickConfirmDeleteEventTypeButton();
});

Then('Notification message will appear', () => {
	eventTypesPage.waitMessageToHide();
});
