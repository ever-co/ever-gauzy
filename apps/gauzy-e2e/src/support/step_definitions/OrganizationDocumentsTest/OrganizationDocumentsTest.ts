import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationDocumentsPage from '../../Base/pages/OrganizationDocuments.po';
import { OrganizationDocumentsPageData } from '../../Base/pagedata/OrganizationDocumentsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';

let url = faker.internet.url();

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { waitUntil } from '../../Base/utils/util';

// Login with email
Given(
	'Login with default credentials and go to Organization documents page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/organization/documents');
	}
);

// Add new document
And('User can see grid button', () => {
	organizationDocumentsPage.gridBtnExists();
});

And('User can click on grid button to change view', () => {
	organizationDocumentsPage.gridBtnClick(1);
});

And('User can see add new document button', () => {
	organizationDocumentsPage.addButtonVisible();
});

When('User click on add new document button', () => {
	organizationDocumentsPage.clickAddButton();
});

Then('User can see name input field', () => {
	organizationDocumentsPage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationDocumentsPage.enterNameInputData(
		OrganizationDocumentsPageData.documentName
	);
});

And('User can see url input field', () => {
	organizationDocumentsPage.urlInputVisible();
});

And('User can enter value for url', () => {
	organizationDocumentsPage.enterUrlInputData(url);
	organizationDocumentsPage.clickCardBody();
});

And('User can see save document button', () => {
	organizationDocumentsPage.saveButtonVisible();
});

When('User click on save document button', () => {
	organizationDocumentsPage.clickSaveButton();
	waitUntil(40000);
	organizationDocumentsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationDocumentsPage.waitMessageToHide();
});

And('User can verify document was created', () => {
	organizationDocumentsPage.verifyDocumentExists(
		OrganizationDocumentsPageData.documentName
	);
});

// Edit document
And('User can see edit button', () => {
	organizationDocumentsPage.editButtonVisible();
});

When('User click on edit button', () => {
	organizationDocumentsPage.clickEditButton(0);
});

Then('User can see edit name input field', () => {
	organizationDocumentsPage.nameInputVisible();
});

And('User can enter new value for name', () => {
	organizationDocumentsPage.enterNameInputData(
		OrganizationDocumentsPageData.editDocumentName
	);
});

And('User can see save document button again', () => {
	organizationDocumentsPage.saveButtonVisible();
});

When('User click on save document button again', () => {
	organizationDocumentsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationDocumentsPage.waitMessageToHide();
});

And('User can verify document was edited', () => {
	organizationDocumentsPage.verifyDocumentExists(
		OrganizationDocumentsPageData.editDocumentName
	);
});

// Delete document
And('User can see delete button', () => {
	organizationDocumentsPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationDocumentsPage.clickDeleteButton(0);
});

Then('User can see confirm delete button', () => {
	organizationDocumentsPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationDocumentsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationDocumentsPage.waitMessageToHide();
});

And('User can verify document was deleted', () => {
	organizationDocumentsPage.verifyDocumentIsDeleted(
		OrganizationDocumentsPageData.editDocumentName
	);
});
