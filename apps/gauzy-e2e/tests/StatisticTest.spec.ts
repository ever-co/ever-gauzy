import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as statisticPage from './support/pages/Statistic.po';
import { StatisticPageData } from '../src/support/Base/pagedata/StatisticPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Statistic page Test', () => {
	test('Statistic page Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify statistic page', async () => {
			await getPage().goto('/#/pages/employees/candidates/statistic');
			await statisticPage.headerTextExist(StatisticPageData.header);
			await statisticPage.subheaderTextExist(StatisticPageData.overallRating);
			await statisticPage.subheaderTextExist(StatisticPageData.ratingInterview);
			await statisticPage.subheaderTextExist(StatisticPageData.criterionRating);
			await statisticPage.subheaderTextExist(StatisticPageData.averageCriterion);
			await statisticPage.verifyAccordionVisible();
			await statisticPage.clickSubheaderByIndex(0);
			await statisticPage.verifyNoDataText(StatisticPageData.noDataText);
			await statisticPage.clickSubheaderByIndex(1);
			await statisticPage.verifyNoDataText(StatisticPageData.noDataText);
			await statisticPage.clickSubheaderByIndex(2);
			await statisticPage.verifyNoDataText(StatisticPageData.noDataText);
			await statisticPage.clickSubheaderByIndex(3);
			await statisticPage.verifyNoDataText(StatisticPageData.noDataText);
		});
	});
});
