import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as estimatesPage from '../support/Base/pages/Estimates.po';
import { EstimatesPageData } from '../support/Base/pagedata/EstimatesPageData';
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

describe('Estimates test', () => {
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
		cy.visit('/#/pages/accounting/invoices/estimates');
		estimatesPage.gridBtnExists();
		estimatesPage.gridBtnClick(1);
		estimatesPage.addButtonVisible();
		estimatesPage.clickAddButton();
		estimatesPage.tagsDropdownVisible();
		estimatesPage.clickTagsDropdown();
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
		estimatesPage.selectContactFromDropdown(0);
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
	it('Should be able to search estimate', () => {
		estimatesPage.verifyTabButtonVisible();
		estimatesPage.clickTabButton(1);
		estimatesPage.verifyEstimateNumberInputVisible();
		estimatesPage.enterEstimateNumberInputData(
			EstimatesPageData.estimateNumber
		);
		estimatesPage.verifyCurrencyDropdownVisible();
		estimatesPage.verifyEstimateDateInput();
		estimatesPage.verifyEstimateDueDateInput();
		estimatesPage.verifyTotalValueInputVisible();
		estimatesPage.verifyCurrencyDropdownVisible();
		estimatesPage.verifyStatusInputVisible();
		estimatesPage.searchButtonVisible();
		estimatesPage.clickSearchButton();
		estimatesPage.resetButtonVisible();
		estimatesPage.clickResetButton();
		estimatesPage.clickSearchButton();
		estimatesPage.verifyDraftBadgeClass();
		estimatesPage.enterEstimateNumberInputData(
			EstimatesPageData.secondEstimateNumber
		);
		estimatesPage.clickSearchButton();
		estimatesPage.clickResetButton();
		estimatesPage.verifyDraftBadgeClass();
		estimatesPage.clickTabButton(2);
		estimatesPage.verifyDraftBadgeClass();
	});
	it('Should be able to edit estimate', () => {
		estimatesPage.clickTabButton(0);
		estimatesPage.selectTableRow(0);
		estimatesPage.editButtonVisible();
		estimatesPage.clickEditButton(0);
		estimatesPage.discountInputVisible();
		estimatesPage.enterDiscountData(EstimatesPageData.editDiscountValue);
		estimatesPage.discountTypeDropdownVisible();
		estimatesPage.clickDiscountDropdown();
		estimatesPage.selectDiscountTypeFromDropdown(
			EstimatesPageData.discountType
		);
		estimatesPage.contactDropdownVisible();
		estimatesPage.clickContactDropdown();
		estimatesPage.selectContactFromDropdown(0);
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
		estimatesPage.moreButtonVisible();
		estimatesPage.clickMoreButton();
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
		estimatesPage.moreButtonVisible();
		estimatesPage.clickMoreButton();
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(EstimatesPageData.sendButton);
		estimatesPage.confirmButtonVisible();
		estimatesPage.clickConfirmButton();
		estimatesPage.waitMessageToHide();
		estimatesPage.clickMoreButton();
		estimatesPage.verifySentBadgeClass();
	});
	it('Should be able to view estimate', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.viewButtonVisible();
		estimatesPage.clickViewButton(1);
		estimatesPage.backButtonVisible();
		estimatesPage.clickBackButton();
	});
	it('Should be able to send estimate by email', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.moreButtonVisible();
		estimatesPage.clickMoreButton();
		estimatesPage.actionButtonVisible();
		estimatesPage.clickActionButtonByText(EstimatesPageData.emailButton);
		estimatesPage.scrollEmailInviteTemplate();
		estimatesPage.emailInputVisible();
		estimatesPage.enterEmailData(sendEmail);
		estimatesPage.confirmButtonVisible();
		estimatesPage.clickConfirmButton();
		estimatesPage.waitMessageToHide();
		estimatesPage.clickMoreButton();
		estimatesPage.verifySentBadgeClass();
	});
	it('Should be able to convert estimate to invoice', () => {
		estimatesPage.selectTableRow(0);
		estimatesPage.actionButtonVisible();
		estimatesPage.convertToInvoiceButtonVisible();
		estimatesPage.clickConvertToInvoiceButton(0);
	});
	it('Should be able to delete estimate', () => {
		estimatesPage.addButtonVisible();
		estimatesPage.clickAddButton();
		estimatesPage.tagsDropdownVisible();
		estimatesPage.clickTagsDropdown();
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
		estimatesPage.selectContactFromDropdown(0);
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
		estimatesPage.selectTableRow(0);
		estimatesPage.moreButtonVisible();
		estimatesPage.clickMoreButton();
		estimatesPage.deleteButtonVisible();
		estimatesPage.clickDeleteButton();
		estimatesPage.confirmDeleteButtonVisible();
		estimatesPage.clickConfirmDeleteButton();
		estimatesPage.verifyElementIsDeleted(EstimatesPageData.discountValue);
	});
});
