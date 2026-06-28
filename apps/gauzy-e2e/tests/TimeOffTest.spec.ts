import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as timeOffPage from './support/pages/TimeOff.po';
import { TimeOffPageData } from '../src/support/Base/pagedata/TimeOffPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Time Off test', () => {
	test('Time Off test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to create new time off request', async () => {
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			// Robust hash nav: a bare goto() to the time-off hash right after addEmployee (which ends on
			// /#/pages/employees) is a same-document no-op, leaving the employees grid mounted long enough
			// for the next "Add" click to re-open the Add Employee dialog instead of the request dialog.
			await timeOffPage.navigateToTimeOff();
			await timeOffPage.requestButtonVisible();
			await timeOffPage.clickRequestButton();
			await timeOffPage.employeeSelectorVisible();
			await timeOffPage.clickEmployeeSelector();
			await timeOffPage.employeeDropdownVisible();
			// Pick the employee BY NAME, not by index. The ga-employee-selector ng-select unshifts an
			// "All Employees" pseudo-option at index 0 (it has id=null), so a plain nth(0) selected that —
			// and saveRequest() bails when selectedEmployee.id is falsy, so the request was never created
			// (the round-4 verifyPolicyExists timeout). Selecting the unique faker employee also makes the
			// spec order-independent in the shared-DB suite.
			await timeOffPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
			await timeOffPage.selectTimeOffPolicyVisible();
			await timeOffPage.clickTimeOffPolicyDropdown();
			await timeOffPage.timeOffPolicyDropdownOptionVisible();
			await timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
			await timeOffPage.startDateInputVisible();
			await timeOffPage.enterStartDateData();
			await timeOffPage.endDateInputVisible();
			await timeOffPage.enterEndDateData();
			await timeOffPage.descriptionInputVisible();
			await timeOffPage.enterDescriptionInputData(
				TimeOffPageData.defaultDescription
			);
			await timeOffPage.saveRequestButtonVisible();
			await timeOffPage.clickSaveRequestButton();
			await timeOffPage.waitMessageToHide();
			await timeOffPage.verifyPolicyExists(TimeOffPageData.defaultPolicy);
		});

		await test.step('Should be able to DENY time off request', async () => {
			await timeOffPage.timeOffTableRowVisible();
			// Scope the row to THIS spec's employee (grid Employee column = "First Last") so we never
			// deny/approve/delete a leftover request from an earlier spec in the shared-DB suite.
			await timeOffPage.selectTimeOffTableRow(`${firstName} ${lastName}`);
			// Approve/Deny live in a second action group that only renders once "more" is toggled.
			await timeOffPage.clickShowActionsButton();
			await timeOffPage.denyTimeOffButtonVisible();
			await timeOffPage.clickDenyTimeOffButton();
			await timeOffPage.clickDenyTimeOffButton();
		});

		await test.step('Should be able to APPROVE time off request', async () => {
			await timeOffPage.waitMessageToHide();
			// Denying cleared the selection + collapsed the action group; re-select the row and re-open
			// the action group before approving.
			await timeOffPage.selectTimeOffTableRow(`${firstName} ${lastName}`);
			await timeOffPage.clickShowActionsButton();
			await timeOffPage.approveTimeOffButtonVisible();
			await timeOffPage.clickApproveTimeOffButton();
			await timeOffPage.clickApproveTimeOffButton();
			await timeOffPage.requestButtonVisible();
			await timeOffPage.clickRequestButton();
			await timeOffPage.employeeSelectorVisible();
			await timeOffPage.clickEmployeeSelector();
			await timeOffPage.employeeDropdownVisible();
			// Pick the unique faker employee by name (see step-1 note: index 0 is the "All Employees"
			// pseudo-option with id=null, which makes saveRequest() a no-op).
			await timeOffPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
			await timeOffPage.selectTimeOffPolicyVisible();
			await timeOffPage.clickTimeOffPolicyDropdown();
			await timeOffPage.timeOffPolicyDropdownOptionVisible();
			await timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
			await timeOffPage.startDateInputVisible();
			await timeOffPage.enterStartDateData();
			await timeOffPage.endDateInputVisible();
			await timeOffPage.enterEndDateData();
			await timeOffPage.descriptionInputVisible();
			await timeOffPage.enterDescriptionInputData(
				TimeOffPageData.defaultDescription
			);
			await timeOffPage.saveRequestButtonVisible();
			await timeOffPage.clickSaveRequestButton();
		});

		await test.step('Should be able to delete time off request', async () => {
			await timeOffPage.waitMessageToHide();
			// Delete the request for THIS spec's employee (pollution-resilient row scope).
			await timeOffPage.selectTimeOffTableRow(`${firstName} ${lastName}`);
			await timeOffPage.deleteTimeOffBtnVisible();
			await timeOffPage.clickDeleteTimeOffButton();
			await timeOffPage.confirmDeleteTimeOffBtnVisible();
			await timeOffPage.clickConfirmDeleteTimeOffButton();
		});

		await test.step('Should be able to add holiday', async () => {
			await timeOffPage.addHolidayButtonVisible();
			await timeOffPage.clickAddHolidayButton();
			await timeOffPage.selectHolidayNameVisible();
			await timeOffPage.clickSelectHolidayName();
			await timeOffPage.selectHolidayOption(TimeOffPageData.defaultHoliday);
			await timeOffPage.selectEmployeeDropdownVisible();
			await timeOffPage.clickSelectEmployeeDropdown();
			await timeOffPage.selectEmployeeFromHolidayDropdown(0);
			await timeOffPage.clickKeyboardButtonByKeyCode(9);
			await timeOffPage.selectTimeOffPolicyVisible();
			await timeOffPage.clickTimeOffPolicyDropdown();
			await timeOffPage.timeOffPolicyDropdownOptionVisible();
			await timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
			await timeOffPage.startHolidayDateInputVisible();
			await timeOffPage.enterStartHolidayDate();
			await timeOffPage.endHolidayDateInputVisible();
			await timeOffPage.enterEndHolidayDate();
			await timeOffPage.clickKeyboardButtonByKeyCode(9);
			await timeOffPage.saveButtonVisible();
			await timeOffPage.clickSaveButton();
		});

		await test.step('Should be able to add new policy', async () => {
			await timeOffPage.timeOffSettingsButtonVisible();
			await timeOffPage.clickTimeOffSettingsButton(1);
			await timeOffPage.addNewPolicyButtonVisible();
			await timeOffPage.clickAddNewPolicyButton();
			await timeOffPage.policyInputFieldVisible();
			await timeOffPage.enterNewPolicyName(TimeOffPageData.addNewPolicyData);
			await timeOffPage.selectEmployeeDropdownVisible();
			await timeOffPage.clickSelectEmployeeDropdown();
			await timeOffPage.selectEmployeeFromHolidayDropdown(1);
			await timeOffPage.clickKeyboardButtonByKeyCode(9);
			await timeOffPage.saveButtonVisible();
			await timeOffPage.clickSaveButton();
			await timeOffPage.waitMessageToHide();
			await timeOffPage.verifyPolicyExists(TimeOffPageData.addNewPolicyData);
		});
	});
});
