import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationVendorsPage from './support/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../src/support/Base/pagedata/OrganizationVendorsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

test.describe('Organization vendors test', () => {
	test('Organization vendors test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new vendor', async () => {
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

		await test.step('Should be able to edit vendor', async () => {
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

		await test.step('Should be able to delete vendor', async () => {
			await organizationVendorsPage.deleteVendorButtonVisible();
			await organizationVendorsPage.clickDeleteVendorButton(0);
			await organizationVendorsPage.confirmDeleteButtonVisible();
			await organizationVendorsPage.clickConfirmDeleteButton();
			await organizationVendorsPage.waitMessageToHide();
			await organizationVendorsPage.verifyVendorIsDeleted();
		});
	});
});
