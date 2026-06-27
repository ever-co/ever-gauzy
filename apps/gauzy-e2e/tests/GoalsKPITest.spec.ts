import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as goalsKPIPage from './support/pages/GoalsKPI.po';
import { GoalsKPIPageData } from '../src/support/Base/pagedata/GoalsKPIPageData';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Goals KPI test', () => {
	test('Goals KPI test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new KPI', async () => {
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			await getPage().goto('/#/pages/goals/settings');
			await goalsKPIPage.tabButtonVisible();
			await goalsKPIPage.clickTabButton(2);
			await goalsKPIPage.addKPIButtonVisible();
			await goalsKPIPage.clickAddKPIButton();
			await goalsKPIPage.nameInputVisible();
			await goalsKPIPage.enterNameInputData(GoalsKPIPageData.name);
			await goalsKPIPage.descriptionInputVisible();
			await goalsKPIPage.enterDescriptionInputData(GoalsKPIPageData.description);
			await goalsKPIPage.employeeMultiSelectVisible();
			await goalsKPIPage.clickEmployeeMultiSelect();
			await goalsKPIPage.employeeDropdownVisible();
			await goalsKPIPage.selectEmployeeFromDropdown(0);
			await goalsKPIPage.valueInputVisible();
			await goalsKPIPage.enterValueInputData(GoalsKPIPageData.value);
			await goalsKPIPage.saveKPIButtonVisible();
			await goalsKPIPage.clickSaveKPIButton();
		});

		await test.step('Should be able to edit KPI', async () => {
			await goalsKPIPage.waitMessageToHide();
			await goalsKPIPage.verifyKPIExists(GoalsKPIPageData.name);
			await goalsKPIPage.tableRowVisible();
			await goalsKPIPage.selectTableRow(0);
			await goalsKPIPage.editKPIButtonVisible();
			await goalsKPIPage.clickEditKPIButton();
			await goalsKPIPage.nameInputVisible();
			await goalsKPIPage.enterNameInputData(GoalsKPIPageData.name);
			await goalsKPIPage.descriptionInputVisible();
			await goalsKPIPage.enterDescriptionInputData(GoalsKPIPageData.description);
			await goalsKPIPage.employeeMultiSelectVisible();
			await goalsKPIPage.clickEmployeeMultiSelect();
			await goalsKPIPage.employeeDropdownVisible();
			await goalsKPIPage.selectEmployeeFromDropdown(0);
			await goalsKPIPage.valueInputVisible();
			await goalsKPIPage.enterValueInputData(GoalsKPIPageData.value);
			await goalsKPIPage.saveKPIButtonVisible();
			await goalsKPIPage.clickSaveKPIButton();
		});

		await test.step('Should be able to delete KPI', async () => {
			await goalsKPIPage.waitMessageToHide();
			await goalsKPIPage.verifyKPIExists(GoalsKPIPageData.name);
			await goalsKPIPage.tableRowVisible();
			await goalsKPIPage.selectTableRow(0);
			await goalsKPIPage.deleteKPIButtonVisible();
			await goalsKPIPage.clickDeleteKPIButton();
			await goalsKPIPage.confirmDeleteButtonVisible();
			await goalsKPIPage.clickConfirmDeleteButton();
			// Verify by KPI name (the row is gone), not the empty-table string: the app's KPI no-data
			// message changed and the shared grid may still hold other KPIs.
			await goalsKPIPage.waitMessageToHide();
			await goalsKPIPage.verifyElementDeleted(GoalsKPIPageData.name);
		});
	});
});
