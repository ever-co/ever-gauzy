import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as humanResourcesPage from '../support/Base/pages/HumanResources.po';
import { HumanResourcesPageData } from '../support/Base/pagedata/HumanResourcesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Human resources page test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
	});
	it('Shoulb be able to verify chart options', () => {
		cy.visit('/#/pages/dashboard/accounting');
		humanResourcesPage.selectEmployeeByName(`${firstName} ${lastName}`);
		humanResourcesPage.verifyEmployeeName(`${firstName} ${lastName}`);
		humanResourcesPage.verifyChartDropdownVisible();
		humanResourcesPage.clickChartDropdown();
		humanResourcesPage.verifyChartOptionText(
			HumanResourcesPageData.barChartText
		);
		humanResourcesPage.verifyChartOptionText(
			HumanResourcesPageData.doughnutChartText
		);
		humanResourcesPage.verifyChartOptionText(
			HumanResourcesPageData.stackedBarChartText
		);
	});
	it('Should be able to verify Total Income', () => {
		humanResourcesPage.verifyCardTextExist(
			HumanResourcesPageData.totalIncomeText
		);
		humanResourcesPage.verifyCardTextExist(
			HumanResourcesPageData.totalExpenseText
		);
		humanResourcesPage.verifyCardTextExist(
			HumanResourcesPageData.totalExpensesText
		);
		humanResourcesPage.verifyCardTextExist(
			HumanResourcesPageData.profitText
		);
		humanResourcesPage.clickCardByHeaderText(
			HumanResourcesPageData.totalIncomeText
		);
		humanResourcesPage.verifyPopupHeaderText(
			HumanResourcesPageData.incomeHeaderText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.incomeTableHeaderDateText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.incomeTableHeaderClientNameText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.incomeTableHeaderValueText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.incomeTableHeaderNotesText
		);
		humanResourcesPage.clickCardBody();
	});
	it('Should be able to verify Total Expenses without salary', () => {
		humanResourcesPage.clickCardByHeaderText(
			HumanResourcesPageData.totalExpenseText
		);
		humanResourcesPage.verifyPopupHeaderText(
			HumanResourcesPageData.expensesHeaderText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderSourceText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderDateText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderVendorText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderCategoryText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderValueText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderNotesText
		);
		humanResourcesPage.clickCardBody();
	});
	it('Should be able to verify Total Expenses', () => {
		humanResourcesPage.clickCardByHeaderText(
			HumanResourcesPageData.totalExpensesText
		);
		humanResourcesPage.verifyPopupHeaderText(
			HumanResourcesPageData.expensesHeaderText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderSourceText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderDateText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderVendorText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderCategoryText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderValueText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.expensesTableHeaderNotesText
		);
		humanResourcesPage.clickCardBody();
	});
	it('Should be able to verify Profit', () => {
		humanResourcesPage.clickCardByHeaderText(
			HumanResourcesPageData.profitText
		);
		humanResourcesPage.verifyPopupProfitHeaderText(
			HumanResourcesPageData.profitHeaderText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.profitTableHeaderDateText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.profitTableHeaderExpensesText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.profitTableHeaderIncomeText
		);
		humanResourcesPage.verifyPopupTableHeaderText(
			HumanResourcesPageData.profitTableHeaderDescriptionText
		);
	});
});
