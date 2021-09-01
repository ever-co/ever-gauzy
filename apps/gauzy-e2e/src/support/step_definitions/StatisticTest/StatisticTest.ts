import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as statisticPage from '../../Base/pages/Statistic.po';
import { StatisticPageData } from '../../Base/pagedata/StatisticPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given(
	'Login with default credentials and visit Candidates statistics page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/employees/candidates/statistic', {
			timeout: pageLoadTimeout
		});
	}
);

// Verify statistic page
And('User can verify text content', () => {
	statisticPage.headerTextExist(StatisticPageData.header);
	statisticPage.subheaderTextExist(StatisticPageData.overallRating);
	statisticPage.subheaderTextExist(StatisticPageData.ratingInterview);
	statisticPage.subheaderTextExist(StatisticPageData.criterionRating);
	statisticPage.subheaderTextExist(StatisticPageData.averageCriterion);
	statisticPage.verifyAccordionVisible();
});

When('User click on first subheader', () => {
	statisticPage.clickSubheaderByIndex(0);
});

Then('user can verify text content', () => {
	statisticPage.verifyNoDataText(StatisticPageData.noDataText);
});

When('User click on second subheader', () => {
	statisticPage.clickSubheaderByIndex(1);
});

Then('user can verify text content', () => {
	statisticPage.verifyNoDataText(StatisticPageData.noDataText);
});

When('User click on third subheader', () => {
	statisticPage.clickSubheaderByIndex(2);
});

Then('user can verify text content', () => {
	statisticPage.verifyNoDataText(StatisticPageData.noDataText);
});

When('User click on fourth subheader', () => {
	statisticPage.clickSubheaderByIndex(3);
});

Then('user can verify text content', () => {
	statisticPage.verifyNoDataText(StatisticPageData.noDataText);
});
