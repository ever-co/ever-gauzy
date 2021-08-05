import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as reportsPage from '../../Base/pages/Reports.po';
import { ReportsPageData } from '../../Base/pagedata/ReportsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let checked = 'be.checked';

// Login with email
Given('Login with default credentials and visit Reports page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/reports/all', { timeout: pageLoadTimeout });
});

// Reports test
// Verify Time tracking
And('User can verify Time tracking content', () => {
	reportsPage.verifyHeader(ReportsPageData.header);
	reportsPage.verifySubheader(ReportsPageData.timeTracking);
	reportsPage.verifyTitle(ReportsPageData.timeAndActivity);
	reportsPage.verifyTitle(ReportsPageData.weekly);
	reportsPage.verifyTitle(ReportsPageData.appsUrls);
	reportsPage.verifyTitle(ReportsPageData.manualTimeEdits);
	reportsPage.verifyTitle(ReportsPageData.expense);
});

And('User can verify Time tracking settigns state', () => {
	reportsPage.verifyCheckboxState(0, checked);
	reportsPage.verifyCheckboxState(1, checked);
	reportsPage.verifyCheckboxState(2, checked);
	reportsPage.verifyCheckboxState(3, checked);
	reportsPage.verifyCheckboxState(4, checked);
});

// Payments tracking
And('User can verify Payments content', () => {
	reportsPage.verifySubheader(ReportsPageData.payments);
	reportsPage.verifyTitle(ReportsPageData.amountsOwed);
	reportsPage.verifyTitle(ReportsPageData.payments);
});

And('User can verify Payments settigns state', () => {
	reportsPage.verifyCheckboxState(5, checked);
	reportsPage.verifyCheckboxState(6, checked);
});

// Time Off tracking
And('User can verify Time Off content', () => {
	reportsPage.verifySubheader(ReportsPageData.timeOff);
	reportsPage.verifyTitle(ReportsPageData.weeklyLimits);
	reportsPage.verifyTitle(ReportsPageData.dailyLimits);
});

And('User can verify Time Off settigns state', () => {
	reportsPage.verifyCheckboxState(7, checked);
	reportsPage.verifyCheckboxState(8, checked);
});

// Invoices tracking
And('User can verify Invoices content', () => {
	reportsPage.verifySubheader(ReportsPageData.invoicing);
	reportsPage.verifyTitle(ReportsPageData.projectBudgets);
	reportsPage.verifyTitle(ReportsPageData.clientBudgets);
});

And('User can verify Invoices settigns state', () => {
	reportsPage.verifyCheckboxState(9, checked);
	reportsPage.verifyCheckboxState(10, checked);
});
