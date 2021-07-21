import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as faker from 'faker';
import { ManageEmployeesPageData } from '../../Base/pagedata/ManageEmployeesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let email = faker.internet.email();
let secEmail = faker.internet.email();
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

// Invite employees
And('User can visit Employees page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees');
});

And('User can see grid button', () => {
	manageEmployeesPage.gridBtnExists();
});

And('User can click on grid button to change view', () => {
	manageEmployeesPage.gridBtnClick(1);
});

And('User can see invite button', () => {
	manageEmployeesPage.inviteButtonVisible();
});

When('User click on invite button', () => {
	manageEmployeesPage.clickInviteButton();
});

Then('User will see email input field', () => {
	manageEmployeesPage.emailInputVisible();
});

And('User can enter multiple emails', () => {
	manageEmployeesPage.enterEmailData(email);
	manageEmployeesPage.enterEmailData(secEmail);
});

And('User can see date input field', () => {
	manageEmployeesPage.dateInputVisible();
});

And('User can enter value for date', () => {
	manageEmployeesPage.enterDateData();
	manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see project dropdown', () => {
	manageEmployeesPage.selectProjectDropdownVisible();
});

When('User click on project dropdown', () => {
	manageEmployeesPage.clickProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	manageEmployeesPage.selectProjectFromDropdown(
		ManageEmployeesPageData.defaultProject
	);
});

And('User can see send invite button', () => {
	manageEmployeesPage.sendInviteButtonVisible();
});

