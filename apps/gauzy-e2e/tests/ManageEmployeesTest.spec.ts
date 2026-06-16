import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import { faker } from '@faker-js/faker';
import { ManageEmployeesPageData } from '../src/support/Base/pagedata/ManageEmployeesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

let email = ' ';
let secEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Manage employees test', () => {
	test('Manage employees test', async () => {
		email = faker.internet.exampleEmail();
		secEmail = faker.internet.exampleEmail();
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		email = faker.internet.exampleEmail();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to invite employees', async () => {
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/employees');
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

		await test.step('Should be able to add new employee', async () => {
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
			await manageEmployeesPage.dateInputVisible();
			await manageEmployeesPage.enterDateData();
			await manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
			await manageEmployeesPage.passwordInputVisible();
			await manageEmployeesPage.enterPasswordInputData(password);
			await manageEmployeesPage.tagsDropdownVisible();
			await manageEmployeesPage.clickTagsDropdown();
			await manageEmployeesPage.selectTagFromDropdown(0);
			await manageEmployeesPage.clickCardBody();
			await manageEmployeesPage.imageInputVisible();
			await manageEmployeesPage.enterImageDataUrl(imgUrl);
			await manageEmployeesPage.nextButtonVisible();
			await manageEmployeesPage.clickNextButton();
			await manageEmployeesPage.nextStepButtonVisible();
			await manageEmployeesPage.clickNextStepButton();
			await manageEmployeesPage.lastStepButtonVisible();
			await manageEmployeesPage.clickLastStepButton();
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.verifyEmployeeExists(`${firstName} ${lastName}`);
		});

		await test.step('Should be able to edit employee', async () => {
			await manageEmployeesPage.tableRowVisible();
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

		await test.step('Should be able to end work', async () => {
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.selectTableRow(0);
			await manageEmployeesPage.endWorkButtonVisible();
			await manageEmployeesPage.clickEndWorkButton();
			await manageEmployeesPage.confirmEndWorkButtonVisible();
			await manageEmployeesPage.clickConfirmEndWorkButton();
		});

		await test.step('Should be able to delete employee', async () => {
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.selectTableRow(0);
			await manageEmployeesPage.deleteButtonVisible();
			await manageEmployeesPage.clickDeleteButton();
			await manageEmployeesPage.confirmDeleteButtonVisible();
			await manageEmployeesPage.clickConfirmDeleteButton();
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.verifyEmployeeIsDeleted(`${firstName} ${lastName}`);
		});

		await test.step('Should be able to copy invite link', async () => {
			await manageEmployeesPage.manageInvitesButtonVisible();
			await manageEmployeesPage.clickManageInviteButton();
			await manageEmployeesPage.selectTableRow(0);
			await manageEmployeesPage.copyLinkButtonVisible();
			await manageEmployeesPage.clickCopyLinkButton();
		});

		await test.step('Should be able to resend invite', async () => {
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.selectTableRow(0);
			await manageEmployeesPage.resendInviteButtonVisible();
			await manageEmployeesPage.clickResendInviteButton();
			await manageEmployeesPage.confirmResendInviteButtonVisible();
			await manageEmployeesPage.clickConfirmResendInviteButton();
		});

		await test.step('Should be able to delete invite', async () => {
			await manageEmployeesPage.waitMessageToHide();
			await manageEmployeesPage.selectTableRow(0);
			await manageEmployeesPage.deleteInviteButtonVisible();
			await manageEmployeesPage.clickDeleteInviteButton();
			await manageEmployeesPage.confirmDeleteInviteButtonVisible();
			await manageEmployeesPage.clickConfirmDeleteInviteButton();
		});
	});
});
