import * as faker from 'faker';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { CustomCommands } from '../../commands';
import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as myTasksTrackedInTimesheets from '../../Base/pages/MyTasksTrackedInTimesheets.po';
import { waitUntil } from '../../Base/utils/util';
import { MyTasksTrackedInTimesheetsPageData } from '../../Base/pagedata/MyTasksTrackedInTimesheetsPageData';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');


let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();


let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();
let employeeEmail = faker.internet.email();

let employeeFullName = `${firstName} ${lastName}`;

// Login with email

Given('Login with default credentials',()=>{
    CustomCommands.login(loginPage, LoginPageData, dashboardPage)
})

// Add new tag
And('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

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
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData,
		employeeFullName
	);
});

//Logout
And('User can logout', () => {
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

//Create task and verify
When('Employee go to my tasks',() => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, {email: employeeEmail, password: password}, dashboardPage);
	
	cy.visit('/#/pages/tasks/me', { timeout: pageLoadTimeout });
	
})

Then ('Employee can see add button', () => {
	myTasksTrackedInTimesheets.verifyAddButton()
})

When ('Employee click on add button', () => {
	myTasksTrackedInTimesheets.clickOnAddTaskButton()
})

Then('Employee can see project dropdown', () => {
	myTasksTrackedInTimesheets.selectProjectDropdownVisible();
});

When('Employee click on project dropdown', () => {
	myTasksTrackedInTimesheets.clickSelectProjectDropdown();
});

Then('Employee can select project from dropdown options', () => {
	myTasksTrackedInTimesheets.selectProjectOptionDropdown(
		MyTasksTrackedInTimesheetsPageData.defaultTaskProject
	);
});

And('Employee can see status dropdown', () => {
	myTasksTrackedInTimesheets.selectStatusDropdownVisible();
});

When('Employee click on status dropdown', () => {
	myTasksTrackedInTimesheets.clickStatusDropdown();
});

Then('Employee can select status from dropdown options', () => {
	myTasksTrackedInTimesheets.selectStatusFromDropdown(MyTasksTrackedInTimesheetsPageData.defauleStatus);
});

And('Employee can see title input field', () => {
	myTasksTrackedInTimesheets.addTitleInputVisible();
});

And('Employee can enter title', () => {
	myTasksTrackedInTimesheets.enterTitleInputData(MyTasksTrackedInTimesheetsPageData.defaultTaskTitle);
});

And('Employee can see tags dropdown', () => {
	myTasksTrackedInTimesheets.tagsMultiSelectVisible();
});

When('Employee click on tags dropdown', () => {
	myTasksTrackedInTimesheets.clickTagsMultiSelect();
});

Then('Employee can select tag from dropdown options', () => {
	myTasksTrackedInTimesheets.selectTagsFromDropdown(0);
	myTasksTrackedInTimesheets.clickCardBody();
});

And('Employee can see due date input field', () => {
	myTasksTrackedInTimesheets.dueDateInputVisible();
});

And('Employee can enter due date', () => {
	myTasksTrackedInTimesheets.enterDueDateData();
	myTasksTrackedInTimesheets.clickKeyboardButtonByKeyCode(9);
});

And('Employee can see estimate days input field', () => {
	myTasksTrackedInTimesheets.estimateDaysInputVisible();
});

And('Employee can enter estimate days', () => {
	myTasksTrackedInTimesheets.enterEstiamteDaysInputData(
		MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateDays
	);
});

And('Employee can see estimate hours input field', () => {
	myTasksTrackedInTimesheets.estimateHoursInputVisible();
});

And('Employee can enter estimate hours', () => {
	myTasksTrackedInTimesheets.enterEstiamteHoursInputData(
		MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateHours
	);
});

And('Employee can see estimate minutes input field', () => {
	myTasksTrackedInTimesheets.estimateMinutesInputVisible();
});

And('Employee can enter estimate minutes', () => {
	myTasksTrackedInTimesheets.enterEstimateMinutesInputData(
		MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateMinutes
	);
});

And('Employee can see task description input field', () => {
	myTasksTrackedInTimesheets.taskDecriptionTextareaVisible();
});

And('Employee can enter task description', () => {
	myTasksTrackedInTimesheets.enterTaskDescriptionTextareaData(
		MyTasksTrackedInTimesheetsPageData.defaultTaskDescription
	);
});

And('Employee can see task save button', () => {
	myTasksTrackedInTimesheets.saveTaskButtonVisible();
});

When('Employee click on save task button', () => {
	myTasksTrackedInTimesheets.clickSaveTaskButton();
});

Then('Notification message will appear', () => {
	myTasksTrackedInTimesheets.waitMessageToHide();
});

//Record time with the new task

And('Employee can see timer', () => {
	myTasksTrackedInTimesheets.timerVisible();
});

When('Employee click on timer', () => {
	myTasksTrackedInTimesheets.clickTimer();
});

Then('Employee can see timer button', () => {
	myTasksTrackedInTimesheets.timerBtnVisible();
});

And('Employee can see task select', () => {
	myTasksTrackedInTimesheets.taskSelectVisible();
});

When('Employee click on task select', () => {
	myTasksTrackedInTimesheets.clickTaskSelect();
});

Then('Employee can select task from dropdown options', () => {
	myTasksTrackedInTimesheets.selectOptionFromDropdown(0);
});

When('Employee click on start timer button', () => {
	myTasksTrackedInTimesheets.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button', () => {
	myTasksTrackedInTimesheets.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	myTasksTrackedInTimesheets.clickStopTimerBtn();
});

Then('Employee can see view timesheet button', () => {
	myTasksTrackedInTimesheets.viewTimesheetbtnVisible();
});

When('Employee click on view timesheet button', () => {
	myTasksTrackedInTimesheets.clickViewTimesheetBtn();
});
Then ('Employee verify project name is the same', () => {
	myTasksTrackedInTimesheets.verifyProjectText(MyTasksTrackedInTimesheetsPageData.defaultTaskTitle)
});




