import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addUserPage from './support/pages/AddUser.po';
import { faker } from '@faker-js/faker';
import { AddUserPageData } from '../src/support/Base/pagedata/AddUserPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let email = ' ';
let password = ' ';
let imgUrl = ' ';

test.describe('Add user test', () => {
	test('Add user test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		email = faker.internet.exampleEmail();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new user', async () => {
			await getPage().goto('/#/pages/users');
			await addUserPage.addUserButtonVisible();
			await addUserPage.clickAddUserButton();
			await addUserPage.firstNameInputVisible();
			await addUserPage.enterFirstNameData(firstName);
			await addUserPage.lastNameInputVisible();
			await addUserPage.enterLastNameData(lastName);
			await addUserPage.usernameInputVisible();
			await addUserPage.enterUsernameData(username);
			await addUserPage.emailInputVisible();
			await addUserPage.enterEmailData(email);
			await addUserPage.selectUserRoleVisible();
			await addUserPage.selectUserRoleData(AddUserPageData.role);
			await addUserPage.passwordInputVisible();
			await addUserPage.enterPasswordInputData(password);
			await addUserPage.imageInputVisible();
			await addUserPage.enterImageDataUrl(imgUrl);
			await addUserPage.confirmAddButtonVisible();
			await addUserPage.clickConfirmAddButton();
			await addUserPage.waitMessageToHide();
			await addUserPage.verifyUserExists(`${firstName} ${lastName}`);
		});
	});
});
