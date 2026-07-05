import { test } from './support/fixtures';
import { faker } from '@faker-js/faker';
import { CustomCommands } from './support/commands';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as logoutPage from './support/pages/Logout.po';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as myTasks from './support/pages/MyTasksTrackedInTimesheets.po';
import { MyTasksTrackedInTimesheetsPageData } from '../src/support/Base/pagedata/MyTasksTrackedInTimesheetsPageData';

// Per-run identity for the employee we create then log in AS. The suite shares ONE stateful DB and runs
// serially, so faker keeps every run's employee + task title unique and order-independent.
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';
let employeeFullName = ' ';
let taskTitle = ' ';

test.describe('My tasks tracked in timesheets test', () => {
	test('My tasks tracked in timesheets test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();
		employeeFullName = `${firstName} ${lastName}`;
		// Unique per-run title so the timer's task select + timesheet verify scope to THIS run's task only.
		taskTitle = `${MyTasksTrackedInTimesheetsPageData.defaultTaskTitle} ${faker.string.uuid()}`;

		// Scenario: Login with email
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Admin can add a new tag', async () => {
			await dashboardPage.verifyAccountingDashboardIfVisible();
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
		});

		await test.step('Admin can add a new employee', async () => {
			// Re-login mirrors the Cypress flow (logout + clear cookies between setup steps to reset state).
			await CustomCommands.logout(dashboardPage, logoutPage, loginPage);
			await CustomCommands.clearCookies();
			await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
		});

		await test.step('Admin can add a new project (assigned to the employee)', async () => {
			await CustomCommands.logout(dashboardPage, logoutPage, loginPage);
			await CustomCommands.clearCookies();
			await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData,
				employeeFullName
			);
		});

		await test.step('Admin logs out', async () => {
			await CustomCommands.logout(dashboardPage, logoutPage, loginPage);
			await CustomCommands.clearCookies();
		});

		await test.step('Employee can log in', async () => {
			await CustomCommands.loginAsEmployee(loginPage, dashboardPage, employeeEmail, password);
		});

		await test.step('Employee can create a task from My Tasks', async () => {
			await myTasks.navigateToMyTasks();
			await myTasks.verifyAddButton();
			await myTasks.clickOnAddTaskButton();
			await myTasks.selectProjectDropdownVisible();
			await myTasks.clickSelectProjectDropdown();
			await myTasks.selectProjectOptionDropdown(MyTasksTrackedInTimesheetsPageData.defaultTaskProject);
			await myTasks.selectStatusDropdownVisible();
			await myTasks.clickStatusDropdown();
			await myTasks.selectStatusFromDropdown(MyTasksTrackedInTimesheetsPageData.defaultStatus);
			await myTasks.addTitleInputVisible();
			await myTasks.enterTitleInputData(taskTitle);
			await myTasks.tagsMultiSelectVisible();
			await myTasks.clickTagsMultiSelect();
			await myTasks.selectTagsFromDropdown(0);
			await myTasks.clickCardBody();
			await myTasks.dueDateInputVisible();
			await myTasks.enterDueDateData();
			await myTasks.clickKeyboardButtonByKeyCode(9);
			await myTasks.estimateDaysInputVisible();
			await myTasks.enterEstimateDaysInputData(MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateDays);
			await myTasks.estimateHoursInputVisible();
			await myTasks.enterEstimateHoursInputData(MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateHours);
			await myTasks.estimateMinutesInputVisible();
			await myTasks.enterEstimateMinutesInputData(
				MyTasksTrackedInTimesheetsPageData.defaultTaskEstimateMinutes
			);
			await myTasks.taskDescriptionTextareaVisible();
			await myTasks.enterTaskDescriptionTextareaData(
				MyTasksTrackedInTimesheetsPageData.defaultTaskDescription
			);
			await myTasks.saveTaskButtonVisible();
			await myTasks.clickSaveTaskButton();
			await myTasks.waitMessageToHide();
		});

		await test.step('Employee can record time against the new task', async () => {
			await myTasks.timerVisible();
			await myTasks.clickTimer();
			await myTasks.timerBtnVisible();
			await myTasks.taskSelectVisible();
			await myTasks.clickTaskSelect();
			await myTasks.selectOptionFromDropdown(0);
			await myTasks.clickStartTimerBtn();
			// Let the timer run ~5s (mirrors the Cypress waitUntil(5000)) so a real session is recorded.
			await myTasks.letTimerRun(5000);
		});

		await test.step('Employee can stop the timer and view the timesheet', async () => {
			await myTasks.stopTimerBtnVisible();
			await myTasks.clickStopTimerBtn();
			await myTasks.viewTimesheetBtnVisible();
			await myTasks.clickViewTimesheetBtn();
			// Best-effort: verify the recorded task title surfaces on the timesheet daily view.
			await myTasks.verifyProjectText(taskTitle);
		});
	});
});
