import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationEmploymentTypePage from './support/pages/OrganizationEmploymentTypes.po';
import { OrganizationEmploymentTypesPageData } from '../src/support/Base/pagedata/OrganizationEmploymentTypesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

test.describe('Organization employment types test', () => {
	test('Organization employment types test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new employment type', async () => {
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/organization/employment-types');
			await organizationEmploymentTypePage.gridBtnExists();
			await organizationEmploymentTypePage.gridBtnClick(1);
			await organizationEmploymentTypePage.addButtonVisible();
			await organizationEmploymentTypePage.clickAddButton();
			await organizationEmploymentTypePage.nameInputVisible();
			await organizationEmploymentTypePage.enterNameInputData(
				OrganizationEmploymentTypesPageData.name
			);
			await organizationEmploymentTypePage.tagsDropdownVisible();
			await organizationEmploymentTypePage.clickTagsDropdown();
			await organizationEmploymentTypePage.selectTagFromDropdown(0);
			await organizationEmploymentTypePage.clickKeyboardButtonByKeyCode(9);
			await organizationEmploymentTypePage.saveButtonVisible();
			await organizationEmploymentTypePage.clickSaveButton();
			await organizationEmploymentTypePage.waitMessageToHide();
			await organizationEmploymentTypePage.verifyTypeExists(
				OrganizationEmploymentTypesPageData.name
			);
		});

		await test.step('Should be able to edit employment type', async () => {
			await organizationEmploymentTypePage.selectFirstItem();
			await organizationEmploymentTypePage.editButtonVisible();
			await organizationEmploymentTypePage.clickEditButton(0);
			await organizationEmploymentTypePage.saveButtonVisible();
			await organizationEmploymentTypePage.clickSaveButton();
		});

		await test.step('Should be able to delete employment type', async () => {
			await organizationEmploymentTypePage.waitMessageToHide();
			await organizationEmploymentTypePage.selectFirstItem();
			await organizationEmploymentTypePage.deleteButtonVisible();
			await organizationEmploymentTypePage.clickDeleteButton(0);
			await organizationEmploymentTypePage.confirmDeleteButtonVisible();
			await organizationEmploymentTypePage.clickConfirmDeleteButton();
			await organizationEmploymentTypePage.waitMessageToHide();
			await organizationEmploymentTypePage.verifyTypeIsDeleted(OrganizationEmploymentTypesPageData.name);
		});
	});
});