When('User click on send invite button', () => {
	manageEmployeesPage.clickSendInviteButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

// Add new employee
And('User can see add employee button', () => {
	manageEmployeesPage.addEmployeeButtonVisible();
});

When('User click on add employee button', () => {
	manageEmployeesPage.clickAddEmployeeButton();
});

Then('User will see first name input field', () => {
	manageEmployeesPage.firstNameInputVisible();
});

And('User can enter value for first name', () => {
	manageEmployeesPage.enterFirstNameData(firstName);
});

And('User will see last name input field', () => {
	manageEmployeesPage.lastNameInputVisible();
});

And('User can enter value for last name', () => {
	manageEmployeesPage.enterLastNameData(lastName);
});

And('User will see username input field', () => {
	manageEmployeesPage.usernameInputVisible();
});

And('User can enter value for username', () => {
	manageEmployeesPage.enterUsernameData(username);
});

And('User can see employee email input field', () => {
	manageEmployeesPage.employeeEmailInputVisible();
});

And('User can enter value for employee email', () => {
	manageEmployeesPage.enterEmployeeEmailData(employeeEmail);
});

And('User can see date input', () => {
	manageEmployeesPage.dateInputVisible();
});

And('User can enter date value', () => {
	manageEmployeesPage.enterDateData();
	manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see password input field', () => {
	manageEmployeesPage.passwordInputVisible();
});

And('User can enter value for password', () => {
	manageEmployeesPage.enterPasswordInputData(password);
});

And('User can see tags dropdown', () => {
	manageEmployeesPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	manageEmployeesPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	manageEmployeesPage.selectTagFromDropdown(0);
	manageEmployeesPage.clickCardBody();
});

And('User can see image input field', () => {
	manageEmployeesPage.imageInputVisible();
});

And('User can enter value for image url', () => {
	manageEmployeesPage.enterImageDataUrl(imgUrl);
});

And('User can see next button', () => {
	manageEmployeesPage.nextButtonVisible();
});

When('User click on next button', () => {
	manageEmployeesPage.clickNextButton();
});

Then('User can see next step button', () => {
	manageEmployeesPage.nextStepButtonVisible();
});

When('User click on next step button', () => {
	manageEmployeesPage.clickNextStepButton();
});

Then('User will see last step button', () => {
	manageEmployeesPage.lastStepButtonVisible();
});

When('User click on last step button', () => {
	manageEmployeesPage.clickLastStepButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

And('User can verify employee was added', () => {
	manageEmployeesPage.verifyEmployeeExists(`${firstName} ${lastName}`);
});

// Edit employee
And('User can see employees table', () => {
	manageEmployeesPage.tableRowVisible();
});

When('User click on emloyees table row', () => {
	manageEmployeesPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	manageEmployeesPage.editButtonVisible();
});

When('User click on edit button', () => {
	manageEmployeesPage.clickEditButton();
});

Then('User will see edit username input field', () => {
	manageEmployeesPage.usernameEditInputVisible();
});

And('User can enter value for username edit', () => {
	manageEmployeesPage.enterUsernameEditInputData(username);
});

And('User can see edit email input field', () => {
	manageEmployeesPage.emailEditInputVisible();
});

And('User can enter value for email edit', () => {
	manageEmployeesPage.enterEmailEditInputData(email);
});

And('User can see edit first name input field', () => {
	manageEmployeesPage.firstNameEditInputVisible();
});

And('User can enter value for first name edit', () => {
	manageEmployeesPage.enterFirstNameEditInputData(firstName);
});

And('User can see edit last name input field', () => {
	manageEmployeesPage.lastNameEditInputVisible();
});

And('User can enter value for last name edit', () => {
	manageEmployeesPage.enterLastNameEditInputData(lastName);
});

And('User can see prefered language dropdown', () => {
	manageEmployeesPage.preferedLanguageDropdownVisible();
});

When('User click on prefered language dropdown', () => {
	manageEmployeesPage.clickPreferedLanguageDropdown();
});

Then('User can select language from dropdown options', () => {
	manageEmployeesPage.selectLanguageFromDropdown(
		ManageEmployeesPageData.preferedLanguage
	);
});

And('User can see save edit button', () => {
	manageEmployeesPage.saveEditButtonVisible();
});

When('User click on save edit button', () => {
	manageEmployeesPage.clickSaveEditButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

And('User can go back to Employees page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees');
});

// End employee work
And('User can see employees table again', () => {
	manageEmployeesPage.tableRowVisible();
});

When('User click on emloyees table row again', () => {
	manageEmployeesPage.selectTableRow(0);
});

Then('End work button will become active', () => {
	manageEmployeesPage.endWorkButtonVisible();
});

When('User click on end work button', () => {
	manageEmployeesPage.clickEndWorkButton();
});

Then('User will see confirm button', () => {
	manageEmployeesPage.confirmEndWorkButtonVisible();
});

When('User click on confirm button', () => {
	manageEmployeesPage.clickConfirmEndWorkButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

// Delete employee
And('User can see employees table again', () => {
	manageEmployeesPage.tableRowVisible();
});

When('User click over table row', () => {
	manageEmployeesPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	manageEmployeesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	manageEmployeesPage.clickDeleteButton();
});

Then('User will see confirm delete button', () => {
	manageEmployeesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	manageEmployeesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

// Copy invite link
And('User can see manage invites button', () => {
	manageEmployeesPage.manageInvitesButtonVisible();
});

When('User click on manage invites button', () => {
	manageEmployeesPage.clickManageInviteButton();
});

Then('User will see and select first row from invites table', () => {
	manageEmployeesPage.selectTableRow(0);
});

And('User can see copy invite button', () => {
	manageEmployeesPage.copyLinkButtonVisible();
});

When('User click on copy invite button', () => {
	manageEmployeesPage.clickCopyLinkButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

// Resend invite
When('User select first table row again', () => {
	manageEmployeesPage.selectTableRow(0);
});

Then('Resend invite button will become active', () => {
	manageEmployeesPage.resendInviteButtonVisible();
});

When('User click on resend invite button', () => {
	manageEmployeesPage.clickResendInviteButton();
});

Then('User will see confirm resend button', () => {
	manageEmployeesPage.confirmResendInviteButtonVisible();
});

When('User click on confirm resend invite button', () => {
	manageEmployeesPage.clickConfirmResendInviteButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});

// Delete invite
When('User click on invites first table row', () => {
	manageEmployeesPage.selectTableRow(0);
});

Then('Delete invite button will become active', () => {
	manageEmployeesPage.deleteInviteButtonVisible();
});

When('User click on delete invite button', () => {
	manageEmployeesPage.clickDeleteInviteButton();
});

Then('User will see confirm delete invite button', () => {
	manageEmployeesPage.confirmDeleteInviteButtonVisible();
});

When('User click on confirm delete invite button', () => {
	manageEmployeesPage.clickConfirmDeleteInviteButton();
});

Then('Notification message will appear', () => {
	manageEmployeesPage.waitMessageToHide();
});
