import { When } from '../../support/bdd';
import * as timesheetsPage from '../../support/pages/Timesheets.po';
import { TimesheetsPageData } from '../../../src/support/Base/pagedata/TimesheetsPageData';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as addTaskPage from '../../support/pages/AddTasks.po';
import { AddTasksPageData } from '../../../src/support/Base/pagedata/AddTasksPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import * as clientsPage from '../../support/pages/Clients.po';
import { faker } from '@faker-js/faker';
import { ClientsData } from '../../../src/support/Base/pagedata/ClientsPageData';
import { CustomCommands } from '../../support/commands';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';

// Converted 1:1 from the plain TimesheetsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po/CustomCommands call sequence, so runtime
// behaviour is identical to the already-CI-tested spec. Cross-step faker state (employee + client
// fields) is declared at module scope and initialised at the top of the first step. The `Given I am
// logged in as the default user` Background step is defined once in common.steps.ts.

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

When('I add a timesheet time log', async () => {
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
	// addTask ends on /#/pages/tasks/dashboard; a bare hash goto() to the timesheets route is a
	// same-document no-op (Angular hash-router never re-renders). Force the hash + wait for the
	// daily screen to mount before interacting. (ROOT CAUSE #8.)
	await timesheetsPage.navigateToDaily();
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

When('I view the timesheet time log', async () => {
	await timesheetsPage.waitMessageToHide();
	await timesheetsPage.viewEmployeeTimeLogButtonVisible();
	await timesheetsPage.clickViewEmployeeTimeLogButton(0);
	await timesheetsPage.closeAddTimeLogPopoverButtonVisible();
	await timesheetsPage.clickCloseAddTimeLogPopoverButton();
});

When('I edit the timesheet time log', async () => {
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

When('I delete the timesheet time log', async () => {
	await timesheetsPage.waitMessageToHide();
	await timesheetsPage.deleteEmployeeTimeLogButtonVisible();
	await timesheetsPage.clickDeleteEmployeeTimeLogButton(0);
	await timesheetsPage.confirmDeleteButtonVisible();
	await timesheetsPage.clickConfirmDeleteButton();
});
