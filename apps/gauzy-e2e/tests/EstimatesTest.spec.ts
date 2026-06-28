import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as estimatesPage from './support/pages/Estimates.po';
import { EstimatesPageData } from '../src/support/Base/pagedata/EstimatesPageData';
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

test.describe('Estimates test', () => {
	test('Estimates test', async () => {
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
			await getPage().goto('/#/pages/accounting/invoices/estimates');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/accounting/invoices/estimates')) {
					location.hash = '#/pages/accounting/invoices/estimates';
				}
			});
			await getPage().waitForTimeout(800);
			await getPage()
				.locator('nb-card-header.card-header-title:has-text("Estimates")')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 })
				.catch(() => {});
			await estimatesPage.gridBtnExists();
			await estimatesPage.gridBtnClick(1);
			await estimatesPage.addButtonVisible();
			await estimatesPage.clickAddButton();
			await estimatesPage.tagsDropdownVisible();
			await estimatesPage.clickTagsDropdown();
			await estimatesPage.selectTagFromDropdown(0);
			await estimatesPage.clickCardBody();
			await estimatesPage.discountInputVisible();
			await estimatesPage.enterDiscountData(EstimatesPageData.discountValue);
			await estimatesPage.discountTypeDropdownVisible();
			await estimatesPage.clickDiscountDropdown();
			await estimatesPage.selectDiscountTypeFromDropdown(
				EstimatesPageData.discountType
			);
			await estimatesPage.contactDropdownVisible();
			await estimatesPage.clickContactDropdown();
			await estimatesPage.selectContactFromDropdown(0);
			await estimatesPage.taxInputVisible();
			await estimatesPage.enterTaxData(EstimatesPageData.taxValue);
			await estimatesPage.taxTypeDropdownVisible();
			await estimatesPage.clickTaxTypeDropdown();
			await estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
			await estimatesPage.invoiceTypeDropdownVisible();
			await estimatesPage.clickInvoiceTypeDropdown();
			await estimatesPage.selectInvoiceTypeFromDropdown(
				EstimatesPageData.invoiceType
			);
			await estimatesPage.employeeDropdownVisible();
			await estimatesPage.clickEmployeeDropdown();
			await estimatesPage.selectEmployeeFromDropdown(0);
			await estimatesPage.clickKeyboardButtonByKeyCode(9);
			await estimatesPage.generateItemsButtonVisible();
			await estimatesPage.clickGenerateItemsButton();
			await estimatesPage.saveAsDraftButtonVisible();
			await estimatesPage.clickSaveAsDraftButton(
				EstimatesPageData.saveAsDraftButton
			);
			await estimatesPage.waitMessageToHide();
			await estimatesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to search estimate', async () => {
			await estimatesPage.verifyTabButtonVisible();
			await estimatesPage.clickTabButton(1);
			await estimatesPage.verifyEstimateNumberInputVisible();
			await estimatesPage.enterEstimateNumberInputData(
				EstimatesPageData.estimateNumber
			);
			await estimatesPage.verifyCurrencyDropdownVisible();
			await estimatesPage.verifyEstimateDateInput();
			await estimatesPage.verifyEstimateDueDateInput();
			await estimatesPage.verifyTotalValueInputVisible();
			await estimatesPage.verifyCurrencyDropdownVisible();
			await estimatesPage.verifyStatusInputVisible();
			await estimatesPage.searchButtonVisible();
			await estimatesPage.clickSearchButton();
			await estimatesPage.resetButtonVisible();
			await estimatesPage.clickResetButton();
			await estimatesPage.clickSearchButton();
			await estimatesPage.verifyDraftBadgeClass();
			await estimatesPage.enterEstimateNumberInputData(
				EstimatesPageData.secondEstimateNumber
			);
			await estimatesPage.clickSearchButton();
			await estimatesPage.clickResetButton();
			await estimatesPage.verifyDraftBadgeClass();
			await estimatesPage.clickTabButton(2);
			await estimatesPage.verifyDraftBadgeClass();
		});

		await test.step('Should be able to edit estimate', async () => {
			await estimatesPage.clickTabButton(0);
			await estimatesPage.selectTableRow(0);
			await estimatesPage.editButtonVisible();
			await estimatesPage.clickEditButton(0);
			await estimatesPage.discountInputVisible();
			await estimatesPage.enterDiscountData(EstimatesPageData.editDiscountValue);
			await estimatesPage.discountTypeDropdownVisible();
			await estimatesPage.clickDiscountDropdown();
			await estimatesPage.selectDiscountTypeFromDropdown(
				EstimatesPageData.discountType
			);
			await estimatesPage.contactDropdownVisible();
			await estimatesPage.clickContactDropdown();
			await estimatesPage.selectContactFromDropdown(0);
			await estimatesPage.taxInputVisible();
			await estimatesPage.enterTaxData(EstimatesPageData.taxValue);
			await estimatesPage.taxTypeDropdownVisible();
			await estimatesPage.clickTaxTypeDropdown();
			await estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
			await estimatesPage.saveAsDraftButtonVisible();
			await estimatesPage.clickSaveAsDraftButton(
				EstimatesPageData.saveAsDraftButton
			);
		});

		await test.step('Should be able to duplicate estimate', async () => {
			await estimatesPage.waitMessageToHide();
			await estimatesPage.selectTableRow(0);
			await estimatesPage.selectTableRow(0);
			await estimatesPage.moreButtonVisible();
			await estimatesPage.clickMoreButton();
			await estimatesPage.actionButtonVisible();
			await estimatesPage.clickActionButtonByText(
				EstimatesPageData.duplicateButton
			);
			await estimatesPage.waitMessageToHide();
			await estimatesPage.backButtonVisible();
			await estimatesPage.clickBackButton();
		});

		await test.step('Should be able to send estimate', async () => {
			await estimatesPage.selectTableRow(0);
			await estimatesPage.moreButtonVisible();
			await estimatesPage.clickMoreButton();
			await estimatesPage.actionButtonVisible();
			await estimatesPage.clickActionButtonByText(EstimatesPageData.sendButton);
			await estimatesPage.confirmButtonVisible();
			await estimatesPage.clickConfirmButton();
			await estimatesPage.waitMessageToHide();
			await estimatesPage.clickMoreButton();
			await estimatesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to view estimate', async () => {
			await estimatesPage.selectTableRow(0);
			await estimatesPage.viewButtonVisible();
			await estimatesPage.clickViewButton(1);
			await estimatesPage.backButtonVisible();
			await estimatesPage.clickBackButton();
		});

		await test.step('Should be able to send estimate by email', async () => {
			await estimatesPage.selectTableRow(0);
			await estimatesPage.moreButtonVisible();
			await estimatesPage.clickMoreButton();
			await estimatesPage.actionButtonVisible();
			await estimatesPage.clickActionButtonByText(EstimatesPageData.emailButton);
			await estimatesPage.scrollEmailInviteTemplate();
			await estimatesPage.emailInputVisible();
			await estimatesPage.enterEmailData(sendEmail);
			await estimatesPage.confirmButtonVisible();
			await estimatesPage.clickConfirmButton();
			await estimatesPage.waitMessageToHide();
			await estimatesPage.clickMoreButton();
			await estimatesPage.verifySentBadgeClass();
		});

		await test.step('Should be able to convert estimate to invoice', async () => {
			await estimatesPage.selectTableRow(0);
			await estimatesPage.actionButtonVisible();
			await estimatesPage.convertToInvoiceButtonVisible();
			await estimatesPage.clickConvertToInvoiceButton(0);
		});

		await test.step('Should be able to delete estimate', async () => {
			await estimatesPage.addButtonVisible();
			await estimatesPage.clickAddButton();
			await estimatesPage.tagsDropdownVisible();
			await estimatesPage.clickTagsDropdown();
			await estimatesPage.selectTagFromDropdown(0);
			await estimatesPage.clickCardBody();
			await estimatesPage.discountInputVisible();
			await estimatesPage.enterDiscountData(EstimatesPageData.discountValue);
			await estimatesPage.discountTypeDropdownVisible();
			await estimatesPage.clickDiscountDropdown();
			await estimatesPage.selectDiscountTypeFromDropdown(
				EstimatesPageData.discountType
			);
			await estimatesPage.contactDropdownVisible();
			await estimatesPage.clickContactDropdown();
			await estimatesPage.selectContactFromDropdown(0);
			await estimatesPage.taxInputVisible();
			await estimatesPage.enterTaxData(EstimatesPageData.taxValue);
			await estimatesPage.taxTypeDropdownVisible();
			await estimatesPage.clickTaxTypeDropdown();
			await estimatesPage.selectTaxTypeFromDropdown(EstimatesPageData.taxType);
			await estimatesPage.invoiceTypeDropdownVisible();
			await estimatesPage.clickInvoiceTypeDropdown();
			await estimatesPage.selectInvoiceTypeFromDropdown(
				EstimatesPageData.invoiceType
			);
			await estimatesPage.employeeDropdownVisible();
			await estimatesPage.clickEmployeeDropdown();
			await estimatesPage.selectEmployeeFromDropdown(0);
			await estimatesPage.clickKeyboardButtonByKeyCode(9);
			await estimatesPage.generateItemsButtonVisible();
			await estimatesPage.clickGenerateItemsButton();
			await estimatesPage.saveAsDraftButtonVisible();
			await estimatesPage.clickSaveAsDraftButton(
				EstimatesPageData.saveAsDraftButton
			);
			await estimatesPage.waitMessageToHide();
			await estimatesPage.verifyDraftBadgeClass();
			await estimatesPage.selectTableRow(0);
			await estimatesPage.moreButtonVisible();
			await estimatesPage.clickMoreButton();
			await estimatesPage.deleteButtonVisible();
			await estimatesPage.clickDeleteButton();
			await estimatesPage.confirmDeleteButtonVisible();
			await estimatesPage.clickConfirmDeleteButton();
			await estimatesPage.verifyElementIsDeleted(EstimatesPageData.discountValue);
		});
	});
});
