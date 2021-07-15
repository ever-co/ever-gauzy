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
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

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

// Add new tag
Then('User can add new tag', () => {
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
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/tasks/dashboard');
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
	addTaskPage.enterEstiamteDaysInputData(
		AddTasksPageData.defaultTaskEstimateDays
	);
});

And('User can see estimate hours input field', () => {
	addTaskPage.estimateHoursInputVisible();
});

And('User can add value for estimate hours', () => {
	addTaskPage.enterEstiamteHoursInputData(
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
	addTaskPage.taskDecriptionTextareaVisible();
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

And('User can verify task was created', () => {
	addTaskPage.verifyTaskExists(AddTasksPageData.defaultTaskTitle);
});

// Duplicate task
Then('User can see table populated with tasks', () => {
	addTaskPage.tasksTableVisible();
});

When('User click on table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('Duplicate task button will become active', () => {
	addTaskPage.duplicateOrEditTaskButtonVisible();
});

When('User click on duplicate task button', () => {
	addTaskPage.clickDuplicateOrEditTaskButton(0);
});

Then('User will see confirm action button', () => {
	addTaskPage.confirmDuplicateOrEditTaskButtonVisible();
});

When('User click on confirm action button', () => {
	addTaskPage.clickConfirmDuplicateOrEditTaskButton();
});

Then('Notification message will appear', () => {
	addTaskPage.waitMessageToHide();
});

// Edit task
And('User can see tasks table again', () => {
	addTaskPage.tasksTableVisible();
});

When('User click on table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('Edit task button will become active', () => {
	addTaskPage.duplicateOrEditTaskButtonVisible();
});

When('User click on edit task button', () => {
	addTaskPage.clickDuplicateOrEditTaskButton(1);
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

And('User can see title input field', () => {
	addTaskPage.addTitleInputVisible();
});

And('User can add value for edit title', () => {
	addTaskPage.enterTitleInputData(AddTasksPageData.editTaskTitle);
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
	addTaskPage.enterEstiamteDaysInputData(
		AddTasksPageData.defaultTaskEstimateDays
	);
});

And('User can see estimate hours input field', () => {
	addTaskPage.estimateHoursInputVisible();
});

And('User can add value for estimate hours', () => {
	addTaskPage.enterEstiamteHoursInputData(
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
	addTaskPage.taskDecriptionTextareaVisible();
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

And('User can verify task was created', () => {
	addTaskPage.verifyTaskExists(AddTasksPageData.editTaskTitle);
});

// Delete task
When('User click on table first row', () => {
	addTaskPage.selectTasksTableRow(0);
});

Then('User can see duplicate or edit task button', () => {
	addTaskPage.duplicateOrEditTaskButtonVisible();
});

When('User click on duplicate or edit task button', () => {
	addTaskPage.clickDuplicateOrEditTaskButton(1);
});

Then('User can see confirm button', () => {
	addTaskPage.confirmDuplicateOrEditTaskButtonVisible();
});

When('User click on confirm button', () => {
	addTaskPage.clickConfirmDuplicateOrEditTaskButton();
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
	addTaskPage.selectTasksTableRow(0);
});

Then('Delete button will become active again', () => {
	addTaskPage.deleteTaskButtonVisible();
});

When('User click on delete task button', () => {
	addTaskPage.clickDeleteTaskButton();
});

Then('User will see confirm delte button again', () => {
	addTaskPage.confirmDeleteTaskButtonVisible();
});

And('User can click again on confirm delete task button', () => {
	addTaskPage.clickConfirmDeleteTaskButton();
});
