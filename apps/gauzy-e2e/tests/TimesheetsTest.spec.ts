import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as timesheetsPage from './support/pages/Timesheets.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { TimesheetsPageData } from '../src/support/Base/pagedata/TimesheetsPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as addTaskPage from './support/pages/AddTasks.po';
import { AddTasksPageData } from '../src/support/Base/pagedata/AddTasksPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as clientsPage from './support/pages/Clients.po';
import { faker } from '@faker-js/faker';
import { ClientsData } from '../src/support/Base/pagedata/ClientsPageData';
import { CustomCommands } from './support/commands';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

let email = ' ';
let fullName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

test.describe('Timesheets test', () => {
	test('Timesheets test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add time', async () => {
			await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			await CustomCommands.addClient(
				clientsPage,
				fullName,
				email,
				website,
				city,
				postcode,
				street,
				ClientsData
			);
			await CustomCommands.addTask(addTaskPage, AddTasksPageData);
			await getPage().goto('/#/pages/employees/timesheets/daily');
			await timesheetsPage.addTimeButtonVisible();
			await timesheetsPage.clickAddTimeButton();
			await timesheetsPage.dateInputVisible();
			await timesheetsPage.enterDateData();
			await timesheetsPage.clickKeyboardButtonByKeyCode(9);
			await timesheetsPage.startTimeDropdownVisible();
			await timesheetsPage.clickStartTimeDropdown();
			await timesheetsPage.selectTaskFromDropdown(0);
			await timesheetsPage.selectProjectDropdownVisible();
			await timesheetsPage.clickSelectProjectDropdown();
			await timesheetsPage.selectProjectFromDropdown(TimesheetsPageData.defaultProjectName);
			await timesheetsPage.clientDropdownVisible();
			await timesheetsPage.clickClientDropdown();
			await timesheetsPage.selectClientFromDropdown(0);
			await timesheetsPage.taskDropdownVisible();
			await timesheetsPage.clickTaskDropdown();
			await timesheetsPage.selectTaskFromDropdown(0);
			await timesheetsPage.selectEmployeeDropdownVisible();
			await timesheetsPage.clickSelectEmployeeDropdown();
			await timesheetsPage.selectEmployeeFromDropdown(0);
			await timesheetsPage.addTimeLogDescriptionVisible();
			await timesheetsPage.enterTimeLogDescriptionData(TimesheetsPageData.defaultDescription);
			await timesheetsPage.saveTimeLogButtonVisible();
			await timesheetsPage.clickSaveTimeLogButton();
		});

		await test.step('Should be able to view time', async () => {
			await timesheetsPage.waitMessageToHide();
			await timesheetsPage.viewEmployeeTimeLogButtonVisible();
			await timesheetsPage.clickViewEmployeeTimeLogButton(0);
			await timesheetsPage.closeAddTimeLogPopoverButtonVisible();
			await timesheetsPage.clickCloseAddTimeLogPopoverButton();
		});

		await test.step('Should be able to edit time', async () => {
			await timesheetsPage.editEmployeeTimeLogButtonVisible();
			await timesheetsPage.clickEditEmployeeTimeLogButton(0);
			await timesheetsPage.dateInputVisible();
			await timesheetsPage.enterDateData();
			await timesheetsPage.clickKeyboardButtonByKeyCode(9);
			await timesheetsPage.addTimeLogDescriptionVisible();
			await timesheetsPage.enterTimeLogDescriptionData(TimesheetsPageData.defaultDescription);
			await timesheetsPage.saveTimeLogButtonVisible();
			await timesheetsPage.clickSaveTimeLogButton();
		});

		await test.step('Should be able to delete time', async () => {
			await timesheetsPage.waitMessageToHide();
			await timesheetsPage.deleteEmployeeTimeLogButtonVisible();
			await timesheetsPage.clickDeleteEmployeeTimeLogButton(0);
			await timesheetsPage.confirmDeleteButtonVisible();
			await timesheetsPage.clickConfirmDeleteButton();
		});
	});
});
