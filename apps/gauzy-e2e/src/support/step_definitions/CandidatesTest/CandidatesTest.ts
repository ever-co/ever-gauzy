import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as inviteCandidatePage from '../../Base/pages/Candidates.po';
import { faker } from '@faker-js/faker';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.exampleEmail();
let secondEmail = faker.internet.exampleEmail();
let firstName = faker.person.firstName();
let lastName = faker.person.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Send invite
Then('User can visit Employees candidates page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/candidates', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	inviteCandidatePage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	inviteCandidatePage.gridBtnClick(1);
});

And('User can see invite button', () => {
	inviteCandidatePage.inviteButtonVisible();
});

When('User click on invite button', () => {
	inviteCandidatePage.clickInviteButton();
});

Then('User can see email input field', () => {
	inviteCandidatePage.emailInputVisible();
});

And('User can enter value for email', () => {
	inviteCandidatePage.enterEmailData(email);
	inviteCandidatePage.enterEmailData(secondEmail);
});

And('User can see invite date input field', () => {
	inviteCandidatePage.inviteDateInputVisible();
});

And('User can enter value for invite date', () => {
	inviteCandidatePage.enterInviteDateInputData();
	inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see send invite button', () => {
	inviteCandidatePage.sendInviteButtonVisible();
});

When('User click on send invite button', () => {
	inviteCandidatePage.clickSendInviteButton();
});

// Add new candidate
Then('User can see add candidate button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	inviteCandidatePage.addCandidateButtonVisible();
});

When('User click on add candidate button', () => {
	inviteCandidatePage.clickAddCandidateButton(0);
});

Then('User can see first name input field', () => {
	inviteCandidatePage.firstNameInputVisible();
});

And('User can enter value for first name', () => {
	inviteCandidatePage.enterFirstNameInputData(firstName);
});

And('User can see last name input field', () => {
	inviteCandidatePage.lastNameInputVisible();
});

And('User can enter value for last name', () => {
	inviteCandidatePage.enterLastNameInputData(lastName);
});

And('User can see username input field', () => {
	inviteCandidatePage.usernameInputVisible();
});

And('User can enter value for username', () => {
	inviteCandidatePage.enterUsernameInputData(username);
});

And('User can see candidate email input field', () => {
	inviteCandidatePage.candidateEmailInputVisible();
});

And('User can enter candidate email value', () => {
	inviteCandidatePage.enterCandidateEmailInputData(email);
});

And('User can see password input field', () => {
	inviteCandidatePage.passwordInputVisible();
});

And('User can enter value for password', () => {
	inviteCandidatePage.enterPasswordInputData(password);
});

And('User can see candidate date input field', () => {
	inviteCandidatePage.candidateDateInputVisible();
});

And('User can enter value for candidate date', () => {
	inviteCandidatePage.enterCandidateDateInputData();
	inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see tags dropdown', () => {
	inviteCandidatePage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	inviteCandidatePage.clickAddTagsDropdown();
});

Then('User can select tag from dropdown options', () => {
	inviteCandidatePage.selectTagsFromDropdown(0);
	inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see image input field', () => {
	inviteCandidatePage.imageInputVisible();
});

And('User can enter value for image', () => {
	inviteCandidatePage.enterImageInputData(imgUrl);
});

Then('User can see next step button', () => {
	inviteCandidatePage.nextButtonVisible();
});

When('User click on next step button', () => {
	inviteCandidatePage.clickNextButton();
});

Then('User can see next button', () => {
	inviteCandidatePage.nextStepButtonVisible();
});

When('User can click on next button', () => {
	inviteCandidatePage.clickNextStepButton();
});

Then('User can see last step button', () => {
	inviteCandidatePage.allCurrentCandidatesButtonVisible();
});

When('User click on last step button', () => {
	inviteCandidatePage.clickAllCurrentCandidatesButton();
});

Then('Notification message will appear', () => {
	inviteCandidatePage.waitMessageToHide();
});

And('User can verify candidate', () => {
	inviteCandidatePage.verifyCandidateExists(`${firstName} ${lastName}`);
});

// Reject candidate
When('User select first table row', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	inviteCandidatePage.selectTableRow(0);
});

Then('Reject button will become active', () => {
	inviteCandidatePage.rejectButtonVisible();
});

When('User click on reject button', () => {
	inviteCandidatePage.clickRejectButton();
});

Then('User can see confirm reject button', () => {
	inviteCandidatePage.confirmActionButtonVisible();
});

When('User click on confirm reject button', () => {
	inviteCandidatePage.clickConfirmActionButton();
});

Then('Notification message will appear', () => {
	inviteCandidatePage.waitMessageToHide();
});

And('User can verify badge', () => {
	inviteCandidatePage.verifyBadgeClass();
});

// Edit candidate
When('User select first table row', () => {
	inviteCandidatePage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	inviteCandidatePage.editButtonVisible();
});

When('User click on edit button', () => {
	inviteCandidatePage.clickEditButton();
});

Then('User can see save edit button', () => {
	inviteCandidatePage.saveEditButtonVisible();
});

When('User click on save edit button', () => {
	inviteCandidatePage.clickSaveEditButton();
});

Then('User can see go back button', () => {
	inviteCandidatePage.backButtonVisible();
});

When('User can click on go back button', () => {
	inviteCandidatePage.clickBackButton();
});

// Archive candidate
Then('User can select first table row again', () => {
	inviteCandidatePage.selectTableRow(0);
});

And('Archive button will become active', () => {
	inviteCandidatePage.archiveButtonVisible();
});

When('User click on archive button', () => {
	inviteCandidatePage.clickArchiveButton();
});

Then('User will see confirm archive button', () => {
	inviteCandidatePage.confirmActionButtonVisible();
});

When('User click on confirm archive button', () => {
	inviteCandidatePage.clickConfirmActionButton();
});

Then('Notification message will appear', () => {
	inviteCandidatePage.waitMessageToHide();
});
