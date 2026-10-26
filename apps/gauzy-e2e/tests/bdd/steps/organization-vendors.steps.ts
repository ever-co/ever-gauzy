import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { faker } from '@faker-js/faker';
import * as organizationVendorsPage from '../../support/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../../../src/support/Base/pagedata/OrganizationVendorsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain OrganizationVendorsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts.
//
// RUN-UNIQUE vendor names (same reason as the expense category in expenses.steps.ts): the shard's one
// database accumulates, so with the fixed 'Dominos Pizza' / 'JUMBO' a retry finds the previous attempt's
// rows — "exists" then passes on a leftover, the edit/delete act on whichever row comes first, and the
// final "deleted" check (strict: exactly our row must be gone) sees a second 'JUMBO'. The edit and the
// delete select the vendor BY THIS NAME rather than the first row for the same reason (the expenses
// scenario also adds a vendor, "Domminos Pizza", to this list). Initialised at the start of the first step.
let vendorName = '';
let editVendorName = '';

When('I add a new vendor', async () => {
	const suffix = faker.string.alphanumeric(6);
	vendorName = `${OrganizationVendorsPageData.vendorName} ${suffix}`;
	editVendorName = `${OrganizationVendorsPageData.editVendorName} ${suffix}`;

	await CustomCommands.addTag(
		organizationTagsUserPage,
		OrganizationTagsPageData
	);
	await getPage().goto('/#/pages/organization/vendors');
	await organizationVendorsPage.gridButtonVisible();
	await organizationVendorsPage.clickGridButton(1);
	await organizationVendorsPage.addVendorButtonVisible();
	await organizationVendorsPage.clickAddVendorButton();
	await organizationVendorsPage.nameInputVisible();
	await organizationVendorsPage.enterNameInputData(vendorName);
	await organizationVendorsPage.phoneInputVisible();
	await organizationVendorsPage.enterPhoneInputData(
		OrganizationVendorsPageData.vendorPhone
	);
	await organizationVendorsPage.emailInputVisible();
	await organizationVendorsPage.enterEmailInputData(
		OrganizationVendorsPageData.vendorEmail
	);
	await organizationVendorsPage.websiteInputVisible();
	await organizationVendorsPage.enterWebsiteInputData(
		OrganizationVendorsPageData.vendorWebsite
	);
	await organizationVendorsPage.tagsDropdownVisible();
	await organizationVendorsPage.clickTagsDropdown();
	await organizationVendorsPage.selectTagFromDropdown(0);
	await organizationVendorsPage.clickKeyboardButtonByKeyCode(9);
	await organizationVendorsPage.saveVendorButtonVisible();
	await organizationVendorsPage.clickSaveVendorButton();
	await organizationVendorsPage.waitMessageToHide();
	await organizationVendorsPage.verifyVendorExists(vendorName);
});

When('I edit the vendor', async () => {
	await organizationVendorsPage.selectItemByName(vendorName);
	await organizationVendorsPage.editVendorButtonVisible();
	await organizationVendorsPage.clickEditVendorButton(0);
	await organizationVendorsPage.nameInputVisible();
	await organizationVendorsPage.enterNameInputData(editVendorName);
	await organizationVendorsPage.phoneInputVisible();
	await organizationVendorsPage.enterPhoneInputData(
		OrganizationVendorsPageData.vendorPhone
	);
	await organizationVendorsPage.emailInputVisible();
	await organizationVendorsPage.enterEmailInputData(
		OrganizationVendorsPageData.vendorEmail
	);
	await organizationVendorsPage.websiteInputVisible();
	await organizationVendorsPage.enterWebsiteInputData(
		OrganizationVendorsPageData.vendorWebsite
	);
	await organizationVendorsPage.tagsDropdownVisible();
	await organizationVendorsPage.clickTagsDropdown();
	await organizationVendorsPage.selectTagFromDropdown(0);
	await organizationVendorsPage.clickKeyboardButtonByKeyCode(9);
	await organizationVendorsPage.saveVendorButtonVisible();
	await organizationVendorsPage.clickSaveVendorButton();
	await organizationVendorsPage.waitMessageToHide();
	await organizationVendorsPage.verifyVendorExists(editVendorName);
});

When('I delete the vendor', async () => {
	await organizationVendorsPage.selectItemByName(editVendorName);
	await organizationVendorsPage.deleteVendorButtonVisible();
	await organizationVendorsPage.clickDeleteVendorButton(0);
	await organizationVendorsPage.confirmDeleteButtonVisible();
	await organizationVendorsPage.clickConfirmDeleteButton();
	await organizationVendorsPage.waitMessageToHide();
	await organizationVendorsPage.verifyVendorIsDeleted(editVendorName);
});
