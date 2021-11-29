import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as timeOffPage from '../../Base/pages/TimeOff.po';
import { TimeOffPageData } from '../../Base/pagedata/TimeOffPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add employee
And('User can add new employee', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addEmployee(
		manageEmployeesPage,
		firstName,
		lastName,
		username,
		employeeEmail,
		password,
		imgUrl
	);
});

// Add new policy
And('User can visit Employees time off page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/time-off', { timeout: pageLoadTimeout });
});

And('User can see time off settings button', () => {
	timeOffPage.timeOffSettingsButtonVisible();
});

When('User click on time off settings button', () => {
	timeOffPage.clickTimeOffSettingsButton(1);
});

Then('User can see add new policy button', () => {
	timeOffPage.addNewPolicyButtonVisible();
});

When('User click on add new policy button', () => {
	timeOffPage.clickAddNewPolicyButton();
});

Then('User can see policy input field', () => {
	timeOffPage.policyInputFieldVisible();
});

And('User can enter policy name', () => {
	timeOffPage.enterNewPolicyName(TimeOffPageData.addNewPolicyData);
});

And('User can see employee select dropdown', () => {
	timeOffPage.selectEmployeeDropdownVisible();
});

When('User click on employee select dropdown', () => {
	timeOffPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropdown select options', () => {
	timeOffPage.selectEmployeeFromHolidayDropdown(0);
	timeOffPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save new policy button', () => {
	timeOffPage.saveButtonVisible();
});

When('User click on save new policy button', () => {
	timeOffPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});

And('User can see back button', () => {
	timeOffPage.backButtonVisible();
});

When('User click on back button', () => {
	timeOffPage.clickBackButton();
});

// Create new time off request
Then('User can see request button', () => {
	timeOffPage.requestButtonVisible();
});

When('User click on request button', () => {
	timeOffPage.clickRequestButton();
});

Then('User can see employee select', () => {
	timeOffPage.employeeSelectorVisible();
});

When('User click employee select', () => {
	timeOffPage.clickEmployeeSelector();
});

Then('User can see employee dropdown', () => {
	timeOffPage.employeeDropdownVisible();
});

And('User can select employee from dropdown options', () => {
	timeOffPage.selectEmployeeFromDropdown(1);
});

And('User can see time off policy select', () => {
	timeOffPage.selectTimeOffPolicyVisible();
});

When('User click on time off policy select', () => {
	timeOffPage.clickTimeOffPolicyDropdown();
});

Then('User can see time off policy dropdown', () => {
	timeOffPage.timeOffPolicyDropdownOptionVisible();
});

And('User can select time off policy from dropdown options', () => {
	timeOffPage.selectTimeOffPolicy(TimeOffPageData.addNewPolicyData);
});

And('User can see start date input field', () => {
	timeOffPage.startDateInputVisible();
});

And('User can enter start date', () => {
	timeOffPage.enterStartDateData();
});

And('User can see end date input field', () => {
	timeOffPage.endDateInputVisible();
});

And('User can enter and date', () => {
	timeOffPage.enterEndDateData();
});

And('User can see description input field', () => {
	timeOffPage.descriptionInputVisible();
});

And('User can enter description', () => {
	timeOffPage.enterDdescriptionInputData(TimeOffPageData.defaultDescription);
});

And('User can see save request button', () => {
	timeOffPage.saveRequestButtonVisible();
});

When('User click on save request button', () => {
	timeOffPage.clickSaveRequestButton();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});

// Deny time off request
And('User can see time off requests table', () => {
	timeOffPage.timeOffTableRowVisible();
});

When('User click on time off requests table row', () => {
	timeOffPage.selectTimeOffTableRow(0);
});

Then('User can see deny time off request button', () => {
	timeOffPage.denyTimeOffButtonVisible();
});

When('User click on deny time off request button', () => {
	timeOffPage.clickDenyTimeOffButton();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});

// Approve time off request
And('User can see approve time off request button', () => {
	timeOffPage.selectTimeOffTableRow(0);

	timeOffPage.approveTimeOffButtonVisible();
});

When('User click on approve time off request button', () => {
	timeOffPage.clickApproveTimeOffButton();
});

Then('User can see request button', () => {
	timeOffPage.requestButtonVisible();
});

