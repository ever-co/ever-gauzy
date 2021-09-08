import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as faker from 'faker';
import * as expensesPage from '../../Base/pages/Expenses.po';
import { ExpensePageData } from '../../Base/pagedata/ExpensesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../../commands';
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

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboard()
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employee
And('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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

// Add project
And('User can add new project', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addProject(
		organizationProjectsPage,
		OrganizationProjectsPageData
	);
});

// Add new expense
When('User visit Expenses page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/accounting/expenses', { timeout: pageLoadTimeout });
});

Then('User can see grid button', () => {
	expensesPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	expensesPage.gridBtnClick(1);
});

And('User can see add expense button', () => {
	expensesPage.addExpenseButtonVisible();
});

When('User click on add expense button', () => {
	expensesPage.clickAddExpenseButton();
});

Then('User can see employee dropdown', () => {
	expensesPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	expensesPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	expensesPage.selectEmployeeFromDrodpwon(1);
});

And('User can see category input field', () => {
	expensesPage.categoryInputVisible();
});

When('User click on category input field', () => {
	expensesPage.clickCategoryInput();
});

Then('User can enter category data', () => {
	expensesPage.enterCategoryInputData(ExpensePageData.defaultCategory);
});

And('User can see date input field', () => {
	expensesPage.dateInputVisible();
});

And('User can enter value for date', () => {
	expensesPage.enterDateInputData();
	expensesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see vendor input field', () => {
	expensesPage.vendorInputVisible();
});

When('User click on vendor input field', () => {
	expensesPage.clickVendorInput();
});

Then('User can enter value for vendor', () => {
	expensesPage.enterVendorInputData(ExpensePageData.defaultVendor);
});

And('User can see amount input field', () => {
	expensesPage.amountInputVisible();
});

And('User can enter value for amount', () => {
	expensesPage.enterAmountInputData(ExpensePageData.defaultAmount);
});

And('User can see purpose input field', () => {
	expensesPage.purposeTextareaVisible();
});

And('User can enter value for purpose', () => {
	expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
});

And('User can see project dropdown', () => {
	expensesPage.projectDropdownVisible();
});

When('User click on project dropdown', () => {
	expensesPage.clickProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
});

And('User can see tags dropdown', () => {
	expensesPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	expensesPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	expensesPage.selectTagFromDropdown(0);
	expensesPage.clickCardBody();
});

And('User can see save button', () => {
	expensesPage.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	expensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	expensesPage.waitMessageToHide();
});

And('User can verify expense', () => {
	expensesPage.verifyExpenseExists();
});

// Verify expense reports
And('User can see Reports sidebar button', () => {
	expensesPage.sidebarBtnVisible();
});

When('User click on Reports sidebar button', () => {
	expensesPage.clickSidebarBtn(ExpensePageData.reports);
});

Then('User can click on Expense sidebar button', () => {
	expensesPage.clickReportsInnerSidebarBtn(ExpensePageData.expense);
});

And('User can see Group by select', () => {
	expensesPage.groupBySelectVisible();
});

When('User click on Group by select', () => {
	expensesPage.clickGroupBySelect();
});

Then('User can see option for Date', () => {
	expensesPage.verifyDropdownOption(ExpensePageData.date);
});

And('User can see option for Client', () => {
	expensesPage.verifyDropdownOption(ExpensePageData.employee);
});

And('User can see option for Project', () => {
	expensesPage.verifyDropdownOption(ExpensePageData.project);
});

When('User click on Date dropdown option', () => {
	expensesPage.selectOptionFromDropdown(ExpensePageData.date);
});

Then('User can verify project', () => {
	expensesPage.verifyExpenseProject(ExpensePageData.defaultProject);
});

And('User can verify amount', () => {
	expensesPage.verifyExpenseAmount(ExpensePageData.verifyAmount);
});

When('User click again on Reports sidebar button', () => {
	expensesPage.clickSidebarBtn(ExpensePageData.reports);
});

