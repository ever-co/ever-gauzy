import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';

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
And('User can add new tag', () => {
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

// Add new project
And('User can visit Organization projects page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/projects', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	organizationProjectsPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	organizationProjectsPage.gridBtnClick(1);
});

And('User can see request project button', () => {
	organizationProjectsPage.requestProjectButtonVisible();
});

When('User click on request project button', () => {
	organizationProjectsPage.clickRequestProjectButton();
});

Then('User can see name input field', () => {
	organizationProjectsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationProjectsPage.enterNameInputData(
		OrganizationProjectsPageData.name
	);
});

And('User can see employee dropdown', () => {
	organizationProjectsPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	organizationProjectsPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropodown options', () => {
	organizationProjectsPage.selectEmployeeDropdownOption(0);
	organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
});

And('User can nvigate to second section', () => {
	organizationProjectsPage.clickTabButton(1);
});

And('User can see tags dropdown', () => {
	organizationProjectsPage.tagsMultyselectVisible();
});

When('User click on tags dropdown', () => {
	organizationProjectsPage.clickTagsMultyselect();
});

Then('User can select tag from dropdown options', () => {
	organizationProjectsPage.selectTagsFromDropdown(0);
	organizationProjectsPage.clickCardBody();
});

And('User can navigate to next section', () => {
	organizationProjectsPage.clickTabButton(3);
});

And('User can see budget hours input field', () => {
	organizationProjectsPage.budgetHoursInputVisible();
});

And('User can enter value for budget hours', () => {
	organizationProjectsPage.enterBudgetHoursInputData(
		OrganizationProjectsPageData.hours
	);
});

And('User can navigate to last section', () => {
	organizationProjectsPage.clickTabButton(5);
});

And('User can see color input field', () => {
	organizationProjectsPage.colorInputVisible();
});

And('User can enter value for color', () => {
	organizationProjectsPage.enterColorInputData(
		OrganizationProjectsPageData.color
	);
});

And('User can see save project button', () => {
	organizationProjectsPage.saveProjectButtonVisible();
});

When('User click on save project button', () => {
	organizationProjectsPage.clickSaveProjectButton();
});

Then('Notification message will appear', () => {
	organizationProjectsPage.waitMessageToHide();
});

// Edit project
And('User can see projects table', () => {
	organizationProjectsPage.tableRowVisible();
});

When('User click on projects table row', () => {
	organizationProjectsPage.selectTableRow(0);
});

Then('Edit project button will become active', () => {
	organizationProjectsPage.editButtonVisible();
});

When('User click on edit project button', () => {
	organizationProjectsPage.clickEditButton();
});

Then('User can see edit name input field', () => {
	organizationProjectsPage.nameInputVisible();
});

And('User can enter new value for name', () => {
	organizationProjectsPage.enterNameInputData(
		OrganizationProjectsPageData.editName
	);
});

And('User can go to next section', () => {
	organizationProjectsPage.clickTabButton(3);
});

And('User can see edit budget hours input field', () => {
	organizationProjectsPage.budgetHoursInputVisible();
});

And('User can enter new value for budget hours', () => {
	organizationProjectsPage.enterBudgetHoursInputData(
		OrganizationProjectsPageData.hours
	);
});

And('User can go to last section', () => {
	organizationProjectsPage.clickTabButton(5);
});

And('User can see edit color input field', () => {
	organizationProjectsPage.colorInputVisible();
});

And('User can enter new value for color', () => {
	organizationProjectsPage.enterColorInputData(
		OrganizationProjectsPageData.color
	);
});

And('User can see save edited project button', () => {
	organizationProjectsPage.saveProjectButtonVisible();
});

When('User click on save edited project button', () => {
	organizationProjectsPage.clickSaveProjectButton();
});

Then('Notification message will appear', () => {
	organizationProjectsPage.waitMessageToHide();
});

// Delete project
And('User can see projects table again', () => {
	organizationProjectsPage.tableRowVisible();
});

When('User click on projects table row again', () => {
	organizationProjectsPage.selectTableRow(0);
});

Then('Delete project button will become active', () => {
	organizationProjectsPage.deleteButtonVisible();
});

When('User click on delete project button', () => {
	organizationProjectsPage.clickDeleteButton();
});

Then('User can see confirm delete project button', () => {
	organizationProjectsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete project button', () => {
	organizationProjectsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationProjectsPage.waitMessageToHide();
});
