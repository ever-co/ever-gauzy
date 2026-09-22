import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';
import * as goalsKPIPage from '../../support/pages/GoalsKPI.po';
import { GoalsKPIPageData } from '../../../src/support/Base/pagedata/GoalsKPIPageData';

// Converted 1:1 from the plain GoalsKPITest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts. The faker-generated values are
// shared across steps, so they live at module scope and are initialised at the start of the first step.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

When('I add a new KPI', async () => {
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	password = faker.internet.password();
	employeeEmail = faker.internet.exampleEmail();
	imgUrl = faker.image.avatar();

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

When('I edit the KPI', async () => {
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

When('I delete the KPI', async () => {
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
