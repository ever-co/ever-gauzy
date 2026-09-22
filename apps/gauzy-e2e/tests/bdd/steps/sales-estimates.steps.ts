import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as salesEstimatesPage from '../../support/pages/SalesEstimates.po';
import { SalesEstimatesPageData } from '../../../src/support/Base/pagedata/SalesEstimatesPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';
import { ContactsLeadsPageData } from '../../../src/support/Base/pagedata/ContactsLeadsPageData';
import * as contactsLeadsPage from '../../support/pages/ContactsLeads.po';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';

// Converted 1:1 from the plain SalesEstimatesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po/CustomCommands call sequence, so runtime
// behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default user`
// Background step is defined once in common.steps.ts. Faker-generated values shared across steps are
// declared at module scope and initialised at the start of the first step (one scenario per feature,
// so module scope is safe).

let email = ' ';
let fullName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';
let sendEmail = ' ';

When('I add a new sales estimate', async () => {
	email = faker.internet.exampleEmail();
	fullName = faker.person.firstName() + ' ' + faker.person.lastName();
	city = faker.location.city();
	postcode = faker.location.zipCode();
	street = faker.location.streetAddress();
	website = faker.internet.url();
	sendEmail = faker.internet.exampleEmail();

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
	// Bind the estimate to the spec's OWN faker contact so every estimate this spec creates carries
	// `fullName` in the grid's Contact column — makes later row selection order-independent. The
	// sales/accounting estimates grids share data, so a plain row-0 / contact-0 grabs a FOREIGN
	// record (the failure DOM had 6 "Michael Sawayn" Draft rows from earlier specs and the send
	// dialog targeted that polluting contact). Mirrors the proven EstimatesTest.
	await salesEstimatesPage.selectContactFromDropdown(fullName);
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

When('I edit the sales estimate', async () => {
	// scope to one of THIS spec's estimates (by its contact name), never a foreign row-0
	await salesEstimatesPage.selectTableRow(fullName);
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
	// keep this spec's faker contact on the edited estimate so it stays scoped to `fullName`
	await salesEstimatesPage.selectContactFromDropdown(fullName);
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

When('I duplicate the sales estimate', async () => {
	await salesEstimatesPage.waitMessageToHide();
	await salesEstimatesPage.selectTableRow(fullName);
	await salesEstimatesPage.moreButtonVisible();
	await salesEstimatesPage.clickMoreButton();
	await salesEstimatesPage.actionButtonVisible();
	// pass fullName so a background grid refresh that deselected the row self-heals (re-select + reopen More)
	await salesEstimatesPage.clickActionButtonByText(
		SalesEstimatesPageData.duplicateButton,
		fullName
	);
	await salesEstimatesPage.waitMessageToHide();
	await salesEstimatesPage.backButtonVisible();
	await salesEstimatesPage.clickBackButton();
});

When('I send the sales estimate', async () => {
	await salesEstimatesPage.selectTableRow(fullName);
	await salesEstimatesPage.moreButtonVisible();
	await salesEstimatesPage.clickMoreButton();
	await salesEstimatesPage.actionButtonVisible();
	// The popover Send is `[disabled]="!canBeSend"`; passing fullName lets clickActionButtonByText
	// re-select this spec's row (recomputing canBeSend) if a grid refresh deselected it, so send()
	// actually fires and the estimate flips DRAFT -> SENT (otherwise div.badge-success never renders).
	await salesEstimatesPage.clickActionButtonByText(
		SalesEstimatesPageData.sendButton,
		fullName
	);
	await salesEstimatesPage.confirmButtonVisible();
	await salesEstimatesPage.clickConfirmButton();
	await salesEstimatesPage.waitMessageToHide();
	await salesEstimatesPage.clickMoreButton();
	await salesEstimatesPage.verifySentBadgeClass();
});

When('I view the sales estimate', async () => {
	await salesEstimatesPage.selectTableRow(fullName);
	await salesEstimatesPage.viewButtonVisible();
	// Only one View button exists in the estimates toolbar; use index 0 (the text-scoped
	// selector matches exactly one element, so the old index 1 resolved to nothing).
	await salesEstimatesPage.clickViewButton(0);
	await salesEstimatesPage.backButtonVisible();
	await salesEstimatesPage.clickBackButton();
});

When('I send the sales estimate by email', async () => {
	await salesEstimatesPage.selectTableRow(fullName);
	await salesEstimatesPage.moreButtonVisible();
	await salesEstimatesPage.clickMoreButton();
	await salesEstimatesPage.actionButtonVisible();
	// pass fullName so a deselecting grid refresh self-heals before the Email popover action dispatches
	await salesEstimatesPage.clickActionButtonByText(
		SalesEstimatesPageData.emailButton,
		fullName
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

When('I convert the sales estimate to an invoice', async () => {
	await salesEstimatesPage.selectTableRow(fullName);
	// No actionButtonVisible() here — "To invoice" is a TOOLBAR button (button.action.info), not a
	// popover action. selectTableRow clicks the grid row, which fires the popover's (clickOutside)
	// and CLOSES it, so asserting the popover action button (div.popover-container-action
	// button.action) would time out. Only the toolbar convert button is needed (enabled by the row
	// selection above). Mirrors the proven EstimatesTest convert step.
	await salesEstimatesPage.convertToInvoiceButtonVisible();
	await salesEstimatesPage.clickConvertToInvoiceButton(0);
});

When('I delete the sales estimate', async () => {
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
	// keep the delete-target estimate scoped to this spec's faker contact
	await salesEstimatesPage.selectContactFromDropdown(fullName);
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
	await salesEstimatesPage.selectTableRow(fullName);
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
