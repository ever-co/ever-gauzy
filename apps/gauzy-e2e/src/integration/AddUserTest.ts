import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addUserPage from '../support/Base/pages/AddUser.po';
import * as faker from 'faker';
import { AddUserPageData } from '../support/Base/pagedata/AddUserPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let email = ' ';
let password = ' ';
let imgUrl = ' ';

describe('Add user test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		email = faker.internet.email();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new user', () => {
		cy.visit('/#/pages/users');
		addUserPage.addUserButtonVisible();
		addUserPage.clickAddUserButton();
		addUserPage.firstNameInputVisible();
		addUserPage.enterFirstNameData(firstName);
		addUserPage.lastNameInputVisible();
		addUserPage.enterLastNameData(lastName);
		addUserPage.usernameInputVisible();
		addUserPage.enterUsernameData(username);
		addUserPage.emailInputVisible();
		addUserPage.enterEmailData(email);
		addUserPage.selectUserRoleVisible();
		addUserPage.selectUserRoleData(AddUserPageData.role);
		addUserPage.passwordInputVisible();
		addUserPage.enterPasswordInputData(password);
		addUserPage.imageInputVisible();
		addUserPage.enterImageDataUrl(imgUrl);
		addUserPage.confirmAddButtonVisible();
		addUserPage.clickConfirmAddButton();
	});
});
