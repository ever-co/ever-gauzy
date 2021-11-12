import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as salesInvoicesPage from '../../Base/pages/SalesInvoices.po';
import { SalesInvoicesPageData } from '../../Base/pagedata/SalesInvoicesPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import { ContactsLeadsPageData } from '../../Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from '../../Base/pages/ContactsLeads.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();
let sendEmail = faker.internet.email();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboard();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add employee
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

// Add contact
And('User can add new contact', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addContact(
		fullName,
		email,
		city,
		postcode,
		street,
		website,
		contactsLeadsPage,
		ContactsLeadsPageData
	);
});

// Add new invoice
Then('User can visit Invoices page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.intercept('GET', '/api/invoices/pagination*').as('waitInvoices');
	cy.visit('/#/pages/sales/invoices', { timeout: pageLoadTimeout });
	cy.wait('@waitInvoices');
});

And('User can see grid button', () => {
	salesInvoicesPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	salesInvoicesPage.gridBtnClick(1);
});

And('User can see add Invoice button', () => {
	salesInvoicesPage.addButtonVisible();
});

When('User click on add Invoice button', () => {
	salesInvoicesPage.clickAddButton();
});

Then('User can see tags dropdown', () => {
	salesInvoicesPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	salesInvoicesPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	salesInvoicesPage.selectTagFromDropdown(0);
	salesInvoicesPage.clickCardBody();
});

And('User can see discount input field', () => {
	salesInvoicesPage.discountInputVisible();
});

And('User can enter value for discount', () => {
	salesInvoicesPage.enterDiscountData(SalesInvoicesPageData.discountValue);
});

And('User can see discount type dropdown', () => {
	salesInvoicesPage.discountTypeDropdownVisible();
});

When('User click on discount type dropdown', () => {
	salesInvoicesPage.clickDiscountDropdown();
});

Then('User can select discount type from dropdown options', () => {
	salesInvoicesPage.selectDiscountTypeFromDropdown(
		SalesInvoicesPageData.discountType
	);
});

And('User can see contact dropdown', () => {
	salesInvoicesPage.contactDropdownVisible();
});

When('User click on contact dropdown', () => {
	salesInvoicesPage.clickContactDropdown();
});

Then('User can select contact from dropdown options', () => {
	salesInvoicesPage.selectContactFromDropdwon(0);
});

And('User can see tax input field', () => {
	salesInvoicesPage.taxInputVisible();
});

And('User can enter value for tax', () => {
	salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
});

And('User can see tax type dropdown', () => {
	salesInvoicesPage.taxTypeDropdownVisible();
});

When('User click on tax type dropdown', () => {
	salesInvoicesPage.clickTaxTypeDropdown();
});

Then('User can select tax type from dropdown options', () => {
	salesInvoicesPage.selectTaxTypeFromDropdown(SalesInvoicesPageData.taxType);
});

And('User can see invoice type dropdown', () => {
	salesInvoicesPage.invoiceTypeDropdownVisible();
});

When('User click on invoice type dropdown', () => {
	salesInvoicesPage.clickInvoiceTypeDropdown();
});

Then('User can select invoice type from dropdown options', () => {
	salesInvoicesPage.selectInvoiceTypeFromDropdown(SalesInvoicesPageData.invoiceType);
});

And('User can see employee dropdown', () => {
	salesInvoicesPage.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	salesInvoicesPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	salesInvoicesPage.selectEmployeeFromDropdown(0);
	salesInvoicesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see generate items button', () => {
	salesInvoicesPage.generateItemsButtonVisible();
});

When('User click on generate items button', () => {
	salesInvoicesPage.clickGenerateItemsButton();
});

Then('Save as draft button will become active', () => {
	salesInvoicesPage.saveAsDraftButtonVisible();
});

When('User click on Save as draft button', () => {
	salesInvoicesPage.clickSaveAsDraftButton(SalesInvoicesPageData.saveAsDraftButton);
});

Then('Notification message will appear', () => {
	salesInvoicesPage.waitMessageToHide();
});

And('User can verify invoice was created', () => {
	salesInvoicesPage.verifyDraftBadgeClass();
});

// Edit invoice
Then('User can select invoices first table row', () => {
	salesInvoicesPage.selectTableRow(0);
});

And('Edit button will become active', () => {
	salesInvoicesPage.editButtonVisible();
});

