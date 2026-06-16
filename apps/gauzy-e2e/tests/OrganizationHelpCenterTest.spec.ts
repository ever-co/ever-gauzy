import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationHelpCenterPage from './support/pages/OrganizationHelpCenter.po';
import { OrganizationHelpCenterPageData } from '../src/support/Base/pagedata/OrganizationHelpCenterPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Organization help center test', () => {
	test('Organization help center test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add base', async () => {
			await getPage().goto('/#/pages/organization/help-center');
			await organizationHelpCenterPage.addButtonVisible();
			await organizationHelpCenterPage.clickAddButton();
			await organizationHelpCenterPage.languageDropdownVisible();
			await organizationHelpCenterPage.clickLanguageDropdown();
			await organizationHelpCenterPage.selectLanguageFromDropdown(
				OrganizationHelpCenterPageData.defaultLanguage
			);
			await organizationHelpCenterPage.publishButtonVisible();
			await organizationHelpCenterPage.clickPublishButton();
			await organizationHelpCenterPage.iconDropdownVisible();
			await organizationHelpCenterPage.clickIconDropdown();
			await organizationHelpCenterPage.selectIconFromDropdown(0);
			await organizationHelpCenterPage.colorInputVisible();
			await organizationHelpCenterPage.enterColorInputData(
				OrganizationHelpCenterPageData.defaultColor
			);
			await organizationHelpCenterPage.nameInputVisible();
			await organizationHelpCenterPage.enterNameInputData(
				OrganizationHelpCenterPageData.defaultBaseName
			);
			await organizationHelpCenterPage.descriptionInputVisible();
			await organizationHelpCenterPage.enterDescriptionInputData(
				OrganizationHelpCenterPageData.defaultBaseDescription
			);
			await organizationHelpCenterPage.saveButtonVisible();
			await organizationHelpCenterPage.clickSaveButton();
			await organizationHelpCenterPage.waitMessageToHide();
			await organizationHelpCenterPage.verifyBaseExists(
				OrganizationHelpCenterPageData.defaultBaseName
			);
		});

		await test.step('Should be able to edit base', async () => {
			await organizationHelpCenterPage.settingsButtonVisible();
			await organizationHelpCenterPage.clickSettingsButton(0);
			await organizationHelpCenterPage.editBaseOptionVisible();
			await organizationHelpCenterPage.clickEditBaseOption(
				OrganizationHelpCenterPageData.editBaseOption
			);
			await organizationHelpCenterPage.colorInputVisible();
			await organizationHelpCenterPage.enterColorInputData(
				OrganizationHelpCenterPageData.defaultColor
			);
			await organizationHelpCenterPage.nameInputVisible();
			await organizationHelpCenterPage.enterNameInputData(
				OrganizationHelpCenterPageData.defaultBaseName
			);
			await organizationHelpCenterPage.descriptionInputVisible();
			await organizationHelpCenterPage.enterDescriptionInputData(
				OrganizationHelpCenterPageData.defaultBaseDescription
			);
			await organizationHelpCenterPage.saveButtonVisible();
			await organizationHelpCenterPage.clickSaveButton();
		});

		await test.step('Should be able to delete base', async () => {
			await organizationHelpCenterPage.waitMessageToHide();
			await organizationHelpCenterPage.clickSettingsButton(0);
			await organizationHelpCenterPage.deleteBaseOptionVisible();
			await organizationHelpCenterPage.clickDeleteBaseOption(
				OrganizationHelpCenterPageData.deleteBaseOption
			);
			await organizationHelpCenterPage.deleteButtonVisible();
			await organizationHelpCenterPage.clickDeleteButton();
			await organizationHelpCenterPage.waitMessageToHide();
			await organizationHelpCenterPage.verifyBaseIsDeleted();
		});
	});
});
