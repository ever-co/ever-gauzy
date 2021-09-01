import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addExistingUserPage from '../../Base/pages/AddExistingUser.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as addUserPage from '../../Base/pages/AddUser.po';
import { AddUserPageData } from '../../Base/pagedata/AddUserPageData';
import * as editUserPage from '../../Base/pages/EditUser.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let email = faker.internet.email();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();
let editFirstName = faker.name.firstName();
let editLastName = faker.name.lastName();

// Login with email
Given('Login with default credentials and visit Users page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/users', { timeout: pageLoadTimeout });
});

// Add new user
Then('User can see Add new user button', () => {
	addUserPage.addUserButtonVisible();
});

When('User click on Add new user button', () => {
	addUserPage.clickAddUserButton();
});

Then('User can see first name input field', () => {
	addUserPage.firstNameInputVisible();
});

And('User can enter value for first name', () => {
	addUserPage.enterFirstNameData(firstName);
});

And('User can see last name input field', () => {
	addUserPage.lastNameInputVisible();
});

And('User can enter value for last name', () => {
	addUserPage.enterLastNameData(lastName);
});

And('User can see username input field', () => {
	addUserPage.usernameInputVisible();
});

And('User can enter value for username', () => {
	addUserPage.enterUsernameData(username);
});

And('User can see email input field', () => {
	addUserPage.emailInputVisible();
});

And('User can enter value for email', () => {
	addUserPage.enterEmailData(email);
});

And('User can see role select', () => {
	addUserPage.selectUserRoleVisible();
});

And('User can set a role from dropdown options', () => {
	addUserPage.selectUserRoleData(AddUserPageData.role);
});

And('User can see password input field', () => {
	addUserPage.passwordInputVisible();
});

And('User can enter value for password', () => {
	addUserPage.enterPasswordInputData(password);
});

And('User can see image input field', () => {
	addUserPage.imageInputVisible();
});

And('User can enter url for image', () => {
	addUserPage.enterImageDataUrl(imgUrl);
});

And('User can see confirm button', () => {
	addUserPage.confirmAddButtonVisible();
});

When('User click on confirm button', () => {
	addUserPage.clickConfirmAddButton();
});

Then('User creation will be confirmed with notification message', () => {
	addUserPage.waitMessageToHide();
});

And('Users table will be populated with new user', () => {
	addUserPage.verifyUserExists(`${firstName} ${lastName}`);
});

// Edit user
When('User select table row by user name', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	editUserPage.selectTableRow(`${firstName} ${lastName}`);
});

Then('User can see edit button', () => {
	editUserPage.editButtonVisible();
});

When('User click on edit button', () => {
	editUserPage.clickEditButton();
});

Then('User can see edit first name input field', () => {
	editUserPage.firstNameInputVisible();
});

And('User can enter value for editing first name', () => {
	editUserPage.enterFirstNameData(editFirstName);
});

And('User can see edit last name input field', () => {
	editUserPage.lastNameInputVisible();
});

And('User can enter value for editing last name', () => {
	editUserPage.enterLastNameData(editLastName);
});

And('User can see edit password input field', () => {
	editUserPage.passwordInputVisible();
});

And('User can enter value for editing password', () => {
	editUserPage.enterPasswordData(password);
});

And('User can see edit repeat password input field', () => {
	editUserPage.repeatPasswordInputVisible();
});

And('User can enter value for editing repeat password', () => {
	editUserPage.enterRepeatPasswordData(password);
});

And('User can see edit email input field', () => {
	editUserPage.emailInputVisible();
});

And('User can enter value for editing email', () => {
	editUserPage.enterEmailData(email);
});

When('User click on save button', () => {
	editUserPage.saveBtnClick();
});

Then('Notification message will appear', () => {
	addUserPage.waitMessageToHide();
});

And('User can verify that data was edited', () => {
	addUserPage.verifyUserExists(`${editFirstName} ${editLastName}`);
});

// Remove existing user
Then('User can see add existing user button', () => {
	addExistingUserPage.addExistingUsersButtonVisible();
});

When('User click add existing user button', () => {
	addExistingUserPage.clickAddExistingUsersButton();
});

Then('User can see cancel button', () => {
	addExistingUserPage.cancelButtonVisible();
});

And('User can click on cancel button', () => {
	addExistingUserPage.clickCancelButton();
});

And('User can verify users table exist', () => {
	addExistingUserPage.tableBodyExists();
});

When('User click on table row', () => {
	addExistingUserPage.clickTableRow(`${editFirstName} ${editLastName}`);
});

Then('Remove user button will became active', () => {
	addExistingUserPage.removeUserButtonVisible();
});

When('User click on remove user button', () => {
	addExistingUserPage.clickRemoveUserButton();
});

Then('User can see confirm remove user button', () => {
	addExistingUserPage.confirmRemoveUserBtnVisible();
});

And('User can click on confirm remove user button', () => {
	addExistingUserPage.clickConfirmRemoveUserBtn();
});
