import { CustomCommands } from '../../commands';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import { AddOrganizationPageData } from '../../Base/pagedata/AddOrganizationPageData';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as loginPage from '../../Base/pages/Login.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as addOrganizationPage from '../../Base/pages/AddOrganization.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as organizationPublicPage from '../../Base/pages/OrganizationPublicPage.po';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

import * as faker from 'faker';

const email = faker.internet.email();
const fullName = faker.name.firstName() + ' ' + faker.name.lastName();
const city = faker.address.city();
const postcode = faker.address.zipCode();
const street = faker.address.streetAddress();
const website = faker.internet.url();

const firstName = faker.name.firstName();
const lastName = faker.name.lastName();
const username = faker.internet.userName();
const password = faker.internet.password();
const employeeEmail = faker.internet.email();
const imgUrl = faker.image.avatar();
const employeeFullName = `${firstName} ${lastName}`;

const organizationName = faker.company.companyName();
const taxId = faker.random.alphaNumeric();
const organizationStreet = faker.address.streetAddress();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new organization
And('User can add new organization', () => {
	CustomCommands.addOrganization(
		addOrganizationPage,
		organizationName,
		AddOrganizationPageData,
		taxId,
		organizationStreet
	);
});

const selectOrganization = (name: string) => {
	organizationPublicPage.organizationDropdownVisible();
	organizationPublicPage.clickOrganizationDropdown();
	organizationPublicPage.selectOrganization(name);
};

const logoutLogin = () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
};

// Add employee
And('User can add new employee', () => {
	logoutLogin();

	selectOrganization(organizationName);

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
	logoutLogin();

	selectOrganization(organizationName);

	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
});

// Add new client
And('User can add new client', () => {
	logoutLogin();

	selectOrganization(organizationName);

	CustomCommands.addClient(
		clientsPage,
		fullName,
		email,
		website,
		city,
		postcode,
		street,
		ClientsData,
		employeeFullName
	);
});

// Add new public profile link
And('User can navigate to organizations page', () => {
	logoutLogin();
	cy.visit('/#/pages/organizations', { timeout: pageLoadTimeout });
});

And('User can see organization name filter input field', () => {
	organizationPublicPage.organizationNameFilterInputVisible();
});

When('User enters organization name filter input value', () => {
	organizationPublicPage.enterOrganizationNameFilterInputData(
		organizationName
	);
});

Then('User can see filtered organization', () => {
	organizationPublicPage.verifyOrganizationNameTableRowContains(
		`${organizationName}`
	);
});

When('User selects organization from table row', () => {
	organizationPublicPage.selectOrganizationTableRow();
});

Then('Manage button will become active', () => {
	organizationPublicPage.manageBtnExists();
});

When('User clicks on manage button', () => {
	organizationPublicPage.manageBtnClick();
});

Then('User can see profile link input field', () => {
	organizationPublicPage.profileLinkInputVisisble();
});

And('User enters profile link value', () => {
	organizationPublicPage.enterProfileLinkInputData(organizationName);
});

Then('User can see save button', () => {
	organizationPublicPage.saveButtonVisible();
});

When('User clicks on save button', () => {
	organizationPublicPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationPublicPage.waitMessageToHide();
});

// Edit public page
And('User can navigate to organization public page', () => {
	logoutLogin();

	cy.visit(`/#/share/organization/${organizationName}`);
});

// And('User can see Edit Page button', () => {});

// When('User clicks on Edit Page button', () => {});

// Then('User can see company name input field', () => {});

// And('User enters company name value', () => {});

// And('User can see company size input field', () => {});

// And('User enters company size value', () => {});

// And('User can see year founded input field', () => {});

// And('User enters year founded value', () => {});

// And('User can see banner input field', () => {});

// And('User enters banner value', () => {});

// And('User see minimum project size dropdown', () => {});

// When('User clicks on minimum project size dropdown', () => {});

// Then('User can select minimum project size value ', () => {});

// And('User can see short description input field', () => {});

// And('User enters short description value', () => {});

// And('User can see awards tab', () => {});

// When('User clicks on awards tab', () => {});

// Then('Use can see add award button', () => {});

// When('User clicks on award button', () => {});

// Then('User can see award name input field', () => {});

// And('User enters award name value', () => {});

// And('User can see award year input field', () => {});

// And('User enters award year value', () => {});

// And('User can see save button', () => {});

// When('User clicks on save button', () => {});

// Then('Notification message will appear', () => {});

// And('User can see skills tab', () => {});

// When('User clicks on skills tab', () => {});

// Then('User can see skills dropdown', () => {});

// When('User clicks on skills dropdown', () => {});

// Then('User can select skills from dropdown options', () => {});

// And('User can see languages tab', () => {});

// When('User clicks on languages tab', () => {});

// Then('User can see add language button', () => {});

// When('User clicks on add language button', () => {});

// Then('User can see language dropdown', () => {});

// When('User clicks on language dropdown', () => {});

// Then('User can select language from dropdown options', () => {});

// And('User can see language level dropdown', () => {});

// When('User clicks on language level dropdown', () => {});

// Then('User can select language level from dropdown ', () => {});

// And('User can see save button', () => {});

// When('User clicks on save button', () => {});

// Then('Notification message will appear', () => {});

// And('User can see Update button', () => {});

// When('User clicks on Update button', () => {});

// Then('Notification message will appear', () => {});

// // Verify public page header
// And('User can verify company name', () => {});

// And('User can verify banner', () => {});

// And('User can verify year founded', () => {});

// And('User can verify company size', () => {});

// And('User can verify total clients', () => {});

// And('User can verify client focus', () => {});

// // Verify profile tab
// And('User can verify projects', () => {});

// And('User can verify languages', () => {});

// And('User can verify awards', () => {});

// And('User can verify employees', () => {});

// And('User can verify description', () => {});

// And('User can verify minium project size', () => {});

// And('User can verify skills', () => {});

// // Verify employees tab
// And('User can see employees tab', () => {});

// When('User clicks on employees tab', () => {});

// Then('User can verify employees', () => {});

// // Verify clients tab
// And('User can see clients tab', () => {});

// When('User clicks on clients tab', () => {});

// And('User can verify clients', () => {});
