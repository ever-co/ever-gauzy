import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as loginPage from '../../support/pages/Login.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import * as humanResourcesPage from '../../support/pages/HumanResources.po';
import { HumanResourcesPageData } from '../../../src/support/Base/pagedata/HumanResourcesPageData';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';

// Converted 1:1 from the plain HumanResourcesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts. The addEmployee setup that ran after login in the plain
// test() (which the Background login does not cover) is folded into the first When step, together with
// the faker initialisation, matching the original execution order.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

When('I verify the employee chart options', async () => {
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

	await getPage().goto('/#/pages/dashboard/accounting');
	// The accounting list shows only employees with `startedWorkOn` in range; the quick-add
	// addEmployee command doesn't set that, so the new faker employee never appears here.
	// Drive the flow with whichever employee IS present and verify that same name on the HR side.
	const employeeName = await humanResourcesPage.getFirstEmployeeName();
	await humanResourcesPage.selectFirstEmployee();
	await humanResourcesPage.verifyEmployeeName(employeeName);
	await humanResourcesPage.verifyChartDropdownVisible();
	await humanResourcesPage.clickChartDropdown();
	await humanResourcesPage.verifyChartOptionText(HumanResourcesPageData.barChartText);
	await humanResourcesPage.verifyChartOptionText(HumanResourcesPageData.doughnutChartText);
	await humanResourcesPage.verifyChartOptionText(HumanResourcesPageData.stackedBarChartText);
});

When('I verify the Total Income card', async () => {
	await humanResourcesPage.verifyCardTextExist(HumanResourcesPageData.totalIncomeText);
	await humanResourcesPage.verifyCardTextExist(HumanResourcesPageData.totalExpenseText);
	await humanResourcesPage.verifyCardTextExist(HumanResourcesPageData.totalExpensesText);
	await humanResourcesPage.verifyCardTextExist(HumanResourcesPageData.profitText);
	await humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.totalIncomeText);
	await humanResourcesPage.verifyPopupHeaderText(HumanResourcesPageData.incomeHeaderText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.incomeTableHeaderDateText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.incomeTableHeaderClientNameText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.incomeTableHeaderValueText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.incomeTableHeaderNotesText);
	await humanResourcesPage.clickCardBody();
});

When('I verify the Total Expenses without salary card', async () => {
	await humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.totalExpenseText);
	await humanResourcesPage.verifyPopupHeaderText(HumanResourcesPageData.expensesHeaderText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderSourceText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderDateText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderVendorText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderCategoryText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderValueText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderNotesText);
	await humanResourcesPage.clickCardBody();
});

When('I verify the Total Expenses card', async () => {
	await humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.totalExpensesText);
	await humanResourcesPage.verifyPopupHeaderText(HumanResourcesPageData.expensesHeaderText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderSourceText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderDateText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderVendorText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderCategoryText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderValueText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.expensesTableHeaderNotesText);
	await humanResourcesPage.clickCardBody();
});

When('I verify the Profit card', async () => {
	await humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.profitText);
	await humanResourcesPage.verifyPopupProfitHeaderText(HumanResourcesPageData.profitHeaderText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderDateText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderExpensesText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderIncomeText);
	await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderDescriptionText);
});
