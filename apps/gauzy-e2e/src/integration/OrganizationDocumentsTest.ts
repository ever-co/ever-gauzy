import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationDocumentsPage from '../support/Base/pages/OrganizationDocuments.po';
import { OrganizationDocumentsPageData } from '../support/Base/pagedata/OrganizationDocumentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Organization documents test', () => {
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
	it('Should be able to add new document', () => {
		cy.visit('/#/pages/organization/documents');
		organizationDocumentsPage.gridBtnExists();
		organizationDocumentsPage.gridBtnClick(1);
		organizationDocumentsPage.addButtonVisible();
		organizationDocumentsPage.clickAddButton();
		organizationDocumentsPage.nameInputVisible();
		organizationDocumentsPage.enterNameInputData(
			OrganizationDocumentsPageData.documentName
		);
		organizationDocumentsPage.urlInputVisible();
		organizationDocumentsPage.enterUrlInputData(
			OrganizationDocumentsPageData.documentUrl
		);
		organizationDocumentsPage.clickCardBody();
		organizationDocumentsPage.saveButtonVisible();
		organizationDocumentsPage.clickSaveButton();
	});
	it('Should be able to edit document', () => {
		organizationDocumentsPage.waitMessageToHide();
		organizationDocumentsPage.editButtonVisible();
		organizationDocumentsPage.clickEditButton(0);
		organizationDocumentsPage.nameInputVisible();
		organizationDocumentsPage.enterNameInputData(
			OrganizationDocumentsPageData.documentName
		);
		organizationDocumentsPage.saveButtonVisible();
		organizationDocumentsPage.clickSaveButton();
	});
	it('Should be able to delete document', () => {
		organizationDocumentsPage.waitMessageToHide();
		organizationDocumentsPage.deleteButtonVisible();
		organizationDocumentsPage.clickDeleteButton(0);
		organizationDocumentsPage.confirmDeleteButtonVisible();
		organizationDocumentsPage.clickConfirmDeleteButton();
	});
});
