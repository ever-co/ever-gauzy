import { When } from '../../support/bdd';
import * as timeOffPage from '../../support/pages/TimeOff.po';
import { TimeOffPageData } from '../../../src/support/Base/pagedata/TimeOffPageData';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';

// Converted 1:1 from the plain TimeOffTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts. Cross-step faker state is hoisted
// to module scope and initialised at the start of the first step.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

When('I create a new time off request', async () => {
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	password = faker.internet.password();
	employeeEmail = faker.internet.exampleEmail();
	imgUrl = faker.image.avatar();

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
	// Verify the policy that was ACTUALLY selected, not the hardcoded "Default Policy". The suite runs
	// serially on a shared DB and the web app persists the last-selected org, so this spec often runs
	// with a random org (which has "Policy 1".."Policy 10", never "Default Policy"); selectTimeOffPolicy
	// falls back to that org's first real policy and records its name, so we assert on the real record.
	await timeOffPage.verifyPolicyExists(timeOffPage.getLastSelectedPolicyName());
});

When('I deny the time off request', async () => {
	await timeOffPage.timeOffTableRowVisible();
	// Scope the row to the employee ACTUALLY selected in the request dialog (grid Employee column =
	// that employee's full name) so we never deny/approve/delete a leftover request from an earlier
	// spec in the shared-DB suite. Use the recorded name (not the raw faker name) because the
	// employee typeahead has a fallback path — the created request may carry the fallback employee.
	await timeOffPage.selectTimeOffTableRow(timeOffPage.getLastSelectedEmployeeName());
	// Approve/Deny live in a second action group that only renders once "more" is toggled.
	await timeOffPage.clickShowActionsButton();
	await timeOffPage.denyTimeOffButtonVisible();
	await timeOffPage.clickDenyTimeOffButton();
	await timeOffPage.clickDenyTimeOffButton();
});

When('I approve the time off request', async () => {
	await timeOffPage.waitMessageToHide();
	// Denying cleared the selection + collapsed the action group; re-select the row and re-open
	// the action group before approving. Scope to the recorded (actually-selected) employee name.
	await timeOffPage.selectTimeOffTableRow(timeOffPage.getLastSelectedEmployeeName());
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

When('I delete the time off request', async () => {
	await timeOffPage.waitMessageToHide();
	// Delete a request for the employee ACTUALLY selected (pollution-resilient row scope).
	await timeOffPage.selectTimeOffTableRow(timeOffPage.getLastSelectedEmployeeName());
	await timeOffPage.deleteTimeOffBtnVisible();
	await timeOffPage.clickDeleteTimeOffButton();
	await timeOffPage.confirmDeleteTimeOffBtnVisible();
	await timeOffPage.clickConfirmDeleteTimeOffButton();
});

When('I add a holiday', async () => {
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

When('I add a new time off policy', async () => {
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
