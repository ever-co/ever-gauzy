import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timeOffPage from '../support/Base/pages/TimeOff.po';
import { TimeOffPageData } from '../support/Base/pagedata/TimeOffPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Time Off test', () => {
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
	it('Should be able to create new time off request', () => {
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
	});
	it('Should be able to edit time off request', () => {
		cy.wait(3000);
		timeOffPage.selectTimeOffTableRow(0);
		timeOffPage.editTimeOffRequestBtnVisible();
		timeOffPage.clickEditTimeOffRequestButton();
		timeOffPage.employeeSelectorVisible();
		timeOffPage.clickEmployeeSelector();
		timeOffPage.employeeDropdownVisible();
		timeOffPage.selectEmployeeFromDropdown(2);
		timeOffPage.clickKeyboardButtonByKeyCode(9);
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
	it('Should be able to DENY time off request', () => {
		cy.wait(3000);
		timeOffPage.selectTimeOffTableRow(0);
		timeOffPage.denyTimeOffButtonVisible();
		timeOffPage.clickDenyTimeOffButton();
		timeOffPage.clickDenyTimeOffButton();
	});
	it('Should be able to APPROVE time off request', () => {
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
		cy.wait(3000);
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
		timeOffPage.selectEmployeeFromHolidayDropdown(1);
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
		timeOffPage.selectEmployeeFromHolidayDropdown(0);
		timeOffPage.selectEmployeeFromHolidayDropdown(1);
		timeOffPage.clickKeyboardButtonByKeyCode(9);
		timeOffPage.saveButtonVisible();
		timeOffPage.clickSaveButton();
	});
});
