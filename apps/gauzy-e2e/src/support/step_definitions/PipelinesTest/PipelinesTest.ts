import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as pipelinesPage from '../../Base/pages/Pipelines.po';
import { PipelinesPageData } from '../../Base/pagedata/PipelinesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials and visit Sales pipelines page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/sales/pipelines', { timeout: pageLoadTimeout });
});

// Add new pipeline
And('User can see grid button', () => {
	pipelinesPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	pipelinesPage.gridBtnClick(1);
});

And('User can see add pipeline button', () => {
	pipelinesPage.addPipelineButtonVisible();
});

When('User click on add pipeline button', () => {
	pipelinesPage.clickAddPipelineButton();
});

Then('User can see name input field', () => {
	pipelinesPage.nameInputVisible();
});

And('User can enter pipeline name', () => {
	pipelinesPage.enterNameInputData(PipelinesPageData.pipelineName);
});

And('User can see description input field', () => {
	pipelinesPage.descriptionInputVisible();
});

And('User can enter pipeline description', () => {
	pipelinesPage.enterDescriptionInputData(
		PipelinesPageData.pipelineDescription
	);
});

And('User can see create pipeline button', () => {
	pipelinesPage.createPipelineButtonVisible();
});

When('User click on create pipeline button', () => {
	pipelinesPage.clickCreatePipelineButton();
});

Then('Notification message will appear', () => {
	pipelinesPage.waitMessageToHide();
});

// Edit pipeline
And('User can see pipelines table', () => {
	pipelinesPage.tableRowVisible();
});

When('User click on pipelines table row', () => {
	pipelinesPage.selectTableRow(0);
});

Then('User can see edit button', () => {
	pipelinesPage.editPipelineButtonVisible();
});

When('User click on edit button', () => {
	pipelinesPage.clickEditPipelineButton();
});

Then('User can see name input field again', () => {
	pipelinesPage.nameInputVisible();
});

And('User can enter new pipeline name', () => {
	pipelinesPage.enterNameInputDataByIndex(PipelinesPageData.editPipelineName,PipelinesPageData.nameInputIndex);
});

And('User can see description input field again', () => {
	pipelinesPage.descriptionInputVisible();
});

And('User can enter new pipeline description', () => {
	pipelinesPage.enterDescriptionInputData(
		PipelinesPageData.pipelineDescription
	);
});

And('User can see update button', () => {
	pipelinesPage.updateButtonVisible();
});

When('User click on update button', () => {
	pipelinesPage.clickUpdateButon();
});

Then('Notification message will appear', () => {
	pipelinesPage.waitMessageToHide();
});

// Delete pipeline
And('User can see pipelines table again', () => {
	pipelinesPage.tableRowVisible();
});

When('User click on pipelines table row again', () => {
	pipelinesPage.selectTableRow(0);
});

Then('User can see delete button', () => {
	pipelinesPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	pipelinesPage.clickDeleteButton();
});

Then('User can see confirm delete button', () => {
	pipelinesPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	pipelinesPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	pipelinesPage.waitMessageToHide();
});
