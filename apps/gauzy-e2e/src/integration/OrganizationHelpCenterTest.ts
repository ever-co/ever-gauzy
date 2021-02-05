import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationHelpCenterPage from '../support/Base/pages/OrganizationHelpCenter.po';
import { OrganizationHelpCenterPageData } from '../support/Base/pagedata/OrganizationHelpCenterPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Organization help center test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add base', () => {
		cy.visit('/#/pages/organization/help-center');
		organizationHelpCenterPage.addButtonVisible();
		organizationHelpCenterPage.clickAddButton();
		organizationHelpCenterPage.languageDropdownVisible();
		organizationHelpCenterPage.clickLanguageDropdown();
		organizationHelpCenterPage.selectLanguageFromDropdown(
			OrganizationHelpCenterPageData.defaultLanguage
		);
		organizationHelpCenterPage.publishButtonVisible();
		organizationHelpCenterPage.clickPublishButton();
		organizationHelpCenterPage.iconDropdownVisible();
		organizationHelpCenterPage.clickIconDropdown();
		organizationHelpCenterPage.selectIconFromDropdown(0);
		organizationHelpCenterPage.colorInputVisible();
		organizationHelpCenterPage.enterColorInputData(
			OrganizationHelpCenterPageData.defaultColor
		);
		organizationHelpCenterPage.nameInputVisible();
		organizationHelpCenterPage.enterNameInputData(
			OrganizationHelpCenterPageData.defaultBaseName
		);
		organizationHelpCenterPage.descriptionInputVisible();
		organizationHelpCenterPage.enterDescriptionInputData(
			OrganizationHelpCenterPageData.defaultBaseDescription
		);
		organizationHelpCenterPage.saveButtonVisible();
		organizationHelpCenterPage.clickSaveButton();
		organizationHelpCenterPage.waitMessageToHide();
		organizationHelpCenterPage.verifybaseExists(
			OrganizationHelpCenterPageData.defaultBaseName
		);
	});
	it('Should be able to edit base', () => {
		organizationHelpCenterPage.settingsButtonVisible();
		organizationHelpCenterPage.clickSettingsButton(0);
		organizationHelpCenterPage.editBaseOptionVisible();
		organizationHelpCenterPage.clickEditBaseOption(
			OrganizationHelpCenterPageData.editBaseOption
		);
		organizationHelpCenterPage.colorInputVisible();
		organizationHelpCenterPage.enterColorInputData(
			OrganizationHelpCenterPageData.defaultColor
		);
		organizationHelpCenterPage.nameInputVisible();
		organizationHelpCenterPage.enterNameInputData(
			OrganizationHelpCenterPageData.defaultBaseName
		);
		organizationHelpCenterPage.descriptionInputVisible();
		organizationHelpCenterPage.enterDescriptionInputData(
			OrganizationHelpCenterPageData.defaultBaseDescription
		);
		organizationHelpCenterPage.saveButtonVisible();
		organizationHelpCenterPage.clickSaveButton();
	});
	it('Should be able to delete base', () => {
		organizationHelpCenterPage.waitMessageToHide();
		organizationHelpCenterPage.clickSettingsButton(0);
		organizationHelpCenterPage.deleteBaseOptionVisible();
		organizationHelpCenterPage.clickDeleteBaseOption(
			OrganizationHelpCenterPageData.deleteBaseOption
		);
		organizationHelpCenterPage.deleteButtonVisible();
		organizationHelpCenterPage.clickDeleteButton();
		organizationHelpCenterPage.waitMessageToHide();
		organizationHelpCenterPage.verifyBaseIsDeleted();
	});
});
