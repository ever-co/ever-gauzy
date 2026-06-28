import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as approvalRequestPage from './support/pages/ApprovalRequest.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { ApprovalRequestPageData } from '../src/support/Base/pagedata/ApprovalRequestPageData';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Approval request test', () => {
	test('Approval request test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add approval policy', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			// Hash-forced navigation: a bare goto() here (right after addEmployee, which ends on
			// /#/pages/employees) is a same-document no-op that leaves the DOM on Manage Employees.
			await approvalRequestPage.gotoApprovals();
			await approvalRequestPage.approvalPolicyButtonVisible();
			await approvalRequestPage.clickApprovalPolicyButton();
			await approvalRequestPage.gridBtnExists();
			await approvalRequestPage.gridBtnClick(1);
			await approvalRequestPage.addApprovalButtonVisible();
			await approvalRequestPage.clickAddApprovalButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(ApprovalRequestPageData.defaultApprovalPolicy);
			await approvalRequestPage.descriptionInputVisible();
			await approvalRequestPage.enterDescriptionInputData(ApprovalRequestPageData.defaultPolicyDescription);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyApprovalPolicyExists(ApprovalRequestPageData.defaultApprovalPolicy);
			await approvalRequestPage.backButtonVisible();
			await approvalRequestPage.clickBackButton();
		});

		await test.step('Should be able to add new approval request', async () => {
			await approvalRequestPage.gridBtnExists();
			await approvalRequestPage.gridBtnClick(1);
			await approvalRequestPage.addApprovalButtonVisible();
			await approvalRequestPage.clickAddApprovalButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(ApprovalRequestPageData.defaultName);
			await approvalRequestPage.minCountInputVisible();
			await approvalRequestPage.enterMinCountInputData(ApprovalRequestPageData.defaultMinCount);
			await approvalRequestPage.approvalPolicyDropdownVisible();
			await approvalRequestPage.clickApprovalPolicyDropdown();
			await approvalRequestPage.selectApprovalPolicyOptionDropdown(ApprovalRequestPageData.defaultApprovalPolicy);
			await approvalRequestPage.selectEmployeeDropdownVisible();
			await approvalRequestPage.clickSelectEmployeeDropdown();
			await approvalRequestPage.selectEmployeeFromDropdown(0);
			await approvalRequestPage.clickKeyboardButtonByKeyCode(9);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyRequestExists(ApprovalRequestPageData.defaultName);
		});

		await test.step('Should be able to edit approval request', async () => {
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.selectTableRow(0);
			await approvalRequestPage.editApprovalRequestButtonVisible();
			await approvalRequestPage.clickEditApprovalRequestButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(ApprovalRequestPageData.editName);
			await approvalRequestPage.minCountInputVisible();
			await approvalRequestPage.enterMinCountInputData(ApprovalRequestPageData.defaultMinCount);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyRequestExists(ApprovalRequestPageData.editName);
		});

		await test.step('Should be able to delete approval request', async () => {
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.selectTableRow(0);
			await approvalRequestPage.deleteApprovalRequestButtonVisible();
			await approvalRequestPage.clickDeleteApprovalRequestButton();
			await approvalRequestPage.confirmDeleteButtonVisible();
			await approvalRequestPage.clickConfirmDeleteButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyElementIsDeleted(ApprovalRequestPageData.editName);
		});
	});
});
