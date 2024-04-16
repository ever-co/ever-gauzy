import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as approvalRequestPage from '../support/Base/pages/ApprovalRequest.po';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { ApprovalRequestPageData } from '../support/Base/pagedata/ApprovalRequestPageData';
import { CustomCommands } from '../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Approval request test', () => {
	before(() => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add approval policy', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/employees/approvals');
		approvalRequestPage.approvalPolicyButtonVisible();
		approvalRequestPage.clickApprovalPolicyButton();
		approvalRequestPage.gridBtnExists();
		approvalRequestPage.gridBtnClick(1);
		approvalRequestPage.addApprovalButtonVisible();
		approvalRequestPage.clickAddApprovalButton();
		approvalRequestPage.nameInputVisible();
		approvalRequestPage.enterNameInputData(
			ApprovalRequestPageData.defaultApprovalPolicy
		);
		approvalRequestPage.descriptionInputVisible();
		approvalRequestPage.enterDescriptionInputData(
			ApprovalRequestPageData.defaultPolicyDescription
		);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.verifyApprovalPolicyExists(
			ApprovalRequestPageData.defaultApprovalPolicy
		);
		approvalRequestPage.backButtonVisible();
		approvalRequestPage.clickBackButton();
	});
	it('Should be able to add new approval request', () => {
		approvalRequestPage.gridBtnExists();
		approvalRequestPage.gridBtnClick(1);
		approvalRequestPage.addApprovalButtonVisible();
		approvalRequestPage.clickAddApprovalButton();
		approvalRequestPage.nameInputVisible();
		approvalRequestPage.enterNameInputData(
			ApprovalRequestPageData.defaultName
		);
		approvalRequestPage.minCountInputVisible();
		approvalRequestPage.enterMinCountInputData(
			ApprovalRequestPageData.defaultMinCount
		);
		approvalRequestPage.approvalPolicyDropdownVisible();
		approvalRequestPage.clickApprovalPolicyDropdown();
		approvalRequestPage.selectApprovalPolicyOptionDropdown(
			ApprovalRequestPageData.defaultApprovalPolicy
		);
		approvalRequestPage.selectEmployeeDropdownVisible();
		approvalRequestPage.clickSelectEmployeeDropdown();
		approvalRequestPage.selectEmployeeFromDropdown(0);
		approvalRequestPage.clickKeyboardButtonByKeyCode(9);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.verifyRequestExists(
			ApprovalRequestPageData.defaultName
		);
	});
	it('Should be able to edit approval request', () => {
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.editApprovalRequestButtonVisible();
		approvalRequestPage.clickEditApprovalRequestButton();
		approvalRequestPage.nameInputVisible();
		approvalRequestPage.enterNameInputData(
			ApprovalRequestPageData.editName
		);
		approvalRequestPage.minCountInputVisible();
		approvalRequestPage.enterMinCountInputData(
			ApprovalRequestPageData.defaultMinCount
		);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.verifyRequestExists(
			ApprovalRequestPageData.editName
		);
	});
	it('Should be able to delete approval request', () => {
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.deleteApprovalRequestButtonVisible();
		approvalRequestPage.clickDeleteApprovalRequestButton();
		approvalRequestPage.waitMessageToHide();
		approvalRequestPage.verifyElementIsDeleted();
	});
});
