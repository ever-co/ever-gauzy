import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timeTrackingPage from '../support/Base/pages/TimeTracking.po';
import { TimeTrackingPageData } from '../support/Base/pagedata/TimeTrackingPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Time tracking page test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to verify time tracking page', () => {
		cy.visit('/#/pages/dashboard/time-tracking');
		timeTrackingPage.headerTextExist(TimeTrackingPageData.header);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.membersWorked);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.projectsWorked);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.weeklyActivity);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.workedThisWeek);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.todayActivity);
		timeTrackingPage.topCardTextExist(TimeTrackingPageData.workedToday);
		timeTrackingPage.bottomCardTextExist(
			TimeTrackingPageData.recentActivities
		);
		timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.projects);
		timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.tasks);
		timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.appsUrls);
		timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.manualTime);
		timeTrackingPage.bottomCardTextExist(TimeTrackingPageData.members);
	});
});
