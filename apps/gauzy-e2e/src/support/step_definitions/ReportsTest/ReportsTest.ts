import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as reportsPage from '../../Base/pages/Reports.po';
import { ReportsPageData } from '../../Base/pagedata/ReportsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as addTaskPage from '../../Base/pages/AddTasks.po';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import { AddTasksPageData } from '../../Base/pagedata/AddTasksPageData';
import * as timeTrackingPage from '../../Base/pages/TimeTracking.po';
import { TimeTrackingPageData } from '../../Base/pagedata/TimeTrackingPageData';


import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

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
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();
let employeeFullName = `${firstName} ${lastName}`;
let projectName = faker.company.companyName()


let description = faker.lorem.text();

let checked = 'be.checked';

// Login with email
Given('Login with default credentials and visit Reports page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/reports/all', { timeout: pageLoadTimeout });
});

// Reports test
// Verify Time tracking
And('User can verify Time tracking content', () => {
	reportsPage.verifyHeader(ReportsPageData.header);
	reportsPage.verifySubheader(ReportsPageData.timeTracking);
	reportsPage.verifyTitle(ReportsPageData.timeAndActivity);
	reportsPage.verifyTitle(ReportsPageData.weekly);
	reportsPage.verifyTitle(ReportsPageData.appsUrls);
	reportsPage.verifyTitle(ReportsPageData.manualTimeEdits);
	reportsPage.verifyTitle(ReportsPageData.expense);
});

And('User can verify Time tracking settings state', () => {
	reportsPage.verifyCheckboxState(0, checked);
	reportsPage.verifyCheckboxState(1, checked);
	reportsPage.verifyCheckboxState(2, checked);
	reportsPage.verifyCheckboxState(3, checked);
	reportsPage.verifyCheckboxState(4, checked);
});

// Payments tracking
And('User can verify Payments content', () => {
	reportsPage.verifySubheader(ReportsPageData.payments);
	reportsPage.verifyTitle(ReportsPageData.amountsOwed);
	reportsPage.verifyTitle(ReportsPageData.payments);
});

And('User can verify Payments settings state', () => {
	reportsPage.verifyCheckboxState(5, checked);
	reportsPage.verifyCheckboxState(6, checked);
});

// Time Off tracking
And('User can verify Time Off content', () => {
	reportsPage.verifySubheader(ReportsPageData.timeOff);
	reportsPage.verifyTitle(ReportsPageData.weeklyLimits);
	reportsPage.verifyTitle(ReportsPageData.dailyLimits);
});

And('User can verify Time Off settings state', () => {
	reportsPage.verifyCheckboxState(7, checked);
	reportsPage.verifyCheckboxState(8, checked);
});

// Invoices tracking
And('User can verify Invoices content', () => {
	reportsPage.verifySubheader(ReportsPageData.invoicing);
	reportsPage.verifyTitle(ReportsPageData.projectBudgets);
	reportsPage.verifyTitle(ReportsPageData.clientBudgets);
});

And('User can verify Invoices settings state', () => {
	reportsPage.verifyCheckboxState(9, checked);
	reportsPage.verifyCheckboxState(10, checked);
});

// Add new tag
And('User can add new tag', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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
		{
			name: projectName,
			hours: OrganizationProjectsPageData.hours,
			editName: OrganizationProjectsPageData.editName,
			description: OrganizationProjectsPageData.description,
			color: OrganizationProjectsPageData.color
		},
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
		{
			defaultProject: projectName,
			country: ClientsData.country,
			defaultPhone: ClientsData.defaultPhone,
			hours: ClientsData.hours
		},
		employeeFullName
	);
});

// Add new task
And('User can add new task', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addTask(addTaskPage,{ 
		defaultTaskProject: projectName,
		defaultTaskTitle: AddTasksPageData.defaultTaskTitle,
		editTaskTitle: AddTasksPageData.defaultTaskTitle,
		defaultTaskEstimateDays: AddTasksPageData.defaultTaskEstimateDays,
		defaultTaskEstimateHours: AddTasksPageData.defaultTaskEstimateHours,
		defaultTaskEstimateMinutes: AddTasksPageData.defaultTaskEstimateMinutes,
		defaultTaskDescription: AddTasksPageData.defaultTaskDescription
	}, employeeFullName);
});

// Logout
And('User can logout', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
});

// Login as employee
And('Newly created employee can log in', () => {
	CustomCommands.loginAsEmployee(
		loginPage,
		dashboardPage,
		employeeEmail,
		password
	);
});

// Add time
And('Employee can log time', () => {
	CustomCommands.addTime(timeTrackingPage, description, TimeTrackingPageData.urlConfirmDashboardLoad);
});

// Verify reports time log data
And('Employee can see Reports sidebar button', () => {
	reportsPage.sidebarBtnVidible();
});

When('Employee click on Reports sidebar button', () => {
	reportsPage.clickSidebarBtn(ReportsPageData.reports);
});

Then('Employee can click on Time & Activity sidebar button', () => {
	reportsPage.clickInnerSidebarBtn(ReportsPageData.timeAndActivity);
});

And('Employee can see activity level button', () => {
	reportsPage.activityLevelBtnVisible();
});

When('Employee click on activity level button', () => {
	reportsPage.clickActivityLevelBtn();
});

Then('Employee can see activity slider', () => {
	reportsPage.sliderVisible();
});

And('Employee can change slide value to filter reports data', () => {
	reportsPage.changeSliderValue();
});

Then('Employee can click again on activity level button to hide slider', () => {
	reportsPage.clickActivityLevelBtn();
});

And('Employee can verify time logged by total hours', () => {
	reportsPage.verifyTimeLogged(ReportsPageData.totalHours);
});

And('Employee can verify Time and Activity project worked', () => {
	reportsPage.verifyTimeAndActivityProject(projectName);
});

When('Employee can click on Amounts owed sidebar button', () => {
	reportsPage.clickInnerSidebarBtn(ReportsPageData.amountsOwed);
});

Then('Employee can verify his own name under employee section', () => {
	reportsPage.verifyEmployeeWorked(employeeFullName);
});

When('Employee click on Projects budgets sidebar button', () => {
	reportsPage.clickInnerSidebarBtn(ReportsPageData.projectBudgets);
});

Then('Employee can verify project that he worked on', () => {
	reportsPage.verifyProjectBudgetsProject(projectName);
});

When('Employee click on Clients budgets sidebar button', () => {
	reportsPage.clickInnerSidebarBtn(ReportsPageData.clientBudgets);
});

Then('Employee can verify projects client', () => {
	reportsPage.verifyClientsBudgetsClient(fullName);
});

And('User can verify budget progress bar', () => {
	reportsPage.verifyClientsBudgetsProgress(ReportsPageData.progress);
});
