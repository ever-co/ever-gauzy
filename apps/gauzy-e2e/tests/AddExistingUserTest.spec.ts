import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from './support/pages/AddExistingUser.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

// The seeded admin renders as "Super Admin" in the grid row (ga-picture-name-tags / avatar uses
// user.name) AND in the nb-select option ({{ firstName }} {{ lastName }}) — confirmed against the
// failure DOM (row "Super Admin admin@ever.co SUPER ADMIN"). The pagedata constant still said the
// stale "Local Admin" and a prior pass guessed "Admin Local"; both matched nothing, so the row/option
// text filters never resolved and the click timed out. Pagedata is read-only for this fix, so the
// corrected name lives here. (Both contexts render the same name for this user.)
const defaultUser = 'Super Admin';

test.describe('Add existing user/s test', () => {
	test('Add existing user/s test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add existing user/s', async () => {
			await getPage().goto('/#/pages/users');
			await addExistingUserPage.addExistingUsersButtonVisible();
			await addExistingUserPage.clickAddExistingUsersButton();
			await addExistingUserPage.cancelButtonVisible();
			await addExistingUserPage.clickCancelButton();
			await addExistingUserPage.tableBodyExists();
			await addExistingUserPage.clickTableRow(defaultUser);
			await addExistingUserPage.removeUserButtonVisible();
			await addExistingUserPage.clickRemoveUserButton();
			await addExistingUserPage.confirmRemoveUserBtnVisible();
			await addExistingUserPage.clickConfirmRemoveUserBtn();
			await addExistingUserPage.clickAddExistingUsersButton();
			await addExistingUserPage.usersMultiSelectVisible();
			await addExistingUserPage.clickUsersMultiSelect();
			await addExistingUserPage.selectUsersFromDropdown(defaultUser);
			await addExistingUserPage.clickKeyboardButtonByKeyCode(9);
			await addExistingUserPage.saveUsersButtonVisible();
			await addExistingUserPage.clickSaveUsersButton();
		});
	});
});
