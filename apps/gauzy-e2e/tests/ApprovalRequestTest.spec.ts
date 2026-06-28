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
// POLLUTION RESILIENCE (Round 5 #1): the suite runs serially against ONE shared DB, so by the time this
// spec runs the policy/request grids and the policy dropdown have ACCUMULATED rows/options from earlier
// specs and earlier (failed/retried) runs. The PageData defaults ("Default Approval Policy", "Request time
// off", "Request holiday") are NOT unique — a leftover same-named row makes a blind row-0 select / verify-
// exists / verify-deleted grab or assert the WRONG record. Create everything with UNIQUE faker names and
// scope every downstream action (policy-dropdown pick, row select, verify-exists, verify-deleted) to those
// names so the spec passes in the full suite, not just in isolation.
let policyName = ' ';
let requestName = ' ';
let editRequestName = ' ';

test.describe('Approval request test', () => {
	test('Approval request test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();
		policyName = `Policy ${faker.string.alphanumeric(8)}`;
		requestName = `Request ${faker.string.alphanumeric(8)}`;
		editRequestName = `Request ${faker.string.alphanumeric(8)}`;

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
			// Navigate STRAIGHT to the approval-policy page by hash. The old path (gotoApprovals -> the
			// approvals "Approval Policy" button -> ... -> Back via location.back()) was the source of the
			// step-1 failure: a queued/overshooting history pop landed the next assertion back on Manage
			// Employees (the nameInput-on-employees-grid dump). gotoApprovalPolicy waits for the policy
			// page's "Approval Policy" header, so the Add we click opens the POLICY dialog on the right
			// screen — no button+history dance, no Back-button needed afterward.
			await approvalRequestPage.gotoApprovalPolicy();
			await approvalRequestPage.addApprovalButtonVisible();
			await approvalRequestPage.clickAddApprovalButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(policyName);
			await approvalRequestPage.descriptionInputVisible();
			await approvalRequestPage.enterDescriptionInputData(ApprovalRequestPageData.defaultPolicyDescription);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyApprovalPolicyExists(policyName);
		});

		await test.step('Should be able to add new approval request', async () => {
			// Step 1 ended on the approval-policy page (we navigated there directly). gotoApprovals hash-
			// forces us onto the approvals grid and waits for its "Approval Request" header, so the generic
			// status="success" Add we dispatch next opens the REQUEST dialog — not the policy page's Add (also
			// status="success") nor the employee one. Without this re-assert the Add could fire on the wrong
			// screen and the following nameInput would time out.
			await approvalRequestPage.gotoApprovals();
			await approvalRequestPage.gridBtnExists();
			await approvalRequestPage.gridBtnClick(1);
			await approvalRequestPage.addApprovalButtonVisible();
			await approvalRequestPage.clickAddApprovalButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(requestName);
			await approvalRequestPage.minCountInputVisible();
			await approvalRequestPage.enterMinCountInputData(ApprovalRequestPageData.defaultMinCount);
			await approvalRequestPage.approvalPolicyDropdownVisible();
			await approvalRequestPage.clickApprovalPolicyDropdown();
			// Pick OUR uniquely-named policy from the dropdown (by text) — the list may hold policies from
			// earlier specs, so selecting by the unique name avoids binding the request to the wrong policy.
			await approvalRequestPage.selectApprovalPolicyOptionDropdown(policyName);
			await approvalRequestPage.selectEmployeeDropdownVisible();
			await approvalRequestPage.clickSelectEmployeeDropdown();
			await approvalRequestPage.selectEmployeeFromDropdown(0);
			await approvalRequestPage.clickKeyboardButtonByKeyCode(9);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyRequestExists(requestName);
		});

		await test.step('Should be able to edit approval request', async () => {
			await approvalRequestPage.waitMessageToHide();
			// Select the row by OUR unique request name (selectTableRow filters the grid to it first), not by
			// index — the shared grid may hold rows from other specs/runs ahead of ours.
			await approvalRequestPage.selectTableRow(requestName);
			await approvalRequestPage.editApprovalRequestButtonVisible();
			await approvalRequestPage.clickEditApprovalRequestButton();
			await approvalRequestPage.nameInputVisible();
			await approvalRequestPage.enterNameInputData(editRequestName);
			await approvalRequestPage.minCountInputVisible();
			await approvalRequestPage.enterMinCountInputData(ApprovalRequestPageData.defaultMinCount);
			await approvalRequestPage.saveButtonVisible();
			await approvalRequestPage.clickSaveButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyRequestExists(editRequestName);
		});

		await test.step('Should be able to delete approval request', async () => {
			await approvalRequestPage.waitMessageToHide();
			// The request was renamed in the edit step, so select by the NEW unique name.
			await approvalRequestPage.selectTableRow(editRequestName);
			await approvalRequestPage.deleteApprovalRequestButtonVisible();
			await approvalRequestPage.clickDeleteApprovalRequestButton();
			await approvalRequestPage.confirmDeleteButtonVisible();
			await approvalRequestPage.clickConfirmDeleteButton();
			await approvalRequestPage.waitMessageToHide();
			await approvalRequestPage.verifyElementIsDeleted(editRequestName);
		});
	});
});
