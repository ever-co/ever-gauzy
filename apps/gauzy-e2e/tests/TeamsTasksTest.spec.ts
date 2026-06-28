import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as teamsTasksPage from './support/pages/TeamsTasks.po';
import { TeamsTasksPageData } from '../src/support/Base/pagedata/TeamsTasksPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationTeamsPage from './support/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../src/support/Base/pagedata/OrganizationTeamsPageData';

test.describe('Add teams tasks test', () => {
	test('Add teams tasks test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new task', async () => {
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await CustomCommands.addTeam(
				organizationTeamsPage,
				OrganizationTeamsPageData
			);
			// A bare goto('/#/pages/tasks/team') right after addTeam (which ends on
			// /#/pages/organization/teams) is a same-document hash NO-OP: the SPA stays on the teams grid
			// and the Add click would re-open the teams dialog, so ga-project-selector never renders. Force
			// the hash through the router and wait for the Team's Tasks screen to mount. (Playbook pattern 8.)
			await teamsTasksPage.navigateToTeamsTasks();
			await teamsTasksPage.gridBtnExists();
			await teamsTasksPage.gridBtnClick(1);
			await teamsTasksPage.addTaskButtonVisible();
			await teamsTasksPage.clickAddTaskButton();
			await teamsTasksPage.selectProjectDropdownVisible();
			await teamsTasksPage.clickSelectProjectDropdown();
			await teamsTasksPage.selectProjectOptionDropdown(
				TeamsTasksPageData.defaultTaskProject
			);
			await teamsTasksPage.selectStatusDropdownVisible();
			await teamsTasksPage.clickStatusDropdown();
			await teamsTasksPage.selectStatusFromDropdown(
				TeamsTasksPageData.defaultStatus
			);
			await teamsTasksPage.selectTeamDropdownVisible();
			await teamsTasksPage.clickSelectTeamDropdown();
			await teamsTasksPage.selectTeamDropdownOption(0);
			await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
			await teamsTasksPage.addTitleInputVisible();
			await teamsTasksPage.enterTitleInputData(TeamsTasksPageData.defaultTaskTitle);
			await teamsTasksPage.tagsMultiSelectVisible();
			await teamsTasksPage.clickTagsMultiSelect();
			await teamsTasksPage.selectTagsFromDropdown(0);
			await teamsTasksPage.clickCardBody();
			await teamsTasksPage.dueDateInputVisible();
			await teamsTasksPage.enterDueDateData();
			await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
			await teamsTasksPage.estimateDaysInputVisible();
			await teamsTasksPage.enterEstimateDaysInputData(
				TeamsTasksPageData.defaultTaskEstimateDays
			);
			await teamsTasksPage.estimateHoursInputVisible();
			await teamsTasksPage.enterEstimateHoursInputData(
				TeamsTasksPageData.defaultTaskEstimateHours
			);
			await teamsTasksPage.estimateMinutesInputVisible();
			await teamsTasksPage.enterEstimateMinutesInputData(
				TeamsTasksPageData.defaultTaskEstimateMinutes
			);
			await teamsTasksPage.taskDescriptionTextareaVisible();
			await teamsTasksPage.enterTaskDescriptionTextareaData(
				TeamsTasksPageData.defaultTaskDescription
			);
			await teamsTasksPage.saveTaskButtonVisible();
			await teamsTasksPage.clickSaveTaskButton();
			await teamsTasksPage.waitMessageToHide();
			await teamsTasksPage.verifyTaskExists(TeamsTasksPageData.defaultTaskTitle);
		});

		await test.step('Should be able to duplicate task', async () => {
			await teamsTasksPage.tasksTableVisible();
			await teamsTasksPage.selectTasksTableRow(0);
			await teamsTasksPage.duplicateOrEditTaskButtonVisible();
			await teamsTasksPage.clickDuplicateOrEditTaskButton(0);
			await teamsTasksPage.confirmDuplicateOrEditTaskButtonVisible();
			await teamsTasksPage.clickConfirmDuplicateOrEditTaskButton();
		});

		await test.step('Should be able to delete task', async () => {
			await teamsTasksPage.waitMessageToHide();
			await teamsTasksPage.tasksTableVisible();
			await teamsTasksPage.selectTasksTableRow(0);
			await teamsTasksPage.deleteTaskButtonVisible();
			await teamsTasksPage.clickDeleteTaskButton();
			await teamsTasksPage.confirmDeleteTaskButtonVisible();
			await teamsTasksPage.clickConfirmDeleteTaskButton();
		});

		await test.step('Should be able to edit task', async () => {
			await teamsTasksPage.waitMessageToHide();
			await teamsTasksPage.tasksTableVisible();
			await teamsTasksPage.selectTasksTableRow(0);
			await teamsTasksPage.duplicateOrEditTaskButtonVisible();
			await teamsTasksPage.clickDuplicateOrEditTaskButton(1);
			await teamsTasksPage.selectProjectDropdownVisible();
			await teamsTasksPage.clickSelectProjectDropdown();
			await teamsTasksPage.selectProjectOptionDropdown(
				TeamsTasksPageData.defaultTaskProject
			);
			await teamsTasksPage.addTitleInputVisible();
			await teamsTasksPage.enterTitleInputData(TeamsTasksPageData.editTaskTitle);
			await teamsTasksPage.dueDateInputVisible();
			await teamsTasksPage.enterDueDateData();
			await teamsTasksPage.clickKeyboardButtonByKeyCode(9);
			await teamsTasksPage.estimateDaysInputVisible();
			await teamsTasksPage.enterEstimateDaysInputData(
				TeamsTasksPageData.defaultTaskEstimateDays
			);
			await teamsTasksPage.estimateHoursInputVisible();
			await teamsTasksPage.enterEstimateHoursInputData(
				TeamsTasksPageData.defaultTaskEstimateHours
			);
			await teamsTasksPage.estimateMinutesInputVisible();
			await teamsTasksPage.enterEstimateMinutesInputData(
				TeamsTasksPageData.defaultTaskEstimateMinutes
			);
			await teamsTasksPage.taskDescriptionTextareaVisible();
			await teamsTasksPage.enterTaskDescriptionTextareaData(
				TeamsTasksPageData.defaultTaskDescription
			);
			await teamsTasksPage.saveTaskButtonVisible();
			await teamsTasksPage.clickSaveTaskButton();
			await teamsTasksPage.waitMessageToHide();
			await teamsTasksPage.verifyTaskExists(TeamsTasksPageData.editTaskTitle);
		});

		await test.step('Should be able to delete task', async () => {
			await teamsTasksPage.waitMessageToHide();
			await teamsTasksPage.tasksTableVisible();
			await teamsTasksPage.selectTasksTableRow(0);
			await teamsTasksPage.deleteTaskButtonVisible();
			await teamsTasksPage.clickDeleteTaskButton();
			await teamsTasksPage.confirmDeleteTaskButtonVisible();
			await teamsTasksPage.clickConfirmDeleteTaskButton();
			await teamsTasksPage.waitMessageToHide();
			// Scope the deleted-check to the edited task's title (the row we just removed) so leftover rows
			// from intra-run pollution don't flake the assertion. (Round 3 anti-pollution guidance.)
			await teamsTasksPage.verifyTaskIsDeleted(TeamsTasksPageData.editTaskTitle);
		});
	});
});
