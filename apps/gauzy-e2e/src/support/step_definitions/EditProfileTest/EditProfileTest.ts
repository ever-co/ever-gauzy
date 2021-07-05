import * as loginPage from '../../Base/pages/Login.po';
import * as editProfilePage from '../../Base/pages/EditProfile.po';
import { EditProfilePageData } from '../../Base/pagedata/EditProfilePageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let email = faker.internet.email();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/users');
});

// Add new user


// Edit user
Then('User can navigate user profile page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/auth/profile');
})

And('User can see first name input field', () => {
	editProfilePage.firstNameInputVisible();
})

And('User can enter value for first name', () => {
	editProfilePage.enterFirstNameData(EditProfilePageData.firstName);
})

And('User can see last name input field', () => {
	editProfilePage.lastNameInputVisible();
})

And('User can enter value for last name', () => {
	editProfilePage.enterLastNameData(EditProfilePageData.lastName);
})

And('User can see password input field', () => {
	editProfilePage.passwordInputVisible();
})

And('User can enter value for password', () => {
	editProfilePage.enterPasswordData(EditProfilePageData.password);
})

And('User can see repeat password input field', () => {
	editProfilePage.repeatPasswordInputVisible();
})

And('User can enter value for repeat password', () => {
	editProfilePage.enterRepeatPasswordData(EditProfilePageData.password);
})

And('User can see email input field', () => {
	editProfilePage.emailInputVisible();
})

And('User can enter value for email', () => {
	editProfilePage.enterEmailData(EditProfilePageData.email);
})

And('User can see language select', () => {
	editProfilePage.languageSelectVisible();
})

And('User can select language', () => {
	editProfilePage.chooseLanguage(EditProfilePageData.preferredLanguage);
})

And('User can see save button', () => {
	editProfilePage.saveBtnExists();
})

When('User click on save button', () => {
	editProfilePage.saveBtnClick();
})

describe('Edit user profile test', () => {

	it('Should be able to edit user profile info', () => {
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
	});

	it('Should be able to logout', () => {
		dashboardPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	});

	it('Should be able to login with new credentials', () => {
		loginPage.verifyLoginButton();
		loginPage.clearEmailField();
		loginPage.enterEmail(EditProfilePageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(EditProfilePageData.password);
		loginPage.clickLoginButton();
		dashboardPage.verifyCreateButton();
	});
});
