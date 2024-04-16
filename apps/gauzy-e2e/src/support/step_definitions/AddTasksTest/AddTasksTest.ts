import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addTaskPage from '../../Base/pages/AddTasks.po';
import { AddTasksPageData } from '../../Base/pagedata/AddTasksPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

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

// Add new tag
Then('User can add new tag', () => {
	//dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employee
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
		OrganizationProjectsPageData
	);
});

// Add new task
When('User go to Tasks dashboard page', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/tasks/dashboard', { timeout: pageLoadTimeout });
});

Then('User can see gird button', () => {
	addTaskPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	addTaskPage.gridBtnClick(1);
});

And('User can see Add task button', () => {
	addTaskPage.addTaskButtonVisible();
});

When('User click on Add task button', () => {
	addTaskPage.clickAddTaskButton();
});

Then('User will see project dropdown', () => {
	addTaskPage.selectProjectDropdownVisible();
});

When('User click on project dropdown', () => {
	addTaskPage.clickSelectProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	addTaskPage.selectProjectOptionDropdown(
		AddTasksPageData.defaultTaskProject
	);
});

And('User can see employee dropdown', () => {
	addTaskPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	addTaskPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	addTaskPage.selectEmployeeDropdownOption(0);
	addTaskPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see title input field', () => {
	addTaskPage.addTitleInputVisible();
});

And('User can add value for title', () => {
	addTaskPage.enterTitleInputData(AddTasksPageData.defaultTaskTitle);
});

And('User can see due date input field', () => {
	addTaskPage.dueDateInputVisible();
});

And('User can enter value for due date', () => {
	addTaskPage.enterDueDateData();
	addTaskPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see estimate days input field', () => {
	addTaskPage.estimateDaysInputVisible();
});

And('User can enter value for estimate days', () => {
	addTaskPage.enterEstimateDaysInputData(
		AddTasksPageData.defaultTaskEstimateDays
	);
});

And('User can see estimate hours input field', () => {
	addTaskPage.estimateHoursInputVisible();
});

And('User can add value for estimate hours', () => {
	addTaskPage.enterEstimateHoursInputData(
		AddTasksPageData.defaultTaskEstimateHours
	);
});

And('User can see estimate minutes input field', () => {
	addTaskPage.estimateMinutesInputVisible();
});

And('User can enter value for estimate minutes', () => {
	addTaskPage.enterEstimateMinutesInputData(
		AddTasksPageData.defaultTaskEstimateMinutes
	);
});

And('User can task description input field', () => {
	addTaskPage.taskDescriptionTextareaVisible();
});

And('User can enter value for description', () => {
	addTaskPage.enterTaskDescriptionTextareaData(
		AddTasksPageData.defaultTaskDescription
	);
});

And('User can see save task button', () => {
	addTaskPage.saveTaskButtonVisible();
});

