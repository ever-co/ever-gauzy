import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Organization tags test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to create tag', () => {
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.closeDialogButtonVisible();
		organizationTagsUserPage.clickCloseDialogButton();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tagName
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
		organizationTagsUserPage.waitMessageToHide();
		organizationTagsUserPage.verifyTagExists(
			OrganizationTagsPageData.tagName
		);
	});
	it('Should be able to edit tag', () => {
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.editTagButtonVisible();
		organizationTagsUserPage.clickEditTagButton();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.editTagName
		);
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
		organizationTagsUserPage.waitMessageToHide();
		organizationTagsUserPage.verifyTagExists(
			OrganizationTagsPageData.editTagName
		);
	});
	it('Should be able to delete tag', () => {
		organizationTagsUserPage.selectTableRow(0);
		organizationTagsUserPage.deleteTagButtonVisible();
		organizationTagsUserPage.clickDeleteTagButton();
		organizationTagsUserPage.confirmDeleteTagButtonVisible();
		organizationTagsUserPage.clickConfirmDeleteTagButton();
		organizationTagsUserPage.waitMessageToHide();
		organizationTagsUserPage.verifyTagIsDeleted(
			OrganizationTagsPageData.editTagName
		);
	});
});
