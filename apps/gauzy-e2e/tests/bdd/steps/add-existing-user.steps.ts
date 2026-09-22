import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as addExistingUserPage from '../../support/pages/AddExistingUser.po';

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

// SKIPPED — impossible on the default e2e seed, not a test/selector defect.
// The flow removes the seeded "Local Admin" from the org then re-adds it via the "Add Existing" dropdown.
// On the DEFAULT seed there is exactly ONE organization ("Default Company"), so Local Admin belongs to a
// single org; the backend user-organization delete handler HARD-DELETES a user that belongs to only one org
// (it calls userService.delete(userId), not just a membership removal). Once deleted, the user no longer
// exists in the tenant, so edit-user-mutation._loadUsers() (tenant users not in this org, role != EMPLOYEE)
// can never list it again — the add-existing dropdown is empty and the re-add step can never succeed.
// (DEMO=false in e2e, so the separate demo-admin protection is not the cause.) The only faithful way to make
// this pass is to seed a SECOND organization (or give a non-employee user membership in two orgs) so removal
// is a membership-only removal and the user survives — an e2e seed/infra change outside a per-spec fix.
// Tracked for a follow-up: redesign to create a 2nd org and exercise add-existing there. The migration
// itself is complete; the assertion is environment-blocked.
// The scenario carries the @skip tag in add-existing-user.feature to preserve the original test.describe.skip.

When('I add an existing user to the organization', async () => {
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
