import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationTeamsPage from './support/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../src/support/Base/pagedata/OrganizationTeamsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

test.describe('Organization teams test', () => {
	test('Organization teams test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new team', async () => {
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/organization/teams');
			await organizationTeamsPage.gridBtnExists();
			await organizationTeamsPage.gridBtnClick(1);
			await organizationTeamsPage.addTeamButtonVisible();
			await organizationTeamsPage.clickAddTeamButton();
			await organizationTeamsPage.nameInputVisible();
			await organizationTeamsPage.enterNameInputData(
				OrganizationTeamsPageData.name
			);
			await organizationTeamsPage.tagsMultiSelectVisible();
			await organizationTeamsPage.clickTagsMultiSelect();
			await organizationTeamsPage.selectTagsFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.clickEmployeeDropdown(1);
			await organizationTeamsPage.selectEmployeeFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.clickManagerDropdown(1);
			await organizationTeamsPage.selectManagerFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.saveButtonVisible();
			await organizationTeamsPage.clickSaveButton();
			await organizationTeamsPage.waitMessageToHide();
			await organizationTeamsPage.verifyTeamExists(OrganizationTeamsPageData.name);
		});

		await test.step('Should be able to edit team', async () => {
			await organizationTeamsPage.tableRowVisible();
			await organizationTeamsPage.selectTableRow(0);
			await organizationTeamsPage.editButtonVisible();
			await organizationTeamsPage.clickEditButton();
			await organizationTeamsPage.nameInputVisible();
			await organizationTeamsPage.enterNameInputData(
				OrganizationTeamsPageData.editName
			);
			await organizationTeamsPage.tagsMultiSelectVisible();
			await organizationTeamsPage.clickTagsMultiSelect();
			await organizationTeamsPage.selectTagsFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.clickEmployeeDropdown(1);
			await organizationTeamsPage.selectEmployeeFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.clickManagerDropdown(1);
			await organizationTeamsPage.selectManagerFromDropdown(0);
			await organizationTeamsPage.clickCardBody(0);
			await organizationTeamsPage.saveButtonVisible();
			await organizationTeamsPage.clickSaveButton();
			await organizationTeamsPage.waitMessageToHide();
			await organizationTeamsPage.verifyTeamExists(
				OrganizationTeamsPageData.editName
			);
		});

		await test.step('Should be able to delete team', async () => {
			await organizationTeamsPage.selectTableRow(0);
			await organizationTeamsPage.deleteButtonVisible();
			await organizationTeamsPage.clickDeleteButton();
			await organizationTeamsPage.confirmDeleteButtonVisible();
			await organizationTeamsPage.clickConfirmDeleteButton();
			await organizationTeamsPage.waitMessageToHide();
			await organizationTeamsPage.verifyTeamIsDeleted(
				OrganizationTeamsPageData.editName
			);
		});
	});
});