Then('User can click on Accounting sidebar button', () => {
	expensesPage.clickSidebarBtn(ExpensePageData.accounting);
});

When('User click on Expenses sidebar button', () => {
	expensesPage.clickAccountingExpensesSidebarBtn(ExpensePageData.expenses);
});

// Edit expense
When('User select first table row', () => {
	expensesPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	expensesPage.editExpenseButtonVisible();
});

When('User click on edit button', () => {
	expensesPage.clickEditExpenseButton();
});

Then('User can see date input field', () => {
	expensesPage.dateInputVisible();
});

And('User can enter value for date', () => {
	expensesPage.enterDateInputData();
	expensesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see purpose input field', () => {
	expensesPage.purposeTextareaVisible();
});

And('User can enter value for purpose', () => {
	expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
});

And('User can see project dropdown', () => {
	expensesPage.projectDropdownVisible();
});

When('User click on project dropdown', () => {
	expensesPage.clickProjectDropdown();
});

Then('User can select project from dropdown options', () => {
	expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
});

And('User can see save button', () => {
	expensesPage.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	expensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	expensesPage.waitMessageToHide();
});

And('User can verify expense', () => {
	expensesPage.verifyExpenseExists();
});

// Duplicate expense
When('User select first table row', () => {
	expensesPage.selectTableRow(0);
});

Then('Duplicate button will become active', () => {
	expensesPage.duplicateButtonVisible();
});

When('User click on duplicate button', () => {
	expensesPage.clickDuplicateButton();
});

Then('User can see save button', () => {
	expensesPage.saveExpenseButtonVisible();
});

When('User click on save button', () => {
	expensesPage.clickSaveExpenseButton();
});

Then('Notification message will appear', () => {
	expensesPage.waitMessageToHide();
});

// Delete expense
When('User select first table row', () => {
	expensesPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	expensesPage.deleteExpenseButtonVisible();
});

When('User click on delete button', () => {
	expensesPage.clickDeleteExpenseButton();
});

Then('User can see confirm delete button', () => {
	expensesPage.confirmDeleteButtonVisible();
});

When('User can click on confirm delete button', () => {
	expensesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	expensesPage.waitMessageToHide();
});

When('User select first table row', () => {
	expensesPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	expensesPage.deleteExpenseButtonVisible();
});

When('User click on delete button', () => {
	expensesPage.clickDeleteExpenseButton();
});

Then('User can see confirm delete button', () => {
	expensesPage.confirmDeleteButtonVisible();
});

When('User can click on confirm delete button', () => {
	expensesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	expensesPage.waitMessageToHide();
});

// Add new category
And('User can see manage categories button', () => {
	expensesPage.manageCategoriesButtonVisible();
});

When('User click on manage categories button', () => {
	expensesPage.clickManageCategoriesButton();
});

Then('User can add category button', () => {
	expensesPage.addExpenseButtonVisible();
});

When('User click on add category button', () => {
	expensesPage.clickAddExpenseButton();
});

Then('User can see new category input field', () => {
	expensesPage.newCategoryInputVisible();
});

And('User can enter data for new category', () => {
	expensesPage.enterNewCategoryInputData(ExpensePageData.defaultCategory);
});

And('User can see category tags dropdown', () => {
	expensesPage.tagsDropdownVisible();
});

When('User click on category tags dropdown', () => {
	expensesPage.clickTagsDropdwon();
});

Then('User can select category tag from dropdown options', () => {
	expensesPage.selectTagFromDropdown(0);
	expensesPage.categorieCardVisible();
	expensesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save category button', () => {
	expensesPage.saveCategorieButtonVisible();
});

When('User click on save category button', () => {
	expensesPage.clickSaveCategorieButton();
});

Then('User can verify category was created', () => {
	expensesPage.verifyCategoryExists(ExpensePageData.defaultCategory);
});
