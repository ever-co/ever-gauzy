import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as estimatesPage from '../../Base/pages/Estimates.po';
import { EstimatesPageData } from '../../Base/pagedata/EstimatesPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import { ContactsLeadsPageData } from '../../Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from '../../Base/pages/ContactsLeads.po';
import * as organizationProjectsPage from '../../Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../Base/pagedata/OrganizationProjectsPageData';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();
let sendEmail = faker.internet.email();

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

// Add new estimate
Then('User can visit Estimates page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/accounting/invoices/estimates', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	estimatesPage.gridBtnExists();
});

And('User can click on second grid button to cahange view', () => {
	estimatesPage.gridBtnClick(1);
});

And('User can see add Estimate button', () => {
	estimatesPage.addButtonVisible();
});

When('User click on add Estimate button', () => {
	estimatesPage.clickAddButton();
});

Then('User can see tags dropdown', () => {
	estimatesPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	estimatesPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	estimatesPage.selectTagFromDropdown(0);
	estimatesPage.clickCardBody();
});

And('User can see discount input field', () => {
	estimatesPage.discountInputVisible();
});

And('User can enter value for discount', () => {
	estimatesPage.enterDiscountData(EstimatesPageData.discountValue);
});

And('User can see discount type dropdown', () => {
	estimatesPage.discountTypeDropdownVisible();
});

When('User click on discount type dropdown', () => {
	estimatesPage.clickDiscountDropdown();
});

Then('User can select discount type from dropdown options', () => {
	estimatesPage.selectDiscountTypeFromDropdown(
		EstimatesPageData.discountType
	);
});

And('User can see contact dropdown', () => {
	estimatesPage.contactDropdownVisible();
});

When('User click on contact drodpown', () => {
	estimatesPage.clickContactDropdown();
});

Then('User can select contact from dropdown options', () => {
	estimatesPage.selectContactFromDropdwon(0);
});

And('User can see tax input field', () => {
	estimatesPage.taxInputVisible();
});

And('User can enter value for tax', () => {
	estimatesPage.enterTaxData(EstimatesPageData.taxValue);
});

And('User can see tax type dropdown', () => {
	estimatesPage.taxTypeDropdownVisible();
});

When('User click on tax type dropdown', () => {
	estimatesPage.clickTaxTypeDropdown();
});

Then('User can select tax type from dropdown options', () => {
	estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
});

And('User can see invoice type dropdown', () => {
	estimatesPage.invoiceTypeDropdownVisible();
});

When('User click on invoice type dropdown', () => {
	estimatesPage.clickInvoiceTypeDropdown();
});

Then('User can select invoice type from dropdown options', () => {
	estimatesPage.selectInvoiceTypeFromDropdown(EstimatesPageData.invoiceType);
});

And('User can see employee dropdown', () => {
	estimatesPage.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	estimatesPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	estimatesPage.selectEmployeeFromDropdown(0);
	estimatesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see generate items button', () => {
	estimatesPage.generateItemsButtonVisible();
});

When('User click on generate items button', () => {
	estimatesPage.clickGenerateItemsButton();
});

Then('Save as draft button will become active', () => {
	estimatesPage.saveAsDraftButtonVisible();
});

When('User click on Save as draft button', () => {
	estimatesPage.clickSaveAsDraftButton(EstimatesPageData.saveAsDraftButton);
});

Then('Notification message will appear', () => {
	estimatesPage.waitMessageToHide();
});

And('User can verify estimate was created', () => {
	estimatesPage.verifyDraftBadgeClass();
});

// Search estimate
And('User can see tab button', () => {
	estimatesPage.verifyTabButtonVisible();
});

When('User click on second tab button', () => {
	estimatesPage.clickTabButton(1);
});

Then('User can see estimate number input field', () => {
	estimatesPage.veirifyEstimateNumberInputVisible();
});

And('User can enter estimate number', () => {
	estimatesPage.enterEstimateNumberInputData(
		EstimatesPageData.estimateNumber
	);
});

And('User can see currency dropdown', () => {
	estimatesPage.verifyCurrencuDropdownVisible();
});

And('User can see estimate date input field', () => {
	estimatesPage.verifyEstimateDateInput();
});

And('User can see estimate due date input field', () => {
	estimatesPage.verifyEstimateDueDateInput();
});

