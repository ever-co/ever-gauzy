import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from './support/pages/AddExistingUser.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

// Target the seeded ADMIN user "Local Admin" (firstName "Local", lastName "Admin"; local.admin@ever.co)
// — NOT the Super Admin. users.component.selectUser() protects SUPER_ADMIN rows: when the logged-in
// user has SUPER_ADMIN_EDIT permission (the e2e logs in as admin@ever.co), selecting a SUPER_ADMIN row
// sets disableButton = true, so the toolbar Remove button stays DISABLED and the remove-confirm dialog
// (nb-card-footer > button[status="danger"]) never opens — exactly the round-3 failure. The ADMIN row
// has no such guard, so its selection enables Remove. "Local Admin" also re-appears in the add-existing
// nb-select afterward: edit-user-mutation._loadUsers() lists tenant users not in THIS org whose role is
// not EMPLOYEE, and the default admins belong to multiple seeded orgs, so removing it from one org
// leaves the tenant user-org record intact. Both the grid row (user.name) and the dropdown option
// ({{ firstName }} {{ lastName }}) render "Local Admin", so the same constant scopes both filters.
const defaultUser = 'Local Admin';

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
