import * as loginPage from '../../Base/pages/Login.po';
import * as editProfilePage from '../../Base/pages/EditProfile.po';
import { EditProfilePageData } from '../../Base/pagedata/EditProfilePageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import { CustomCommands } from '../../commands';
import * as addUserPage from '../../Base/pages/AddUser.po';
import { AddUserPageData } from '../../Base/pagedata/AddUserPageData';
import { faker } from '@faker-js/faker';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.person.firstName();
let lastName = faker.person.lastName();
let username = faker.internet.userName();
let email = faker.internet.exampleEmail();
let password = faker.internet.password();
let editFirstName = faker.person.firstName();
let editLastName = faker.person.lastName();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
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

// Logout
When('User click on username', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	dashboardPage.clickUserName();
});

Then('User can see and click on logout button', () => {
	logoutPage.clickLogoutButton();
});

And('User can see again login text', () => {
	loginPage.verifyLoginText();
});

// Login with new credentials
And('User can enter value for login email', () => {
	loginPage.clearEmailField();
	loginPage.enterEmail(email);
});

And('User can see login password input field', () => {
	loginPage.clearPasswordField();
	loginPage.enterPassword(password);
});

When('User click on login button', () => {
	loginPage.clickLoginButton();
});

Then('User can see home page', () => {
	dashboardPage.verifyCreateButton();
});

And('User can visit his profile page', () => {
	cy.visit('/#/pages/auth/profile');
});

// Edit user profile
And('User can see edit first name input field', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	editProfilePage.firstNameInputVisible();
});

And('User can enter value for editing first name', () => {
	editProfilePage.enterFirstNameData(editFirstName);
});

And('User can see edit last name input field', () => {
	editProfilePage.lastNameInputVisible();
});

And('User can enter value for editing last name', () => {
	editProfilePage.enterLastNameData(editLastName);
});

And('User can see edit password input field', () => {
	editProfilePage.passwordInputVisible();
});

And('User can enter value for editing password', () => {
	editProfilePage.enterPasswordData(password);
});

And('User can see edit repeat password input field', () => {
	editProfilePage.repeatPasswordInputVisible();
});

And('User can enter value for editing repeat password', () => {
	editProfilePage.enterRepeatPasswordData(password);
});

And('User can see edit email input field', () => {
	editProfilePage.emailInputVisible();
});

And('User can enter value for editing email', () => {
	editProfilePage.enterEmailData(email);
});

And('User can see language select', () => {
	editProfilePage.languageSelectVisible();
});

And('User can select language', () => {
	editProfilePage.chooseLanguage(EditProfilePageData.preferredLanguage);
});

And('User can see save button', () => {
	editProfilePage.saveBtnExists();
});

When('User click on save button', () => {
	editProfilePage.saveBtnClick();
});

Then('Notification message will appear', () => {
	addUserPage.waitMessageToHide();
});
