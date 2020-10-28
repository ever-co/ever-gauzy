import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Organization tags test', () => {
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
	it('Should be able to create tag', () => {
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton();
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.closeDialogButtonVisible();
		organizationTagsUserPage.clickCloseDialogButton();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.checkboxTenantLevelVisible();
		organizationTagsUserPage.clickCheckboxTenantLevel();
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
	});
	it('Should be able to edit tag', () => {
		organizationTagsUserPage.tagsTableDataVisible();
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.editTagButtonVisible();
		organizationTagsUserPage.clickEditTagButton();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.clickCheckboxTenantLevel();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
	});
	it('Should be able to delete tag', () => {
		organizationTagsUserPage.tagsTableDataVisible();
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.deleteTagButtonVisible();
		organizationTagsUserPage.clickDeleteTagButton();
		organizationTagsUserPage.confirmDeleteTagButtonVisible();
		organizationTagsUserPage.clickConfirmDeleteTagButton();
	});
});
