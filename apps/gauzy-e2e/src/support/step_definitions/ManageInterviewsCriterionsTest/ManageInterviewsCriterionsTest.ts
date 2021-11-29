import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import { ManageInterviewsCriterionsPageData } from '../../Base/pagedata/ManageInterviewsCriterionsPageData';
import * as manageInterviewsCriterionsPage from '../../Base/pages/ManageInterviewsCriterions.po';
import { CustomCommands } from '../../commands';
import * as dashboardPage from '../../Base/pages/Dashboard.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add technology stack
And('User can visit Candidates interview criterion page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.intercept('GET', '/api/candidate-technologies*').as('waitCandidateTechnologies');
	cy.intercept('GET', '/api/candidate-personal-qualities*').as('waitCandidatePersonalQualities');
	cy.visit('/#/pages/employees/candidates/interviews/criterion', { timeout: pageLoadTimeout });
	cy.wait(['@waitCandidateTechnologies', '@waitCandidatePersonalQualities']);
	
});

And('User can see technology stack input field', () => {
	manageInterviewsCriterionsPage.technologyInputVisible();
});

And('User can enter value for technology stack', () => {
	manageInterviewsCriterionsPage.enterTechonologyInputData(
		ManageInterviewsCriterionsPageData.technology
	);
});

And('User can see save technology stack button', () => {
	manageInterviewsCriterionsPage.saveButtonVisible();
});

When('User click on save technology stack button', () => {
	manageInterviewsCriterionsPage.clickSaveButton(0);
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

And('User can verify technology stack', () => {
	manageInterviewsCriterionsPage.verifyTechnologyTextExist(
		ManageInterviewsCriterionsPageData.technology
	);
});

// Edit technology stack
And('User can see edit technology stack button', () => {
	manageInterviewsCriterionsPage.editTechnologyButtonVisible();
});

When('User click on edit technology stack button', () => {
	manageInterviewsCriterionsPage.clickEditTechnologyButton();
});

Then('User can see edit technology stack input field', () => {
	manageInterviewsCriterionsPage.technologyInputVisible();
});

And('User can enter new value for technology stack', () => {
	manageInterviewsCriterionsPage.enterTechonologyInputData(
		ManageInterviewsCriterionsPageData.editTechnology
	);
});

And('User can see save edited technology stack button', () => {
	manageInterviewsCriterionsPage.saveButtonVisible();
});

When('User click on save edited technology stack button', () => {
	manageInterviewsCriterionsPage.clickSaveButton(0);
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

And('User can verify technology stack was edited', () => {
	manageInterviewsCriterionsPage.verifyTechnologyTextExist(
		ManageInterviewsCriterionsPageData.editTechnology
	);
});

// Delete technology stack
And('User can see delete technology stack button', () => {
	manageInterviewsCriterionsPage.deleteTechnologyButtonVisible();
});

When('User click on delete technology stack button', () => {
	manageInterviewsCriterionsPage.clickDeleteTechnologyButton();
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

And('User can verify technology stack was deleted', () => {
	manageInterviewsCriterionsPage.verifyTechnologyIsDeleted();
});

// Add personal quality
And('User can see quality input field', () => {
	manageInterviewsCriterionsPage.qualityInputVisible();
});

And('User can enter value for quality', () => {
	manageInterviewsCriterionsPage.enterQualityInputData(
		ManageInterviewsCriterionsPageData.quality
	);
});

And('User can see save quality button', () => {
	manageInterviewsCriterionsPage.saveButtonVisible();
});

When('User click on save quality button', () => {
	manageInterviewsCriterionsPage.clickSaveButton(1);
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

Then('User can verify quality was created', () => {
	manageInterviewsCriterionsPage.verifyQualityTextExist(
		ManageInterviewsCriterionsPageData.quality
	);
});

// Edit personal quality
And('User can see edit quality button', () => {
	manageInterviewsCriterionsPage.editQualityButtonVisible();
});

When('User click on edit quality button', () => {
	manageInterviewsCriterionsPage.clickEditQualityButton();
});

Then('User can see edit quality input field', () => {
	manageInterviewsCriterionsPage.qualityInputVisible();
});

And('User can enter new value for quality', () => {
	manageInterviewsCriterionsPage.enterQualityInputData(
		ManageInterviewsCriterionsPageData.editQuality
	);
});

And('User can see save edited quality button', () => {
	manageInterviewsCriterionsPage.saveButtonVisible();
});

When('User click on save edited quality button', () => {
	manageInterviewsCriterionsPage.clickSaveButton(1);
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

And('User can verify quality was edited', () => {
	manageInterviewsCriterionsPage.verifyQualityTextExist(
		ManageInterviewsCriterionsPageData.editQuality
	);
});

// Delete personal quality
And('User can see delete quality button', () => {
	manageInterviewsCriterionsPage.deleteQualityButtonVisible();
});

When('User click on delete quality button', () => {
	manageInterviewsCriterionsPage.clickDeleteQualityButton();
});

Then('Notification message will appear', () => {
	manageInterviewsCriterionsPage.waitMessageToHide();
});

And('Use can verify qaulity was deleted', () => {
	manageInterviewsCriterionsPage.verifyQualityIsDeleted();
});
