import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as invoicesPage from '../support/Base/pages/Invoices.po';
import { InvoicesPageData } from '../support/Base/pagedata/InvoicesPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import { faker } from '@faker-js/faker';
import { ContactsLeadsPageData } from '../support/Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from '../support/Base/pages/ContactsLeads.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';

let email = ' ';
let fullName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';
let sendEmail = ' ';

describe('Invoices test', () => {
	before(() => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.exampleEmail();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add new invoice', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
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
		cy.visit('/#/pages/accounting/invoices');
		invoicesPage.gridBtnExists();
		invoicesPage.gridBtnClick(1);
		invoicesPage.addButtonVisible();
		invoicesPage.clickAddButton();
		invoicesPage.tagsDropdownVisible();
		invoicesPage.clickTagsDropdown();
		invoicesPage.selectTagFromDropdown(0);
		invoicesPage.clickCardBody();
		invoicesPage.discountInputVisible();
		invoicesPage.enterDiscountData(InvoicesPageData.discountValue);
		invoicesPage.discountTypeDropdownVisible();
		invoicesPage.clickDiscountDropdown();
		invoicesPage.selectDiscountTypeFromDropdown(
			InvoicesPageData.discountType
		);
		invoicesPage.contactDropdownVisible();
		invoicesPage.clickContactDropdown();
		invoicesPage.selectContactFromDropdown(0);
		invoicesPage.taxInputVisible();
		invoicesPage.enterTaxData(InvoicesPageData.taxValue);
		invoicesPage.taxTypeDropdownVisible();
		invoicesPage.clickTaxTypeDropdown();
		invoicesPage.selectTaxTypeFromDropdown(InvoicesPageData.taxType);
		invoicesPage.invoiceTypeDropdownVisible();
		invoicesPage.clickInvoiceTypeDropdown();
		invoicesPage.selectInvoiceTypeFromDropdown(
			InvoicesPageData.invoiceType
		);
		invoicesPage.employeeDropdownVisible();
		invoicesPage.clickEmployeeDropdown();
		invoicesPage.selectEmployeeFromDropdown(0);
		invoicesPage.clickKeyboardButtonByKeyCode(9);
		invoicesPage.generateItemsButtonVisible();
		invoicesPage.clickGenerateItemsButton();
		invoicesPage.saveAsDraftButtonVisible();
		invoicesPage.clickSaveAsDraftButton(InvoicesPageData.saveAsDraftButton);
		invoicesPage.waitMessageToHide();
		invoicesPage.verifyDraftBadgeClass();
	});
	it('Should be able to search invoice', () => {
		invoicesPage.verifyTabButtonVisible();
		invoicesPage.clickTabButton(1);
		invoicesPage.verifyEstimateNumberInputVisible();
		invoicesPage.enterEstimateNumberInputData(
			InvoicesPageData.invoiceNumber
		);
		invoicesPage.verifyCurrencyDropdownVisible();
		invoicesPage.verifyEstimateDateInput();
		invoicesPage.verifyEstimateDueDateInput();
		invoicesPage.verifyTotalValueInputVisible();
		invoicesPage.verifyCurrencyDropdownVisible();
		invoicesPage.verifyStatusInputVisible();
		invoicesPage.searchButtonVisible();
		invoicesPage.clickSearchButton();
		invoicesPage.resetButtonVisible();
		invoicesPage.clickResetButton();
		invoicesPage.clickSearchButton();
		invoicesPage.verifyDraftBadgeClass();
		invoicesPage.enterEstimateNumberInputData(
			InvoicesPageData.secondInvoiceNumber
		);
		invoicesPage.clickSearchButton();
		invoicesPage.clickResetButton();
		invoicesPage.verifyDraftBadgeClass();
		invoicesPage.clickTabButton(2);
		invoicesPage.verifyDraftBadgeClass();
	});
	it('Should be able to edit invoice', () => {
		invoicesPage.clickTabButton(0);
		invoicesPage.selectTableRow(0);
		invoicesPage.editButtonVisible();
		invoicesPage.clickEditButton(0);
		invoicesPage.discountInputVisible();
		invoicesPage.enterDiscountData(InvoicesPageData.editDiscountValue);
		invoicesPage.discountTypeDropdownVisible();
		invoicesPage.clickDiscountDropdown();
		invoicesPage.selectDiscountTypeFromDropdown(
			InvoicesPageData.discountType
		);
		invoicesPage.contactDropdownVisible();
		invoicesPage.clickContactDropdown();
		invoicesPage.selectContactFromDropdown(0);
		invoicesPage.taxInputVisible();
		invoicesPage.enterTaxData(InvoicesPageData.taxValue);
		invoicesPage.taxTypeDropdownVisible();
		invoicesPage.clickTaxTypeDropdown();
		invoicesPage.selectTaxTypeFromDropdown(InvoicesPageData.taxType);
		invoicesPage.saveAsDraftButtonVisible();
		invoicesPage.clickSaveAsDraftButton(InvoicesPageData.saveAsDraftButton);
		invoicesPage.waitMessageToHide();
		invoicesPage.verifyDraftBadgeClass();
	});
	it('Should be able to send invoice', () => {
		invoicesPage.selectTableRow(0);
		invoicesPage.moreButtonVisible();
		invoicesPage.clickMoreButton();
		invoicesPage.actionButtonVisible();
		invoicesPage.clickActionButtonByText(InvoicesPageData.sendButton);
		invoicesPage.confirmButtonVisible();
		invoicesPage.clickConfirmButton();
		invoicesPage.waitMessageToHide();
		invoicesPage.verifySentBadgeClass();
	});
	it('Should be able to view invoice', () => {
		invoicesPage.selectTableRow(0);
		invoicesPage.viewButtonVisible();
		invoicesPage.clickViewButton(1);
		invoicesPage.backButtonVisible();
		invoicesPage.clickBackButton();
	});
	it('Should be able to send invoice by email', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		invoicesPage.selectTableRow(0);
		invoicesPage.moreButtonVisible();
		invoicesPage.clickMoreButton();
		invoicesPage.actionButtonVisible();
		invoicesPage.clickActionButtonByText(InvoicesPageData.emailButton);
		invoicesPage.scrollEmailInviteTemplate();
		invoicesPage.emailInputVisible();
		invoicesPage.enterEmailData(sendEmail);
		invoicesPage.confirmButtonVisible();
		invoicesPage.clickConfirmButton();
		invoicesPage.waitMessageToHide();
		invoicesPage.verifySentBadgeClass();
	});
	it('Should be able to set invoice status', () => {
		invoicesPage.waitMessageToHide();
		invoicesPage.selectTableRow(0);
		invoicesPage.setStatusButtonVisible();
		invoicesPage.clickSetStatusButton(InvoicesPageData.setStatusButton);
		invoicesPage.setStatusFromDropdown(InvoicesPageData.status);
	});
	it('Should be able to delete invoice', () => {
		invoicesPage.waitMessageToHide();
		invoicesPage.selectTableRow(0);
		invoicesPage.moreButtonVisible();
		invoicesPage.clickMoreButton();
		invoicesPage.deleteButtonVisible();
		invoicesPage.clickDeleteButton();
		invoicesPage.confirmDeleteButtonVisible();
		invoicesPage.clickConfirmDeleteButton();
		invoicesPage.waitMessageToHide();
		invoicesPage.verifyElementIsDeleted(InvoicesPageData.emptyTableText);
	});
});
