import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as removeUserPage from '../../support/pages/RemoveUser.po';
import * as addUserPage from '../../support/pages/AddUser.po';
import { faker } from '@faker-js/faker';
import { AddUserPageData } from '../../../src/support/Base/pagedata/AddUserPageData';

// Converted 1:1 from the plain RemoveUserTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The faker-generated user fields are
// shared across both steps, so they live at module scope and are initialised at the start of the first
// step. The `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let email = ' ';
let password = ' ';
let imgUrl = ' ';

When('I add a user to remove', async () => {
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
	// Pollution-safe: the shared serial DB makes the users grid paginate ("1 - 10 of N"), so a
	// just-added user can land on page 2 and never render. Filter the grid by the unique full name
	// so it is the only data row on page 1 before verifying it exists (and for the remove step).
	await removeUserPage.filterByName(`${firstName} ${lastName}`);
	await addUserPage.verifyUserExists(`${firstName} ${lastName}`);
});

When('I remove the user', async () => {
	await removeUserPage.gridButtonVisible();
	await removeUserPage.clickGridButton();
	// Re-apply the Full Name filter (idempotent) so the user we created is the only data row even
	// if the grid re-rendered, then select that specific row to enable the toolbar Remove button.
	await removeUserPage.filterByName(`${firstName} ${lastName}`);
	await removeUserPage.tableBodyExists();
	await removeUserPage.clickTableRow(`${firstName} ${lastName}`);
	await removeUserPage.removeButtonVisible();
	await removeUserPage.clickRemoveButton();
	await removeUserPage.confirmRemoveBtnVisible();
	await removeUserPage.clickConfirmRemoveButton();
	await removeUserPage.waitMessageToHide();
	await removeUserPage.verifyUserIsDeleted(`${firstName} ${lastName}`);
});
