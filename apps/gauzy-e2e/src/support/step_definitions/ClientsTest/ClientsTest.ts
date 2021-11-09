import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as faker from 'faker';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let inviteName = faker.name.firstName() + ' ' + faker.name.lastName();
let deleteName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
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

// Invite client
Then('User can see invite button', () => {
	clientsPage.inviteButtonVisible();
});

When('User click on invite button', () => {
	clientsPage.clickInviteButton();
});

Then('User can see contact name input field', () => {
	clientsPage.contactNameInputVisible();
});

And('User can enter value for contact name', () => {
	clientsPage.enterClientNameData(inviteName);
});

And('User can see client phone input field', () => {
	clientsPage.clientPhoneInputVisible();
});

And('User can enter value for client phone', () => {
	clientsPage.enterClientPhoneData(ClientsData.defaultPhone);
});

And('User can see client email input field', () => {
	clientsPage.clientEmailInputVisible();
});

And('User can enter value for client email', () => {
	clientsPage.enterClientEmailData(email);
});

And('User can see save invite button', () => {
	clientsPage.saveInvitebuttonVisible();
});

When('User click on save invite button', () => {
	clientsPage.clickSaveInviteButton();
});

Then('Notification message will appear', () => {
	clientsPage.waitMessageToHide();
});

And('User can verify client was created', () => {
	clientsPage.verifyClientExists(inviteName);
});

// Edit client
When('User see name input field', () => {
	clientsPage.verifyNameInput();
});

Then('User enter client name', () => {
	clientsPage.searchClientName(fullName);
});

And('User can verify client name', () => {
	clientsPage.verifyClientNameInTable(fullName);
})

And('User can see clients table', () => {
	clientsPage.tableRowVisible();
});

When('User click on table first row', () => {
	clientsPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	clientsPage.editButtonVisible();
});

When('User click on edit button', () => {
	clientsPage.clickEditButton(ClientsData.editButton);
});

Then('User can see name input field', () => {
	clientsPage.nameInputVisible();
});

And('User can enter new value for name', () => {
	clientsPage.enterNameInputData(deleteName);
});

And('User can see email input field', () => {
	clientsPage.emailInputVisible();
});

And('User can enter new value for email', () => {
	clientsPage.enterEmailInputData(email);
});

And('User can see phone input field', () => {
	clientsPage.phoneInputVisible();
});

And('User can enter new value for phone', () => {
	clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
});

And('User can see website input field', () => {
	clientsPage.websiteInputVisible();
});

And('User can enter value for website', () => {
	clientsPage.enterWebsiteInputData(website);
});

And('User can see save button', () => {
	clientsPage.saveButtonVisible();
});

When('User click on save button', () => {
	clientsPage.clickSaveButton();
});

Then('User can see country dropdown', () => {
	clientsPage.countryDropdownVisible();
});

When('User click on country dropdown', () => {
	clientsPage.clickCountryDropdown();
});

Then('User can select country from dropdown options', () => {
	clientsPage.selectCountryFromDropdown(ClientsData.country);
});

And('User can see city input field', () => {
	clientsPage.cityInputVisible();
});

And('User can enter value for city', () => {
	clientsPage.enterCityInputData(city);
});

And('User can see post code input field', () => {
	clientsPage.postcodeInputVisible();
});

And('User can enter value for postcode', () => {
	clientsPage.enterPostcodeInputData(postcode);
});

And('User can see street input field', () => {
	clientsPage.streetInputVisible();
});

And('User can enter value for street', () => {
	clientsPage.enterStreetInputData(street);
});

And('User can see next button', () => {
	clientsPage.nextButtonVisible();
});

When('User click on next button', () => {
	clientsPage.clickNextButton();
});

Then('User can see hours input field', () => {
	clientsPage.budgetInputVisible();
});

And('User can enter value for hours', () => {
	clientsPage.enterBudgetData(ClientsData.hours);
});

And('User can see last step button', () => {
	clientsPage.lastStepBtnVisible();
});

When('User click on last step button', () => {
	clientsPage.clickLastStepBtn();
});

Then('User can see next step button', () => {
	clientsPage.nextButtonVisible();
});

When('User click on next step button', () => {
	clientsPage.clickNextButton();
});

Then('Notification message will appear', () => {
	clientsPage.waitMessageToHide();
});

And('User can verify client was edited', () => {
	clientsPage.searchClientName(deleteName);
	clientsPage.verifyClientExists(deleteName);
});
//View client information
Then('View button will become active', () => {
	clientsPage.viewButtonVisible();
});

When('User click on view button', () => {
	clientsPage.clickViewButton();
});

And('User can verify client name in view', () => {
	clientsPage.verifyClientNameView(deleteName);
});

And('User can verify contact type', () => {
	clientsPage.verifyContactType(ClientsData.clientType);
});

Then('User can see back button', () => {
	clientsPage.verifyBackBtn();
});

And('User click on back button', () => {
	clientsPage.clickOnBackBtn();
});

// Delete client
When('User see name input field again', () => {
	cy.intercept('GET', '/api/organization-projects*').as('waitOrg');
	cy.wait('@waitOrg');
	clientsPage.verifyNameInput();
});

Then('User enter client name again', () => {
	clientsPage.searchClientName(deleteName);
});

And('User can see only selected user', () => {
	clientsPage.verifySearchResult(ClientsData.tableResult);
});

Then('User can see clients table', () => {
	clientsPage.tableRowVisible();
});

When('User select table first row', () => {
	clientsPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	clientsPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	clientsPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	clientsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	clientsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	clientsPage.waitMessageToHide();
});

And('User can verify client was deleted', () => {
	clientsPage.clearSearchInput();
	clientsPage.verifyElementIsDeleted(deleteName);
});

