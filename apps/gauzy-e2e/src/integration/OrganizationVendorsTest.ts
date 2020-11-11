import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationVendorsPage from '../support/Base/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../support/Base/pagedata/OrganizationVendorsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

describe('Organization vendors test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should be able to add new vendor', () => {
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
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
	});
	it('Should be able to edit vendor', () => {
		organizationVendorsPage.editVendorButtonVisible();
		organizationVendorsPage.clickEditVendorButton(0);
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
	});
	it('Should be able to delete vendor', () => {
		organizationVendorsPage.deleteVendorButtonVisible();
		organizationVendorsPage.clickDeleteVendorButton(0);
		organizationVendorsPage.confirmDeletebuttonVisible();
		organizationVendorsPage.clickConfirmDeleteButton();
	});
});
