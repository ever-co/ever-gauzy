import { test } from './support/fixtures';
import { getPage } from './support/page-context';
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
			await getPage().goto('/#/pages/employees/time-off');
			await timeOffPage.requestButtonVisible();
			await timeOffPage.clickRequestButton();
			await timeOffPage.employeeSelectorVisible();
			await timeOffPage.clickEmployeeSelector();
			await timeOffPage.employeeDropdownVisible();
			// index 0 = first working employee in the ng-select (no placeholder option), more robust than
			// the legacy index 1 which skipped the first and broke when only one employee was in range.
			await timeOffPage.selectEmployeeFromDropdown(0);
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
			await timeOffPage.selectTimeOffTableRow(0);
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
			await timeOffPage.selectTimeOffTableRow(0);
			await timeOffPage.clickShowActionsButton();
			await timeOffPage.approveTimeOffButtonVisible();
			await timeOffPage.clickApproveTimeOffButton();
			await timeOffPage.clickApproveTimeOffButton();
			await timeOffPage.requestButtonVisible();
			await timeOffPage.clickRequestButton();
			await timeOffPage.employeeSelectorVisible();
			await timeOffPage.clickEmployeeSelector();
			await timeOffPage.employeeDropdownVisible();
			// index 0 = first working employee (see step 1 note).
			await timeOffPage.selectEmployeeFromDropdown(0);
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
			await timeOffPage.selectTimeOffTableRow(0);
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
