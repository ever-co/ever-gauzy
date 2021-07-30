import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationEquipmentPage from '../../Base/pages/OrganizationEquipment.po';
import { OrganizationEquipmentPageData } from '../../Base/pagedata/OrganizationEquipmentPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let empFirstName = faker.name.firstName();
let empLastName = faker.name.lastName();
let empUsername = faker.internet.userName();
let empPassword = faker.internet.password();
let employeeEmail = faker.internet.email();
let empImgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new employee
And('User can add new employee', () => {
	CustomCommands.addEmployee(
		manageEmployeesPage,
		empFirstName,
		empLastName,
		empUsername,
		employeeEmail,
		empPassword,
		empImgUrl
	);
});

// Add new equipment
And('User can visit Organization equipment page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/equipment', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	organizationEquipmentPage.gridBtnExists();
});

And('User can click on grid button to change view', () => {
	organizationEquipmentPage.gridBtnClick(1);
});

And('User can see add equipment button', () => {
	organizationEquipmentPage.addEquipmentButtonVisible();
});

When('User click on add equipment button', () => {
	organizationEquipmentPage.clickAddEqupmentButton();
});

Then('User will see name input field', () => {
	organizationEquipmentPage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationEquipmentPage.enterNameInputData(
		OrganizationEquipmentPageData.name
	);
});

And('User can see type input field', () => {
	organizationEquipmentPage.typeInputVisible();
});

And('User can enter value for type', () => {
	organizationEquipmentPage.enterTypeInputData(
		OrganizationEquipmentPageData.type
	);
});

And('User can see serial number input field', () => {
	organizationEquipmentPage.serialNumberInputVisible();
});

And('User can enter value for serial number', () => {
	organizationEquipmentPage.enterSerialNumberInputData(
		OrganizationEquipmentPageData.sn
	);
});

And('User can see manufactured year input field', () => {
	organizationEquipmentPage.manufacturedYearInputVisible();
});

And('User can enter value for manufactured year', () => {
	organizationEquipmentPage.enterManufacturedYearInputData(
		OrganizationEquipmentPageData.year
	);
});

And('User can see initial cost input field', () => {
	organizationEquipmentPage.initialCostInputVisible();
});

And('User can enter value for initial cost', () => {
	organizationEquipmentPage.enterInitialCostInputData(
		OrganizationEquipmentPageData.cost
	);
});

And('User can see share period input field', () => {
	organizationEquipmentPage.sharePeriodInputVisible();
});

And('User can enter value for share period', () => {
	organizationEquipmentPage.enterSharePeriodInputData(
		OrganizationEquipmentPageData.period
	);
});

And('User can see save button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationEquipmentPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEquipmentPage.waitMessageToHide();
});

And('User can verify equipment was created', () => {
	organizationEquipmentPage.verifyEquipmentExists(
		OrganizationEquipmentPageData.name
	);
});

// Add equipment policy
And('User can see equipment sharing button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationEquipmentPage.equipmentSharingButtonVisible();
});

When('User click on equipment sharing button', () => {
	organizationEquipmentPage.clickEquipmentSharingButton();
});

Then('User can see sharing policy button', () => {
	organizationEquipmentPage.waitSpinnerToDisappear();
	organizationEquipmentPage.sharingPolicyButtonVisible();
});

When('User click on sharing policy button', () => {
	organizationEquipmentPage.clickSharingPolicyButton();
});

Then('User can see add policy button', () => {
	organizationEquipmentPage.addPolicyButtonVisible();
});

When('User click on add policy button', () => {
	organizationEquipmentPage.clickAddPolicyButton();
});

Then('User can see policy name input field', () => {
	organizationEquipmentPage.policyNameInputVisible();
});

And('User can enter policy name', () => {
	organizationEquipmentPage.enterPolicyNameInputData(
		OrganizationEquipmentPageData.policy
	);
});

And('User can see policy description input field', () => {
	organizationEquipmentPage.policyDescriptionInputVisible();
});

And('User can enter value for policy description', () => {
	organizationEquipmentPage.enterPolicyDescriptionInputData(
		OrganizationEquipmentPageData.description
	);
});

And('User can see save policy button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save policy button', () => {
	organizationEquipmentPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEquipmentPage.waitMessageToHide();
});

And('User can verify policy was created', () => {
	organizationEquipmentPage.verifyPolicyExists(
		OrganizationEquipmentPageData.policy
	);
});

And('User can see back button', () => {
	organizationEquipmentPage.backButtonVisible();
});

When('User click on back button', () => {
	organizationEquipmentPage.clickBackButton();
});

// Request equipment sharing
Then('User can see request equipment sharing button', () => {
	organizationEquipmentPage.waitSpinnerToDisappear();
	organizationEquipmentPage.requestButtonVisible();
});

When('User click on request equipment sharing button', () => {
	organizationEquipmentPage.clickRequestButton();
});

Then('User can see request name input field', () => {
	organizationEquipmentPage.requestNameInputVisible();
});

And('User can enter value for request name', () => {
	organizationEquipmentPage.enterRequestNameInputData(
		OrganizationEquipmentPageData.requestName
	);
});

And('User can see equipment dropdown', () => {
	organizationEquipmentPage.selectEquipmentDropdownVisible();
});

When('User click on equipment dropdown', () => {
	organizationEquipmentPage.clickEquipmentDropdown();
});

Then('User can select equipment from dropdown options', () => {
	organizationEquipmentPage.selectEquipmentFromDropdown(0);
});

And('User can see policy dropdown', () => {
	organizationEquipmentPage.approvalPolicyDropdownVisible();
});

