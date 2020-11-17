import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationHelpCenterPage from '../support/Base/pages/OrganizationHelpCenter.po';
import { OrganizationHelpCenterPageData } from '../support/Base/pagedata/OrganizationHelpCenterPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Organization help center test', () => {
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
	});
	it('Should be able to edit base', () => {
		organizationHelpCenterPage.waitMessageToHide();
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
	});
});
