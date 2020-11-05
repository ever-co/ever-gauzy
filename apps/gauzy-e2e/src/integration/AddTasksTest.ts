import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Add tasks test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});
	it('Should be able to add new task', () => {
		cy.visit('/#/pages/organization/projects');
		addTaskPage.requestProjectButtonVisible();
		addTaskPage.clickRequestProjectButton();
		addTaskPage.projectNameInputVisible();
		addTaskPage.enterProjectNameInputData(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.saveProjectButtonVisible();
		addTaskPage.clickSaveProjectButton();
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
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.addTitleInputVisible();
		addTaskPage.enterTtielInputData(AddTasksPageData.defaultTaskTitle);
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
	});
	it('Should be able to duplicate task', () => {
		addTaskPage.tasksTableVisible();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.duplicateOrEditTaskButtonVisible();
		addTaskPage.clickDuplicateOrEditTaskButton(0);
		addTaskPage.confirmDuplicateOrEditTaskButtonVisible();
		addTaskPage.clickConfirmDuplicateOrEditTaskButton();
	});
	it('Should be able to edit task', () => {
		addTaskPage.tasksTableVisible();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.duplicateOrEditTaskButtonVisible();
		addTaskPage.clickDuplicateOrEditTaskButton(1);
		addTaskPage.selectProjectDropdownVisible();
		addTaskPage.clickSelectProjectDropdown();
		addTaskPage.selectProjectOptionDropdown(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.addTitleInputVisible();
		addTaskPage.enterTtielInputData(AddTasksPageData.defaultTaskTitle);
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
	});
	it('Should be able to delete task', () => {
		addTaskPage.tasksTableVisible();
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.selectTasksTableRow(0);
		addTaskPage.deleteTaskButtonVisible();
		addTaskPage.clickDeleteTaskButton();
		addTaskPage.confirmDeleteTaskButtonVisible();
		addTaskPage.clickConfirmDeleteTaskButton();
	});
});
