import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as jobProposalsPage from '../../Base/pages/JobsProposals.po';
import { JobsProposalsPageData } from '../../Base/pagedata/JobsProposalsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
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

// Add new proposal
And('User can visist Jobs proposals page', () => { // User can verify complete page
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies(); //expected ga-onboarding-complete > div.logo > h6 to be visible
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/jobs/proposal-template', { timeout: pageLoadTimeout });
});

Then('User can see add button', () => {
	jobProposalsPage.addButtonVisible();
});

When('User click on add button', () => {
	jobProposalsPage.clickAddButton();
});

Then('User can see employee dropdown', () => {
	jobProposalsPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	jobProposalsPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	jobProposalsPage.selectEmployeeFromDrodpwon(1);
});

And('User can see name input field', () => {
	jobProposalsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	jobProposalsPage.enterNameInputData(JobsProposalsPageData.name);
});

And('User can see content input field', () => {
	jobProposalsPage.contentInputVisible();
});

And('User can enter value for content', () => {
	jobProposalsPage.enterContentInputData(JobsProposalsPageData.content);
});

And('User can see save button', () => {
	jobProposalsPage.saveButtonVisible();
});

When('User click on save button', () => {
	jobProposalsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	jobProposalsPage.waitMessageToHide();
});

And('User can verify job proposal was created', () => {
	jobProposalsPage.verifyProposalExists(JobsProposalsPageData.name);
});

// Edit proposal
When('User select proposals first table row', () => {
	jobProposalsPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	jobProposalsPage.editButtonVisible();
});

When('User click on edit button', () => {
	jobProposalsPage.clickEditButton(JobsProposalsPageData.editButton);
});

Then('User will see name input field', () => {
	jobProposalsPage.nameInputVisible();
});

And('User can edit name value', () => {
	jobProposalsPage.enterNameInputData(JobsProposalsPageData.editName);
});

And('User can see save button again', () => {
	jobProposalsPage.saveButtonVisible();
});

When('User click on save button again', () => {
	jobProposalsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	jobProposalsPage.waitMessageToHide();
});

And('User can verify job proposal was edited', () => {
	jobProposalsPage.verifyProposalExists(JobsProposalsPageData.editName);
});

// Make proposal default
When('User select first table row', () => {
	jobProposalsPage.selectTableRow(0);
});

Then('Make dafault button will become active', () => {
	jobProposalsPage.makeDefaultButtonVisible();
});

When('User click on make default button', () => {
	jobProposalsPage.clickMakeDefaultButton(
		JobsProposalsPageData.makeDefaultButton
	);
});

Then('Notification message will appear', () => {
	jobProposalsPage.waitMessageToHide();
});

// Delete proposal
When('User select first table row again', () => {
	jobProposalsPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	jobProposalsPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	jobProposalsPage.clickDeleteButton();
});

Then('User will see confirm delete button', () => {
	jobProposalsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	jobProposalsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	jobProposalsPage.waitMessageToHide();
});

And('User can verify porposal was deleted', () => {
	jobProposalsPage.verifyElementIsDeleted(JobsProposalsPageData.editName);
});
