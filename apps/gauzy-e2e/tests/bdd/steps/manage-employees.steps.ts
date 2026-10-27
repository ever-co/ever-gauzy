import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';
import { faker } from '@faker-js/faker';
import { ManageEmployeesPageData } from '../../../src/support/Base/pagedata/ManageEmployeesPageData';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain ManageEmployeesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts. Cross-step faker state is hoisted to module scope and
// initialised at the start of the first step.

let email = ' ';
let secEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';

When('I invite employees', async () => {
	email = faker.internet.exampleEmail();
	secEmail = faker.internet.exampleEmail();
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	email = faker.internet.exampleEmail();
	password = faker.internet.password();
	employeeEmail = faker.internet.exampleEmail();

	await CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
	await CustomCommands.addTag(
		organizationTagsUserPage,
		OrganizationTagsPageData
	);
	// A bare hash goto issued right after addTag (which ends on /#/pages/organization/tags) can be
	// a same-document NO-OP — the Angular hash-router never re-renders and we stay on the tags grid,
	// so the employees toolbar (Invite/Add) is never found. Force the hash + settle, then wait for
	// the Manage Employees header before interacting.
	await getPage().goto('/#/pages/employees');
	await getPage().evaluate(() => {
		if (!location.hash.includes('/pages/employees')) location.hash = '#/pages/employees';
	});
	await getPage().waitForTimeout(800);
	await getPage()
		.locator('ngx-header-title:has-text("Manage Employees"), h4:has-text("Manage Employees")')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => {});
	await manageEmployeesPage.gridBtnExists();
	await manageEmployeesPage.gridBtnClick(1);
	await manageEmployeesPage.inviteButtonVisible();
	await manageEmployeesPage.clickInviteButton();
	await manageEmployeesPage.emailInputVisible();
	await manageEmployeesPage.enterEmailData(email);
	await manageEmployeesPage.enterEmailData(secEmail);
	await manageEmployeesPage.dateInputVisible();
	await manageEmployeesPage.enterDateData();
	await manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
	await manageEmployeesPage.selectProjectDropdownVisible();
	await manageEmployeesPage.clickProjectDropdown();
	await manageEmployeesPage.selectProjectFromDropdown(
		ManageEmployeesPageData.defaultProject
	);
	await manageEmployeesPage.sendInviteButtonVisible();
	await manageEmployeesPage.clickSendInviteButton();
});

When('I add a new employee', async () => {
	await manageEmployeesPage.addEmployeeButtonVisible();
	await manageEmployeesPage.clickAddEmployeeButton();
	await manageEmployeesPage.firstNameInputVisible();
	await manageEmployeesPage.enterFirstNameData(firstName);
	await manageEmployeesPage.lastNameInputVisible();
	await manageEmployeesPage.enterLastNameData(lastName);
	await manageEmployeesPage.usernameInputVisible();
	await manageEmployeesPage.enterUsernameData(username);
	await manageEmployeesPage.employeeEmailInputVisible();
	await manageEmployeesPage.enterEmployeeEmailData(employeeEmail);
	await manageEmployeesPage.employeeDateInputVisible();
	await manageEmployeesPage.enterEmployeeDateData();
	await manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
	await manageEmployeesPage.passwordInputVisible();
	await manageEmployeesPage.enterPasswordInputData(password);
	await manageEmployeesPage.tagsDropdownVisible();
	await manageEmployeesPage.clickTagsDropdown();
	await manageEmployeesPage.selectTagFromDropdown(0);
	// Close the tags panel with an inert in-dialog click (the dialog title): the old card-body centre
	// click lands on a form control of the redesigned, much taller dialog (#10336).
	await manageEmployeesPage.closeEmployeeDialogDropdowns();
	// The picture: the image-URL field is gone (#10336) — the avatar is uploaded as a file now. That
	// also removes the old reason this step skipped the picture (an unloadable external URL flipped the
	// form invalid): an uploaded asset's imageUrl control is disabled, so it can't invalidate the form.
	await manageEmployeesPage.uploadEmployeeImage();
	// Re-fill the required step-1 fields (firstName/email/password) as the LAST step-1 action so
	// the form is reliably valid before advancing. If the password fill earlier landed on the
	// date-picker overlay (or an earlier valueChanges re-rendered an input), the form would stay
	// invalid and the stepper would force-advance into an empty createBulk([]) — the empty grid.
	await manageEmployeesPage.reEnterRequiredStep1Fields(firstName, employeeEmail, password);
	await manageEmployeesPage.nextButtonVisible();
	await manageEmployeesPage.clickNextButton();
	await manageEmployeesPage.nextStepButtonVisible();
	await manageEmployeesPage.clickNextStepButton();
	await manageEmployeesPage.lastStepButtonVisible();
	await manageEmployeesPage.clickLastStepButton();
	await manageEmployeesPage.waitMessageToHide();
	// Same pollution guard the edit/end-work/delete steps below already use: the employees grid pages
	// at 10 and the seed alone brings 18 employees, so the one just added is not on page 1.
	await manageEmployeesPage.searchEmployeeByName(`${firstName} ${lastName}`);
	await manageEmployeesPage.verifyEmployeeExists(`${firstName} ${lastName}`);
});

