import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationDepartmentsPage from '../support/Base/pages/OrganizationDepartments.po';
import * as faker from 'faker';
import { OrganizationDepartmentsPageData } from '../support/Base/pagedata/OrganizationDepartmentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let secEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Organization departments test', () => {
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

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new department', () => {
		cy.visit('/#/pages/employees');
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
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/organization/departments');
		organizationDepartmentsPage.gridBtnExists();
		organizationDepartmentsPage.gridBtnClick(1);
		organizationDepartmentsPage.addDepaartmentButtonVisible();
		organizationDepartmentsPage.clickAddDepartmentButton();
		organizationDepartmentsPage.nameInputVisible();
		organizationDepartmentsPage.enterNameInputData(
			OrganizationDepartmentsPageData.departmentName
		);
		organizationDepartmentsPage.selectEmployeeDropdownVisible();
		organizationDepartmentsPage.clickEmployeeDropdown();
		organizationDepartmentsPage.selectEmployeeFromDrodpwon(0);
		organizationDepartmentsPage.clickKeyboardButtonByKeyCode(9);
		organizationDepartmentsPage.tagsDropdownVisible();
		organizationDepartmentsPage.clickTagsDropdwon();
		organizationDepartmentsPage.selectTagFromDropdown(0);
		organizationDepartmentsPage.clickCardBody();
		organizationDepartmentsPage.saveDepartmentButtonVisible();
		organizationDepartmentsPage.clickSaveDepartmentButton();
		organizationDepartmentsPage.verifyDepartmentExists(
			OrganizationDepartmentsPageData.departmentName
		);
	});
	it('Should be able to edit department', () => {
		organizationDepartmentsPage.tableRowVisible();
		organizationDepartmentsPage.selectTableRow(0);
		organizationDepartmentsPage.editButtonVisible();
		organizationDepartmentsPage.clickEditButton();
		organizationDepartmentsPage.nameInputVisible();
		organizationDepartmentsPage.enterNameInputData(
			OrganizationDepartmentsPageData.departmentName
		);
		organizationDepartmentsPage.saveDepartmentButtonVisible();
		organizationDepartmentsPage.clickSaveDepartmentButton();
	});
	it('Should be able to delete department', () => {
		organizationDepartmentsPage.selectTableRow(0);
		organizationDepartmentsPage.deleteButtonVisible();
		organizationDepartmentsPage.clickDeleteButton();
		organizationDepartmentsPage.confirmDeleteButtonVisible();
		organizationDepartmentsPage.clickConfirmDeleteButton();
		organizationDepartmentsPage.verifyDepartmentIsDeleted(
			OrganizationDepartmentsPageData.departmentName
		);
	});
});
