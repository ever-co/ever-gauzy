import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as approvalRequestPage from '../support/Base/pages/ApprovalRequest.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { ApprovalRequestPageData } from '../support/Base/pagedata/ApprovalRequestPageData';

describe('Approval request test', () => {
	before(() => {
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
	it('Should be able to add approval policy', () => {
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
			ApprovalRequestPageData.defaultpolicyDescription
		);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
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
			ApprovalRequestPageData.dafaultName
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
		approvalRequestPage.selectEmployeeFromDropdown(1);
		approvalRequestPage.selectEmployeeFromDropdown(2);
		approvalRequestPage.clickKeyboardButtonByKeyCode(9);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
	});
	it('Should be able to edit approval request', () => {
		approvalRequestPage.selectTableRowVisible();
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.editApprovalRequestButtonVisible();
		approvalRequestPage.clickEditApprovalRequestButton();
		approvalRequestPage.nameInputVisible();
		approvalRequestPage.enterNameInputData(
			ApprovalRequestPageData.dafaultName
		);
		approvalRequestPage.minCountInputVisible();
		approvalRequestPage.enterMinCountInputData(
			ApprovalRequestPageData.defaultMinCount
		);
		approvalRequestPage.saveButtonVisible();
		approvalRequestPage.clickSaveButton();
	});
	it('Should be able to delete approval request', () => {
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.selectTableRow(0);
		approvalRequestPage.deleteApprovalRequestButtonVisible();
		approvalRequestPage.clickDeleteApprovalRequestButton();
	});
});
