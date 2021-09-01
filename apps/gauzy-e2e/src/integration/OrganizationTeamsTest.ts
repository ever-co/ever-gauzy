import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationTeamsPage from '../support/Base/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../support/Base/pagedata/OrganizationTeamsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

describe('Organization teams test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new team', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/organization/teams');
		organizationTeamsPage.gridBtnExists();
		organizationTeamsPage.gridBtnClick(1);
		organizationTeamsPage.addTeamButtonVisible();
		organizationTeamsPage.clickAddTeamButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.name
		);
		organizationTeamsPage.tagsMultiSelectVisible();
		organizationTeamsPage.clickTagsMultiSelect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
		organizationTeamsPage.waitMessageToHide();
		organizationTeamsPage.verifyTeamExists(OrganizationTeamsPageData.name);
	});
	it('Should be able to edit team', () => {
		organizationTeamsPage.tableRowVisible();
		organizationTeamsPage.selectTableRow(0);
		organizationTeamsPage.editButtonVisible();
		organizationTeamsPage.clickEditButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.editName
		);
		organizationTeamsPage.tagsMultiSelectVisible();
		organizationTeamsPage.clickTagsMultiSelect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
		organizationTeamsPage.waitMessageToHide();
		organizationTeamsPage.verifyTeamExists(
			OrganizationTeamsPageData.editName
		);
	});
	it('Should be able to delete team', () => {
		organizationTeamsPage.selectTableRow(0);
		organizationTeamsPage.deleteButtonVisible();
		organizationTeamsPage.clickDeleteButton();
		organizationTeamsPage.confirmDeleteButtonVisible();
		organizationTeamsPage.clickConfirmDeleteButton();
		organizationTeamsPage.waitMessageToHide();
		organizationTeamsPage.verifyTeamIsDeleted(
			OrganizationTeamsPageData.editName
		);
	});
});
