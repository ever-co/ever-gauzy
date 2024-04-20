import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as goalsKPIPage from '../../Base/pages/GoalsKPI.po';
import { GoalsKPIPageData } from '../../Base/pagedata/GoalsKPIPageData';
import { faker } from '@faker-js/faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as goalsTimeFramePage from '../../Base/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../../Base/pagedata/GoalsTimeFramePageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.person.firstName();
let lastName = faker.person.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.exampleEmail();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new employee
And('User can add new employee', () => {
	dashboardPage.verifyAccountingDashboard()
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

// Goals Time Frame test
// Add new time frame
And('User can visit Goals settings page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/goals/settings', { timeout: pageLoadTimeout });
});

And('User can see second tab button', () => {
	goalsKPIPage.tabButtonVisible();
});

When('User click on second tab button', () => {
	cy.intercept('GET', '/api/goal-time-frame*').as('waitTable');
	goalsTimeFramePage.clickTabButton(1);
	cy.wait('@waitTable')
});

Then('User can see add time frame button', () => {
	goalsTimeFramePage.addTimeFrameButtonVisible();
});

When('User click on add time frame button', () => {
	goalsTimeFramePage.clickAddTimeFrameButton();
});

Then('User can see time frame name input field', () => {
	goalsTimeFramePage.nameInputVisible();
});

And('User can enter name for time frame', () => {
	goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
});

And('User can see start date input field', () => {
	goalsTimeFramePage.startDateInputVisible();
});

And('User can enter start date', () => {
	goalsTimeFramePage.enterStartDateData();
});

And('User can see end date input field', () => {
	goalsTimeFramePage.endDateInputVisible();
});

And('User can enter and date', () => {
	goalsTimeFramePage.enterEndDateData();
	goalsTimeFramePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save time frame button', () => {
	goalsTimeFramePage.saveTimeFrameButtonVisible();
});

When('User click on save time frame button', () => {
	goalsTimeFramePage.clickSaveTimeFrameButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});

// Edit time frame
And('User can see time frame table', () => {
	goalsTimeFramePage.tableRowVisible();
});

When('User click on time frame table row', () => {
	goalsTimeFramePage.selectTableRow(0);
});

Then('Edit time frame button will become active', () => {
	goalsTimeFramePage.editTimeFrameButtonVisible();
});

When('User click on edit time frame button', () => {
	goalsTimeFramePage.clickEditTimeFrameButton();
});

Then('User can see edit time frame name input field', () => {
	goalsTimeFramePage.nameInputVisible();
});

And('User can enter new time frame name', () => {
	goalsTimeFramePage.enterNameInputData(GoalsTimeFramePageData.editName);
});

And('User can see save edited time frame button', () => {
	goalsTimeFramePage.saveTimeFrameButtonVisible();
});

When('User click on save edited time frame button', () => {
	goalsTimeFramePage.clickSaveTimeFrameButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});

// Delete time frame
And('User can see time frame table again', () => {
	goalsTimeFramePage.tableRowVisible();
});

When('User click on time frame table row again', () => {
	goalsTimeFramePage.selectTableRow(0);
});

Then('Delete time frame button will become active', () => {
	goalsTimeFramePage.deleteTimeFrameButtonVisible();
});

When('USer click on delete time frame button', () => {
	goalsTimeFramePage.clickDeleteTimeFrameButton();
});

Then('User can see confirm delete time frame button', () => {
	goalsTimeFramePage.confirmDeleteButtonVisible();
});

When('User click on confirm delete time frame button', () => {
	goalsTimeFramePage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});

// Goals KPI test
// Add new KPI
And('User can see third tab button', () => {
	goalsKPIPage.tabButtonVisible();
});

When('User click on third tab button', () => {
	goalsTimeFramePage.clickTabButton(2);
});

Then('User can see add KPI button', () => {
	goalsKPIPage.addKPIButtonVisible();
});

When('User click on add KPI button', () => {
	goalsKPIPage.clickAddKPIButton();
});

Then('User can see KPI name input field', () => {
	goalsKPIPage.nameInputVisible();
});

And('User can enter KPI name', () => {
	goalsKPIPage.enterNameInputData(GoalsKPIPageData.name);
});

And('User can see KPI description input field', () => {
	goalsKPIPage.descriptionInputVisible();
});

And('User can enter KPI description', () => {
	goalsKPIPage.enterDescriptionInputData(GoalsKPIPageData.description);
});

And('User can see employee dropdown', () => {
	goalsKPIPage.employeeMultiSelectVisible();
});

When('User click on employee dropdown', () => {
	goalsKPIPage.clickEmployeeMultiSelect();
});

Then('User can select employee from dropdown options', () => {
	goalsKPIPage.selectEmployeeFromDropdown(0);
});

And('User can see KPI value input field', () => {
	goalsKPIPage.valueInputVisible();
});

And('User can enter KPI value', () => {
	goalsKPIPage.enterValueInputData(GoalsKPIPageData.value);
});

And('user can see save KPI button', () => {
	goalsKPIPage.saveKPIButtonVisible();
});

When('User click on save KPI button', () => {
	goalsKPIPage.clickSaveKPIButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});

// Edit KPI
And('User can see KPI table', () => {
	goalsKPIPage.tableRowVisible();
});

When('User click on KPI table row', () => {
	goalsKPIPage.selectTableRow(0);
});

Then('Edit KPI button will become active', () => {
	goalsKPIPage.editKPIButtonVisible();
});

When('User click on edit KPI button', () => {
	goalsKPIPage.clickEditKPIButton();
});

Then('User can see edit KPI name input field', () => {
	goalsKPIPage.nameInputVisible();
});

And('User can enter new KPI name', () => {
	goalsKPIPage.enterNameInputData(GoalsKPIPageData.editName);
});

And('User can see employee dropdown', () => {
	goalsKPIPage.employeeMultiSelectVisible();
});

When('User click on employee dropdown', () => {
	goalsKPIPage.clickEmployeeMultiSelect();
});

Then('User can select employee from dropdown options', () => {
	goalsKPIPage.selectEmployeeFromDropdown(0);
});

And('User can see save edited KPI button', () => {
	goalsKPIPage.saveKPIButtonVisible();
});

When('User click on save edited KPI button', () => {
	goalsKPIPage.clickSaveKPIButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});

// Delete KPI
When('User see name input field', () => {
	goalsKPIPage.verifyNameInput();
});

Then('User enter invited client name', () => {
	goalsKPIPage.searchClientName(GoalsKPIPageData.name);
});

And('User can see only selected user', () => {
	goalsKPIPage.verifySearchResult(GoalsKPIPageData.tableResult);
});

And('User can see KPI table again', () => {
	goalsKPIPage.tableRowVisible();
});

When('User click on KPI table row again', () => {
	goalsKPIPage.selectTableRow(0);
});

Then('Delete KPI button will become active', () => {
	goalsKPIPage.deleteKPIButtonVisible();
});

When('User click on delete KPI button', () => {
	goalsKPIPage.clickDeleteKPIButton();
});

Then('User can see confirm delete KPI button', () => {
	goalsKPIPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete KPI button', () => {
	goalsKPIPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	goalsTimeFramePage.waitMessageToHide();
});
