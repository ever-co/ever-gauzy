import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as contactsLeadsPage from '../../Base/pages/ContactsLeads.po';
import * as faker from 'faker';
import { ContactsLeadsPageData } from '../../Base/pagedata/ContactsLeadsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import { waitUntil } from '../../Base/utils/util';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let deleteName = faker.name.firstName() + ' ' + faker.name.lastName();
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

// Add tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employee
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

// Add lead
And('User can add new contact', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addContact(
		fullName,
		email,
		city,
		postcode,
		street,
		website,
		contactsLeadsPage,
		ContactsLeadsPageData
	);
});

Then('Notification message will appear', () => {
	contactsLeadsPage.waitMessageToHide();
});

// Invite lead
And('User can see invite button', () => {
	contactsLeadsPage.inviteButtonVisible();
});

When('User click on invite button', () => {
	contactsLeadsPage.clickInviteButton();
});

Then('User can see contact name input field', () => {
	contactsLeadsPage.contactNameInputVisible();
});

And('User can enter value for contact name', () => {
	contactsLeadsPage.enterContactNameData(fullName);
});

And('User can see contact phone input field', () => {
	contactsLeadsPage.contactPhoneInputVisible();
});

And('User can enter value for contact phone', () => {
	contactsLeadsPage.enterContactPhoneData(ContactsLeadsPageData.defaultPhone);
});

And('User can see contact email input field', () => {
	contactsLeadsPage.contactEmailInputVisible();
});

And('User can enter value for contact email', () => {
	contactsLeadsPage.enterContactEmailData(email);
});

And('User can see save invite button', () => {
	contactsLeadsPage.saveInvitebuttonVisible();
});

When('User click on save invite button', () => {
	contactsLeadsPage.clickSaveInviteButton();
});

Then('Notification message will appear', () => {
	contactsLeadsPage.waitMessageToHide();
});

And('User can verify contact was created', () => {
	contactsLeadsPage.verifyLeadExists(fullName);
});

// Edit lead
And('User can see contacts table', () => {
	contactsLeadsPage.tableRowVisible();
});

When('User select first table row', () => {
	contactsLeadsPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	contactsLeadsPage.editButtonVisible();
});

When('User click on edit button', () => {
	contactsLeadsPage.clickEditButton(ContactsLeadsPageData.editBtn);
});

Then('User can see name input field', () => {
	contactsLeadsPage.nameInputVisible();
});

And('User can enter new value for name', () => {
	contactsLeadsPage.enterNameInputData(deleteName);
});

And('User can see email input field', () => {
	contactsLeadsPage.emailInputVisible();
});

And('User can enter new value for email', () => {
	contactsLeadsPage.enterEmailInputData(email);
});

And('User can see phone input field', () => {
	contactsLeadsPage.phoneInputVisible();
});

And('User can enter new value for phone', () => {
	contactsLeadsPage.enterPhoneInputData(ContactsLeadsPageData.defaultPhone);
});

And('User can see website input field', () => {
	contactsLeadsPage.websiteInputVisible();
});

And('User can enter value for website', () => {
	contactsLeadsPage.enterWebsiteInputData(website);
});

And('User can see save button', () => {
	contactsLeadsPage.saveButtonVisible();
});

When('User click on save button', () => {
	contactsLeadsPage.clickSaveButton();
});

Then('User can see country dropdown', () => {
	contactsLeadsPage.countryDropdownVisible();
});

When('User click on country dropdown', () => {
	contactsLeadsPage.clickCountryDropdown();
});

Then('User can select country from dropdown options', () => {
	contactsLeadsPage.selectCountryFromDropdown(ContactsLeadsPageData.country);
});

And('User can see city input field', () => {
	contactsLeadsPage.cityInputVisible();
});

And('User can enter value for city', () => {
	contactsLeadsPage.enterCityInputData(city);
});

And('User can see post code input field', () => {
	contactsLeadsPage.postcodeInputVisible();
});

And('User can enter value for postcode', () => {
	contactsLeadsPage.enterPostcodeInputData(postcode);
});

And('User can see street input field', () => {
	contactsLeadsPage.streetInputVisible();
});

And('User can enter value for street', () => {
	contactsLeadsPage.enterStreetInputData(street);
});

And('User can see next button', () => {
	contactsLeadsPage.verifyNextButtonVisible();
});

When('User click on next button', () => {
	contactsLeadsPage.clickNextButton();
});

Then('User can see hours input field', () => {
	contactsLeadsPage.budgetInputVisible();
});

And('User can enter value for hours', () => {
	contactsLeadsPage.enterBudgetData(ContactsLeadsPageData.hours);
});

And('User can see last step button', () => {
	contactsLeadsPage.lastStepBtnVisible();
});

When('User click on last step button', () => {
	contactsLeadsPage.clickLastStepBtn();
});

Then('User can see finish button', () => {
	contactsLeadsPage.verifyFinishButtonVisible();
});

When('User click on finish button', () => {
	contactsLeadsPage.clickFinishButton();
});

Then('Notification message will appear', () => {
	contactsLeadsPage.waitMessageToHide();
});

And('User can verify contact was edited', () => {
	contactsLeadsPage.verifyLeadExists(deleteName);
});

// Delete lead
Then('User can see contacts table', () => {
	contactsLeadsPage.tableRowVisible();
});

When('User select first table row', () => {
	contactsLeadsPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	contactsLeadsPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	contactsLeadsPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	contactsLeadsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	contactsLeadsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	contactsLeadsPage.waitMessageToHide();
});

And('User can verify contact was deleted', () => {
	contactsLeadsPage.verifyElementIsDeleted(deleteName);
});
