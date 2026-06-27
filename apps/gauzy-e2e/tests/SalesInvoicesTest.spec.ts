import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as salesInvoicesPage from './support/pages/SalesInvoices.po';
import { SalesInvoicesPageData } from '../src/support/Base/pagedata/SalesInvoicesPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import { ContactsLeadsPageData } from '../src/support/Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from './support/pages/ContactsLeads.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';

let email = ' ';
let fullName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';
let sendEmail = ' ';

test.describe('Sales invoices test', () => {
	test('Sales invoices test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.exampleEmail();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new invoice', async () => {
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await CustomCommands.addContact(
				fullName,
				email,
				city,
				postcode,
				street,
				website,
				contactsLeadsPage,
				ContactsLeadsPageData
			);
			await getPage().goto('/#/pages/sales/invoices');
			// A hash-only goto issued right after addContact can be a same-document no-op (the SPA router
			// never re-renders, leaving the leads screen mounted). Force the hash so Angular's hashchange
			// fires, then let the invoices screen settle before interacting.
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/sales/invoices')) {
					location.hash = '#/pages/sales/invoices';
				}
			});
			await getPage().waitForTimeout(700);
			await salesInvoicesPage.gridBtnExists();
			await salesInvoicesPage.gridBtnClick(1);
			await salesInvoicesPage.addButtonVisible();
			await salesInvoicesPage.clickAddButton();
			await salesInvoicesPage.tagsDropdownVisible();
			await salesInvoicesPage.clickTagsDropdown();
			await salesInvoicesPage.selectTagFromDropdown(0);
			await salesInvoicesPage.clickCardBody();
			await salesInvoicesPage.discountInputVisible();
			await salesInvoicesPage.enterDiscountData(
				SalesInvoicesPageData.discountValue
			);
			await salesInvoicesPage.discountTypeDropdownVisible();
			await salesInvoicesPage.clickDiscountDropdown();
			await salesInvoicesPage.selectDiscountTypeFromDropdown(
				SalesInvoicesPageData.discountType
			);
			await salesInvoicesPage.contactDropdownVisible();
			await salesInvoicesPage.clickContactDropdown();
			await salesInvoicesPage.selectContactFromDropdown(0);
			await salesInvoicesPage.taxInputVisible();
			await salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
			await salesInvoicesPage.taxTypeDropdownVisible();
			await salesInvoicesPage.clickTaxTypeDropdown();
			await salesInvoicesPage.selectTaxTypeFromDropdown(
				SalesInvoicesPageData.taxType
			);
			await salesInvoicesPage.invoiceTypeDropdownVisible();
			await salesInvoicesPage.clickInvoiceTypeDropdown();
			await salesInvoicesPage.selectInvoiceTypeFromDropdown(
				SalesInvoicesPageData.invoiceType
			);
			await salesInvoicesPage.employeeDropdownVisible();
			await salesInvoicesPage.clickEmployeeDropdown();
			await salesInvoicesPage.selectEmployeeFromDropdown(0);
			await salesInvoicesPage.clickKeyboardButtonByKeyCode(9);
			await salesInvoicesPage.generateItemsButtonVisible();
			await salesInvoicesPage.clickGenerateItemsButton();
			await salesInvoicesPage.saveAsDraftButtonVisible();
			await salesInvoicesPage.clickSaveAsDraftButton(
				SalesInvoicesPageData.saveAsDraftButton
			);
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to edit invoice', async () => {
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.editButtonVisible();
			await salesInvoicesPage.clickEditButton(0);
			await salesInvoicesPage.discountInputVisible();
			await salesInvoicesPage.enterDiscountData(
				SalesInvoicesPageData.editDiscountValue
			);
			await salesInvoicesPage.discountTypeDropdownVisible();
			await salesInvoicesPage.clickDiscountDropdown();
			await salesInvoicesPage.selectDiscountTypeFromDropdown(
				SalesInvoicesPageData.discountType
			);
			await salesInvoicesPage.contactDropdownVisible();
			await salesInvoicesPage.clickContactDropdown();
			await salesInvoicesPage.selectContactFromDropdown(0);
			await salesInvoicesPage.taxInputVisible();
			await salesInvoicesPage.enterTaxData(SalesInvoicesPageData.taxValue);
			await salesInvoicesPage.taxTypeDropdownVisible();
			await salesInvoicesPage.clickTaxTypeDropdown();
			await salesInvoicesPage.selectTaxTypeFromDropdown(
				SalesInvoicesPageData.taxType
			);
			await salesInvoicesPage.saveAsDraftButtonVisible();
			await salesInvoicesPage.clickSaveAsDraftButton(
				SalesInvoicesPageData.saveAsDraftButton
			);
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to send invoice', async () => {
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.moreButtonVisible();
			await salesInvoicesPage.clickMoreButton();
			await salesInvoicesPage.actionButtonVisible();
			await salesInvoicesPage.clickActionButtonByText(
				SalesInvoicesPageData.sendButton
			);
			await salesInvoicesPage.confirmButtonVisible();
			await salesInvoicesPage.clickConfirmButton();
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to view invoice', async () => {
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.viewButtonVisible();
			// index 0 = the View (eye-outline) button; the old `1` resolved to the Payments button.
			await salesInvoicesPage.clickViewButton(0);
			await salesInvoicesPage.backButtonVisible();
			await salesInvoicesPage.clickBackButton();
		});

		await test.step('Should be able to send invoice by email', async () => {
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.moreButtonVisible();
			await salesInvoicesPage.clickMoreButton();
			await salesInvoicesPage.actionButtonVisible();
			await salesInvoicesPage.clickActionButtonByText(
				SalesInvoicesPageData.emailButton
			);
			await salesInvoicesPage.scrollEmailInviteTemplate();
			await salesInvoicesPage.emailInputVisible();
			await salesInvoicesPage.enterEmailData(sendEmail);
			await salesInvoicesPage.confirmButtonVisible();
			await salesInvoicesPage.clickConfirmButton();
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to set invoice status', async () => {
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.setStatusButtonVisible();
			await salesInvoicesPage.clickSetStatusButton(
				SalesInvoicesPageData.setStatusButton
			);
			await salesInvoicesPage.setStatusFromDropdown(SalesInvoicesPageData.status);
		});

		await test.step('Should be able to delete invoice', async () => {
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.selectTableRow(0);
			await salesInvoicesPage.moreButtonVisible();
			await salesInvoicesPage.clickMoreButton();
			await salesInvoicesPage.deleteButtonVisible();
			await salesInvoicesPage.clickDeleteButton();
			await salesInvoicesPage.confirmDeleteButtonVisible();
			await salesInvoicesPage.clickConfirmDeleteButton();
			await salesInvoicesPage.waitMessageToHide();
			await salesInvoicesPage.verifyElementIsDeleted(
				SalesInvoicesPageData.emptyTableText
			);
		});
	});
});
