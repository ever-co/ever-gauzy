import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationTeamsPage from '../support/Base/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../support/Base/pagedata/OrganizationTeamsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

describe('Organization teams test', () => {
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

	it('Should be able to add new team', () => {
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
		cy.visit('/#/pages/organization/teams');
		organizationTeamsPage.gridBtnExists();
		organizationTeamsPage.gridBtnClick(1);
		organizationTeamsPage.addTeamButtonVisible();
		organizationTeamsPage.clickAddTeamButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.name
		);
		organizationTeamsPage.tagsMultyselectVisible();
		organizationTeamsPage.clickTagsMultyselect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
	});
	it('Should be able to edit team', () => {
		organizationTeamsPage.tableRowVisible();
		organizationTeamsPage.selectTableRow(0);
		organizationTeamsPage.editButtonVisible();
		organizationTeamsPage.clickEditButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.name
		);
		organizationTeamsPage.tagsMultyselectVisible();
		organizationTeamsPage.clickTagsMultyselect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
	});
	it('Should be able to delete team', () => {
		organizationTeamsPage.waitMessageToHide();
		organizationTeamsPage.selectTableRow(0);
		organizationTeamsPage.deleteButtonVisible();
		organizationTeamsPage.clickDeleteButton();
		organizationTeamsPage.confirmDeleteButtonVisible();
		organizationTeamsPage.clickConfirmDeleteButton();
	});
});
