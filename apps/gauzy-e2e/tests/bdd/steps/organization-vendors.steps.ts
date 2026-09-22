import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationVendorsPage from '../../support/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../../../src/support/Base/pagedata/OrganizationVendorsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain OrganizationVendorsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts.

When('I add a new vendor', async () => {
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
	await organizationVendorsPage.enterNameInputData(
		OrganizationVendorsPageData.vendorName
	);
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
	await organizationVendorsPage.verifyVendorExists(
		OrganizationVendorsPageData.vendorName
	);
});

When('I edit the vendor', async () => {
	await organizationVendorsPage.selectFirstItem();
	await organizationVendorsPage.editVendorButtonVisible();
	await organizationVendorsPage.clickEditVendorButton(0);
	await organizationVendorsPage.nameInputVisible();
	await organizationVendorsPage.enterNameInputData(
		OrganizationVendorsPageData.editVendorName
	);
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
	await organizationVendorsPage.verifyVendorExists(
		OrganizationVendorsPageData.editVendorName
	);
});

When('I delete the vendor', async () => {
	await organizationVendorsPage.selectFirstItem();
	await organizationVendorsPage.deleteVendorButtonVisible();
	await organizationVendorsPage.clickDeleteVendorButton(0);
	await organizationVendorsPage.confirmDeleteButtonVisible();
	await organizationVendorsPage.clickConfirmDeleteButton();
	await organizationVendorsPage.waitMessageToHide();
	await organizationVendorsPage.verifyVendorIsDeleted(
		OrganizationVendorsPageData.editVendorName
	);
});
