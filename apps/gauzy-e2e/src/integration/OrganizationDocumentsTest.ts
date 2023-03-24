import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationDocumentsPage from '../support/Base/pages/OrganizationDocuments.po';
import { OrganizationDocumentsPageData } from '../support/Base/pagedata/OrganizationDocumentsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import { faker } from '@faker-js/faker';

let url = faker.internet.url();

describe('Organization documents test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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
		organizationDocumentsPage.enterUrlInputData(url);
		organizationDocumentsPage.clickCardBody();
		organizationDocumentsPage.saveButtonVisible();
		organizationDocumentsPage.clickSaveButton();
		organizationDocumentsPage.waitMessageToHide();
		organizationDocumentsPage.verifyDocumentExists(
			OrganizationDocumentsPageData.documentName
		);
	});
	it('Should be able to edit document', () => {
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
		organizationDocumentsPage.waitMessageToHide();
		organizationDocumentsPage.verifyDocumentIsDeleted(
			OrganizationDocumentsPageData.documentName
		);
	});
});
