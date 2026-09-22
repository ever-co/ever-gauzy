import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as timeTrackingPage from '../../support/pages/TimeTracking.po';
import { TimeTrackingPageData } from '../../../src/support/Base/pagedata/TimeTrackingPageData';

// Converted 1:1 from the plain TimeTrackingTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the time tracking page', async () => {
	await getPage().goto('/#/pages/dashboard/time-tracking');
	await timeTrackingPage.headerTextExist(TimeTrackingPageData.header);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.membersWorked);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.projectsWorked);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.weeklyActivity);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.workedThisWeek);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.todayActivity);
	await timeTrackingPage.topCardTextExist(TimeTrackingPageData.workedToday);
	await timeTrackingPage.bottomCardTextExist(
		TimeTrackingPageData.recentActivities
	);
	await timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.projects);
	await timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.tasks);
	await timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.appsUrls);
	await timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.manualTime);
	await timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.members);
});
