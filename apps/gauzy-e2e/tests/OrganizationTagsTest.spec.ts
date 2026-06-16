import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Organization tags test', () => {
	test('Organization tags test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to create tag', async () => {
			await getPage().goto('/#/pages/organization/tags');
			await organizationTagsUserPage.gridButtonVisible();
			await organizationTagsUserPage.clickGridButton(1);
			await organizationTagsUserPage.addTagButtonVisible();
			await organizationTagsUserPage.clickAddTagButton();
			await organizationTagsUserPage.closeDialogButtonVisible();
			await organizationTagsUserPage.clickCloseDialogButton();
			await organizationTagsUserPage.clickAddTagButton();
			await organizationTagsUserPage.tagNameInputVisible();
			await organizationTagsUserPage.enterTagNameData(
				OrganizationTagsPageData.tagName
			);
			await organizationTagsUserPage.tagColorInputVisible();
			await organizationTagsUserPage.enterTagColorData(
				OrganizationTagsPageData.tagColor
			);
			await organizationTagsUserPage.tagDescriptionTextareaVisible();
			await organizationTagsUserPage.enterTagDescriptionData(
				OrganizationTagsPageData.tagDescription
			);
			await organizationTagsUserPage.saveTagButtonVisible();
			await organizationTagsUserPage.clickSaveTagButton();
			await organizationTagsUserPage.waitMessageToHide();
			await organizationTagsUserPage.verifyTagExists(
				OrganizationTagsPageData.tagName
			);
		});

		await test.step('Should be able to edit tag', async () => {
			await organizationTagsUserPage.selectTableRow(0);
			await organizationTagsUserPage.editTagButtonVisible();
			await organizationTagsUserPage.clickEditTagButton();
			await organizationTagsUserPage.enterTagNameData(
				OrganizationTagsPageData.editTagName
			);
			await organizationTagsUserPage.enterTagColorData(
				OrganizationTagsPageData.tagColor
			);
			await organizationTagsUserPage.enterTagDescriptionData(
				OrganizationTagsPageData.tagDescription
			);
			await organizationTagsUserPage.saveTagButtonVisible();
			await organizationTagsUserPage.clickSaveTagButton();
			await organizationTagsUserPage.waitMessageToHide();
			await organizationTagsUserPage.verifyTagExists(
				OrganizationTagsPageData.editTagName
			);
		});

		await test.step('Should be able to delete tag', async () => {
			await organizationTagsUserPage.selectTableRow(0);
			await organizationTagsUserPage.deleteTagButtonVisible();
			await organizationTagsUserPage.clickDeleteTagButton();
			await organizationTagsUserPage.confirmDeleteTagButtonVisible();
			await organizationTagsUserPage.clickConfirmDeleteTagButton();
			await organizationTagsUserPage.waitMessageToHide();
			await organizationTagsUserPage.verifyTagIsDeleted(
				OrganizationTagsPageData.editTagName
			);
		});
	});
});
