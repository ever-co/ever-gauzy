import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timesheetsPage from '../support/Base/pages/Timesheets.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { TimesheetsPageData } from '../support/Base/pagedata/TimesheetsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as clientsPage from '../support/Base/pages/Clients.po';
import * as faker from 'faker';
import { ClientsData } from '../support/Base/pagedata/ClientsPageData';
import { CustomCommands } from '../support/commands';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

let email = ' ';
let fullName = ' ';
let country = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Timesheets test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		country = faker.address.country();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();

		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add time', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
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
		cy.visit('/#/pages/contacts/clients');
		clientsPage.gridBtnExists();
		clientsPage.gridBtnClick(1);
		clientsPage.addButtonVisible();
		clientsPage.clickAddButton();
		clientsPage.nameInputVisible();
		clientsPage.enterNameInputData(fullName);
		clientsPage.emailInputVisible();
		clientsPage.enterEmailInputData(email);
		clientsPage.phoneInputVisible();
		clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
		clientsPage.cityInputVisible();
		clientsPage.enterCityInputData(city);
		clientsPage.postcodeInputVisible();
		clientsPage.enterPostcodeInputData(postcode);
		clientsPage.streetInputVisible();
		clientsPage.enterStreetInputData(street);
		clientsPage.projectDropdownVisible();
		clientsPage.clickProjectDropdown();
		clientsPage.selectProjectFromDropdown(ClientsData.defaultProject);
		clientsPage.selectEmployeeDropdownVisible();
		clientsPage.clickSelectEmployeeDropdown();
		clientsPage.selectEmployeeDropdownOption(0);
		clientsPage.clickKeyboardButtonByKeyCode(9);
		clientsPage.tagsMultyselectVisible();
		clientsPage.clickTagsMultyselect();
		clientsPage.selectTagsFromDropdown(0);
		clientsPage.clickCardBody();
		clientsPage.websiteInputVisible();
		clientsPage.enterWebsiteInputData(website);
		clientsPage.saveButtonVisible();
		clientsPage.clickSaveButton();
		CustomCommands.addTask(addTaskPage, AddTasksPageData);
		cy.visit('/#/pages/employees/timesheets/daily');
		timesheetsPage.addTimeButtonVisible();
		timesheetsPage.clickAddTimeButton();
		timesheetsPage.dateInputVisible();
		timesheetsPage.enterDateData();
		timesheetsPage.clickKeyboardButtonByKeyCode(9);
		timesheetsPage.startTimeDropdownVisible();
		timesheetsPage.clickStartTimeDropdown();
		timesheetsPage.selectTaskFromDropdown(0);
		timesheetsPage.selectProjectDropdownVisible();
		timesheetsPage.clickSelectProjectDropdown();
		timesheetsPage.selectProjectFromDropdown(
			TimesheetsPageData.defaultProjectName
		);
		timesheetsPage.clientDropdownVisible();
		timesheetsPage.clickClientDropdown();
		timesheetsPage.selectClientFromDropdown(0);
		timesheetsPage.taskDropdownVisible();
		timesheetsPage.clickTaskDropdown();
		timesheetsPage.selectTaskFromDropdown(0);
		timesheetsPage.selectEmployeeDropdownVisible();
		timesheetsPage.clickSelectEmployeeDropdown();
		timesheetsPage.selectEmployeeFromDropdown(0);
		timesheetsPage.addTimeLogDescriptionVisible();
		timesheetsPage.enterTimeLogDescriptionData(
			TimesheetsPageData.defaultDescription
		);
		timesheetsPage.saveTimeLogButtonVisible();
		timesheetsPage.clickSaveTimeLogButton();
	});
	it('Should be able to view time', () => {
		timesheetsPage.waitMessageToHide();
		timesheetsPage.viewEmployeeTimeLogButtonVisible();
		timesheetsPage.clickViewEmployeeTimeLogButton(0);
		timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		timesheetsPage.clickCloseAddTimeLogPopoverButton();
	});
	it('Should be able to edit time', () => {
		timesheetsPage.editEmployeeTimeLogButtonVisible();
		timesheetsPage.clickEditEmployeeTimeLogButton(0);
		timesheetsPage.dateInputVisible();
		timesheetsPage.enterDateData();
		timesheetsPage.clickKeyboardButtonByKeyCode(9);
		timesheetsPage.addTimeLogDescriptionVisible();
		timesheetsPage.enterTimeLogDescriptionData(
			TimesheetsPageData.defaultDescription
		);
		timesheetsPage.saveTimeLogButtonVisible();
		timesheetsPage.clickSaveTimeLogButton();
	});
	it('Should be able to delete time', () => {
		timesheetsPage.waitMessageToHide();
		timesheetsPage.deleteEmployeeTimeLogButtonVisible();
		timesheetsPage.clickDeleteEmployeeTimeLogButton(0);
		timesheetsPage.confirmDeleteButtonVisible();
		timesheetsPage.clickConfirmDeleteButton();
	});
});
