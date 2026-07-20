import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as addUserPage from '../../support/pages/AddUser.po';
import { faker } from '@faker-js/faker';
import { AddUserPageData } from '../../../src/support/Base/pagedata/AddUserPageData';

// Converted 1:1 from the plain AddUserTest.spec.ts: the single test() -> one Scenario, the single
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The faker-generated cross-step vars
// are declared at module scope and initialised at the start of the first (only) step. The `Given I am
// logged in as the default user` Background step is defined once in common.steps.ts.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let email = ' ';
let password = ' ';
let imgUrl = ' ';

When('I add a new user', async () => {
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	email = faker.internet.exampleEmail();
	password = faker.internet.password();
	imgUrl = faker.image.avatar();

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
