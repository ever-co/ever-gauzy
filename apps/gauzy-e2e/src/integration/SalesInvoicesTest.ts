import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as salesInvoicesPage from '../support/Base/pages/SalesInvoices.po';
import { SalesInvoicesPageData } from '../support/Base/pagedata/SalesInvoicesPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';
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

describe('Sales invoices test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.email();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
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
		cy.visit('/#/pages/sales/invoices');
		salesInvoicesPage.gridBtnExists();
		salesInvoicesPage.gridBtnClick(1);
		salesInvoicesPage.addButtonVisible();
		salesInvoicesPage.clickAddButton();
		salesInvoicesPage.tagsDropdownVisible();
		salesInvoicesPage.clickTagsDropdwon();
		salesInvoicesPage.selectTagFromDropdown(0);
		salesInvoicesPage.clickCardBody();
		salesInvoicesPage.discountInputVisible();
		salesInvoicesPage.enterDiscountData(
			SalesInvoicesPageData.discountValue
		);
		salesInvoicesPage.discountTypeDropdownVisible();
		salesInvoicesPage.clickDiscountDropdown();
		salesInvoicesPage.selectDiscountTypeFromDropdown(
			SalesInvoicesPageData.discountType
		);
		salesInvoicesPage.contactDropdownVisible();
		salesInvoicesPage.clickContactDropdown();
		salesInvoicesPage.selectContactFromDropdwon(0);
		salesInvoicesPage.taxInputVisible();
		salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
		salesInvoicesPage.taxTypeDropdownVisible();
		salesInvoicesPage.clickTaxTypeDropdown();
		salesInvoicesPage.selectTaxTypeFromDropdown(
			SalesInvoicesPageData.taxType
		);
		salesInvoicesPage.invoiceTypeDropdownVisible();
		salesInvoicesPage.clickInvoiceTypeDropdown();
		salesInvoicesPage.selectInvoiceTypeFromDropdown(
			SalesInvoicesPageData.invoiceType
		);
		salesInvoicesPage.employeeDropdownVisible();
		salesInvoicesPage.clickEmployeeDropdown();
		salesInvoicesPage.selectEmployeeFromDropdown(0);
		salesInvoicesPage.clickKeyboardButtonByKeyCode(9);
		salesInvoicesPage.generateItemsButtonVisible();
		salesInvoicesPage.clickGenerateItemsButton();
		salesInvoicesPage.saveAsDraftButtonVisible();
		salesInvoicesPage.clickSaveAsDraftButton(
			SalesInvoicesPageData.saveAsDraftButton
		);
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.verifyDraftBadgeClass();
	});
	it('Should be able to edit invoice', () => {
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.editButtonVisible();
		salesInvoicesPage.clickEditButton(0);
		salesInvoicesPage.discountInputVisible();
		salesInvoicesPage.enterDiscountData(
			SalesInvoicesPageData.editDiscountValue
		);
		salesInvoicesPage.discountTypeDropdownVisible();
		salesInvoicesPage.clickDiscountDropdown();
		salesInvoicesPage.selectDiscountTypeFromDropdown(
			SalesInvoicesPageData.discountType
		);
		salesInvoicesPage.contactDropdownVisible();
		salesInvoicesPage.clickContactDropdown();
		salesInvoicesPage.selectContactFromDropdwon(0);
		salesInvoicesPage.taxInputVisible();
		salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
		salesInvoicesPage.taxTypeDropdownVisible();
		salesInvoicesPage.clickTaxTypeDropdown();
		salesInvoicesPage.selectTaxTypeFromDropdown(
			SalesInvoicesPageData.taxType
		);
		salesInvoicesPage.saveAsDraftButtonVisible();
		salesInvoicesPage.clickSaveAsDraftButton(
			SalesInvoicesPageData.saveAsDraftButton
		);
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.verifyDraftBadgeClass();
	});
	it('Should be able to send invoice', () => {
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.moreButtonVisible();
		salesInvoicesPage.clickMoreButton();
		salesInvoicesPage.actionButtonVisible();
		salesInvoicesPage.clickActionButtonByText(
			SalesInvoicesPageData.sendButton
		);
		salesInvoicesPage.confirmButtonVisible();
		salesInvoicesPage.clickConfirmButton();
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.verifySentBadgeClass();
	});
	it('Should be able to view invoice', () => {
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.viewButtonVisible();
		salesInvoicesPage.clickViewButton(1);
		salesInvoicesPage.backButtonVisible();
		salesInvoicesPage.clickBackButton();
	});
	it('Should be able to send invoice by email', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.moreButtonVisible();
		salesInvoicesPage.clickMoreButton();
		salesInvoicesPage.actionButtonVisible();
		salesInvoicesPage.clickActionButtonByText(
			SalesInvoicesPageData.emailButton
		);
		salesInvoicesPage.scrollEmailInviteTemplate();
		salesInvoicesPage.emailInputVisible();
		salesInvoicesPage.enterEmailData(sendEmail);
		salesInvoicesPage.confirmButtonVisible();
		salesInvoicesPage.clickConfirmButton();
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.verifySentBadgeClass();
	});
	it('Should be able to set invoice status', () => {
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.setStatusButtonVisible();
		salesInvoicesPage.clickSetStatusButton(
			SalesInvoicesPageData.setStatusButton
		);
		salesInvoicesPage.setStatusFromDropdown(SalesInvoicesPageData.status);
	});
	it('Should be able to delete invoice', () => {
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.selectTableRow(0);
		salesInvoicesPage.moreButtonVisible();
		salesInvoicesPage.clickMoreButton();
		salesInvoicesPage.deleteButtonVisible();
		salesInvoicesPage.clickDeleteButton();
		salesInvoicesPage.confirmDeleteButtonVisible();
		salesInvoicesPage.clickConfirmDeleteButton();
		salesInvoicesPage.waitMessageToHide();
		salesInvoicesPage.verifyElementIsDeleted(
			SalesInvoicesPageData.emptyTableText
		);
	});
});
