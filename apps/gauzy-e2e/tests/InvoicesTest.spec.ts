import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as invoicesPage from './support/pages/Invoices.po';
import { InvoicesPageData } from '../src/support/Base/pagedata/InvoicesPageData';
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

test.describe('Invoices test', () => {
	test('Invoices test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.exampleEmail();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new invoice', async () => {
			await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
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
			// addContact ends on /#/pages/contacts/leads, so a bare hash goto to the invoices route is
			// frequently a SAME-DOCUMENT NO-OP (Playwright doesn't reload, the Angular hash-router never
			// re-renders) — the page stays on the Leads screen and the invoices Add button is never found
			// (the Leads add button is ALSO a status="success" button, so addButtonVisible would still
			// resolve against the wrong screen). Mirror the gotoRoute helper: force the hash when goto()
			// didn't take, settle, then wait for the Invoices grid header before interacting.
			await getPage().goto('/#/pages/accounting/invoices');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/accounting/invoices')) {
					location.hash = '#/pages/accounting/invoices';
				}
			});
			await getPage().waitForTimeout(800);
			await getPage()
				.locator('nb-card-header.card-header-title:has-text("Invoices")')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 })
				.catch(() => {});
			await invoicesPage.gridBtnExists();
			await invoicesPage.gridBtnClick(1);
			await invoicesPage.addButtonVisible();
			await invoicesPage.clickAddButton();
			await invoicesPage.tagsDropdownVisible();
			await invoicesPage.clickTagsDropdown();
			await invoicesPage.selectTagFromDropdown(0);
			await invoicesPage.clickCardBody();
			await invoicesPage.discountInputVisible();
			await invoicesPage.enterDiscountData(InvoicesPageData.discountValue);
			await invoicesPage.discountTypeDropdownVisible();
			await invoicesPage.clickDiscountDropdown();
			await invoicesPage.selectDiscountTypeFromDropdown(InvoicesPageData.discountType);
			await invoicesPage.contactDropdownVisible();
			await invoicesPage.clickContactDropdown();
			await invoicesPage.selectContactFromDropdown(0);
			await invoicesPage.taxInputVisible();
			await invoicesPage.enterTaxData(InvoicesPageData.taxValue);
			await invoicesPage.taxTypeDropdownVisible();
			await invoicesPage.clickTaxTypeDropdown();
			await invoicesPage.selectTaxTypeFromDropdown(InvoicesPageData.taxType);
			await invoicesPage.invoiceTypeDropdownVisible();
			await invoicesPage.clickInvoiceTypeDropdown();
			await invoicesPage.selectInvoiceTypeFromDropdown(InvoicesPageData.invoiceType);
			await invoicesPage.employeeDropdownVisible();
			await invoicesPage.clickEmployeeDropdown();
			await invoicesPage.selectEmployeeFromDropdown(0);
			await invoicesPage.clickKeyboardButtonByKeyCode(9);
			await invoicesPage.generateItemsButtonVisible();
			await invoicesPage.clickGenerateItemsButton();
			await invoicesPage.saveAsDraftButtonVisible();
			await invoicesPage.clickSaveAsDraftButton(InvoicesPageData.saveAsDraftButton);
			await invoicesPage.waitMessageToHide();
			await invoicesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to search invoice', async () => {
			await invoicesPage.verifyTabButtonVisible();
			await invoicesPage.clickTabButton(1);
			await invoicesPage.verifyEstimateNumberInputVisible();
			await invoicesPage.enterEstimateNumberInputData(InvoicesPageData.invoiceNumber);
			await invoicesPage.verifyCurrencyDropdownVisible();
			await invoicesPage.verifyEstimateDateInput();
			await invoicesPage.verifyEstimateDueDateInput();
			await invoicesPage.verifyTotalValueInputVisible();
			await invoicesPage.verifyCurrencyDropdownVisible();
			await invoicesPage.verifyStatusInputVisible();
			await invoicesPage.searchButtonVisible();
			await invoicesPage.clickSearchButton();
			await invoicesPage.resetButtonVisible();
			await invoicesPage.clickResetButton();
			await invoicesPage.clickSearchButton();
			await invoicesPage.verifyDraftBadgeClass();
			await invoicesPage.enterEstimateNumberInputData(InvoicesPageData.secondInvoiceNumber);
			await invoicesPage.clickSearchButton();
			await invoicesPage.clickResetButton();
			await invoicesPage.verifyDraftBadgeClass();
			await invoicesPage.clickTabButton(2);
			await invoicesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to edit invoice', async () => {
			await invoicesPage.clickTabButton(0);
			await invoicesPage.selectTableRow(0);
			await invoicesPage.editButtonVisible();
			await invoicesPage.clickEditButton(0);
			await invoicesPage.discountInputVisible();
			await invoicesPage.enterDiscountData(InvoicesPageData.editDiscountValue);
			await invoicesPage.discountTypeDropdownVisible();
			await invoicesPage.clickDiscountDropdown();
			await invoicesPage.selectDiscountTypeFromDropdown(InvoicesPageData.discountType);
			await invoicesPage.contactDropdownVisible();
			await invoicesPage.clickContactDropdown();
			await invoicesPage.selectContactFromDropdown(0);
			await invoicesPage.taxInputVisible();
			await invoicesPage.enterTaxData(InvoicesPageData.taxValue);
			await invoicesPage.taxTypeDropdownVisible();
			await invoicesPage.clickTaxTypeDropdown();
			await invoicesPage.selectTaxTypeFromDropdown(InvoicesPageData.taxType);
			await invoicesPage.saveAsDraftButtonVisible();
			await invoicesPage.clickSaveAsDraftButton(InvoicesPageData.saveAsDraftButton);
			await invoicesPage.waitMessageToHide();
			await invoicesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to send invoice', async () => {
			await invoicesPage.selectTableRow(0);
			await invoicesPage.moreButtonVisible();
			await invoicesPage.clickMoreButton();
			await invoicesPage.actionButtonVisible();
			await invoicesPage.clickActionButtonByText(InvoicesPageData.sendButton);
			await invoicesPage.confirmButtonVisible();
			await invoicesPage.clickConfirmButton();
			await invoicesPage.waitMessageToHide();
			await invoicesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to view invoice', async () => {
			await invoicesPage.selectTableRow(0);
			await invoicesPage.viewButtonVisible();
			await invoicesPage.clickViewButton(1);
			await invoicesPage.backButtonVisible();
			await invoicesPage.clickBackButton();
		});

		await test.step('Should be able to send invoice by email', async () => {
			await invoicesPage.selectTableRow(0);
			await invoicesPage.moreButtonVisible();
			await invoicesPage.clickMoreButton();
			await invoicesPage.actionButtonVisible();
			await invoicesPage.clickActionButtonByText(InvoicesPageData.emailButton);
			await invoicesPage.scrollEmailInviteTemplate();
			await invoicesPage.emailInputVisible();
			await invoicesPage.enterEmailData(sendEmail);
			await invoicesPage.confirmButtonVisible();
			await invoicesPage.clickConfirmButton();
			await invoicesPage.waitMessageToHide();
			await invoicesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to set invoice status', async () => {
			await invoicesPage.waitMessageToHide();
			await invoicesPage.selectTableRow(0);
			await invoicesPage.setStatusButtonVisible();
			await invoicesPage.clickSetStatusButton(InvoicesPageData.setStatusButton);
			await invoicesPage.setStatusFromDropdown(InvoicesPageData.status);
		});

		await test.step('Should be able to delete invoice', async () => {
			await invoicesPage.waitMessageToHide();
			await invoicesPage.selectTableRow(0);
			await invoicesPage.moreButtonVisible();
			await invoicesPage.clickMoreButton();
			await invoicesPage.deleteButtonVisible();
			await invoicesPage.clickDeleteButton();
			await invoicesPage.confirmDeleteButtonVisible();
			await invoicesPage.clickConfirmDeleteButton();
			await invoicesPage.waitMessageToHide();
			await invoicesPage.verifyElementIsDeleted(InvoicesPageData.emptyTableText);
		});
	});
});
