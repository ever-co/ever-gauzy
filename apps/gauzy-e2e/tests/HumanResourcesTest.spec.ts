import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as humanResourcesPage from './support/pages/HumanResources.po';
import { HumanResourcesPageData } from '../src/support/Base/pagedata/HumanResourcesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Human resources page test', () => {
	test('Human resources page test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

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

		await test.step('Should be able to verify chart options', async () => {
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

		await test.step('Should be able to verify Total Income', async () => {
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

		await test.step('Should be able to verify Total Expenses without salary', async () => {
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

		await test.step('Should be able to verify Total Expenses', async () => {
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

		await test.step('Should be able to verify Profit', async () => {
			await humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.profitText);
			await humanResourcesPage.verifyPopupProfitHeaderText(HumanResourcesPageData.profitHeaderText);
			await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderDateText);
			await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderExpensesText);
			await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderIncomeText);
			await humanResourcesPage.verifyPopupTableHeaderText(HumanResourcesPageData.profitTableHeaderDescriptionText);
		});
	});
});
