import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as goalsKPIPage from '../../Base/pages/GoalsKPI.po';
import { GoalsKPIPageData } from '../../Base/pagedata/GoalsKPIPageData';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as goalstimeFramePage from '../../Base/pages/GoalsTimeFrame.po';
import { GoalsTimeFramePageData } from '../../Base/pagedata/GoalsTimeFramePageData';

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

// Add new employee
And('User can add new employee', () => {
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
	goalstimeFramePage.clickTabButton(1);
});

Then('User can see add time frame button', () => {
	goalstimeFramePage.addtimeFrameButtonVisible();
});

When('User click on add time frame button', () => {
	goalstimeFramePage.clickAddtimeFrameButton();
});

Then('User can see time frame name input field', () => {
	goalstimeFramePage.nameInputVisible();
});

And('User can enter name for time frame', () => {
	goalstimeFramePage.enterNameInputData(GoalsTimeFramePageData.name);
});

And('User can see start date input field', () => {
	goalstimeFramePage.startDateInputVisible();
});

And('User can enter start date', () => {
	goalstimeFramePage.enterStartDateData();
});

And('User can see end date input field', () => {
	goalstimeFramePage.endDateInputVisible();
});

And('User can enter and date', () => {
	goalstimeFramePage.enterEndDateData();
	goalstimeFramePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save time frame button', () => {
	goalstimeFramePage.saveTimeFrameButtonVisible();
});

When('User click on save time frame button', () => {
	goalstimeFramePage.clickSaveTimeFrameButton();
});

Then('Notification message will appear', () => {
	goalstimeFramePage.waitMessageToHide();
});

// Edit time frame
And('User can see time frame table', () => {
	goalstimeFramePage.tableRowVisible();
});

When('User click on time frame table row', () => {
	goalstimeFramePage.selectTableRow(0);
});

Then('Edit time frame button will become active', () => {
	goalstimeFramePage.editTimeFrameButtonVisible();
});

When('User click on edit time frame button', () => {
	goalstimeFramePage.clickEditTimeFrameButton();
});

Then('User can see edit time frame name input field', () => {
	goalstimeFramePage.nameInputVisible();
});

And('User can enter new time frame name', () => {
	goalstimeFramePage.enterNameInputData(GoalsTimeFramePageData.editName);
});

And('User can see save edited time frame button', () => {
	goalstimeFramePage.saveTimeFrameButtonVisible();
});

When('User click on save edited time frame button', () => {
	goalstimeFramePage.clickSaveTimeFrameButton();
});

Then('Notification message will appear', () => {
	goalstimeFramePage.waitMessageToHide();
});

// Delete time frame
And('User can see time frame table again', () => {
	goalstimeFramePage.tableRowVisible();
});

When('User click on time frame table row again', () => {
	goalstimeFramePage.selectTableRow(0);
});

Then('Delete time frame button will become active', () => {
	goalstimeFramePage.deleteTimeFrameButtonVisible();
});

When('USer click on delete time frame button', () => {
	goalstimeFramePage.clickDeleteTimeFrameButton();
});

Then('User can see confirm delete time frame button', () => {
	goalstimeFramePage.confirmDeleteButtonVisible();
});

When('User click on confirm delete time frame button', () => {
	goalstimeFramePage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	goalstimeFramePage.waitMessageToHide();
});

// Goals KPI test
// Add new KPI
And('User can see third tab button', () => {
	goalsKPIPage.tabButtonVisible();
});

When('User click on third tab button', () => {
	goalstimeFramePage.clickTabButton(2);
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
	goalstimeFramePage.waitMessageToHide();
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

And('User can see save edited KPI button', () => {
	goalsKPIPage.saveKPIButtonVisible();
});

When('User click on save edited KPI button', () => {
	goalsKPIPage.clickSaveKPIButton();
});

Then('Notification message will appear', () => {
	goalstimeFramePage.waitMessageToHide();
});

// Delete KPI
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
	goalstimeFramePage.waitMessageToHide();
});
