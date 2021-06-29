import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addExistingUserPage from '../../Base/pages/AddExistingUser.po';
import { AddExistingUserPageData } from '../../Base/pagedata/AddExistingUserPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as addUserPage from '../../Base/pages/AddUser.po';
import { AddUserPageData } from '../../Base/pagedata/AddUserPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let email = faker.internet.email();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials and visit Users page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/users');
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

// Remove existing user
Then('User can see add existing usr button', () => {
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
	addExistingUserPage.clickTableRow(`${firstName} ${lastName}`);
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

And('User can click on cofnrim remove user button', () => {
	addExistingUserPage.clickConfirmRemoveUserBtn();
});
