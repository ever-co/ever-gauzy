import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationDepartmentsPage from '../../Base/pages/OrganizationDepartments.po';
import * as faker from 'faker';
import { OrganizationDepartmentsPageData } from '../../Base/pagedata/OrganizationDepartmentsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { waitUntil } from '../../Base/utils/util';

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
	waitUntil(3000);
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

// Add project
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
});

// Add department
When('User go to Organization departments page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/departments', { timeout: pageLoadTimeout });
});

Then('User will see grid button', () => {
	organizationDepartmentsPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	organizationDepartmentsPage.gridBtnClick(1);
});

And('User can see add new department button', () => {
	organizationDepartmentsPage.addDepartmentButtonVisible();
});

When('User click on add new department button', () => {
	organizationDepartmentsPage.clickAddDepartmentButton();
});

Then('User will see name input field', () => {
	organizationDepartmentsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationDepartmentsPage.enterNameInputData(
		OrganizationDepartmentsPageData.departmentName
	);
});

And('User can see employee dropdown', () => {
	organizationDepartmentsPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	organizationDepartmentsPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	organizationDepartmentsPage.selectEmployeeFromDrodpwon(0);
	organizationDepartmentsPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see tags dropdown', () => {
	organizationDepartmentsPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	organizationDepartmentsPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	organizationDepartmentsPage.selectTagFromDropdown(0);
	organizationDepartmentsPage.clickCardBody();
});

And('User can see save department button', () => {
	organizationDepartmentsPage.saveDepartmentButtonVisible();
});

When('User click on save department button', () => {
	organizationDepartmentsPage.clickSaveDepartmentButton();
});

Then('Notification message will appear', () => {
	organizationDepartmentsPage.waitMessageToHide();
});

And('User can verify department was created', () => {
	organizationDepartmentsPage.verifyDepartmentExists(
		OrganizationDepartmentsPageData.departmentName
	);
});

// Edit department
And('User can see departments table', () => {
	organizationDepartmentsPage.tableRowVisible();
});

When('User click on departments table row', () => {
	organizationDepartmentsPage.selectTableRow(0);
});

Then('Edit department button will become active', () => {
	organizationDepartmentsPage.editButtonVisible();
});

When('User click on edit department button', () => {
	organizationDepartmentsPage.clickEditButton();
});

Then('User can see edit department name input field', () => {
	organizationDepartmentsPage.nameInputVisible();
});

And('User can enter new value for department name', () => {
	organizationDepartmentsPage.enterNameInputData(
		OrganizationDepartmentsPageData.editDepartmentName
	);
});

And('User can save edited department button', () => {
	organizationDepartmentsPage.saveDepartmentButtonVisible();
});

When('User click on save edited department button', () => {
	organizationDepartmentsPage.clickSaveDepartmentButton();
});

Then('Notification message will appear', () => {
	organizationDepartmentsPage.waitMessageToHide();
});

And('User can verify department was edited', () => {
	organizationDepartmentsPage.verifyDepartmentExists(
		OrganizationDepartmentsPageData.editDepartmentName
	);
});

// Delete department
And('User can see departments table again', () => {
	organizationDepartmentsPage.tableRowVisible();
});

When('User click on departments table row again', () => {
	organizationDepartmentsPage.selectTableRow(0);
});

Then('Delete department button will become active', () => {
	organizationDepartmentsPage.deleteButtonVisible();
});

When('User click on delete department button', () => {
	organizationDepartmentsPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	organizationDepartmentsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationDepartmentsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationDepartmentsPage.waitMessageToHide();
});

And('User can verify department was deleted', () => {
	organizationDepartmentsPage.verifyDepartmentIsDeleted(
		OrganizationDepartmentsPageData.editDepartmentName
	);
});
