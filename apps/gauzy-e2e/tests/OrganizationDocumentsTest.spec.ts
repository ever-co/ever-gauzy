import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationDocumentsPage from './support/pages/OrganizationDocuments.po';
import { OrganizationDocumentsPageData } from '../src/support/Base/pagedata/OrganizationDocumentsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';

let url = faker.internet.url();

test.describe('Organization documents test', () => {
	test('Organization documents test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new document', async () => {
			await getPage().goto('/#/pages/organization/documents');
			await organizationDocumentsPage.gridBtnExists();
			await organizationDocumentsPage.gridBtnClick(1);
			await organizationDocumentsPage.addButtonVisible();
			await organizationDocumentsPage.clickAddButton();
			await organizationDocumentsPage.nameInputVisible();
			await organizationDocumentsPage.enterNameInputData(
				OrganizationDocumentsPageData.documentName
			);
			await organizationDocumentsPage.urlInputVisible();
			await organizationDocumentsPage.enterUrlInputData(url);
			await organizationDocumentsPage.clickCardBody();
			await organizationDocumentsPage.saveButtonVisible();
			await organizationDocumentsPage.clickSaveButton();
			await organizationDocumentsPage.waitMessageToHide();
			await organizationDocumentsPage.verifyDocumentExists(
				OrganizationDocumentsPageData.documentName
			);
		});

		await test.step('Should be able to edit document', async () => {
			await organizationDocumentsPage.editButtonVisible();
			await organizationDocumentsPage.clickEditButton(0);
			await organizationDocumentsPage.nameInputVisible();
			await organizationDocumentsPage.enterNameInputData(
				OrganizationDocumentsPageData.documentName
			);
			await organizationDocumentsPage.saveButtonVisible();
			await organizationDocumentsPage.clickSaveButton();
		});

		await test.step('Should be able to delete document', async () => {
			await organizationDocumentsPage.waitMessageToHide();
			await organizationDocumentsPage.deleteButtonVisible();
			await organizationDocumentsPage.clickDeleteButton(0);
			await organizationDocumentsPage.confirmDeleteButtonVisible();
			await organizationDocumentsPage.clickConfirmDeleteButton();
			await organizationDocumentsPage.waitMessageToHide();
			await organizationDocumentsPage.verifyDocumentIsDeleted(
				OrganizationDocumentsPageData.documentName
			);
		});
	});
});
