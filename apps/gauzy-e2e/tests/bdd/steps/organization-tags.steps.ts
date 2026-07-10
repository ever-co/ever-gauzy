import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';

// Converted 1:1 from the plain OrganizationTagsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts.

When('I create a new tag', async () => {
	await getPage().goto('/#/pages/organization/tags');
	await organizationTagsUserPage.gridButtonVisible();
	await organizationTagsUserPage.clickGridButton(1);
	await organizationTagsUserPage.addTagButtonVisible();
	await organizationTagsUserPage.clickAddTagButton();
	await organizationTagsUserPage.closeDialogButtonVisible();
	await organizationTagsUserPage.clickCloseDialogButton();
	await organizationTagsUserPage.clickAddTagButton();
	await organizationTagsUserPage.tagNameInputVisible();
	await organizationTagsUserPage.enterTagNameData(OrganizationTagsPageData.tagName);
	await organizationTagsUserPage.tagColorInputVisible();
	await organizationTagsUserPage.enterTagColorData(OrganizationTagsPageData.tagColor);
	await organizationTagsUserPage.tagDescriptionTextareaVisible();
	await organizationTagsUserPage.enterTagDescriptionData(OrganizationTagsPageData.tagDescription);
	await organizationTagsUserPage.saveTagButtonVisible();
	await organizationTagsUserPage.clickSaveTagButton();
	await organizationTagsUserPage.waitMessageToHide();
	await organizationTagsUserPage.verifyTagExists(OrganizationTagsPageData.tagName);
});

When('I edit the tag', async () => {
	await organizationTagsUserPage.selectTableRow(0);
	await organizationTagsUserPage.editTagButtonVisible();
	await organizationTagsUserPage.clickEditTagButton();
	await organizationTagsUserPage.enterTagNameData(OrganizationTagsPageData.editTagName);
	await organizationTagsUserPage.enterTagColorData(OrganizationTagsPageData.tagColor);
	await organizationTagsUserPage.enterTagDescriptionData(OrganizationTagsPageData.tagDescription);
	await organizationTagsUserPage.saveTagButtonVisible();
	await organizationTagsUserPage.clickSaveTagButton();
	await organizationTagsUserPage.waitMessageToHide();
	await organizationTagsUserPage.verifyTagExists(OrganizationTagsPageData.editTagName);
});

When('I delete the tag', async () => {
	await organizationTagsUserPage.selectTableRow(0);
	await organizationTagsUserPage.deleteTagButtonVisible();
	await organizationTagsUserPage.clickDeleteTagButton();
	await organizationTagsUserPage.confirmDeleteTagButtonVisible();
	await organizationTagsUserPage.clickConfirmDeleteTagButton();
	await organizationTagsUserPage.waitMessageToHide();
	await organizationTagsUserPage.verifyTagIsDeleted(OrganizationTagsPageData.editTagName);
});