And('User can see total value input field', () => {
	estimatesPage.verifyTotalValueInputVisible();
});

And('User can see status input field', () => {
	estimatesPage.verifyStatusInputVisible();
});

And('User can see search button', () => {
	estimatesPage.searchButtonVisible();
});

When('User click on search button', () => {
	estimatesPage.clickSearchButton();
});

Then('User can see reset button', () => {
	estimatesPage.resetButtonVisible();
});

When('User click on reset button', () => {
	estimatesPage.clickResetButton();
});

Then('User can click search button', () => {
	estimatesPage.clickSearchButton();
});

And('User can verify badge', () => {
	estimatesPage.verifyDraftBadgeClass();
});

And('User can edit estimate number', () => {
	estimatesPage.enterEstimateNumberInputData(
		EstimatesPageData.secondEstimateNumber
	);
});

And('User can click search button again', () => {
	estimatesPage.clickSearchButton();
});

And('User can click on reset button', () => {
	estimatesPage.clickResetButton();
});

And('User can verify badge', () => {
	estimatesPage.verifyDraftBadgeClass();
});

And('User can click on next tab button', () => {
	estimatesPage.clickTabButton(2);
});

And('User can verify badge', () => {
	estimatesPage.verifyDraftBadgeClass();
});

// Edit estimate
When('User clcik on first tab button', () => {
	estimatesPage.clickTabButton(0);
});

Then('User can select estimates first table row', () => {
	estimatesPage.selectTableRow(0);
});

And('Edit button will become active', () => {
	estimatesPage.editButtonVisible();
});

When('User click on edit button', () => {
	estimatesPage.clickEditButton(0);
});

Then('User can see discount input field', () => {
	estimatesPage.discountInputVisible();
});

And('User can enter value for discount', () => {
	estimatesPage.enterDiscountData(EstimatesPageData.editDiscountValue);
});

And('User can see discount type dropdown', () => {
	estimatesPage.discountTypeDropdownVisible();
});

When('User click on discount type dropdown', () => {
	estimatesPage.clickDiscountDropdown();
});

Then('User can select discount type from dropdown options', () => {
	estimatesPage.selectDiscountTypeFromDropdown(
		EstimatesPageData.discountType
	);
});

And('User can see contact dropdown', () => {
	estimatesPage.contactDropdownVisible();
});

When('User click on contact drodpown', () => {
	estimatesPage.clickContactDropdown();
});

Then('User can select contact from dropdown options', () => {
	estimatesPage.selectContactFromDropdwon(0);
});

And('User can see tax input field', () => {
	estimatesPage.taxInputVisible();
});

And('User can enter value for tax', () => {
	estimatesPage.enterTaxData(EstimatesPageData.taxValue);
});

And('User can see tax type dropdown', () => {
	estimatesPage.taxTypeDropdownVisible();
});

When('User click on tax type dropdown', () => {
	estimatesPage.clickTaxTypeDropdown();
});

Then('User can select tax type from dropdown options', () => {
	estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
});

Then('Save as draft button will become active', () => {
	estimatesPage.saveAsDraftButtonVisible();
});

When('User click on Save as draft button', () => {
	estimatesPage.clickSaveAsDraftButton(EstimatesPageData.saveAsDraftButton);
});

Then('Notification message will appear', () => {
	estimatesPage.waitMessageToHide();
});

// View estimate
When('User select estimates first table row', () => {
	estimatesPage.selectTableRow(0);
});

Then('View estimate button will become active', () => {
	estimatesPage.viewButtonVisible();
});

And('User can click on vew estimate button', () => {
	estimatesPage.clickViewButton(1);
});

And('User can see back button', () => {
	estimatesPage.backButtonVisible();
});

When('User click on back button', () => {
	estimatesPage.clickBackButton();
});

// Send estimate by email
Then('User can click again on estimates first table row', () => {
	estimatesPage.selectTableRow(0);
});

And('More settings button will become active', () => {
	estimatesPage.moreButtonVisible();
});

When('User click more settings button', () => {
	estimatesPage.clickMoreButton();
});

Then('User can see email button', () => {
	estimatesPage.actionButtonVisible();
});

When('User click on email button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	estimatesPage.clickActionButtonByText(EstimatesPageData.emailButton);
});

Then('User can scroll down to email input field', () => {
	estimatesPage.scrollEmailInviteTemplate();
})

