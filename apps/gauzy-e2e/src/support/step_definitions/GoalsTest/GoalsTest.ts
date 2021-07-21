import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as goalsPage from '../../Base/pages/Goals.po';
import { GoalsPageData } from '../../Base/pagedata/GoalsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import { ContactsLeadsPageData } from '../../Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from '../../Base/pages/ContactsLeads.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let employeeStreet = faker.address.streetAddress();
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
And('User can add new tag', () => {
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

// Add contact
And('User can add new contact', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addContact(
		fullName,
		email,
		city,
		postcode,
		employeeStreet,
		website,
		contactsLeadsPage,
		ContactsLeadsPageData
	);
});

// Add new goal
And('User can visit Goals page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/goals');
});

And('User can see add goal button', () => {
	goalsPage.addButtonVisible();
});

When('User click on add goal button', () => {
	goalsPage.clickAddButton(0);
});

Then('User can select first option from a dropdown', () => {
	goalsPage.selectOptionFromDropdown(0);
});

And('User can see name input field', () => {
	goalsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	goalsPage.enterNameInputData(GoalsPageData.name);
});

And('User can see owner dropdown', () => {
	goalsPage.ownerDropdownVisible();
});

When('User click on owner dropdown', () => {
	goalsPage.clickOwnerDropdown();
});

Then('User can select owner from dropdown options', () => {
	goalsPage.selectOwnerFromDropdown(0);
});

And('User can see contact dropdown', () => {
	goalsPage.leadDropdownVisible();
});

When('User click on contact dropdown', () => {
	goalsPage.clickLeadDropdown();
});

Then('User can select contact from dropdown options', () => {
	goalsPage.selectLeadFromDropdown(0);
});

And('User can see confirm button', () => {
	goalsPage.confirmButtonVisible();
});

When('User click on confirm button', () => {
	goalsPage.clickConfirmButton();
});

Then('Notification message will appear', () => {
	goalsPage.waitMessageToHide();
});

And('User can verify goal was created', () => {
	goalsPage.verifyGoalExists(GoalsPageData.name);
});

// Add key result
And('User can see goals table', () => {
	goalsPage.tableRowVisible();
});

When('User click on first table row', () => {
	goalsPage.clickTableRow(0);
});

Then('Add button will become active', () => {
	goalsPage.addButtonVisible();
});

When('User click on add button', () => {
	goalsPage.clickAddButton(1);
});

Then('User can see key result input field', () => {
	goalsPage.keyResultInputVisible();
});

And('User can enter value for key result', () => {
	goalsPage.enterKeyResultNameData(GoalsPageData.keyResultName);
});

And('User can see key result owner dropdown', () => {
	goalsPage.keyResultOwnerDropdownVisible();
});

When('User click on key result owner dropdown', () => {
	goalsPage.clickKeyResultOwnerDropdown();
});

Then('User can select key result owner from dropdown options', () => {
	goalsPage.selectKeyResultOwnerFromDropdown(0);
});

And('User can see key result contact dropdown', () => {
	goalsPage.keyResultLeadDropdownVisible();
});

When('User click on key result contact dropdown', () => {
	goalsPage.clickKeyResultLeadDropdown();
});

Then('User can select key result owner from dropdown options', () => {
	goalsPage.selectKeyResultLeadFromDropdown(0);
});

And('User can see toggle button', () => {
	goalsPage.toggleButtonVisible();
});

And('U ser can click on toggle button', () => {
	goalsPage.clickToggleButton();
	goalsPage.clickToggleButton();
});

And('User can see confirm button', () => {
	goalsPage.confirmButtonVisible();
});

When('User click on confirm button', () => {
	goalsPage.clickConfirmButton();
});

// Edit goal
And('User can see edit goal button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	goalsPage.editButtonVisible();
});

When('User click on edit goal button', () => {
	goalsPage.clickEditButton(0);
});

Then('User can see owner dropdown', () => {
	goalsPage.ownerDropdownVisible();
});

When('User click on owner dropdown', () => {
	goalsPage.clickOwnerDropdown();
});

Then('User can select owner from dropdown options', () => {
	goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
});

And('User can see confirm button', () => {
	goalsPage.confirmButtonVisible();
});

When('User click on confirm button', () => {
	goalsPage.clickConfirmButton();
});

Then('Notification message will appear', () => {
	goalsPage.waitMessageToHide();
});

// Delete goal
And('View button will become active', () => {
	goalsPage.viewButtonVisible();
});

When('User click on view button', () => {
	goalsPage.clickViewButton(0);
});

Then('Delete button will become active', () => {
	goalsPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	goalsPage.clickDeleteButton();
});

And('User can see confirm button', () => {
	goalsPage.confirmButtonVisible();
});

When('User click on confirm button', () => {
	goalsPage.clickConfirmButton();
});

Then('Notification message will appear', () => {
	goalsPage.waitMessageToHide();
});

And('User can verify goal was deleted', () => {
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/goals');
	goalsPage.verifyElementIsDeleted();
});