When('User click on request button', () => {
	timeOffPage.clickRequestButton();
});

Then('User can see employee select', () => {
	timeOffPage.employeeSelectorVisible();
});

When('User click employee select', () => {
	timeOffPage.clickEmployeeSelector();
});

Then('User can see employee dropdown', () => {
	timeOffPage.employeeDropdownVisible();
});

And('User can select employee from dropdown options', () => {
	timeOffPage.selectEmployeeFromDropdown(1);
});

And('User can see time off policy select', () => {
	timeOffPage.selectTimeOffPolicyVisible();
});

When('User click on time off policy select', () => {
	timeOffPage.clickTimeOffPolicyDropdown();
});

Then('User can see time off policy dropdown again', () => {
	timeOffPage.timeOffPolicyDropdownOptionVisible();
});

And('User can select time off policy from dropdown options', () => {
	timeOffPage.selectTimeOffPolicy(TimeOffPageData.addNewPolicyData);
});

And('User can see start date input field', () => {
	timeOffPage.startDateInputVisible();
});

And('User can enter start date', () => {
	timeOffPage.enterStartDateData();
});

And('User can see end date input field', () => {
	timeOffPage.endDateInputVisible();
});

And('User can enter and date', () => {
	timeOffPage.enterEndDateData();
});

And('User can see description input field', () => {
	timeOffPage.descriptionInputVisible();
});

And('User can enter description', () => {
	timeOffPage.enterDdescriptionInputData(TimeOffPageData.defaultDescription);
});

And('User can see save request button', () => {
	timeOffPage.saveRequestButtonVisible();
});

When('User click on save request button', () => {
	timeOffPage.clickSaveRequestButton();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});

// Delete time off request
And('User can see time off requests table again', () => {
	timeOffPage.timeOffTableRowVisible();
});

When('User click on time off requests table row again', () => {
	timeOffPage.selectTimeOffTableRow(0);
});

Then('User can see delete time off request button', () => {
	timeOffPage.deleteTimeOffBtnVisible();
});

When('User click on delete time off request button', () => {
	timeOffPage.clickDeleteTimeOffButton();
});

Then('User can see confirm delete button', () => {
	timeOffPage.confirmDeleteTimeOffBtnVisible();
});

When('User click on confirm delete button', () => {
	timeOffPage.clickConfirmDeleteTimeOffButoon();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});

// Add holiday
And('User can see add holiday button', () => {
	timeOffPage.addHolidayButtonVisible();
});

When('User click on add holiday button', () => {
	timeOffPage.clickAddHolidayButton();
});

Then('User can see holiday name select', () => {
	timeOffPage.selectHolidayNameVisible();
});

When('User click on holiday select', () => {
	timeOffPage.clickSelectHolidayName();
});

Then('User can select holiday from dropdown options', () => {
	timeOffPage.selectHolidayOption(0);
});

And('User can see select employee dropdown', () => {
	timeOffPage.verifyEmployeeSelectorVisible();
});

When('User click on select employee dropdown', () => {
	timeOffPage.clickEmployeeSelectorDropdown();
});

Then('User can select employee from select dropdown options', () => {
	timeOffPage.selectEmployeeFromHolidayDropdown(0);
	timeOffPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see again time off policy dropdown', () => {
	timeOffPage.verifyTimeOffPolicyVisible();
});

When('User click on time off policy dropdown', () => {
	timeOffPage.clickTimeOffPolicySelector();
});

Then('User can see again time off policy dropdown', () => {
	timeOffPage.timeOffPolicyDropdownOptionVisible();
});

And('User can select again time off policy from dropdown options', () => {
	timeOffPage.selectTimeOffPolicy(TimeOffPageData.addNewPolicyData);
});

And('User can see start holiday input field', () => {
	timeOffPage.startHolidayDateInputVisible();
});

And('User can enter start holiday date', () => {
	timeOffPage.enterStartHolidayDate();
});

And('User can see end holiday date input field', () => {
	timeOffPage.endHolidayDateInputVisible();
});

And('User can enter end holiday date', () => {
	timeOffPage.enterEndHolidayDate();
	timeOffPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save holiday button', () => {
	timeOffPage.saveButtonVisible();
});

When('User click on save holiday button', () => {
	timeOffPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	timeOffPage.waitMessageToHide();
});
