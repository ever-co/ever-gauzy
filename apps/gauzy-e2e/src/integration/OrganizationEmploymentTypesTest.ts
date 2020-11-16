import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationEmploymentTypePage from '../support/Base/pages/OrganizationEmploymentTypes.po';
import { OrganizationEmploymentTypesPageData } from '../support/Base/pagedata/OrganizationEmploymentTypesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

describe('Organization employment types test', () => {
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

	it('Should be able to add new employment type', () => {
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
		cy.visit('/#/pages/organization/employment-types');
		organizationEmploymentTypePage.gridBtnExists();
		organizationEmploymentTypePage.gridBtnClick(1);
		organizationEmploymentTypePage.addButtonVisible();
		organizationEmploymentTypePage.clickAddButton();
		organizationEmploymentTypePage.nameInputVisible();
		organizationEmploymentTypePage.enterNameInputData(
			OrganizationEmploymentTypesPageData.name
		);
		organizationEmploymentTypePage.tagsDropdownVisible();
		organizationEmploymentTypePage.clickTagsDropdwon();
		organizationEmploymentTypePage.selectTagFromDropdown(0);
		organizationEmploymentTypePage.clickKeyboardButtonByKeyCode(9);
		organizationEmploymentTypePage.saveButtonVisible();
		organizationEmploymentTypePage.clickSaveButton();
	});
	it('Should be able to edit employment type', () => {
		organizationEmploymentTypePage.waitMessageToHide();
		organizationEmploymentTypePage.editButtonVisible();
		organizationEmploymentTypePage.clickEditButton(0);
		organizationEmploymentTypePage.saveButtonVisible();
		organizationEmploymentTypePage.clickSaveButton();
	});
	it('Should be able to delete employment type', () => {
		organizationEmploymentTypePage.waitMessageToHide();
		organizationEmploymentTypePage.deleteButtonVisible();
		organizationEmploymentTypePage.clickDeleteButton(0);
		organizationEmploymentTypePage.confirmDeleteButtonVisible();
		organizationEmploymentTypePage.clickConfirmDeleteButton();
	});
});
