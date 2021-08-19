import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as timeTrackingPage from '../../Base/pages/TimeTracking.po';
import { TimeTrackingPageData } from '../../Base/pagedata/TimeTrackingPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as faker from 'faker';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as addTaskPage from '../../Base/pages/AddTasks.po';
import { AddTasksPageData } from '../../Base/pagedata/AddTasksPageData';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { waitUntil } from '../../Base/utils/util';

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
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();
let employeeFullName = `${firstName} ${lastName}`;

let description = faker.lorem.text();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add employee
And('User can add new employee', () => {
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

// Add new project
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

// Add new client
And('User can add new client', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addClient(
		clientsPage,
		fullName,
		email,
		website,
		city,
		postcode,
		street,
		ClientsData,
		employeeFullName
	);
});

// Add new task
And('User can add new task', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addTask(addTaskPage, AddTasksPageData, employeeFullName);
});

// Logout
And('User can logout', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
});

// Login as employee
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

// Add time
And('Employee can see timer', () => {
	timeTrackingPage.timerVisible();
});

When('Employee click on timer', () => {
	timeTrackingPage.clickTimer();
});

Then('Employee can see timer button', () => {
	timeTrackingPage.timerBtnVisible();
});

When('Employee click on timer button', () => {
	timeTrackingPage.clickTimerBtn(1);
});

Then('Employee can see client dropdown', () => {
	timeTrackingPage.clientSelectVisible();
});

When('Employee click on client select', () => {
	timeTrackingPage.clickClientSelect();
});

Then('Employee can select client from dropdown options', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see project select', () => {
	timeTrackingPage.projectSelectVisible();
});

When('Employee click on project select', () => {
	timeTrackingPage.clickProjectSelect();
});

Then('Employee can select project from dropdown options', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see task select', () => {
	timeTrackingPage.taskSelectVisible();
});

When('Employee click on task select', () => {
	timeTrackingPage.clickTaskSelect();
});

Then('Employee can select task from dropdown options', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see description input field', () => {
	timeTrackingPage.descriptionInputVisible();
});

And('Employee can enter description', () => {
	timeTrackingPage.enterDescription(description);
});

And('Employee can see start timer button', () => {
	timeTrackingPage.startTimerBtnVisible();
});

When('Employee click on start timer button', () => {
	timeTrackingPage.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button', () => {
	timeTrackingPage.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	timeTrackingPage.clickStopTimerBtn();
});

Then('Employee can see again start timer button', () => {
	timeTrackingPage.startTimerBtnVisible();
});

And('Employee can see close button', () => {
	timeTrackingPage.closeBtnVisible();
});

When('Employee click on close button', () => {
	timeTrackingPage.clickCloseBtn();
});

Then('User can see tab button', () => {
	timeTrackingPage.tabBtnVisible();
});

When('User click on second tab button', () => {
	timeTrackingPage.clickTabBtn(1);
});

Then('Employee can verify time was recorded', () => {
	timeTrackingPage.verifyTimeWasRecorded(3, TimeTrackingPageData.time);
});

And('Employee can verify project worked', () => {
	timeTrackingPage.verifyWork(OrganizationProjectsPageData.name);
});

And('Employee can verify tasks worked', () => {
	timeTrackingPage.verifyWork(AddTasksPageData.defaultTaskProject);
});

// Add manual time
And('Employee can go back to dashboard tab', () => {
	timeTrackingPage.clickTabBtn(0);
});

When('Employee click on timer again', () => {
	timeTrackingPage.clickTimer();
});

Then('Employee can see manual time button', () => {
	timeTrackingPage.manualBtnVisible();
});

When('Employee click on manaul time button', () => {
	timeTrackingPage.clickManualBtn();
});

Then('Employee can see date input field', () => {
	timeTrackingPage.dateInputVisible();
});

And('Employee can enter date', () => {
	timeTrackingPage.enterDate();
	timeTrackingPage.clickKeyboardButtonByKeyCode(9);
});

And('Employee can see start time select', () => {
	timeTrackingPage.startTimeSelectVisible();
});

When('Employee click on start time select', () => {
	timeTrackingPage.clickStartTimeSelect();
});

Then('Employee can select start time from dropdown options', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see end time select', () => {
	timeTrackingPage.endTimeSelectVisible();
});

When('Employee click on end time select', () => {
	timeTrackingPage.clickEndTimeSelect();
});

Then('Employee can select end time from dropdown options', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see client dropdown again', () => {
	timeTrackingPage.clientSelectVisible();
});

When('Employee click on client select again', () => {
	timeTrackingPage.clickClientSelect();
});

Then('Employee can select client from dropdown options again', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see project select again', () => {
	timeTrackingPage.projectSelectVisible();
});

When('Employee click on project select again', () => {
	timeTrackingPage.clickProjectSelect();
});

Then('Employee can select project from dropdown options again', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see task select again', () => {
	timeTrackingPage.taskSelectVisible();
});

When('Employee click on task select again', () => {
	timeTrackingPage.clickTaskSelect();
});

Then('Employee can select task from dropdown options again', () => {
	timeTrackingPage.selectOptionFromDropdown(0);
});

And('Employee can see description input field again', () => {
	timeTrackingPage.descriptionInputVisible();
});

And('Employee can enter description again', () => {
	timeTrackingPage.enterDescription(description);
});

And('Employee can see add time button', () => {
	timeTrackingPage.addTimeBtnVisible();
});

When('User click on add time button', () => {
	timeTrackingPage.clickAddTimeBtn();
});

Then('Notification message will appear', () => {
	timeTrackingPage.waitMessageToHide();
});

And('User can see view timesheet button', () => {
	timeTrackingPage.viewTimesheetbtnVisible();
});

When('User click on view timesheet button', () => {
	timeTrackingPage.clickViewTimesheetBtn();
});

Then('User can verify manual time was added', () => {
	timeTrackingPage.verifyManualTime(TimeTrackingPageData.manual);
});
