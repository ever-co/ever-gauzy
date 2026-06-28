import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addTaskPage from './support/pages/AddTasks.po';
import { AddTasksPageData } from '../src/support/Base/pagedata/AddTasksPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';
// Unique per-run task titles. The suite shares ONE stateful DB and runs serially, so a STATIC
// title can collide with rows left by an earlier run/spec; a faker suffix makes EVERY downstream
// row-select / verify-exists / verify-deleted scope to THIS run's task only (order-independent).
let taskTitle = ' ';
let editedTaskTitle = ' ';

test.describe('Add tasks test', () => {
	test('Add tasks test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();
		taskTitle = `${AddTasksPageData.defaultTaskTitle} ${faker.string.uuid()}`;
		editedTaskTitle = `${AddTasksPageData.editTaskTitle} ${faker.string.uuid()}`;

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new task', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			// Force the hash route through the Angular router: a bare goto() right after addEmployee
			// (which ends on /#/pages/employees) is a same-document no-op and leaves the employees grid
			// mounted, so the Add click would re-open the employee dialog and ga-project-selector never
			// renders. (Playbook pattern 8.)
			await addTaskPage.navigateToTasksDashboard();
			await addTaskPage.gridBtnExists();
			await addTaskPage.gridBtnClick(1);
			await addTaskPage.addTaskButtonVisible();
			await addTaskPage.clickAddTaskButton();
			await addTaskPage.selectProjectDropdownVisible();
			await addTaskPage.clickSelectProjectDropdown();
			await addTaskPage.selectProjectOptionDropdown(AddTasksPageData.defaultTaskProject);
			await addTaskPage.selectEmployeeDropdownVisible();
			await addTaskPage.clickSelectEmployeeDropdown();
			await addTaskPage.selectEmployeeDropdownOption(0);
			await addTaskPage.clickKeyboardButtonByKeyCode(9);
			await addTaskPage.addTitleInputVisible();
			await addTaskPage.enterTitleInputData(taskTitle);
			await addTaskPage.dueDateInputVisible();
			await addTaskPage.enterDueDateData();
			await addTaskPage.clickKeyboardButtonByKeyCode(9);
			await addTaskPage.estimateDaysInputVisible();
			await addTaskPage.enterEstimateDaysInputData(AddTasksPageData.defaultTaskEstimateDays);
			await addTaskPage.estimateHoursInputVisible();
			await addTaskPage.enterEstimateHoursInputData(AddTasksPageData.defaultTaskEstimateHours);
			await addTaskPage.estimateMinutesInputVisible();
			await addTaskPage.enterEstimateMinutesInputData(AddTasksPageData.defaultTaskEstimateMinutes);
			await addTaskPage.taskDescriptionTextareaVisible();
			await addTaskPage.enterTaskDescriptionTextareaData(AddTasksPageData.defaultTaskDescription);
			await addTaskPage.saveTaskButtonVisible();
			await addTaskPage.clickSaveTaskButton();
			await addTaskPage.waitMessageToHide();
			await addTaskPage.verifyTaskExists(taskTitle);
		});

		await test.step('Should be able to duplicate task', async () => {
			await addTaskPage.tasksTableVisible();
			// Select THIS run's task by its unique title (not row 0 — the grid may hold rows from
			// earlier specs/runs), then click the Duplicate toolbar action and confirm Save in the
			// dialog. A second row with the same title now exists.
			await addTaskPage.selectTaskRowByName(taskTitle);
			await addTaskPage.duplicateTaskButtonVisible();
			await addTaskPage.clickDuplicateTaskAction();
			await addTaskPage.confirmDuplicateTaskButtonVisible();
			await addTaskPage.clickConfirmDuplicateTaskButton();
			await addTaskPage.waitMessageToHide();
			await addTaskPage.verifyTaskExists(taskTitle);
		});

		await test.step('Should be able to edit task', async () => {
			await addTaskPage.tasksTableVisible();
			// Edit one of THIS run's rows: select by unique title, open Edit, rename to the unique
			// edited title, re-save.
			await addTaskPage.selectTaskRowByName(taskTitle);
			await addTaskPage.editTaskButtonVisible();
			await addTaskPage.clickEditTaskAction();
			await addTaskPage.addTitleInputVisible();
			await addTaskPage.enterTitleInputData(editedTaskTitle);
			await addTaskPage.dueDateInputVisible();
			await addTaskPage.enterDueDateData();
			await addTaskPage.clickKeyboardButtonByKeyCode(9);
			await addTaskPage.estimateDaysInputVisible();
			await addTaskPage.enterEstimateDaysInputData(AddTasksPageData.defaultTaskEstimateDays);
			await addTaskPage.estimateHoursInputVisible();
			await addTaskPage.enterEstimateHoursInputData(AddTasksPageData.defaultTaskEstimateHours);
			await addTaskPage.estimateMinutesInputVisible();
			await addTaskPage.enterEstimateMinutesInputData(AddTasksPageData.defaultTaskEstimateMinutes);
			await addTaskPage.taskDescriptionTextareaVisible();
			await addTaskPage.enterTaskDescriptionTextareaData(AddTasksPageData.defaultTaskDescription);
			await addTaskPage.saveTaskButtonVisible();
			await addTaskPage.clickSaveTaskButton();
			await addTaskPage.waitMessageToHide();
			await addTaskPage.verifyTaskExists(editedTaskTitle);
		});

		await test.step('Should be able to delete task', async () => {
			await addTaskPage.tasksTableVisible();
			// Delete the edited row (unique title), confirm, then assert that exact title is gone.
			await addTaskPage.selectTaskRowByName(editedTaskTitle);
			await addTaskPage.deleteTaskButtonVisible();
			await addTaskPage.clickDeleteTaskButton();
			await addTaskPage.confirmDeleteTaskButtonVisible();
			await addTaskPage.clickConfirmDeleteTaskButton();
			await addTaskPage.waitMessageToHide();
			await addTaskPage.verifyElementIsDeleted(editedTaskTitle);
			// Clean up the remaining duplicate row (still carries the original unique title).
			await addTaskPage.selectTaskRowByName(taskTitle);
			await addTaskPage.deleteTaskButtonVisible();
			await addTaskPage.clickDeleteTaskButton();
			await addTaskPage.confirmDeleteTaskButtonVisible();
			await addTaskPage.clickConfirmDeleteTaskButton();
		});
	});
});
