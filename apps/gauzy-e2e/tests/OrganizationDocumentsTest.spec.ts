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
// Unique name per run: the grid accumulates documents across runs (pollution), so a fixed name would
// make the final "document is deleted" assertion (zero matches for the name) impossible — older rows
// with the same name survive. A unique suffix scopes create/select/edit/delete/verify to this run's row.
const documentName = `${OrganizationDocumentsPageData.documentName} ${faker.string.alphanumeric(6)}`;

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
			await organizationDocumentsPage.enterNameInputData(documentName);
			await organizationDocumentsPage.urlInputVisible();
			await organizationDocumentsPage.enterUrlInputData(url);
			await organizationDocumentsPage.clickCardBody();
			await organizationDocumentsPage.saveButtonVisible();
			await organizationDocumentsPage.clickSaveButton();
			await organizationDocumentsPage.waitMessageToHide();
			await organizationDocumentsPage.verifyDocumentExists(documentName);
		});

		await test.step('Should be able to edit document', async () => {
			// Select THIS run's document row first: the toolbar Edit/Delete buttons render disabled until
			// selectDocument() runs, so without this the disabled Edit click is a no-op and the
			// dialog (and #documentName) never appears. Target by the unique name so we don't pick a
			// leftover polluting row.
			await organizationDocumentsPage.selectDocumentRow(documentName);
			await organizationDocumentsPage.editButtonVisible();
			await organizationDocumentsPage.clickEditButton(0);
			await organizationDocumentsPage.nameInputVisible();
			await organizationDocumentsPage.enterNameInputData(documentName);
			await organizationDocumentsPage.saveButtonVisible();
			await organizationDocumentsPage.clickSaveButton();
		});

		await test.step('Should be able to delete document', async () => {
			await organizationDocumentsPage.waitMessageToHide();
			// Re-select this run's row: saving the edit ran cancel() which resets disabled=true, so
			// Edit/Delete are disabled again until a row is selected.
			await organizationDocumentsPage.selectDocumentRow(documentName);
			await organizationDocumentsPage.deleteButtonVisible();
			await organizationDocumentsPage.clickDeleteButton(0);
			await organizationDocumentsPage.confirmDeleteButtonVisible();
			await organizationDocumentsPage.clickConfirmDeleteButton();
			await organizationDocumentsPage.waitMessageToHide();
			await organizationDocumentsPage.verifyDocumentIsDeleted(documentName);
		});
	});
});
