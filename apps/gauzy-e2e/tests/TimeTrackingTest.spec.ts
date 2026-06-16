import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as timeTrackingPage from './support/pages/TimeTracking.po';
import { TimeTrackingPageData } from '../src/support/Base/pagedata/TimeTrackingPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Time tracking page test', () => {
	test('Time tracking page test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify time tracking page', async () => {
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
	});
});
