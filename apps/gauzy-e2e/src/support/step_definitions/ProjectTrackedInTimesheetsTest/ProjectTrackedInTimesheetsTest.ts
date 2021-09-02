import * as faker from 'faker';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { CustomCommands } from '../../commands';
import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as projectTrackedInTimesheets from '../../Base/pages/ProjectTrackedInTimesheet.po';
import { waitUntil } from '../../Base/utils/util';
import { ProjectTrackedInTimesheetPageData } from '../../Base/pagedata/ProjectTrackedInTimesheetPageData';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');



let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();
let employeeEmail = faker.internet.email();

let projectName = faker.company.companyName()

let employeeFullName = `${firstName} ${lastName}`;


// Login with email

Given('Login with default credentials',()=>{
    CustomCommands.login(loginPage, LoginPageData, dashboardPage)
})

//Add employee
Then('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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

//Add new project

And('User can visit Organization projects page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/projects', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	projectTrackedInTimesheets.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	projectTrackedInTimesheets.gridBtnClick(1);
});

And('User can see request project button', () => {
	projectTrackedInTimesheets.requestProjectButtonVisible();
});

When('User click on request project button', () => {
	projectTrackedInTimesheets.clickRequestProjectButton();
});

Then('User can see name input field', () => {
	projectTrackedInTimesheets.nameInputVisible();
});

And('User can enter value for name', () => {
	projectTrackedInTimesheets.enterNameInputData(projectName);
});

And('User can see employee dropdown', () => {
	projectTrackedInTimesheets.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	projectTrackedInTimesheets.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropodown options', () => {
	projectTrackedInTimesheets.selectEmployeeDropdownOption(employeeFullName);
	projectTrackedInTimesheets.clickKeyboardButtonByKeyCode(9);
});

And('User can see save project button', () => {
	projectTrackedInTimesheets.saveProjectButtonVisible();
});

When('User click on save project button', () => {
	projectTrackedInTimesheets.clickSaveProjectButton();
});

Then('Notification message will appear', () => {
	projectTrackedInTimesheets.waitMessageToHide();
});

//Logout
And ('User can logout', () => {
    CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
});

//Login as employee

And('Employee can see login page', () => {
	loginPage.verifyLoginText();
});

And('Employee can see email input', () => {
	loginPage.clearEmailField();
});

And('Employee can enter value for employee email', () => {
	loginPage.enterEmail(employeeEmail);
});

And('Employee can see password input', () => {
	loginPage.clearPasswordField();
});

And('Employee can enter value for employee password', () => {
	loginPage.enterPassword(password);
});

When('Employee click on login button', () => {
	loginPage.clickLoginButton();
});

Then('Employee will see Create button', () => {
	dashboardPage.verifyCreateButton();
});

//Record time with the new project

And('Employee can see timer', () => {
	projectTrackedInTimesheets.timerVisible();
});

When('Employee click on timer', () => {
	projectTrackedInTimesheets.clickTimer();
});

Then('Employee can see timer button', () => {
	projectTrackedInTimesheets.timerBtnVisible();
});

And('Employee can see project select', () => {
	projectTrackedInTimesheets.projectSelectVisible();
});

When('Employee click on project select', () => {
	projectTrackedInTimesheets.clickProjectSelect();
});

Then('Employee can select project from dropdown options', () => {
	projectTrackedInTimesheets.selectOptionFromDropdown(0);
});

When('Employee click on start timer button', () => {
	projectTrackedInTimesheets.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button', () => {
	projectTrackedInTimesheets.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	projectTrackedInTimesheets.clickStopTimerBtn();
});

Then('Employee can see view timesheet button', () => {
	projectTrackedInTimesheets.viewTimesheetbtnVisible();
});

When('Employee click on view timesheet button', () => {
	projectTrackedInTimesheets.clickViewTimesheetBtn();
});
Then ('Employee verify project name is the same', () => {
	projectTrackedInTimesheets.verifyProjectText(projectName)
});


