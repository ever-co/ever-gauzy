import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as salesEstimatesPage from '../support/Base/pages/SalesEstimates.po';
import { SalesEstimatesPageData } from '../support/Base/pagedata/SalesEstimatesPageData';
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

describe('Sales estimates test', () => {
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
	it('Should be able to add new estimate', () => {
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
		cy.visit('/#/pages/sales/invoices/estimates');
		salesEstimatesPage.gridBtnExists();
		salesEstimatesPage.gridBtnClick(1);
		salesEstimatesPage.addButtonVisible();
		salesEstimatesPage.clickAddButton();
		salesEstimatesPage.tagsDropdownVisible();
		salesEstimatesPage.clickTagsDropdown();
		salesEstimatesPage.selectTagFromDropdown(0);
		salesEstimatesPage.clickCardBody();
		salesEstimatesPage.discountInputVisible();
		salesEstimatesPage.enterDiscountData(
			SalesEstimatesPageData.discountValue
		);
		salesEstimatesPage.discountTypeDropdownVisible();
		salesEstimatesPage.clickDiscountDropdown();
		salesEstimatesPage.selectDiscountTypeFromDropdown(
			SalesEstimatesPageData.discountType
		);
		salesEstimatesPage.contactDropdownVisible();
		salesEstimatesPage.clickContactDropdown();
		salesEstimatesPage.selectContactFromDropdown(0);
		salesEstimatesPage.taxInputVisible();
		salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
		salesEstimatesPage.taxTypeDropdownVisible();
		salesEstimatesPage.clickTaxTypeDropdown();
		salesEstimatesPage.selectTaxTypeFromDropdown(
			SalesEstimatesPageData.taxType
		);
		salesEstimatesPage.invoiceTypeDropdownVisible();
		salesEstimatesPage.clickInvoiceTypeDropdown();
		salesEstimatesPage.selectInvoiceTypeFromDropdown(
			SalesEstimatesPageData.invoiceType
		);
		salesEstimatesPage.employeeDropdownVisible();
		salesEstimatesPage.clickEmployeeDropdown();
		salesEstimatesPage.selectEmployeeFromDropdown(0);
		salesEstimatesPage.clickKeyboardButtonByKeyCode(9);
		salesEstimatesPage.generateItemsButtonVisible();
		salesEstimatesPage.clickGenerateItemsButton();
		salesEstimatesPage.saveAsDraftButtonVisible();
		salesEstimatesPage.clickSaveAsDraftButton(
			SalesEstimatesPageData.saveAsDraftButton
		);
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.verifyDraftBadgeClass();
	});
	it('Should be able to edit estimate', () => {
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.editButtonVisible();
		salesEstimatesPage.clickEditButton(0);
		salesEstimatesPage.discountInputVisible();
		salesEstimatesPage.enterDiscountData(
			SalesEstimatesPageData.editDiscountValue
		);
		salesEstimatesPage.discountTypeDropdownVisible();
		salesEstimatesPage.clickDiscountDropdown();
		salesEstimatesPage.selectDiscountTypeFromDropdown(
			SalesEstimatesPageData.discountType
		);
		salesEstimatesPage.contactDropdownVisible();
		salesEstimatesPage.clickContactDropdown();
		salesEstimatesPage.selectContactFromDropdown(0);
		salesEstimatesPage.taxInputVisible();
		salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
		salesEstimatesPage.taxTypeDropdownVisible();
		salesEstimatesPage.clickTaxTypeDropdown();
		salesEstimatesPage.selectTaxTypeFromDropdown(
			SalesEstimatesPageData.taxType
		);
		salesEstimatesPage.saveAsDraftButtonVisible();
		salesEstimatesPage.clickSaveAsDraftButton(
			SalesEstimatesPageData.saveAsDraftButton
		);
	});
	it('Should be able to duplicate estimate', () => {
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.moreButtonVisible();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.actionButtonVisible();
		salesEstimatesPage.clickActionButtonByText(
			SalesEstimatesPageData.duplicateButton
		);
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.backButtonVisible();
		salesEstimatesPage.clickBackButton();
	});
	it('Should be able to send estimate', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.moreButtonVisible();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.actionButtonVisible();
		salesEstimatesPage.clickActionButtonByText(
			SalesEstimatesPageData.sendButton
		);
		salesEstimatesPage.confirmButtonVisible();
		salesEstimatesPage.clickConfirmButton();
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.verifySentBadgeClass();
	});
	it('Should be able to view estimate', () => {
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.viewButtonVisible();
		salesEstimatesPage.clickViewButton(1);
		salesEstimatesPage.backButtonVisible();
		salesEstimatesPage.clickBackButton();
	});
	it('Should be able to send estimate by email', () => {
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.moreButtonVisible();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.actionButtonVisible();
		salesEstimatesPage.clickActionButtonByText(
			SalesEstimatesPageData.emailButton
		);
		salesEstimatesPage.scrollEmailInviteTemplate();
		salesEstimatesPage.emailInputVisible();
		salesEstimatesPage.enterEmailData(sendEmail);
		salesEstimatesPage.confirmButtonVisible();
		salesEstimatesPage.clickConfirmButton();
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.verifySentBadgeClass();
	});
	it('Should be able to convert estimate to invoice', () => {
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.actionButtonVisible();
		salesEstimatesPage.convertToInvoiceButtonVisible();
		salesEstimatesPage.clickConvertToInvoiceButton(0);
	});
	it('Should be able to delete estimate', () => {
		salesEstimatesPage.addButtonVisible();
		salesEstimatesPage.clickAddButton();
		salesEstimatesPage.tagsDropdownVisible();
		salesEstimatesPage.clickTagsDropdown();
		salesEstimatesPage.selectTagFromDropdown(0);
		salesEstimatesPage.clickCardBody();
		salesEstimatesPage.discountInputVisible();
		salesEstimatesPage.enterDiscountData(
			SalesEstimatesPageData.discountValue
		);
		salesEstimatesPage.discountTypeDropdownVisible();
		salesEstimatesPage.clickDiscountDropdown();
		salesEstimatesPage.selectDiscountTypeFromDropdown(
			SalesEstimatesPageData.discountType
		);
		salesEstimatesPage.contactDropdownVisible();
		salesEstimatesPage.clickContactDropdown();
		salesEstimatesPage.selectContactFromDropdown(0);
		salesEstimatesPage.taxInputVisible();
		salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
		salesEstimatesPage.taxTypeDropdownVisible();
		salesEstimatesPage.clickTaxTypeDropdown();
		salesEstimatesPage.selectTaxTypeFromDropdown(
			SalesEstimatesPageData.taxType
		);
		salesEstimatesPage.invoiceTypeDropdownVisible();
		salesEstimatesPage.clickInvoiceTypeDropdown();
		salesEstimatesPage.selectInvoiceTypeFromDropdown(
			SalesEstimatesPageData.invoiceType
		);
		salesEstimatesPage.employeeDropdownVisible();
		salesEstimatesPage.clickEmployeeDropdown();
		salesEstimatesPage.selectEmployeeFromDropdown(0);
		salesEstimatesPage.clickKeyboardButtonByKeyCode(9);
		salesEstimatesPage.generateItemsButtonVisible();
		salesEstimatesPage.clickGenerateItemsButton();
		salesEstimatesPage.saveAsDraftButtonVisible();
		salesEstimatesPage.clickSaveAsDraftButton(
			SalesEstimatesPageData.saveAsDraftButton
		);
		salesEstimatesPage.waitMessageToHide();
		salesEstimatesPage.verifyDraftBadgeClass();
		salesEstimatesPage.selectTableRow(0);
		salesEstimatesPage.moreButtonVisible();
		salesEstimatesPage.clickMoreButton();
		salesEstimatesPage.deleteButtonVisible();
		salesEstimatesPage.clickDeleteButton();
		salesEstimatesPage.confirmDeleteButtonVisible();
		salesEstimatesPage.clickConfirmDeleteButton();
		salesEstimatesPage.verifyElementIsDeleted(
			SalesEstimatesPageData.discountValue
		);
	});
});
