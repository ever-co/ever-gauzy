import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as teamsTasksPage from '../support/Base/pages/TeamsTasks.po';
import { TeamsTasksPageData } from '../support/Base/pagedata/TeamsTasksPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as organizationTeamsPage from '../support/Base/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../support/Base/pagedata/OrganizationTeamsPageData';

describe('Add teams tasks test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new task', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		CustomCommands.addTeam(
			organizationTeamsPage,
			OrganizationTeamsPageData
		);
		cy.visit('/#/pages/tasks/team');
		teamsTasksPage.gridBtnExists();
		teamsTasksPage.gridBtnClick(1);
		teamsTasksPage.addTaskButtonVisible();
		teamsTasksPage.clickAddTaskButton();
		teamsTasksPage.selectProjectDropdownVisible();
		teamsTasksPage.clickSelectProjectDropdown();
		teamsTasksPage.selectProjectOptionDropdown(
			TeamsTasksPageData.defaultTaskProject
		);
		teamsTasksPage.selectStatusDropdownVisible();
		teamsTasksPage.clickStatusDropdown();
		teamsTasksPage.selectStatusFromDropdown(
			TeamsTasksPageData.defauleStatus
		);
		teamsTasksPage.selectTeamDropdownVisible();
		teamsTasksPage.clickSelectTeamDropdown();
		teamsTasksPage.selectTeamDropdownOption(0);
		teamsTasksPage.clickKeyboardButtonByKeyCode(9);
		teamsTasksPage.addTitleInputVisible();
		teamsTasksPage.enterTitleInputData(TeamsTasksPageData.defaultTaskTitle);
		teamsTasksPage.tagsMultyselectVisible();
		teamsTasksPage.clickTagsMultyselect();
		teamsTasksPage.selectTagsFromDropdown(0);
		teamsTasksPage.clickCardBody();
		teamsTasksPage.dueDateInputVisible();
		teamsTasksPage.enterDueDateData();
		teamsTasksPage.clickKeyboardButtonByKeyCode(9);
		teamsTasksPage.estimateDaysInputVisible();
		teamsTasksPage.enterEstiamteDaysInputData(
			TeamsTasksPageData.defaultTaskEstimateDays
		);
		teamsTasksPage.estimateHoursInputVisible();
		teamsTasksPage.enterEstiamteHoursInputData(
			TeamsTasksPageData.defaultTaskEstimateHours
		);
		teamsTasksPage.estimateMinutesInputVisible();
		teamsTasksPage.enterEstimateMinutesInputData(
			TeamsTasksPageData.defaultTaskEstimateMinutes
		);
		teamsTasksPage.taskDecriptionTextareaVisible();
		teamsTasksPage.enterTaskDescriptionTextareaData(
			TeamsTasksPageData.defaultTaskDescription
		);
		teamsTasksPage.saveTaskButtonVisible();
		teamsTasksPage.clickSaveTaskButton();
	});
	it('Should be able to duplicate task', () => {
		teamsTasksPage.tasksTableVisible();
		teamsTasksPage.selectTasksTableRow(0);
		teamsTasksPage.duplicateOrEditTaskButtonVisible();
		teamsTasksPage.clickDuplicateOrEditTaskButton(0);
		teamsTasksPage.confirmDuplicateOrEditTaskButtonVisible();
		teamsTasksPage.clickConfirmDuplicateOrEditTaskButton();
	});
	it('Should be able to edit task', () => {
		teamsTasksPage.tasksTableVisible();
		teamsTasksPage.selectTasksTableRow(0);
		teamsTasksPage.duplicateOrEditTaskButtonVisible();
		teamsTasksPage.clickDuplicateOrEditTaskButton(1);
		teamsTasksPage.selectProjectDropdownVisible();
		teamsTasksPage.clickSelectProjectDropdown();
		teamsTasksPage.selectProjectOptionDropdown(
			TeamsTasksPageData.defaultTaskProject
		);
		teamsTasksPage.addTitleInputVisible();
		teamsTasksPage.enterTitleInputData(TeamsTasksPageData.defaultTaskTitle);
		teamsTasksPage.dueDateInputVisible();
		teamsTasksPage.enterDueDateData();
		teamsTasksPage.clickKeyboardButtonByKeyCode(9);
		teamsTasksPage.estimateDaysInputVisible();
		teamsTasksPage.enterEstiamteDaysInputData(
			TeamsTasksPageData.defaultTaskEstimateDays
		);
		teamsTasksPage.estimateHoursInputVisible();
		teamsTasksPage.enterEstiamteHoursInputData(
			TeamsTasksPageData.defaultTaskEstimateHours
		);
		teamsTasksPage.estimateMinutesInputVisible();
		teamsTasksPage.enterEstimateMinutesInputData(
			TeamsTasksPageData.defaultTaskEstimateMinutes
		);
		teamsTasksPage.taskDecriptionTextareaVisible();
		teamsTasksPage.enterTaskDescriptionTextareaData(
			TeamsTasksPageData.defaultTaskDescription
		);
		teamsTasksPage.saveTaskButtonVisible();
		teamsTasksPage.clickSaveTaskButton();
	});
	it('Should be able to delete task', () => {
		teamsTasksPage.tasksTableVisible();
		teamsTasksPage.selectTasksTableRow(0);
		teamsTasksPage.deleteTaskButtonVisible();
		teamsTasksPage.clickDeleteTaskButton();
		teamsTasksPage.confirmDeleteTaskButtonVisible();
		teamsTasksPage.clickConfirmDeleteTaskButton();
	});
});
