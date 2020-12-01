import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timeOffPage from '../support/Base/pages/TimeOff.po';
import { TimeOffPageData } from '../support/Base/pagedata/TimeOffPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Time Off test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to create new time off request', () => {
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/employees/time-off');
		timeOffPage.requestButtonVisible();
		timeOffPage.clickRequestButton();
		timeOffPage.employeeSelectorVisible();
		timeOffPage.clickEmployeeSelector();
		timeOffPage.employeeDropdownVisible();
		timeOffPage.selectEmployeeFromDropdown(1);
		timeOffPage.selectTiemOffPolicyVisible();
		timeOffPage.clickTimeOffPolicyDropdown();
		timeOffPage.timeOffPolicyDropdownOptionVisible();
		timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
		timeOffPage.startDateInputVisible();
		timeOffPage.enterStartDateData();
		timeOffPage.endDateInputVisible();
		timeOffPage.enterEndDateData();
		timeOffPage.descriptionInputVisible();
		timeOffPage.enterDdescriptionInputData(
			TimeOffPageData.defaultDescription
		);
		timeOffPage.saveRequestButtonVisible();
		timeOffPage.clickSaveRequestButton();
		timeOffPage.waitMessageToHide();
		timeOffPage.verifyPolicyExists(TimeOffPageData.defaultPolicy);
	});
	it('Should be able to DENY time off request', () => {
		timeOffPage.timeOffTableRowVisible();
		timeOffPage.selectTimeOffTableRow(0);
		timeOffPage.denyTimeOffButtonVisible();
		timeOffPage.clickDenyTimeOffButton();
		timeOffPage.clickDenyTimeOffButton();
	});
	it('Should be able to APPROVE time off request', () => {
		timeOffPage.waitMessageToHide();
		timeOffPage.approveTimeOffButtonVisible();
		timeOffPage.clickApproveTimeOffButton();
		timeOffPage.clickApproveTimeOffButton();
		timeOffPage.requestButtonVisible();
		timeOffPage.clickRequestButton();
		timeOffPage.employeeSelectorVisible();
		timeOffPage.clickEmployeeSelector();
		timeOffPage.employeeDropdownVisible();
		timeOffPage.selectEmployeeFromDropdown(1);
		timeOffPage.selectTiemOffPolicyVisible();
		timeOffPage.clickTimeOffPolicyDropdown();
		timeOffPage.timeOffPolicyDropdownOptionVisible();
		timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
		timeOffPage.startDateInputVisible();
		timeOffPage.enterStartDateData();
		timeOffPage.endDateInputVisible();
		timeOffPage.enterEndDateData();
		timeOffPage.descriptionInputVisible();
		timeOffPage.enterDdescriptionInputData(
			TimeOffPageData.defaultDescription
		);
		timeOffPage.saveRequestButtonVisible();
		timeOffPage.clickSaveRequestButton();
	});
	it('Should be able to delete time off request', () => {
		timeOffPage.waitMessageToHide();
		timeOffPage.selectTimeOffTableRow(0);
		timeOffPage.deleteTimeOffBtnVisible();
		timeOffPage.clickDeleteTimeOffButton();
		timeOffPage.confirmDeleteTimeOffBtnVisible();
		timeOffPage.clickConfirmDeleteTimeOffButoon();
	});
	it('Should be able to add holiday', () => {
		timeOffPage.addHolidayButtonVisible();
		timeOffPage.clickAddHolidayButton();
		timeOffPage.selectHolidayNameVisible();
		timeOffPage.clickSelectHolidayName();
		timeOffPage.selectHolidayOption(TimeOffPageData.defaultHoliday);
		timeOffPage.selectEmployeeDropdownVisible();
		timeOffPage.clickSelectEmployeeDropdown();
		timeOffPage.selectEmployeeFromHolidayDropdown(0);
		timeOffPage.clickKeyboardButtonByKeyCode(9);
		timeOffPage.selectTiemOffPolicyVisible();
		timeOffPage.clickTimeOffPolicyDropdown();
		timeOffPage.timeOffPolicyDropdownOptionVisible();
		timeOffPage.selectTimeOffPolicy(TimeOffPageData.defaultPolicy);
		timeOffPage.startHolidayDateInputVisible();
		timeOffPage.enterStartHolidayDate();
		timeOffPage.endHolidayDateInputVisible();
		timeOffPage.enterEndHolidayDate();
		timeOffPage.clickKeyboardButtonByKeyCode(9);
		timeOffPage.saveButtonVisible();
		timeOffPage.clickSaveButton();
	});
	it('Should be able to add new policy', () => {
		timeOffPage.timeOffSettingsButtonVisible();
		timeOffPage.clickTimeOffSettingsButton();
		timeOffPage.addNewPolicyButtonVisible();
		timeOffPage.clickAddNewPolicyButton();
		timeOffPage.policyInputFieldVisible();
		timeOffPage.enterNewPolicyName(TimeOffPageData.addNewPolicyData);
		timeOffPage.selectEmployeeDropdownVisible();
		timeOffPage.clickSelectEmployeeDropdown();
		timeOffPage.selectEmployeeFromHolidayDropdown(1);
		timeOffPage.clickKeyboardButtonByKeyCode(9);
		timeOffPage.saveButtonVisible();
		timeOffPage.clickSaveButton();
		timeOffPage.waitMessageToHide();
		timeOffPage.verifyPolicyExists(TimeOffPageData.addNewPolicyData);
	});
});
