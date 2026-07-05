import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationDocumentsPage from '../../support/pages/OrganizationDocuments.po';
import { OrganizationDocumentsPageData } from '../../../src/support/Base/pagedata/OrganizationDocumentsPageData';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain OrganizationDocumentsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts. Cross-step faker state (url, documentName) is
// hoisted to module scope and initialised at the start of the first step (safe: one scenario per feature).

let url = ' ';
// Unique name per run: the grid accumulates documents across runs (pollution), so a fixed name would
// make the final "document is deleted" assertion (zero matches for the name) impossible — older rows
// with the same name survive. A unique suffix scopes create/select/edit/delete/verify to this run's row.
let documentName = ' ';

When('I add a new document', async () => {
	url = faker.internet.url();
	documentName = `${OrganizationDocumentsPageData.documentName} ${faker.string.alphanumeric(6)}`;

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

When('I edit the document', async () => {
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

When('I delete the document', async () => {
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
