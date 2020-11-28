import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as estimatesPage from '../support/Base/pages/Estimates.po';
import { EstimatesPageData } from '../support/Base/pagedata/EstimatesPageData';
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
let country = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';
let sendEmail = ' ';

describe('Estimates test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		country = faker.address.country();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.email();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
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
			country,
			city,
			postcode,
			street,
			website,
			contactsLeadsPage,
			ContactsLeadsPageData
		);
		cy.visit('/#/pages/accounting/invoices/estimates');
		estimatesPage.gridBtnExists();
		estimatesPage.gridBtnClick(1);
		estimatesPage.addButtonVisible();
		estimatesPage.clickAddButton();
		estimatesPage.tagsDropdownVisible();
		estimatesPage.clickTagsDropdwon();
		estimatesPage.selectTagFromDropdown(0);
		estimatesPage.clickCardBody();
		estimatesPage.discountInputVisible();
		estimatesPage.enterDiscountData(EstimatesPageData.discountValue);
		estimatesPage.discountTypeDropdownVisible();
		estimatesPage.clickDiscountDropdown();
		estimatesPage.selectDiscountTypeFromDropdown(
			EstimatesPageData.discountType
		);
		estimatesPage.contactDropdownVisible();
		estimatesPage.clickContactDropdown();
		estimatesPage.selectContactFromDropdwon(0);
		estimatesPage.taxInputVisible();
		estimatesPage.enterTaxData(EstimatesPageData.taxValue);
		estimatesPage.taxTypeDropdownVisible();
		estimatesPage.clickTaxTypeDropdown();
		estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
		estimatesPage.invoiceTypeDropdownVisible();
		estimatesPage.clickInvoiceTypeDropdown();
		estimatesPage.selectInvoiceTypeFromDropdown(
			EstimatesPageData.invoiceType
		);
		estimatesPage.employeeDropdownVisible();
		estimatesPage.clickEmployeeDropdown();
		estimatesPage.selectEmployeeFromDropdown(0);
		estimatesPage.clickKeyboardButtonByKeyCode(9);
		estimatesPage.generateItemsButtonVisible();
		estimatesPage.clickGenerateItemsButton();
		estimatesPage.saveAsDraftButtonVisible();
		estimatesPage.clickSaveAsDraftButton(
			EstimatesPageData.saveAsDraftButton
		);
		estimatesPage.waitMessageToHide();
		estimatesPage.verifyDraftBadgeClass();
	});
	it('Should be able to edit estimate', () => {
		estimatesPage.addButtonVisible();
		estimatesPage.clickAddButton();
		estimatesPage.backButtonVisible();
		estimatesPage.clickBackButton();
		estimatesPage.selectTableRow(0);
		estimatesPage.editButtonVisible();
		estimatesPage.clickEditButton(EstimatesPageData.editButton);
		estimatesPage.discountInputVisible();
		estimatesPage.enterDiscountData(EstimatesPageData.editDiscountValue);
		estimatesPage.discountTypeDropdownVisible();
		estimatesPage.clickDiscountDropdown();
		estimatesPage.selectDiscountTypeFromDropdown(
			EstimatesPageData.discountType
		);
		estimatesPage.contactDropdownVisible();
		estimatesPage.clickContactDropdown();
		estimatesPage.selectContactFromDropdwon(0);
		estimatesPage.taxInputVisible();
		estimatesPage.enterTaxData(EstimatesPageData.taxValue);
		estimatesPage.taxTypeDropdownVisible();
		estimatesPage.clickTaxTypeDropdown();
		estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
		estimatesPage.saveAsDraftButtonVisible();
		estimatesPage.clickSaveAsDraftButton(
			EstimatesPageData.saveAsDraftButton
		);
	});
	it('Should be able to duplicate estimate', () => {
		estimatesPage.waitMessageToHide();
		estimatesPage.selectTableRow(0);
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(
			EstimatesPageData.duplicateButton
		);
		estimatesPage.waitMessageToHide();
		estimatesPage.backButtonVisible();
		estimatesPage.clickBackButton();
	});
	it('Should be able to send estimate', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(EstimatesPageData.sendButton);
		estimatesPage.confirmButtonVisible();
		estimatesPage.clickConfirmButton();
		estimatesPage.waitMessageToHide();
		estimatesPage.verifySentBadgeClass();
	});
	it('Should be able to view estimate', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(EstimatesPageData.viewButton);
		estimatesPage.backButtonVisible();
		estimatesPage.clickBackButton();
	});
	it('Should be able to send estimate by email', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(EstimatesPageData.emailButton);
		estimatesPage.scrollEmailInviteTemplate();
		estimatesPage.emailInputVisible();
		estimatesPage.enterEmailData(sendEmail);
		estimatesPage.confirmButtonVisible();
		estimatesPage.clickConfirmButton();
		estimatesPage.waitMessageToHide();
		estimatesPage.verifySentBadgeClass();
	});
	it('Should be able to convert estimate to invoice', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(
			EstimatesPageData.convertToInvoiceButton
		);
	});
	it('Should be able to delete estimate', () => {
		estimatesPage.waitMessageToHide();
		estimatesPage.selectTableRow(0);
		estimatesPage.deleteButtonVisible();
		estimatesPage.clickDeleteButton();
		estimatesPage.confirmDeleteButtonVisible();
		estimatesPage.clickConfirmDeleteButton();
		estimatesPage.verifyElementIsDeleted(EstimatesPageData.discountValue);
	});
});
