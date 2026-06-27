import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from './support/pages/AddExistingUser.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

// The seeded admin renders as "Admin Local" in the grid row (ga-picture-name-tags / avatar) AND in
// the nb-select option ({{ firstName }} {{ lastName }}). The pagedata constant still said the stale
// "Local Admin", so the row/option text filters matched nothing and the click timed out. Pagedata is
// read-only for this fix, so the corrected name lives here. (Both contexts use the same rendered name.)
const defaultUser = 'Admin Local';

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
