import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as editUserPage from '../../support/pages/EditUser.po';
import * as addUserPage from '../../support/pages/AddUser.po';
import { faker } from '@faker-js/faker';
import { EditUserPageData } from '../../../src/support/Base/pagedata/EditUserPageData';
import { AddUserPageData } from '../../../src/support/Base/pagedata/AddUserPageData';

// Converted 1:1 from the plain EditUserTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The faker-generated values are
// shared across both steps, so they live at module scope and are initialised at the start of the first
// step. The `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let email = ' ';
let imgUrl = ' ';
let editFirstName = ' ';
let editLastName = ' ';

When('I add a user to edit', async () => {
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	email = faker.internet.exampleEmail();
	password = faker.internet.password();
	imgUrl = faker.image.avatar();
	editFirstName = faker.person.firstName();
	editLastName = faker.person.lastName();

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
	// Pollution-safe: the shared serial DB makes the users grid paginate ("1 - 10 of N"), so the user
	// just added lands on page 2 and never renders. Filter the grid by the unique full name so it is
	// the only data row on page 1 before verifying it exists (same as remove-user).
	await editUserPage.filterByName(`${firstName} ${lastName}`);
	await addUserPage.verifyUserExists(`${firstName} ${lastName}`);
});

When('I edit the user', async () => {
	await editUserPage.gridButtonVisible();
	await editUserPage.clickGridButton();
	// Re-apply the filter (idempotent) so the row we select is the one this spec created.
	await editUserPage.filterByName(`${firstName} ${lastName}`);
	await editUserPage.tableRowVisible();
	await editUserPage.selectTableRow(`${firstName} ${lastName}`);
	await editUserPage.editButtonVisible();
	await editUserPage.clickEditButton();
	await editUserPage.orgTabButtonVisible();
	await editUserPage.clickOrgTabButton(1);
	await editUserPage.addOrgButtonVisible();
	await editUserPage.clickAddOrgButton();
	await editUserPage.selectOrgDropdownVisible();
	await editUserPage.clickSelectOrgDropdown();
	await editUserPage.clickSelectOrgDropdownOption();
	await editUserPage.saveSelectedOrgButtonVisible();
	await editUserPage.clickSaveSelectedOrgButton();
	await editUserPage.removeOrgButtonVisible();
	await editUserPage.clickRemoveOrgButton();
	await editUserPage.confirmRemoveBtnVisible();
	await editUserPage.clickConfirmRemoveButton();
	await editUserPage.clickOrgTabButton(0);
	await editUserPage.firstNameInputVisible();
	await editUserPage.lastNameInputVisible();
	await editUserPage.passwordInputVisible();
	await editUserPage.repeatPasswordInputVisible();
	await editUserPage.emailInputVisible();
	await editUserPage.tagsMultiSelectVisible();
	await editUserPage.selectRoleVisible();
	await editUserPage.languageSelectVisible();
	await editUserPage.saveBtnExists();
	await editUserPage.enterFirstNameData(editFirstName);
	await editUserPage.enterLastNameData(editLastName);
	await editUserPage.enterPasswordData(password);
	await editUserPage.enterRepeatPasswordData(password);
	await editUserPage.enterEmailData(email);
	await editUserPage.clickKeyboardButtonByKeyCode(9);
	await editUserPage.chooseRoleSelectData(EditUserPageData.role);
	await editUserPage.chooseLanguage(EditUserPageData.preferredLanguage);
	await editUserPage.saveBtnClick();
	await addUserPage.waitMessageToHide();
	// The rename means the grid's Full Name filter (still holding the OLD name) now excludes the very
	// row we are about to assert on — re-filter on the new name before verifying.
	await editUserPage.filterByName(`${editFirstName} ${editLastName}`);
	await addUserPage.verifyUserExists(`${editFirstName} ${editLastName}`);
});
