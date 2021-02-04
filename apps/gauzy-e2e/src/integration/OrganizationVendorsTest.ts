import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationVendorsPage from '../support/Base/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../support/Base/pagedata/OrganizationVendorsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

describe('Organization vendors test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new vendor', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/organization/vendors');
		organizationVendorsPage.gridButtonVisible();
		organizationVendorsPage.clickGridButton(1);
		organizationVendorsPage.addVendorButtonVisible();
		organizationVendorsPage.clickAddVendorButton();
		organizationVendorsPage.nameInputVisible();
		organizationVendorsPage.enterNameInputData(
			OrganizationVendorsPageData.vendorName
		);
		organizationVendorsPage.phoneInputVisible();
		organizationVendorsPage.enterPhoneInputData(
			OrganizationVendorsPageData.vendorPhone
		);
		organizationVendorsPage.emailInputVisible();
		organizationVendorsPage.enterEmailInputData(
			OrganizationVendorsPageData.vendorEmail
		);
		organizationVendorsPage.websiteInputVisible();
		organizationVendorsPage.enterWebsiteInputData(
			OrganizationVendorsPageData.vendorWebsite
		);
		organizationVendorsPage.tagsDropdownVisible();
		organizationVendorsPage.clickTagsDropdwon();
		organizationVendorsPage.selectTagFromDropdown(0);
		organizationVendorsPage.clickKeyboardButtonByKeyCode(9);
		organizationVendorsPage.saveVendorButtonVisible();
		organizationVendorsPage.clickSaveVendorButton();
		organizationVendorsPage.waitMessageToHide();
		organizationVendorsPage.verifyVendorExists(
			OrganizationVendorsPageData.vendorName
		);
	});
	it('Should be able to edit vendor', () => {
		organizationVendorsPage.editVendorButtonVisible();
		organizationVendorsPage.clickEditVendorButton(0);
		organizationVendorsPage.nameInputVisible();
		organizationVendorsPage.enterNameInputData(
			OrganizationVendorsPageData.editVendorName
		);
		organizationVendorsPage.phoneInputVisible();
		organizationVendorsPage.enterPhoneInputData(
			OrganizationVendorsPageData.vendorPhone
		);
		organizationVendorsPage.emailInputVisible();
		organizationVendorsPage.enterEmailInputData(
			OrganizationVendorsPageData.vendorEmail
		);
		organizationVendorsPage.websiteInputVisible();
		organizationVendorsPage.enterWebsiteInputData(
			OrganizationVendorsPageData.vendorWebsite
		);
		organizationVendorsPage.tagsDropdownVisible();
		organizationVendorsPage.clickTagsDropdwon();
		organizationVendorsPage.selectTagFromDropdown(0);
		organizationVendorsPage.clickKeyboardButtonByKeyCode(9);
		organizationVendorsPage.saveVendorButtonVisible();
		organizationVendorsPage.clickSaveVendorButton();
		organizationVendorsPage.waitMessageToHide();
		organizationVendorsPage.verifyVendorExists(
			OrganizationVendorsPageData.editVendorName
		);
	});
	it('Should be able to delete vendor', () => {
		organizationVendorsPage.deleteVendorButtonVisible();
		organizationVendorsPage.clickDeleteVendorButton(0);
		organizationVendorsPage.confirmDeletebuttonVisible();
		organizationVendorsPage.clickConfirmDeleteButton();
		organizationVendorsPage.waitMessageToHide();
		organizationVendorsPage.verifyVendorIsDeleted();
	});
});
