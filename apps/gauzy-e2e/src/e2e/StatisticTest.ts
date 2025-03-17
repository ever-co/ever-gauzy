import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as statisticPage from '../support/Base/pages/Statistic.po';
import { StatisticPageData } from '../support/Base/pagedata/StatisticPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Statistic page Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to verify statistic page', () => {
		cy.visit('/#/pages/employees/candidates/statistic');
		statisticPage.headerTextExist(StatisticPageData.header);
		statisticPage.subheaderTextExist(StatisticPageData.overallRating);
		statisticPage.subheaderTextExist(StatisticPageData.ratingInterview);
		statisticPage.subheaderTextExist(StatisticPageData.criterionRating);
		statisticPage.subheaderTextExist(StatisticPageData.averageCriterion);
		statisticPage.verifyAccordionVisible();
		statisticPage.clickSubheaderByIndex(0);
		statisticPage.verifyNoDataText(StatisticPageData.noDataText);
		statisticPage.clickSubheaderByIndex(1);
		statisticPage.verifyNoDataText(StatisticPageData.noDataText);
		statisticPage.clickSubheaderByIndex(2);
		statisticPage.verifyNoDataText(StatisticPageData.noDataText);
		statisticPage.clickSubheaderByIndex(3);
		statisticPage.verifyNoDataText(StatisticPageData.noDataText);
	});
});
