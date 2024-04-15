import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import * as goalsKPIPage from '../support/Base/pages/GoalsKPI.po';
import { GoalsKPIPageData } from '../support/Base/pagedata/GoalsKPIPageData';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Goals KPI test', () => {
	before(() => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add new KPI', () => {
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/goals/settings');
		goalsKPIPage.tabButtonVisible();
		goalsKPIPage.clickTabButton(2);
		goalsKPIPage.addKPIButtonVisible();
		goalsKPIPage.clickAddKPIButton();
		goalsKPIPage.nameInputVisible();
		goalsKPIPage.enterNameInputData(GoalsKPIPageData.name);
		goalsKPIPage.descriptionInputVisible();
		goalsKPIPage.enterDescriptionInputData(GoalsKPIPageData.description);
		goalsKPIPage.employeeMultiSelectVisible();
		goalsKPIPage.clickEmployeeMultiSelect();
		goalsKPIPage.employeeDropdownVisible();
		goalsKPIPage.selectEmployeeFromDropdown(0);
		goalsKPIPage.valueInputVisible();
		goalsKPIPage.enterValueInputData(GoalsKPIPageData.value);
		goalsKPIPage.saveKPIButtonVisible();
		goalsKPIPage.clickSaveKPIButton();
	});
	it('Should be able to edit KPI', () => {
		goalsKPIPage.waitMessageToHide();
		goalsKPIPage.verifyKPIExists(GoalsKPIPageData.name);
		goalsKPIPage.tableRowVisible();
		goalsKPIPage.selectTableRow(0);
		goalsKPIPage.editKPIButtonVisible();
		goalsKPIPage.clickEditKPIButton();
		goalsKPIPage.nameInputVisible();
		goalsKPIPage.enterNameInputData(GoalsKPIPageData.name);
		goalsKPIPage.descriptionInputVisible();
		goalsKPIPage.enterDescriptionInputData(GoalsKPIPageData.description);
		goalsKPIPage.employeeMultiSelectVisible();
		goalsKPIPage.clickEmployeeMultiSelect();
		goalsKPIPage.employeeDropdownVisible();
		goalsKPIPage.selectEmployeeFromDropdown(0);
		goalsKPIPage.valueInputVisible();
		goalsKPIPage.enterValueInputData(GoalsKPIPageData.value);
		goalsKPIPage.saveKPIButtonVisible();
		goalsKPIPage.clickSaveKPIButton();
	});
	it('Should be able to delete KPI', () => {
		goalsKPIPage.waitMessageToHide();
		goalsKPIPage.verifyKPIExists(GoalsKPIPageData.name);
		goalsKPIPage.tableRowVisible();
		goalsKPIPage.selectTableRow(0);
		goalsKPIPage.deleteKPIButtonVisible();
		goalsKPIPage.clickDeleteKPIButton();
		goalsKPIPage.confirmDeleteButtonVisible();
		goalsKPIPage.clickConfirmDeleteButton();
		goalsKPIPage.verifyElementDeleted(GoalsKPIPageData.emptyTableText);
	});
});
