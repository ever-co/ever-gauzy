import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationDepartmentsPage from './support/pages/OrganizationDepartments.po';
import { faker } from '@faker-js/faker';
import { OrganizationDepartmentsPageData } from '../src/support/Base/pagedata/OrganizationDepartmentsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';

let email = ' ';
let secEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Organization departments test', () => {
	test('Organization departments test', async () => {
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

		await test.step('Should be able to add new department', async () => {
			await getPage().goto('/#/pages/employees');
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
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/organization/departments');
			await organizationDepartmentsPage.gridBtnExists();
			await organizationDepartmentsPage.gridBtnClick(1);
			await organizationDepartmentsPage.addDepartmentButtonVisible();
			await organizationDepartmentsPage.clickAddDepartmentButton();
			await organizationDepartmentsPage.nameInputVisible();
			await organizationDepartmentsPage.enterNameInputData(
				OrganizationDepartmentsPageData.departmentName
			);
			await organizationDepartmentsPage.selectEmployeeDropdownVisible();
			await organizationDepartmentsPage.clickEmployeeDropdown();
			await organizationDepartmentsPage.selectEmployeeFromDropdown(0);
			await organizationDepartmentsPage.clickKeyboardButtonByKeyCode(9);
			await organizationDepartmentsPage.tagsDropdownVisible();
			await organizationDepartmentsPage.clickTagsDropdown();
			await organizationDepartmentsPage.selectTagFromDropdown(0);
			await organizationDepartmentsPage.clickCardBody();
			await organizationDepartmentsPage.saveDepartmentButtonVisible();
			await organizationDepartmentsPage.clickSaveDepartmentButton();
			await organizationDepartmentsPage.verifyDepartmentExists(
				OrganizationDepartmentsPageData.departmentName
			);
		});

		await test.step('Should be able to edit department', async () => {
			await organizationDepartmentsPage.tableRowVisible();
			await organizationDepartmentsPage.selectTableRow();
			await organizationDepartmentsPage.editButtonVisible();
			await organizationDepartmentsPage.clickEditButton();
			await organizationDepartmentsPage.nameInputVisible();
			await organizationDepartmentsPage.enterNameInputData(
				OrganizationDepartmentsPageData.departmentName
			);
			await organizationDepartmentsPage.saveDepartmentButtonVisible();
			await organizationDepartmentsPage.clickSaveDepartmentButton();
		});

		await test.step('Should be able to delete department', async () => {
			await organizationDepartmentsPage.selectTableRow();
			await organizationDepartmentsPage.deleteButtonVisible();
			await organizationDepartmentsPage.clickDeleteButton();
			await organizationDepartmentsPage.confirmDeleteButtonVisible();
			await organizationDepartmentsPage.clickConfirmDeleteButton();
			await organizationDepartmentsPage.verifyDepartmentIsDeleted(
				OrganizationDepartmentsPageData.departmentName
			);
		});
	});
});
