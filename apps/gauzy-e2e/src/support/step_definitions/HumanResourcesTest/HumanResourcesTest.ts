import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as humanResourcesPage from '../../Base/pages/HumanResources.po';
import { HumanResourcesPageData } from '../../Base/pagedata/HumanResourcesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add employee
And('User can add new employee', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
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

// Verify chart options
And('User can visit Dashboard accounting page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/dashboard/', { timeout: pageLoadTimeout });
});

And('User can see employees dashboard', () => {
	humanResourcesPage.verifyEmployeeCardVisible();
})

When('User select employee by name', () => {
	humanResourcesPage.selectEmployee(1);
	humanResourcesPage.selectEmployee(1);
});

Then('User can see chart dropdown', () => {
	humanResourcesPage.verifyChartDropdownVisible();
});

When('User click chart dropdown', () => {
	humanResourcesPage.clickChartDropdown();
});

And('User can verify bar chart', () => {
	humanResourcesPage.verifyChartOptionText(
		HumanResourcesPageData.barChartText
	);
});

And('User can verify doughnut chart', () => {
	humanResourcesPage.verifyChartOptionText(
		HumanResourcesPageData.doughnutChartText
	);
});

And('User can verify stacked bar chart', () => {
	humanResourcesPage.verifyChartOptionText(
		HumanResourcesPageData.stackedBarChartText
	);
});

// Verify total income
And('User can verify total income section', () => {
	humanResourcesPage.verifyCardTextExist(
		HumanResourcesPageData.totalIncomeText
	);
});

And('User can verify total expense section', () => {
	humanResourcesPage.verifyCardTextExist(
		HumanResourcesPageData.totalExpenseText
	);
});

And('User can verify total expenses section', () => {
	humanResourcesPage.verifyCardTextExist(
		HumanResourcesPageData.totalExpensesText
	);
});

And('User can verify profit section', () => {
	humanResourcesPage.verifyCardTextExist(HumanResourcesPageData.profitText);
});

When('User click on total income section', () => {
	humanResourcesPage.clickCardByHeaderText(
		HumanResourcesPageData.totalIncomeText
	);
});

Then('User can see popup with income header', () => {
	humanResourcesPage.verifyPopupHeaderText(
		HumanResourcesPageData.incomeHeaderText
	);
});

And('user can see total income date table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.incomeTableHeaderDateText
	);
});

And('User can see total income contact table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.incomeTableHeaderClientNameText
	);
});

And('User can see total income value table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.incomeTableHeaderValueText
	);
});

And('Uer can see total income notes table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.incomeTableHeaderNotesText
	);
	humanResourcesPage.clickCardBody();
});

// Verify Total Expenses without salary
When('User click on Total expenses section', () => {
	humanResourcesPage.clickCardByHeaderText(
		HumanResourcesPageData.totalExpenseText
	);
});

Then('User can see popup with expenses header', () => {
	humanResourcesPage.verifyPopupHeaderText(
		HumanResourcesPageData.expensesHeaderText
	);
});

And('user can see total expenses source table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderSourceText
	);
});

And('User can see total expenses date table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderDateText
	);
});

And('User can see total expenses vendor table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderVendorText
	);
});

And('Uer can see total expenses category table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderCategoryText
	);
});

And('Uer can see total expenses value table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderValueText
	);
});

And('Uer can see total expenses notes table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.expensesTableHeaderNotesText
	);
	humanResourcesPage.clickCardBody();
});

// Verify Profit
When('User click on Profit section', () => {
	humanResourcesPage.clickCardByHeaderText(HumanResourcesPageData.profitText);
});

Then('User can see popup with profit header', () => {
	humanResourcesPage.verifyPopupProfitHeaderText(
		HumanResourcesPageData.profitHeaderText
	);
});

And('user can see profit date table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.profitTableHeaderDateText
	);
});

And('User can see profit expenses table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.profitTableHeaderExpensesText
	);
});

And('User can see profit income table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.profitTableHeaderIncomeText
	);
});

And('Uer can see profit description table column', () => {
	humanResourcesPage.verifyPopupTableHeaderText(
		HumanResourcesPageData.profitTableHeaderDescriptionText
	);
});
