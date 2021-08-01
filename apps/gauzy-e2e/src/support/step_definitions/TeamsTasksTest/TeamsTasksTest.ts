import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as teamsTasksPage from '../../Base/pages/TeamsTasks.po';
import { TeamsTasksPageData } from '../../Base/pagedata/TeamsTasksPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as organizationTeamsPage from '../../Base/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../../Base/pagedata/OrganizationTeamsPageData';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add project
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
});

// Add team
And('User can add new team', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addTeam(organizationTeamsPage, OrganizationTeamsPageData);
});

// Add new task
And('User can visit Tasks team page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/tasks/team', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	teamsTasksPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	teamsTasksPage.gridBtnClick(1);
});

And('User can see add task button', () => {
	teamsTasksPage.addTaskButtonVisible();
});

When('User click on add task button', () => {
	teamsTasksPage.clickAddTaskButton();
});

Then('User can see project dropdown', () => {
	teamsTasksPage.selectProjectDropdownVisible();
});

When('User click on project dropdown', () => {
	teamsTasksPage.clickSelectProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	teamsTasksPage.selectProjectOptionDropdown(
		TeamsTasksPageData.defaultTaskProject
	);
});

And('User can see status dropdown', () => {
	teamsTasksPage.selectStatusDropdownVisible();
});

When('User click on status dropdown', () => {
	teamsTasksPage.clickStatusDropdown();
});

Then('User can select status from dropdown options', () => {
	teamsTasksPage.selectStatusFromDropdown(TeamsTasksPageData.defauleStatus);
});

And('User can see team dropdown', () => {
	teamsTasksPage.selectTeamDropdownVisible();
});

When('User click on team dropdown', () => {
	teamsTasksPage.clickSelectTeamDropdown();
});

Then('User can select team from dropdown options', () => {
	teamsTasksPage.selectTeamDropdownOption(0);
	teamsTasksPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see title input field', () => {
	teamsTasksPage.addTitleInputVisible();
});

And('User can enter title', () => {
	teamsTasksPage.enterTitleInputData(TeamsTasksPageData.defaultTaskTitle);
});

And('User can see tags dropdown', () => {
	teamsTasksPage.tagsMultyselectVisible();
});

When('User click on tags dropdown', () => {
	teamsTasksPage.clickTagsMultyselect();
});

Then('User can select tag from dropdown options', () => {
	teamsTasksPage.selectTagsFromDropdown(0);
	teamsTasksPage.clickCardBody();
});

And('User can see due date input field', () => {
	teamsTasksPage.dueDateInputVisible();
});

And('User can enter due date', () => {
	teamsTasksPage.enterDueDateData();
	teamsTasksPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see estimate days input field', () => {
	teamsTasksPage.estimateDaysInputVisible();
});

And('User can enter estimate days', () => {
	teamsTasksPage.enterEstiamteDaysInputData(
		TeamsTasksPageData.defaultTaskEstimateDays
	);
});

And('User can see estimate hours input field', () => {
	teamsTasksPage.estimateHoursInputVisible();
});

And('User can enter estimate hours', () => {
	teamsTasksPage.enterEstiamteHoursInputData(
		TeamsTasksPageData.defaultTaskEstimateHours
	);
});

And('User can see estimate minutes input field', () => {
	teamsTasksPage.estimateMinutesInputVisible();
});

And('User can enter estimate minutes', () => {
	teamsTasksPage.enterEstimateMinutesInputData(
		TeamsTasksPageData.defaultTaskEstimateMinutes
	);
});

And('User can see task description input field', () => {
	teamsTasksPage.taskDecriptionTextareaVisible();
});

And('User can enter task description', () => {
	teamsTasksPage.enterTaskDescriptionTextareaData(
		TeamsTasksPageData.defaultTaskDescription
	);
});

And('User can see task save button', () => {
	teamsTasksPage.saveTaskButtonVisible();
});

When('User click on save task button', () => {
	teamsTasksPage.clickSaveTaskButton();
});

Then('Notification message will appear', () => {
	teamsTasksPage.waitMessageToHide();
});

// Duplicate task
And('User can see tasks table', () => {
	teamsTasksPage.tasksTableVisible();
});

When('User select tasks table row', () => {
	teamsTasksPage.selectTasksTableRow(0);
});

Then('Duplicate task button will become active', () => {
	teamsTasksPage.duplicateOrEditTaskButtonVisible();
});

When('User click on duplicate task button', () => {
	teamsTasksPage.clickDuplicateOrEditTaskButton(0);
});

Then('User can see confirm duplicate task button', () => {
	teamsTasksPage.confirmDuplicateOrEditTaskButtonVisible();
});

When('User click on confirm duplicate task button', () => {
	teamsTasksPage.clickConfirmDuplicateOrEditTaskButton();
});

Then('Notification message will appear', () => {
	teamsTasksPage.waitMessageToHide();
});

// Edit task
And('User can see tasks table again', () => {
	teamsTasksPage.tasksTableVisible();
});

When('User select tasks table row again', () => {
	teamsTasksPage.selectTasksTableRow(0);
});

Then('Edit task button will become active', () => {
	teamsTasksPage.duplicateOrEditTaskButtonVisible();
});

When('User click on edit task button', () => {
	teamsTasksPage.clickDuplicateOrEditTaskButton(1);
});

Then('User can see title input field again', () => {
	teamsTasksPage.addTitleInputVisible();
});

And('User can enter new title', () => {
	teamsTasksPage.enterTitleInputData(TeamsTasksPageData.editTaskTitle);
});

And('User can see save edited task button', () => {
	teamsTasksPage.saveTaskButtonVisible();
});

When('User click on save edited task button', () => {
	teamsTasksPage.clickSaveTaskButton();
});

Then('Notification message will appear', () => {
	teamsTasksPage.waitMessageToHide();
});

// Delete task
And('User can see again tasks table', () => {
	teamsTasksPage.tasksTableVisible();
});

When('User select again tasks table row', () => {
	teamsTasksPage.selectTasksTableRow(0);
});

Then('Delete task button will become active', () => {
	teamsTasksPage.deleteTaskButtonVisible();
});

When('User click on delete task button', () => {
	teamsTasksPage.clickDeleteTaskButton();
});

Then('User can see confirm delete task button', () => {
	teamsTasksPage.confirmDeleteTaskButtonVisible();
});

When('User click on confirm delete task button', () => {
	teamsTasksPage.clickConfirmDeleteTaskButton();
});

Then('Notification message will appear', () => {
	teamsTasksPage.waitMessageToHide();
});
