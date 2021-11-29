import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as employeeDashboard from '../../Base/pages/EmployeeDashboardTest.po';
import { EmployeeDashboardPageData } from '../../Base/pagedata/EmployeeDashboardPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as faker from 'faker';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';


let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();
let projectName = faker.name.jobTitle()

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();
let employeeFullName = `${firstName} ${lastName}`;

const pageLoadTimeout = Cypress.config('pageLoadTimeout');


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

// Add new project
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		{
			name: projectName,
			hours: OrganizationProjectsPageData.hours,
			editName: OrganizationProjectsPageData.editName,
			description: OrganizationProjectsPageData.description,
			color: OrganizationProjectsPageData.color
		},
		employeeFullName
	);
});

// Add new client
And('User can add new client', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addClient(
		clientsPage,
		fullName,
		email,
		website,
		city,
		postcode,
		street,
		{
			defaultProject: projectName,
			country: ClientsData.country,
			defaultPhone: ClientsData.defaultPhone,
			hours: ClientsData.hours
		},
		employeeFullName
	);
});

// Add employee salary
And('User can visit Employees recurring expense page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.intercept('GET', '/api/employee/working*').as('waitOrganization');
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/employees/recurring-expenses', {
		timeout: pageLoadTimeout
	});
	cy.wait('@waitOrganization')
});

And('User can see add new expense button', () => {
	employeeDashboard.addNewExpenseButtonVisible();
});

When('User click on add new expense button', () => {
	employeeDashboard.clickAddNewExpenseButton();
});

And('User can see employee dropdown', () => {
	employeeDashboard.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	employeeDashboard.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	employeeDashboard.selectEmployeeFromDropdown(employeeFullName);
});

And('User can see expense dropdown', () => {
	employeeDashboard.expenseDropdownVisible();
});

When('User click on expense dropdown', () => {
	employeeDashboard.clickExpenseDropdown();
});

Then('User can select expense from dropdown options', () => {
	employeeDashboard.selectExpenseOptionDropdown(
		EmployeeDashboardPageData.defaultExpense
	);
});

And('User can see expense value input field', () => {
	employeeDashboard.expenseValueInputVisible();
});

And('User can enter expense value', () => {
	employeeDashboard.enterExpenseValueInputData(
		EmployeeDashboardPageData.defaultExpenseValue
	);
});

And('User can see save button', () => {
	employeeDashboard.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	employeeDashboard.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	employeeDashboard.waitMessageToHide();
});

//Add income for employee
When('User see Accounting button', () => {
	employeeDashboard.verifyMenuBtnByText(EmployeeDashboardPageData.accountingTxt);
});

Then('User click on Accounting button', () => {
	employeeDashboard.clickMenuButtonsByText(EmployeeDashboardPageData.accountingTxt);
})

When('User see income button', () => {
	employeeDashboard.verifyMenuBtnByText(EmployeeDashboardPageData.incomeTxt);
})
Then('User click on income button', () => {
	employeeDashboard.clickOnIncomeBtn();
});

And('User can see grid button', () => {
	employeeDashboard.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	employeeDashboard.gridBtnClick(1);
});

And('User can see add income button', () => {
	employeeDashboard.verifyIncomeAddButton();
});

When('User click on add income button', () => {
	employeeDashboard.clickIncomeAddButton();
});

Then('User can see employee dropdown again', () => {
	employeeDashboard.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown again', () => {
	employeeDashboard.clickEmployeeSelector();
});

Then('User can select employee from dropdown options again', () => {
	employeeDashboard.selectEmployeeFromDrodpwonByName(employeeFullName);
});

And('User can see date input field', () => {
	employeeDashboard.dateInputVisible();
});

And('User can enter value for date', () => {
	employeeDashboard.enterDateInputData();
	employeeDashboard.clickKeyboardButtonByKeyCode(9);
});

And('User can see contact input field', () => {
	employeeDashboard.contactInputVisible();
});

And('User can enter value for contact', () => {
	employeeDashboard.enterContactInputData(fullName);
});

And('User click on currency input field', () => {
	employeeDashboard.clickOnCurrencyField();
});

And('User select currency',() => {
	employeeDashboard.selectCurrency(EmployeeDashboardPageData.bgnCurrency);
});

And('User can see amount input field', () => {
	employeeDashboard.amountInputVisible();
});

And('User can enter value for amount', () => {
	employeeDashboard.enterAmountInputData(EmployeeDashboardPageData.anountInput);
});

And('User can see notes textarea input field', () => {
	employeeDashboard.notesTextareaVisible();
});

And('User can add value for notes', () => {
	employeeDashboard.enterNotesInputData(EmployeeDashboardPageData.defaultNote);
});

And('User can see save button', () => {
	employeeDashboard.saveIncomeButtonVisible();
});

When('User click on save button', () => {
	employeeDashboard.clickSaveIncomeButton();
});

Then('Notification message will appear', () => {
	employeeDashboard.waitMessageToHide();
});

And('User can verify income was created', () => {
	employeeDashboard.verifyIncomeExists(EmployeeDashboardPageData.defaultNote);
});

//User go to dashboard to verify employee salary

When('User see dashboard button on main manu', () => {
	employeeDashboard.verifyMenuBtnByText(EmployeeDashboardPageData.dashboardTxt);
});

Then ('User click on dashboard button', () => {
	employeeDashboard.clickMenuButtonsByText(EmployeeDashboardPageData.dashboardTxt)
});

When('User see employee selector', () => {
	employeeDashboard.verifyEmployeeSelecor();
});

Then('User click on employee selector', () => {
	employeeDashboard.clickOnEmployeeSelecor();
});

When ('User see employee dropdown', () => {
	employeeDashboard.verifyEmployeeSelectorDropdown(employeeFullName);
});

Then ('User click on employee', () => {
	employeeDashboard.clickOnEmployeeSelecorDropdown(employeeFullName);
});

And('User can verify salary', () => {
	employeeDashboard.verifyEmployeeSalary(EmployeeDashboardPageData.employeeSalary);
});

And('User can verify income', () => {
	employeeDashboard.verifyEmployeeIncome(EmployeeDashboardPageData.dashboardIncomeTxt);
});