import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as manageCandidatesInvitesPage from '../../Base/pages/ManageCandidatesInvites.po';
import { CustomCommands } from '../../commands';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as faker from 'faker';
import { ManageCandidatesInvitesPageData } from '../../Base/pagedata/ManageCandidatesInvitesPageData'

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.email();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Create new invite
Then('User can visit Candidates invites page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.intercept('GET', '/api/invite*').as('waitInvites');
	cy.visit('/#/pages/employees/candidates/invites', { timeout: pageLoadTimeout });
	cy.wait('@waitInvites');
});

Then('User can see header of the page', () => {
	manageCandidatesInvitesPage.verifyHeaderOfThePage(ManageCandidatesInvitesPageData.headerText);
});

When('User see invite button', () => {
	manageCandidatesInvitesPage.inviteButtonVisible();
});

Then('User click on invite button', () => {
	manageCandidatesInvitesPage.clickInviteButton();
});

And('User can see email input field', () => {
	manageCandidatesInvitesPage.emailInputVisible();
});

And('User can enter value for email', () => {
	manageCandidatesInvitesPage.enterEmailInputData(email);
});

And('User can see date input field', () => {
	manageCandidatesInvitesPage.dateInputVisible();
});

And('User can enter value for date', () => {
	manageCandidatesInvitesPage.enterDateInputData();
	manageCandidatesInvitesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save button', () => {
	manageCandidatesInvitesPage.saveButtonVisible();
});

When('User click on save button', () => {
	manageCandidatesInvitesPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	manageCandidatesInvitesPage.waitMessageToHide();
});

And('User can verify invite was created', () => {
	manageCandidatesInvitesPage.verifyInviteExist(email);
});
//Search by Email
When ('User see email input field', () => {
	manageCandidatesInvitesPage.verifyEmailPlaceholder();
});
Then('User can enter email in email field', () => {
	manageCandidatesInvitesPage.enterEmailPlaceholder(email);
});

And('User can see only selected user', () => {
	manageCandidatesInvitesPage.verifySearchResult(ManageCandidatesInvitesPageData.tableResult);
});


// Resend invite
And('User can see invites table', () => {
	manageCandidatesInvitesPage.tableRowVisible();
});

When('User click on table row', () => {
	manageCandidatesInvitesPage.selectTableRow(email);
});

Then('Resend invite button will become active', () => {
	manageCandidatesInvitesPage.resendButtonVisible();
});

When('User click on resend invite button', () => {
	manageCandidatesInvitesPage.clickResendButton();
});

Then('User will see confirm button', () => {
	manageCandidatesInvitesPage.confirmResendButtonVisible();
});

When('User click on confirm button', () => {
	manageCandidatesInvitesPage.clickConfirmResendButton();
});

Then('Notification message will appear', () => {
	manageCandidatesInvitesPage.waitMessageToHide();
});

// Delete invite
And('User can see invites table', () => {
	manageCandidatesInvitesPage.tableRowVisible();
});

When('User click on table row', () => {
	manageCandidatesInvitesPage.selectTableRow(email);
});

Then('Delete invite button will become active', () => {
	manageCandidatesInvitesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	manageCandidatesInvitesPage.clickDeleteButton();
});

Then('User will see confirm delete button', () => {
	manageCandidatesInvitesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	manageCandidatesInvitesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	manageCandidatesInvitesPage.waitMessageToHide();
});

Then('User clear field', () => {
	manageCandidatesInvitesPage.clearEmailField();
});

And('User verify invite is deleted', () => {
	manageCandidatesInvitesPage.verifyInviteIsDeleted(email);
});