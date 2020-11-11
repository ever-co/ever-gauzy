import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Organization projects test', () => {
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
	it('Should be able to add new project', () => {
		cy.visit('/#/pages/organization/projects');
		organizationProjectsPage.gridBtnExists();
		organizationProjectsPage.gridBtnClick(1);
		organizationProjectsPage.requestProjectButtonVisible();
		organizationProjectsPage.clickRequestProjectButton();
		organizationProjectsPage.nameInputVisible();
		organizationProjectsPage.enterNameInputData(
			OrganizationProjectsPageData.name
		);
		organizationProjectsPage.selectEmployeeDropdownVisible();
		organizationProjectsPage.clickSelectEmployeeDropdown();
		organizationProjectsPage.selectEmployeeDropdownOption(0);
		organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
		organizationProjectsPage.tagsMultyselectVisible();
		organizationProjectsPage.clickTagsMultyselect();
		organizationProjectsPage.selectTagsFromDropdown(0);
		organizationProjectsPage.clickCardBody();
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(
			OrganizationProjectsPageData.color
		);
		organizationProjectsPage.descriptionInputVisible();
		organizationProjectsPage.enterDescriptionInputData(
			OrganizationProjectsPageData.description
		);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
	});
	it('Should be able to edit project', () => {
		organizationProjectsPage.tableRowVisible();
		organizationProjectsPage.selectTableRow(0);
		organizationProjectsPage.editButtonVisible();
		organizationProjectsPage.clickEditButton();
		organizationProjectsPage.nameInputVisible();
		organizationProjectsPage.enterNameInputData(
			OrganizationProjectsPageData.name
		);
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(
			OrganizationProjectsPageData.color
		);
		organizationProjectsPage.descriptionInputVisible();
		organizationProjectsPage.enterDescriptionInputData(
			OrganizationProjectsPageData.description
		);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
	});
	it('Should be able to delete project', () => {
		organizationProjectsPage.selectTableRow(0);
		organizationProjectsPage.deleteButtonVisible();
		organizationProjectsPage.clickDeleteButton();
		organizationProjectsPage.confirmDeleteButtonVisible();
		organizationProjectsPage.clickConfirmDeleteButton();
	});
});