When('User click on save task button', () => {
	addTaskPage.clickSaveTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

When('User see title input field', () => {
	addTaskPage.verifyTitleInput();
});

Then('User enter title name', () => {
	addTaskPage.searchTitleName(AddTasksPageData.defaultTaskTitle);
});

And('User can see only the results', () => {
	addTaskPage.verifySearchResult(AddTasksPageData.tableResult);
});

And('User can verify task was created', () => {
	addTaskPage.verifyTaskExists(AddTasksPageData.defaultTaskTitle);
});

// Duplicate task
And('User clear the search field', () => {
	addTaskPage.clearSearchInput()
});

Then('User can see table populated with tasks', () => {
	addTaskPage.tasksTableVisible();
});

When('User click on table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('Duplicate task button will become active', () => {
	addTaskPage.duplicateTaskButtonVisible();
});

When('User click on duplicate task button', () => {
	addTaskPage.clickDuplicateTaskButton(0);
});

Then('User will see confirm action button', () => {
	addTaskPage.confirmDuplicateTaskButtonVisible();
});

When('User click on confirm action button', () => {
	addTaskPage.clickConfirmDuplicateTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

// Edit task
And('User can see tasks table again', () => {
	addTaskPage.tasksTableVisible();
});

When('User select table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('Edit task button will become active', () => {
	addTaskPage.editTaskButtonVisible();
});

When('User click on edit task button', () => {
	addTaskPage.clickEditTaskButton(0);
});

Then('User will see edit project dropdown', () => {
	addTaskPage.selectProjectDropdownVisible();
});

When('User click on edit project dropdown', () => {
	addTaskPage.clickSelectProjectDropdown();
});

Then('User can select new project from dropdown options', () => {
	addTaskPage.selectProjectOptionDropdown(
		AddTasksPageData.defaultTaskProject
	);
});

And('User can see edit title input field', () => {
	addTaskPage.addTitleInputVisible();
});

And('User can add value for edit title', () => {
	addTaskPage.enterTitleInputData(AddTasksPageData.editTaskTitle);
});

And('User can see edit due date input field', () => {
	addTaskPage.dueDateInputVisible();
});

And('User can enter value for edit due date', () => {
	addTaskPage.enterDueDateData();
	addTaskPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see edit estimate days input field', () => {
	addTaskPage.estimateDaysInputVisible();
});

And('User can enter value for estimate days edit', () => {
	addTaskPage.enterEstimateDaysInputData(
		AddTasksPageData.defaultTaskEstimateDays
	);
});

And('User can see edit estimate hours input field', () => {
	addTaskPage.estimateHoursInputVisible();
});

And('User can add value for estimate hours edit', () => {
	addTaskPage.enterEstimateHoursInputData(
		AddTasksPageData.defaultTaskEstimateHours
	);
});

And('User can see edit estimate minutes input field', () => {
	addTaskPage.estimateMinutesInputVisible();
});

And('User can enter value for estimate minutes edit', () => {
	addTaskPage.enterEstimateMinutesInputData(
		AddTasksPageData.defaultTaskEstimateMinutes
	);
});

And('User can task edit description input field', () => {
	addTaskPage.taskDescriptionTextareaVisible();
});

And('User can enter value for description edit', () => {
	addTaskPage.enterTaskDescriptionTextareaData(
		AddTasksPageData.defaultTaskDescription
	);
});

And('User can see save edited task button', () => {
	addTaskPage.saveTaskButtonVisible();
});

When('User click on save edited task button', () => {
	addTaskPage.clickSaveTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

And('User can verify task was edited', () => {
	addTaskPage.verifyTaskExists(AddTasksPageData.editTaskTitle);
});

// Delete task
And('User can see table for tasks', () => {
	addTaskPage.tasksTableVisible();
});

When('User click on first table row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('User can see duplicate or edit task button', () => {
	addTaskPage.duplicateTaskButtonVisible();
});

When('User click on duplicate or edit task button', () => {
	addTaskPage.clickDuplicateTaskButton(0);
});

Then('User can see confirm button', () => {
	addTaskPage.confirmDuplicateTaskButtonVisible();
});

When('User click on confirm button', () => {
	addTaskPage.clickConfirmDuplicateTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

And('User can see tasks table again', () => {
	addTaskPage.tasksTableVisible();
});

When('User click on table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('Delete task button will become active', () => {
	addTaskPage.deleteTaskButtonVisible();
});

When('User click on delete task button', () => {
	addTaskPage.clickDeleteTaskButton();
});

Then('User can see confirm delete button', () => {
	addTaskPage.confirmDeleteTaskButtonVisible();
});

When('User click on confirm delete button', () => {
	addTaskPage.clickConfirmDeleteTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

And('User can verify task was deleted', () => {
	addTaskPage.verifyElementIsDeleted(AddTasksPageData.editTaskTitle);
});

When('User click on table first row', () => {
	addTaskPage.selectFirstTaskTableRow(0);
});

Then('Delete button will become active again', () => {
	addTaskPage.deleteTaskButtonVisible();
});

When('User click on delete task button', () => {
	addTaskPage.clickDeleteTaskButton();
});

Then('User will see confirm delete button again', () => {
	addTaskPage.confirmDeleteTaskButtonVisible();
});

And('User can click again on confirm delete task button', () => {
	addTaskPage.clickConfirmDeleteTaskButton();
});