And('User can see email input field', () => {
	estimatesPage.emailInputVisible();
});

And('User can enter value for email', () => {
	estimatesPage.enterEmailData(sendEmail);
});

And('User can see confirm send email button', () => {
	estimatesPage.confirmButtonVisible();
});

When('User click on confirm send email button', () => {
	estimatesPage.clickConfirmButton();
});

Then('Notification message will appear', () => {
	estimatesPage.waitMessageToHide();
});

When('User click more settings button', () => {
	estimatesPage.clickMoreButton();
});

Then('User can verify estimate was sent by email', () => {
	estimatesPage.verifySentBadgeClass();
});

// Convert estimate to invoice
Then('User can click again on estimates first table row', () => {
	estimatesPage.selectTableRow(0);
});

And('User can see convert to invoice button', () => {
	estimatesPage.convertToInvoiceButtonVisible();
});

And('User can click on convert to invoice button', () => {
	estimatesPage.clickConvertToInvoiceButton(0);
});

// Delete estimate
And('User can see add Estimate button', () => {
	estimatesPage.addButtonVisible();
});

When('User click on add Estimate button', () => {
	estimatesPage.clickAddButton();
});

Then('User can see tags dropdown', () => {
	estimatesPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	estimatesPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	estimatesPage.selectTagFromDropdown(0);
	estimatesPage.clickCardBody();
});

And('User can see discount input field', () => {
	estimatesPage.discountInputVisible();
});

And('User can enter value for discount', () => {
	estimatesPage.enterDiscountData(EstimatesPageData.discountValue);
});

And('User can see discount type dropdown', () => {
	estimatesPage.discountTypeDropdownVisible();
});

When('User click on discount type dropdown', () => {
	estimatesPage.clickDiscountDropdown();
});

Then('User can select discount type from dropdown options', () => {
	estimatesPage.selectDiscountTypeFromDropdown(
		EstimatesPageData.discountType
	);
});

And('User can see contact dropdown', () => {
	estimatesPage.contactDropdownVisible();
});

When('User click on contact drodpown', () => {
	estimatesPage.clickContactDropdown();
});

Then('User can select contact from dropdown options', () => {
	estimatesPage.selectContactFromDropdwon(0);
});

And('User can see tax input field', () => {
	estimatesPage.taxInputVisible();
});

And('User can enter value for tax', () => {
	estimatesPage.enterTaxData(EstimatesPageData.taxValue);
});

And('User can see tax type dropdown', () => {
	estimatesPage.taxTypeDropdownVisible();
});

When('User click on tax type dropdown', () => {
	estimatesPage.clickTaxTypeDropdown();
});

Then('User can select tax type from dropdown options', () => {
	estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
});

And('User can see invoice type dropdown', () => {
	estimatesPage.invoiceTypeDropdownVisible();
});

When('User click on invoice type dropdown', () => {
	estimatesPage.clickInvoiceTypeDropdown();
});

Then('User can select invoice type from dropdown options', () => {
	estimatesPage.selectInvoiceTypeFromDropdown(EstimatesPageData.invoiceType);
});

And('User can see employee dropdown', () => {
	estimatesPage.employeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	estimatesPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	estimatesPage.selectEmployeeFromDropdown(0);
	estimatesPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see generate items button', () => {
	estimatesPage.generateItemsButtonVisible();
});

When('User click on generate items button', () => {
	estimatesPage.clickGenerateItemsButton();
});

Then('Save as draft button will become active', () => {
	estimatesPage.saveAsDraftButtonVisible();
});

When('User click on Save as draft button', () => {
	estimatesPage.clickSaveAsDraftButton(EstimatesPageData.saveAsDraftButton);
});

Then('Notification message will appear', () => {
	estimatesPage.waitMessageToHide();
});

And('User can verify badge', () => {
	estimatesPage.verifyDraftBadgeClass();
});

Then('User can click on estimates first row', () => {
	estimatesPage.selectTableRow(0);
});

And('Settings button will become active', () => {
	estimatesPage.moreButtonVisible();
});

When('User click settings button', () => {
	estimatesPage.clickMoreButton();
});

Then('Delete button will become active', () => {
	estimatesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	estimatesPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	estimatesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	estimatesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	estimatesPage.waitMessageToHide();
});
