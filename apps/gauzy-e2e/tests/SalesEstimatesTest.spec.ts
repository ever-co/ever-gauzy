import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as salesEstimatesPage from './support/pages/SalesEstimates.po';
import { SalesEstimatesPageData } from '../src/support/Base/pagedata/SalesEstimatesPageData';
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

test.describe('Sales estimates test', () => {
	test('Sales estimates test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();
		sendEmail = faker.internet.exampleEmail();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new estimate', async () => {
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
			// addContact ends on /#/pages/contacts/leads, so a bare hash goto to the estimates route is
			// frequently a SAME-DOCUMENT NO-OP (Playwright doesn't reload, the Angular hash-router never
			// re-renders) — the page stays on the Leads screen and the estimates Add button is never found
			// (the Leads add button is ALSO a status="success" button, so addButtonVisible would still
			// resolve against the wrong screen). Mirror the gotoRoute helper: force the hash when goto()
			// didn't take, settle, then wait for the Estimates grid header before interacting.
			await getPage().goto('/#/pages/sales/invoices/estimates');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/sales/invoices/estimates')) {
					location.hash = '#/pages/sales/invoices/estimates';
				}
			});
			await getPage().waitForTimeout(800);
			await getPage()
				.locator('nb-card-header.card-header-title:has-text("Estimates")')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 })
				.catch(() => {});
			await salesEstimatesPage.gridBtnExists();
			await salesEstimatesPage.gridBtnClick(1);
			await salesEstimatesPage.addButtonVisible();
			await salesEstimatesPage.clickAddButton();
			await salesEstimatesPage.tagsDropdownVisible();
			await salesEstimatesPage.clickTagsDropdown();
			await salesEstimatesPage.selectTagFromDropdown(0);
			await salesEstimatesPage.clickCardBody();
			await salesEstimatesPage.discountInputVisible();
			await salesEstimatesPage.enterDiscountData(
				SalesEstimatesPageData.discountValue
			);
			await salesEstimatesPage.discountTypeDropdownVisible();
			await salesEstimatesPage.clickDiscountDropdown();
			await salesEstimatesPage.selectDiscountTypeFromDropdown(
				SalesEstimatesPageData.discountType
			);
			await salesEstimatesPage.contactDropdownVisible();
			await salesEstimatesPage.clickContactDropdown();
			await salesEstimatesPage.selectContactFromDropdown(0);
			await salesEstimatesPage.taxInputVisible();
			await salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
			await salesEstimatesPage.taxTypeDropdownVisible();
			await salesEstimatesPage.clickTaxTypeDropdown();
			await salesEstimatesPage.selectTaxTypeFromDropdown(
				SalesEstimatesPageData.taxType
			);
			await salesEstimatesPage.invoiceTypeDropdownVisible();
			await salesEstimatesPage.clickInvoiceTypeDropdown();
			await salesEstimatesPage.selectInvoiceTypeFromDropdown(
				SalesEstimatesPageData.invoiceType
			);
			await salesEstimatesPage.employeeDropdownVisible();
			await salesEstimatesPage.clickEmployeeDropdown();
			await salesEstimatesPage.selectEmployeeFromDropdown(0);
			await salesEstimatesPage.clickKeyboardButtonByKeyCode(9);
			await salesEstimatesPage.generateItemsButtonVisible();
			await salesEstimatesPage.clickGenerateItemsButton();
			await salesEstimatesPage.saveAsDraftButtonVisible();
			await salesEstimatesPage.clickSaveAsDraftButton(
				SalesEstimatesPageData.saveAsDraftButton
			);
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to edit estimate', async () => {
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.editButtonVisible();
			await salesEstimatesPage.clickEditButton(0);
			await salesEstimatesPage.discountInputVisible();
			await salesEstimatesPage.enterDiscountData(
				SalesEstimatesPageData.editDiscountValue
			);
			await salesEstimatesPage.discountTypeDropdownVisible();
			await salesEstimatesPage.clickDiscountDropdown();
			await salesEstimatesPage.selectDiscountTypeFromDropdown(
				SalesEstimatesPageData.discountType
			);
			await salesEstimatesPage.contactDropdownVisible();
			await salesEstimatesPage.clickContactDropdown();
			await salesEstimatesPage.selectContactFromDropdown(0);
			await salesEstimatesPage.taxInputVisible();
			await salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
			await salesEstimatesPage.taxTypeDropdownVisible();
			await salesEstimatesPage.clickTaxTypeDropdown();
			await salesEstimatesPage.selectTaxTypeFromDropdown(
				SalesEstimatesPageData.taxType
			);
			await salesEstimatesPage.saveAsDraftButtonVisible();
			await salesEstimatesPage.clickSaveAsDraftButton(
				SalesEstimatesPageData.saveAsDraftButton
			);
		});

		await test.step('Should be able to duplicate estimate', async () => {
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.moreButtonVisible();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.actionButtonVisible();
			await salesEstimatesPage.clickActionButtonByText(
				SalesEstimatesPageData.duplicateButton
			);
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.backButtonVisible();
			await salesEstimatesPage.clickBackButton();
		});

		await test.step('Should be able to send estimate', async () => {
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.moreButtonVisible();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.actionButtonVisible();
			await salesEstimatesPage.clickActionButtonByText(
				SalesEstimatesPageData.sendButton
			);
			await salesEstimatesPage.confirmButtonVisible();
			await salesEstimatesPage.clickConfirmButton();
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to view estimate', async () => {
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.viewButtonVisible();
			// Only one View button exists in the estimates toolbar; use index 0 (the text-scoped
			// selector matches exactly one element, so the old index 1 resolved to nothing).
			await salesEstimatesPage.clickViewButton(0);
			await salesEstimatesPage.backButtonVisible();
			await salesEstimatesPage.clickBackButton();
		});

		await test.step('Should be able to send estimate by email', async () => {
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.moreButtonVisible();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.actionButtonVisible();
			await salesEstimatesPage.clickActionButtonByText(
				SalesEstimatesPageData.emailButton
			);
			await salesEstimatesPage.scrollEmailInviteTemplate();
			await salesEstimatesPage.emailInputVisible();
			await salesEstimatesPage.enterEmailData(sendEmail);
			await salesEstimatesPage.confirmButtonVisible();
			await salesEstimatesPage.clickConfirmButton();
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to convert estimate to invoice', async () => {
			await salesEstimatesPage.selectTableRow(0);
			// No actionButtonVisible() here — "To invoice" is a TOOLBAR button (button.action.info), not a
			// popover action. selectTableRow clicks the grid row, which fires the popover's (clickOutside)
			// and CLOSES it, so asserting the popover action button (div.popover-container-action
			// button.action) would time out. Only the toolbar convert button is needed (enabled by the row
			// selection above). Mirrors the proven EstimatesTest convert step.
			await salesEstimatesPage.convertToInvoiceButtonVisible();
			await salesEstimatesPage.clickConvertToInvoiceButton(0);
		});

		await test.step('Should be able to delete estimate', async () => {
			await salesEstimatesPage.addButtonVisible();
			await salesEstimatesPage.clickAddButton();
			await salesEstimatesPage.tagsDropdownVisible();
			await salesEstimatesPage.clickTagsDropdown();
			await salesEstimatesPage.selectTagFromDropdown(0);
			await salesEstimatesPage.clickCardBody();
			await salesEstimatesPage.discountInputVisible();
			await salesEstimatesPage.enterDiscountData(
				SalesEstimatesPageData.discountValue
			);
			await salesEstimatesPage.discountTypeDropdownVisible();
			await salesEstimatesPage.clickDiscountDropdown();
			await salesEstimatesPage.selectDiscountTypeFromDropdown(
				SalesEstimatesPageData.discountType
			);
			await salesEstimatesPage.contactDropdownVisible();
			await salesEstimatesPage.clickContactDropdown();
			await salesEstimatesPage.selectContactFromDropdown(0);
			await salesEstimatesPage.taxInputVisible();
			await salesEstimatesPage.enterTaxData(SalesEstimatesPageData.taxValue);
			await salesEstimatesPage.taxTypeDropdownVisible();
			await salesEstimatesPage.clickTaxTypeDropdown();
			await salesEstimatesPage.selectTaxTypeFromDropdown(
				SalesEstimatesPageData.taxType
			);
			await salesEstimatesPage.invoiceTypeDropdownVisible();
			await salesEstimatesPage.clickInvoiceTypeDropdown();
			await salesEstimatesPage.selectInvoiceTypeFromDropdown(
				SalesEstimatesPageData.invoiceType
			);
			await salesEstimatesPage.employeeDropdownVisible();
			await salesEstimatesPage.clickEmployeeDropdown();
			await salesEstimatesPage.selectEmployeeFromDropdown(0);
			await salesEstimatesPage.clickKeyboardButtonByKeyCode(9);
			await salesEstimatesPage.generateItemsButtonVisible();
			await salesEstimatesPage.clickGenerateItemsButton();
			await salesEstimatesPage.saveAsDraftButtonVisible();
			await salesEstimatesPage.clickSaveAsDraftButton(
				SalesEstimatesPageData.saveAsDraftButton
			);
			await salesEstimatesPage.waitMessageToHide();
			await salesEstimatesPage.verifyDraftBadgeClass();
			await salesEstimatesPage.selectTableRow(0);
			await salesEstimatesPage.moreButtonVisible();
			await salesEstimatesPage.clickMoreButton();
			await salesEstimatesPage.deleteButtonVisible();
			await salesEstimatesPage.clickDeleteButton();
			await salesEstimatesPage.confirmDeleteButtonVisible();
			await salesEstimatesPage.clickConfirmDeleteButton();
			await salesEstimatesPage.verifyElementIsDeleted(
				SalesEstimatesPageData.discountValue
			);
		});
	});
});
