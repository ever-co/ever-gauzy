import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as faker from 'faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Add tasks test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new task', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/tasks/dashboard');
		addTaskPage.gridBtnExists();
		addTaskPage.gridBtnClick(1);
		addTaskPage.addTaskButtonVisible();
		addTaskPage.clickAddTaskButton();
		addTaskPage.selectProjectDropdownVisible();
		addTaskPage.clickSelectProjectDropdown();
		addTaskPage.selectProjectOptionDropdown(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.selectEmployeeDropdownVisible();
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(0);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.addTitleInputVisible();
		addTaskPage.enterTitleInputData(AddTasksPageData.defaultTaskTitle);
		addTaskPage.dueDateInputVisible();
		addTaskPage.enterDueDateData();
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.estimateDaysInputVisible();
		addTaskPage.enterEstiamteDaysInputData(
			AddTasksPageData.defaultTaskEstimateDays
		);
		addTaskPage.estimateHoursInputVisible();
		addTaskPage.enterEstiamteHoursInputData(
			AddTasksPageData.defaultTaskEstimateHours
		);
		addTaskPage.estimateMinutesInputVisible();
		addTaskPage.enterEstimateMinutesInputData(
			AddTasksPageData.defaultTaskEstimateMinutes
		);
		addTaskPage.taskDecriptionTextareaVisible();
		addTaskPage.enterTaskDescriptionTextareaData(
			AddTasksPageData.defaultTaskDescription
		);
		addTaskPage.saveTaskButtonVisible();
		addTaskPage.clickSaveTaskButton();
		addTaskPage.waitMessageToHide();
		addTaskPage.verifyTaskExists(AddTasksPageData.defaultTaskTitle);
	});
	it('Should be able to duplicate task', () => {
		addTaskPage.tasksTableVisible();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.duplicateOrEditTaskButtonVisible();
		addTaskPage.clickDuplicateOrEditTaskButton(0);
		addTaskPage.confirmDuplicateOrEditTaskButtonVisible();
		addTaskPage.clickConfirmDuplicateOrEditTaskButton();
	});
	// it('Should be able to delete task', () => {
	// 	addTaskPage.waitMessageToHide();
	// 	addTaskPage.tasksTableVisible();
	// 	addTaskPage.selectTasksTableRow(0);
	// 	addTaskPage.deleteTaskButtonVisible();
	// 	addTaskPage.clickDeleteTaskButton();
	// 	addTaskPage.confirmDeleteTaskButtonVisible();
	// 	addTaskPage.clickConfirmDeleteTaskButton();
	// });
	it('Should be able to edit task', () => {
		addTaskPage.waitMessageToHide();
		addTaskPage.tasksTableVisible();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.duplicateOrEditTaskButtonVisible();
		addTaskPage.clickDuplicateOrEditTaskButton(1);
		addTaskPage.selectProjectDropdownVisible();
		addTaskPage.clickSelectProjectDropdown();
		addTaskPage.selectProjectOptionDropdown(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.addTitleInputVisible();
		addTaskPage.enterTitleInputData(AddTasksPageData.editTaskTitle);
		addTaskPage.dueDateInputVisible();
		addTaskPage.enterDueDateData();
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.estimateDaysInputVisible();
		addTaskPage.enterEstiamteDaysInputData(
			AddTasksPageData.defaultTaskEstimateDays
		);
		addTaskPage.estimateHoursInputVisible();
		addTaskPage.enterEstiamteHoursInputData(
			AddTasksPageData.defaultTaskEstimateHours
		);
		addTaskPage.estimateMinutesInputVisible();
		addTaskPage.enterEstimateMinutesInputData(
			AddTasksPageData.defaultTaskEstimateMinutes
		);
		addTaskPage.taskDecriptionTextareaVisible();
		addTaskPage.enterTaskDescriptionTextareaData(
			AddTasksPageData.defaultTaskDescription
		);
		addTaskPage.saveTaskButtonVisible();
		addTaskPage.clickSaveTaskButton();
		addTaskPage.waitMessageToHide();
		addTaskPage.verifyTaskExists(AddTasksPageData.editTaskTitle);
	});
	it('Should be able to delete task', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.duplicateOrEditTaskButtonVisible();
		addTaskPage.clickDuplicateOrEditTaskButton(1);
		addTaskPage.confirmDuplicateOrEditTaskButtonVisible();
		addTaskPage.clickConfirmDuplicateOrEditTaskButton();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.deleteTaskButtonVisible();
		addTaskPage.clickDeleteTaskButton();
		addTaskPage.confirmDeleteTaskButtonVisible();
		addTaskPage.clickConfirmDeleteTaskButton();
		addTaskPage.waitMessageToHide();
		addTaskPage.verifyElementIsDeleted(AddTasksPageData.editTaskTitle);
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.deleteTaskButtonVisible();
		addTaskPage.clickDeleteTaskButton();
		addTaskPage.confirmDeleteTaskButtonVisible();
		addTaskPage.clickConfirmDeleteTaskButton();
	});
});