When('User click on policy dropdown', () => {
	organizationEquipmentPage.clickSelectPolicyDropdown();
});

Then('User can select policy from dropdown options', () => {
	organizationEquipmentPage.selectPolicyFromDropdown(0);
});

And('User can see employee dropdown', () => {
	organizationEquipmentPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	organizationEquipmentPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	organizationEquipmentPage.selectEmployeeFromDrodpwon(0);
	organizationEquipmentPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see date input field', () => {
	organizationEquipmentPage.dateInputVisible();
});

And('User can enter value for date', () => {
	organizationEquipmentPage.enterDateData();
});

And('User can see start date input field', () => {
	organizationEquipmentPage.startDateInputVisible();
});

And('User can enter value for start date', () => {
	organizationEquipmentPage.enterStartDateData();
});

And('User can see end date input field', () => {
	organizationEquipmentPage.endDateInputVisible();
});

And('User can enter value for end date', () => {
	organizationEquipmentPage.enterEndDateData();
});

And('User can see save request button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save request button', () => {
	organizationEquipmentPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEquipmentPage.waitMessageToHide();
});

And('User can see back button', () => {
	organizationEquipmentPage.backButtonVisible();
});

When('User click on back button', () => {
	organizationEquipmentPage.clickBackButton();
});

// Edit equipment
Then('User can see equipment table', () => {
	organizationEquipmentPage.tableRowVisible();
});

When('User click on equipment table row', () => {
	organizationEquipmentPage.selectTableRow(0);
});

Then('Edit button will become active', () => {
	organizationEquipmentPage.editButtonVisible();
});

When('User click on edit button', () => {
	organizationEquipmentPage.clickEditButton();
});

Then('User can see edit name input field', () => {
	organizationEquipmentPage.nameInputVisible();
});

And('User can enter new value for name', () => {
	organizationEquipmentPage.enterNameInputData(
		OrganizationEquipmentPageData.editName
	);
});

And('User can see save edited equipment button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save edited equipment button', () => {
	organizationEquipmentPage.clickSaveButton();
});

// Edit equipment request
Then('User can see equipment sharing button again', () => {
	organizationEquipmentPage.equipmentSharingButtonVisible();
});

When('User click on equipment sharing button again', () => {
	organizationEquipmentPage.clickEquipmentSharingButton();
});

Then('user can see equipment sharing table', () => {
	organizationEquipmentPage.tableRowVisible();
});

When('User click on equipment sharing table row', () => {
	organizationEquipmentPage.selectTableRow(0);
});

Then('Edit equipment button will become active', () => {
	organizationEquipmentPage.editButtonVisible();
});

When('User click on edit equipment button', () => {
	organizationEquipmentPage.clickEditButton();
});

Then('User can see edit request name input field', () => {
	organizationEquipmentPage.requestNameInputVisible();
});

And('User can enter new value for request name', () => {
	organizationEquipmentPage.enterRequestNameInputData(
		OrganizationEquipmentPageData.editRequestName
	);
});

And('User can see save edited request button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save edited request button', () => {
	organizationEquipmentPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEquipmentPage.waitMessageToHide();
});

// Delete equipment request
And('User can see again equipment sharing table', () => {
	organizationEquipmentPage.tableRowVisible();
});

When('User select equipment sharing table row', () => {
	organizationEquipmentPage.selectTableRow(0);
});

Then('Delete button will become active', () => {
	organizationEquipmentPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationEquipmentPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	organizationEquipmentPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationEquipmentPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationEquipmentPage.waitMessageToHide();
});

// Edit policy
And('User can see policy button', () => {
	organizationEquipmentPage.sharingPolicyButtonVisible();
});

When('User click on policy button', () => {
	organizationEquipmentPage.clickSharingPolicyButton();
});

Then('User can see policy table', () => {
	organizationEquipmentPage.tableRowVisible();
});

When('User select policy table row', () => {
	organizationEquipmentPage.selectTableRow(0);
});

Then('Edit policy button will become active', () => {
	organizationEquipmentPage.editButtonVisible();
});

When('User click on edit policy button', () => {
	organizationEquipmentPage.clickEditButton();
});

And('User can see edit policy name input field', () => {
	organizationEquipmentPage.policyNameInputVisible();
});

And('User can enter new policy name', () => {
	organizationEquipmentPage.enterPolicyNameInputData(
		OrganizationEquipmentPageData.editPolicy
	);
});

And('User can see edit policy description input field', () => {
	organizationEquipmentPage.policyDescriptionInputVisible();
});

And('User can enter new description', () => {
	organizationEquipmentPage.enterPolicyDescriptionInputData(
		OrganizationEquipmentPageData.description
	);
});

And('User can see save edited policy button', () => {
	organizationEquipmentPage.saveButtonVisible();
});

When('User click on save edited policy button', () => {
	organizationEquipmentPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationEquipmentPage.waitMessageToHide();
});

// Delete policy
Then('User can see policy table again', () => {
	organizationEquipmentPage.tableRowVisible();
});

When('User select again policy table row', () => {
	organizationEquipmentPage.selectTableRow(0);
});

Then('Delete policy button will become active', () => {
	organizationEquipmentPage.deleteButtonVisible();
});

When('User click on delete policy button', () => {
	organizationEquipmentPage.clickDeleteButton();
});

Then('User can see confirm delete policy button', () => {
	organizationEquipmentPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete policy button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationEquipmentPage.clickConfirmDeleteButton();
});

Then('User will see notification message', () => {
	organizationEquipmentPage.waitMessageToHide();
});
