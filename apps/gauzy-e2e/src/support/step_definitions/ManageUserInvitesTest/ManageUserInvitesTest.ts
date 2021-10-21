import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as manageUserInvitesPage from '../../Base/pages/ManageUserInvites.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.email();

// Login with email
Given('Login with default credentials and visit Users page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Create new invite
Then('User can visit Candidates invites page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/users', { timeout: pageLoadTimeout });
});

Then('User can see manage invites button', () => {
	manageUserInvitesPage.manageInvitesButtonVisible();
});

When('User click on manage invites button', () => {
	manageUserInvitesPage.clickManageInvitesButton();
});

Then('User will see grid button', () => {
	manageUserInvitesPage.gridButtonVisible();
});

And('User can click on second grid button to change view', () => {
	manageUserInvitesPage.clickGridButton(1);
});

And('User can see invite button', () => {
	manageUserInvitesPage.inviteButtonVisible();
});

When('User click on invite button', () => {
	manageUserInvitesPage.clickInviteButton();
});

And('User can see email input field', () => {
	manageUserInvitesPage.emailInputVisible();
});

And('User can enter value for email', () => {
	manageUserInvitesPage.enterEmailInputData(email);
});

And('User can see date input field', () => {
	manageUserInvitesPage.dateInputVisible();
});

And('User can enter value for date', () => {
	manageUserInvitesPage.enterDateInputData();
	manageUserInvitesPage.clickKeyboardButtonByKeyCode(9);
});

When('User can see roles select', () => {
	manageUserInvitesPage.verifyRoleSelect();
});

Then('User click on roles select', () => {
	manageUserInvitesPage.clickOnRoleSelect();
});

When('User can see roles dropdown', () => {
	manageUserInvitesPage.verifyRolesDropdown();
})

Then('User click see roles dropdown', () => {
	manageUserInvitesPage.clickRolesDropdown(0);
})

And('User can see save button', () => {
	manageUserInvitesPage.saveButtonVisible();
});

When('User click on save button', () => {
	manageUserInvitesPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	manageUserInvitesPage.waitMessageToHide();
});

And('User can verify invite was created', () => {
	manageUserInvitesPage.verifyInviteExist(email);
});

// Copy invite
And('User can see invites table', () => {
	manageUserInvitesPage.tableBodyExists();
});

When('User click on invites first table row', () => {
	manageUserInvitesPage.clickTableRow(0);
});

Then('Copy invite button will become active', () => {
	manageUserInvitesPage.copyLinkButtonVisible();
});

When('User click on copy invite button', () => {
	manageUserInvitesPage.clickCopyLinkButton();
});

Then('Notification message will appear', () => {
	manageUserInvitesPage.waitMessageToHide();
});

// Resend invite
When('User click on invites first table row again', () => {
	manageUserInvitesPage.clickTableRow(0);
});

Then('Resend invite button will become active', () => {
	manageUserInvitesPage.resendInviteButtonVisible();
});

When('User click on resend invite button', () => {
	manageUserInvitesPage.clickResendInviteButton();
});

Then('User can see confirm resend invite button', () => {
	manageUserInvitesPage.confirmResendInviteButtonVisible();
});

When('User click on confirm resend invite button', () => {
	manageUserInvitesPage.clickConfirmResendInviteButton();
});

Then('Notification message will appear', () => {
	manageUserInvitesPage.waitMessageToHide();
});

// Delete invite
When('User click again on first table row', () => {
	manageUserInvitesPage.clickTableRow(0);
});

Then('Delete button will become active', () => {
	manageUserInvitesPage.deleteInviteButtonVisible();
});

When('User click on delete button', () => {
	manageUserInvitesPage.clickDeleteInviteButton();
});

Then('User can see confirm delete button', () => {
	manageUserInvitesPage.confirmDeleteInviteButtonVisible();
});

When('User click on confirm delete button', () => {
	manageUserInvitesPage.clickConfirmDeleteInviteButton();
});

Then('Notification message will appear', () => {
	manageUserInvitesPage.waitMessageToHide();
});
