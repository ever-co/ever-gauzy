import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import * as faker from 'faker';
import { ManageEmployeesPageData } from '../support/Base/pagedata/ManageEmployeesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { manageCategoriesButtonVisible } from '../support/Base/pages/Expenses.po';

let email = ' ';
let secEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Manage employees test', () => {
	before(() => {
		email = faker.internet.email();
		secEmail = faker.internet.email();
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		email = faker.internet.email();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should be able to invite employees', () => {
		cy.visit('/#/pages/organization/projects');
		addTaskPage.requestProjectButtonVisible();
		addTaskPage.clickRequestProjectButton();
		addTaskPage.projectNameInputVisible();
		addTaskPage.enterProjectNameInputData(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.saveProjectButtonVisible();
		addTaskPage.clickSaveProjectButton();
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
		cy.visit('/#/pages/employees');
		manageEmployeesPage.gridBtnExists();
		manageEmployeesPage.gridBtnClick(1);
		manageEmployeesPage.inviteButtonVisible();
		manageEmployeesPage.clickInviteButton();
		manageEmployeesPage.emailInputVisible();
		manageEmployeesPage.enterEmailData(email);
		manageEmployeesPage.enterEmailData(secEmail);
		manageEmployeesPage.dateInputVisible();
		manageEmployeesPage.enterDateData();
		manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
		manageEmployeesPage.selectProjectDropdownVisible();
		manageEmployeesPage.clickProjectDropdown();
		manageEmployeesPage.selectProjectFromDropdown(
			ManageEmployeesPageData.defaultProject
		);
		manageEmployeesPage.sendInviteButtonVisible();
		manageEmployeesPage.clickSendInviteButton();
	});
	it('Should be able to add new employee', () => {
		manageEmployeesPage.addEmployeeButtonVisible();
		manageEmployeesPage.clickAddEmployeeButton();
		manageEmployeesPage.firstNameInputVisible();
		manageEmployeesPage.enterFirstNameData(firstName);
		manageEmployeesPage.lastNameInputVisible();
		manageEmployeesPage.enterLastNameData(lastName);
		manageEmployeesPage.usernameInputVisible();
		manageEmployeesPage.enterUsernameData(username);
		manageEmployeesPage.employeeEmailInputVisible();
		manageEmployeesPage.enterEmployeeEmailData(employeeEmail);
		manageEmployeesPage.dateInputVisible();
		manageEmployeesPage.enterDateData();
		manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
		manageEmployeesPage.passwordInputVisible();
		manageEmployeesPage.enterPasswordInputData(password);
		manageEmployeesPage.tagsDropdownVisible();
		manageEmployeesPage.clickTagsDropdwon();
		manageEmployeesPage.selectTagFromDropdown(0);
		manageEmployeesPage.clickCardBody();
		manageEmployeesPage.imageInputVisible();
		manageEmployeesPage.enterImageDataUrl(imgUrl);
		manageEmployeesPage.nextButtonVisible();
		manageEmployeesPage.clickNextButton();
		manageEmployeesPage.nextStepButtonVisible();
		manageEmployeesPage.clickNextStepButton();
		manageEmployeesPage.lastStepButtonVisible();
		manageEmployeesPage.clickLastStepButton();
	});
	it('Should be able to edit employee', () => {
		manageEmployeesPage.tableRowVisible();
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.editButtonVisible();
		manageEmployeesPage.clickEditButton();
		manageEmployeesPage.usernameEditInputVisible();
		manageEmployeesPage.enterUsernameEditInputData(username);
		manageEmployeesPage.emailEditInputVisible();
		manageEmployeesPage.enterEmailEditInputData(email);
		manageEmployeesPage.firstNameEditInputVisible();
		manageEmployeesPage.enterFirstNameEditInputData(firstName);
		manageEmployeesPage.lastNameEditInputVisible();
		manageEmployeesPage.enterLastNameEditInputData(lastName);
		manageEmployeesPage.preferedLanguageDropdownVisible();
		manageEmployeesPage.clickPreferedLanguageDropdown();
		manageEmployeesPage.selectLanguageFromDropdown(
			ManageEmployeesPageData.preferedLanguage
		);
		manageEmployeesPage.saveEditButtonVisible();
		manageEmployeesPage.clickSaveEditButton();
		manageEmployeesPage.backButtonVisible();
		manageEmployeesPage.clickBackButton();
	});
	it('Should be able to end work', () => {
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.endWorkButtonVisible();
		manageEmployeesPage.clickEndWorkButton();
		manageEmployeesPage.confirmEndWorkButtonVisible();
		manageEmployeesPage.clickConfirmEndWorkButton();
	});
	it('Should be able to delete employee', () => {
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.deleteButtonVisible();
		manageEmployeesPage.clickDeleteButton();
		manageEmployeesPage.confirmDeleteButtonVisible();
		manageEmployeesPage.clickConfirmDeleteButton();
	});
	it('Should be able to copy invite link', () => {
		manageEmployeesPage.manageInvitesButtonVisible();
		manageEmployeesPage.clickManageInviteButton();
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.copyLinkButtonVisible();
		manageEmployeesPage.clickCopyLinkButton();
	});
	it('Should be able to resend invite', () => {
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.resendInviteButtonVisible();
		manageEmployeesPage.clickResendInviteButton();
		manageEmployeesPage.confirmResendInviteButtonVisible();
		manageEmployeesPage.clickConfirmResendInviteButton();
	});
	it('Should be able to delete invite', () => {
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.selectTableRow(0);
		manageEmployeesPage.deleteInviteButtonVisible();
		manageEmployeesPage.clickDeleteInviteButton();
		manageEmployeesPage.confirmDeleteInviteButtonVisible();
		manageEmployeesPage.clickConfirmDeleteInviteButton();
	});
});
