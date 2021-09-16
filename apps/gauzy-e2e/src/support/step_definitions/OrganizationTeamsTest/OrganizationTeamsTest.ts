import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationTeamsPage from '../../Base/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../../Base/pagedata/OrganizationTeamsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let empFirstName = faker.name.firstName();
let empLastName = faker.name.lastName();
let empUsername = faker.internet.userName();
let empPassword = faker.internet.password();
let employeeEmail = faker.internet.email();
let empImgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboard();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employee
And('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addEmployee(
		manageEmployeesPage,
		empFirstName,
		empLastName,
		empUsername,
		employeeEmail,
		empPassword,
		empImgUrl
	);
});

// Add new team
And('User can visit Organization teams page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/teams', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	organizationTeamsPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	organizationTeamsPage.gridBtnClick(1);
});

And('User can see add team button', () => {
	organizationTeamsPage.addTeamButtonVisible();
});

When('User click on add team button', () => {
	organizationTeamsPage.clickAddTeamButton();
});

Then('User can see name input field', () => {
	organizationTeamsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationTeamsPage.enterNameInputData(OrganizationTeamsPageData.name);
});

And('User can see tags dropdown', () => {
	organizationTeamsPage.tagsMultiSelectVisible();
});

When('User click on tags dropdown', () => {
	organizationTeamsPage.clickTagsMultiSelect();
});

Then('User can select tag from dropdown options', () => {
	organizationTeamsPage.selectTagsFromDropdown(0);
	organizationTeamsPage.clickCardBody(0);
});

And('User can see employee dropdown', () => {
	organizationTeamsPage.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	organizationTeamsPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	organizationTeamsPage.selectEmployeeFromDropdown(0);
	organizationTeamsPage.clickCardBody(0);
});

And('User can see manager dropdown', () => {
	organizationTeamsPage.managerDropdownVisible();
});

When('User click on manager dropdown', () => {
	organizationTeamsPage.clickManagerDropdown();
});

Then('User can select manager from dropdown options', () => {
	organizationTeamsPage.selectManagerFromDropdown(0);
	organizationTeamsPage.clickCardBody(0);
});

And('User can see save button', () => {
	organizationTeamsPage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationTeamsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationTeamsPage.waitMessageToHide();
});

// Edit team
And('User can see teams table', () => {
	organizationTeamsPage.tableRowVisible();
});

When('User click on teams table row', () => {
	organizationTeamsPage.selectTableRow(0);
});

Then('Edit team button will become active', () => {
	organizationTeamsPage.editButtonVisible();
});

When('User click on edit team button', () => {
	organizationTeamsPage.clickEditButton();
});

Then('User can see name input field again', () => {
	organizationTeamsPage.nameInputVisible();
});

And('User can enter new name', () => {
	organizationTeamsPage.enterNameInputData(
		OrganizationTeamsPageData.editName
	);
});

And('User can see save edited team button', () => {
	organizationTeamsPage.saveButtonVisible();
});

When('User click on save edited team button', () => {
	organizationTeamsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationTeamsPage.waitMessageToHide();
});

// Delete team
And('User can see teams table again', () => {
	organizationTeamsPage.tableRowVisible();
});

When('User click on teams table row again', () => {
	organizationTeamsPage.selectTableRow(0);
});

Then('Delete team button will become active', () => {
	organizationTeamsPage.deleteButtonVisible();
});

When('User click on delete team button', () => {
	organizationTeamsPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	organizationTeamsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationTeamsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationTeamsPage.waitMessageToHide();
});
