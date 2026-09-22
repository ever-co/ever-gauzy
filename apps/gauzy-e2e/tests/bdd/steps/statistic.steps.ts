import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as statisticPage from '../../support/pages/Statistic.po';
import { StatisticPageData } from '../../../src/support/Base/pagedata/StatisticPageData';

// Converted 1:1 from the plain StatisticTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the candidate statistic page', async () => {
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