When('User click on edit button', () => {
	salesInvoicesPage.clickEditButton(0);
});

Then('User can see discount input field', () => {
	salesInvoicesPage.discountInputVisible();
});

And('User can enter value for discount', () => {
	salesInvoicesPage.enterDiscountData(SalesInvoicesPageData.editDiscountValue);
});

And('User can see discount type dropdown', () => {
	salesInvoicesPage.discountTypeDropdownVisible();
});

When('User click on discount type dropdown', () => {
	salesInvoicesPage.clickDiscountDropdown();
});

Then('User can select discount type from dropdown options', () => {
	salesInvoicesPage.selectDiscountTypeFromDropdown(
		SalesInvoicesPageData.discountType
	);
});

And('User can see contact dropdown', () => {
	salesInvoicesPage.contactDropdownVisible();
});

When('User click on contact dropdown', () => {
	salesInvoicesPage.clickContactDropdown();
});

Then('User can select contact from dropdown options', () => {
	salesInvoicesPage.selectContactFromDropdwon(0);
});

And('User can see tax input field', () => {
	salesInvoicesPage.taxInputVisible();
});

And('User can enter value for tax', () => {
	salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
});

And('User can see tax type dropdown', () => {
	salesInvoicesPage.taxTypeDropdownVisible();
});

When('User click on tax type dropdown', () => {
	salesInvoicesPage.clickTaxTypeDropdown();
});

Then('User can select tax type from dropdown options', () => {
	salesInvoicesPage.selectTaxTypeFromDropdown(SalesInvoicesPageData.taxType);
});

Then('Save as draft button will become active', () => {
	salesInvoicesPage.saveAsDraftButtonVisible();
});

When('User click on Save as draft button', () => {
	salesInvoicesPage.clickSaveAsDraftButton(SalesInvoicesPageData.saveAsDraftButton);
});

Then('Notification message will appear', () => {
	salesInvoicesPage.waitMessageToHide();
});

// View invoice
When('User select invoices first table row', () => {
	salesInvoicesPage.selectTableRow(0);
});

Then('View invoice button will become active', () => {
	salesInvoicesPage.viewButtonVisible();
});

And('User can click on vew invoice button', () => {
	salesInvoicesPage.clickViewButton(1);
});

And('User can see back button', () => {
	salesInvoicesPage.backButtonVisible();
});

When('User click on back button', () => {
	salesInvoicesPage.clickBackButton();
});

// Send invoice by email
Then('User can click again on invoices first table row', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	salesInvoicesPage.selectTableRow(0);
});

And('More settings button will become active', () => {
	salesInvoicesPage.moreButtonVisible();
});

When('User click more settings button', () => {
	salesInvoicesPage.clickMoreButton();
});

Then('User can see email button', () => {
	salesInvoicesPage.actionButtonVisible();
});

When('User click on email button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	salesInvoicesPage.clickActionButtonByText(SalesInvoicesPageData.emailButton);
});

Then('User can scroll down to email input field', () => {
	salesInvoicesPage.scrollEmailInviteTemplate();
})

And('User can see email input field', () => {
	salesInvoicesPage.emailInputVisible();
});

And('User can enter value for email', () => {
	salesInvoicesPage.enterEmailData(sendEmail);
});

And('User can see confirm send email button', () => {
	salesInvoicesPage.confirmButtonVisible();
});

When('User click on confirm send email button', () => {
	salesInvoicesPage.clickConfirmButton();
});

Then('Notification message will appear', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	salesInvoicesPage.waitMessageToHide();
});

//Verify invoice was sent
Then('User can see more settings button again', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/sales/invoices', { timeout: pageLoadTimeout });
	salesInvoicesPage.verifyMoreButton();
})

And('User can verify invoice was sent by email', () => {
	salesInvoicesPage.verifySentBadgeClass();
});

// Delete invoice
Then('User can click on invoices first row', () => {
	salesInvoicesPage.selectTableRow(0);
});

And('Settings button will become active', () => {
	salesInvoicesPage.moreButtonVisible();
});

When('User click settings button', () => {
	salesInvoicesPage.clickMoreButton();
});

Then('Delete button will become active', () => {
	salesInvoicesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	salesInvoicesPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	salesInvoicesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	salesInvoicesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	salesInvoicesPage.waitMessageToHide();
});
