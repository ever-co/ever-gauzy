import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as employeeAddInfo from '../../Base/pages/EmployeeAddInfoTest.po';
import { EmployeeAddInfoPageData } from '../../Base/pagedata/EmployeeAddInfoPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';

const responseTimeout = Cypress.config('responseTimeout');

const jobTitle = faker.name.jobTitle();
const employeeLevel = EmployeeAddInfoPageData.level + ` ${faker.random.alpha().toUpperCase()}`
const firstName = faker.name.firstName();
const lastName = faker.name.lastName();
const username = faker.internet.userName();
const password = faker.internet.password();
const employeeEmail = faker.internet.email();
const imgUrl = faker.image.avatar();
const employeeFullName = `${firstName} ${lastName}`;


// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add employee
And('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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

//Add employee level
When('User visit Add new employee level page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/employees/employee-level', { timeout: responseTimeout });
});

Then('User can see grid button', () => {
	employeeAddInfo.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	employeeAddInfo.gridBtnClick(1);
});

And('User can see Add new level button', () => {
	employeeAddInfo.addNewLevelButtonVisible();
});

When('User click on Add new level button', () => {
	employeeAddInfo.clickAddNewLevelButton();
});

Then('User will see new level input', () => {
	employeeAddInfo.newLevelInputVisible();
});

And('User can enter new level name', () => {
	employeeAddInfo.enterNewLevelData(employeeLevel);
});

And('User can see tags multi-select', () => {
	employeeAddInfo.tagsMultiSelectVisible();
});

When('User click on tags multi-select', () => {
	employeeAddInfo.clickTagsMultiSelect();
});

Then('User can select tag from dropdown menu', () => {
	employeeAddInfo.selectTagsFromDropdown(0);
	employeeAddInfo.clickKeyboardButtonByKeyCode(9);
});

And('User can see Save button', () => {
	employeeAddInfo.saveNewLevelButtonVisible();
});

When('User click on Save button', () => {
	employeeAddInfo.clickSaveNewLevelButton();
});

Then('User will see notification message', () => {
	employeeAddInfo.waitMessageToHide();
});

//Add employee level and short description
When('User see dashboard button on main manu', () => {
	employeeAddInfo.verifyMenuBtnByText(EmployeeAddInfoPageData.dashboardTxt);
});

Then ('User click on dashboard button', () => {
	employeeAddInfo.clickMenuButtonsByText(EmployeeAddInfoPageData.dashboardTxt)
});

When('User see employee selector', () => {
	employeeAddInfo.verifyEmployeeSelecor();
});

Then('User click on employee selector', () => {
	employeeAddInfo.clickOnEmployeeSelecor();
});

When ('User see employee dropdown', () => {
	employeeAddInfo.verifyEmployeeSelectorDropdown(employeeFullName);
});

Then ('User click on employee', () => {
	employeeAddInfo.clickOnEmployeeSelecorDropdown(employeeFullName);
});

When ('User see edit icon button', () => {
	employeeAddInfo.verifyEditIconButton();
})

Then ('User click on edit icon button', () => {
	employeeAddInfo.clickOnEditIconButton();
});

When ('User see Employment tab', ()=> {
	employeeAddInfo.verifyTab(EmployeeAddInfoPageData.employmentTxt);
});

Then ('User click on Employment tab', () => {
	employeeAddInfo.clickTab(EmployeeAddInfoPageData.employmentTxt);
});

When ('User see Short Description input field', () => {
	employeeAddInfo.verifyInputField();
});

Then ('User enter value for Short Description', () => {
	employeeAddInfo.enterInputField(jobTitle);
});

When ('User see level input field', () => {
	employeeAddInfo.verifyLevelInput();
});

Then ('User click on level input field',() => {
	employeeAddInfo.clickOnLevelInput();
});

And ('User can select level from dropdown', () => {
	employeeAddInfo.clickOnLevelOptions(employeeLevel);
});

When ('User see save button', () => {
	employeeAddInfo.verifySaveBtn();
});

Then ('User click on save button again', () => {
	employeeAddInfo.clickOnSaveBtn();
});

//Verify employee information

And('User can verify employee short description', () => {
	employeeAddInfo.verifyInfo(jobTitle);
});

And('User can verify employee level', () => {
	employeeAddInfo.verifyInfo(employeeLevel);
});