When('I edit the employee', async () => {
	await manageEmployeesPage.tableRowVisible();
	// Fresh seed renders Super Admin + Default Employee ahead of the new employee, so filter the
	// grid by name to make the created employee row 0 before selecting it.
	await manageEmployeesPage.searchEmployeeByName(`${firstName} ${lastName}`);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.editButtonVisible();
	await manageEmployeesPage.clickEditButton();
	await manageEmployeesPage.usernameEditInputVisible();
	await manageEmployeesPage.enterUsernameEditInputData(username);
	await manageEmployeesPage.emailEditInputVisible();
	await manageEmployeesPage.enterEmailEditInputData(email);
	await manageEmployeesPage.firstNameEditInputVisible();
	await manageEmployeesPage.enterFirstNameEditInputData(firstName);
	await manageEmployeesPage.lastNameEditInputVisible();
	await manageEmployeesPage.enterLastNameEditInputData(lastName);
	await manageEmployeesPage.preferredLanguageDropdownVisible();
	await manageEmployeesPage.clickPreferredLanguageDropdown();
	await manageEmployeesPage.selectLanguageFromDropdown(
		ManageEmployeesPageData.preferredLanguage
	);
	await manageEmployeesPage.saveEditButtonVisible();
	await manageEmployeesPage.clickSaveEditButton();
	await manageEmployeesPage.backButtonVisible();
	await manageEmployeesPage.clickBackButton();
});

When("I end the employee's work", async () => {
	await manageEmployeesPage.waitMessageToHide();
	// Back-navigation from edit re-inits the grid (filter cleared), so re-filter by name to keep
	// the created employee as row 0 (a seeded admin shows "Not Started" with no End Work button).
	await manageEmployeesPage.searchEmployeeByName(`${firstName} ${lastName}`);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.endWorkButtonVisible();
	await manageEmployeesPage.clickEndWorkButton();
	await manageEmployeesPage.confirmEndWorkButtonVisible();
	await manageEmployeesPage.clickConfirmEndWorkButton();
});

When('I delete the employee', async () => {
	await manageEmployeesPage.waitMessageToHide();
	// Re-filter by name so the created employee is row 0 for the delete selection.
	await manageEmployeesPage.searchEmployeeByName(`${firstName} ${lastName}`);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.deleteButtonVisible();
	await manageEmployeesPage.clickDeleteButton();
	await manageEmployeesPage.confirmDeleteButtonVisible();
	await manageEmployeesPage.clickConfirmDeleteButton();
	await manageEmployeesPage.waitMessageToHide();
	await manageEmployeesPage.verifyEmployeeIsDeleted(`${firstName} ${lastName}`);
});

When('I copy the employee invite link', async () => {
	await manageEmployeesPage.manageInvitesButtonVisible();
	await manageEmployeesPage.clickManageInviteButton();
	// Filter the invites grid by this spec's invited email so row 0 is OUR invite (INVITED status,
	// so Copy/Resend render), not an earlier spec's polluting invite.
	await manageEmployeesPage.searchInviteByEmail(email);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.copyLinkButtonVisible();
	await manageEmployeesPage.clickCopyLinkButton();
});

When('I resend the employee invite', async () => {
	await manageEmployeesPage.waitMessageToHide();
	await manageEmployeesPage.searchInviteByEmail(email);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.resendInviteButtonVisible();
	await manageEmployeesPage.clickResendInviteButton();
	await manageEmployeesPage.confirmResendInviteButtonVisible();
	await manageEmployeesPage.clickConfirmResendInviteButton();
});

When('I delete the employee invite', async () => {
	await manageEmployeesPage.waitMessageToHide();
	await manageEmployeesPage.searchInviteByEmail(email);
	await manageEmployeesPage.selectTableRow(0);
	await manageEmployeesPage.deleteInviteButtonVisible();
	await manageEmployeesPage.clickDeleteInviteButton();
	await manageEmployeesPage.confirmDeleteInviteButtonVisible();
	// Type-to-confirm (#10761): the dialog's Delete is enabled only once the invitee's email is typed.
	await manageEmployeesPage.enterDeleteInviteConfirmation(email);
	await manageEmployeesPage.clickConfirmDeleteInviteButton();
});
