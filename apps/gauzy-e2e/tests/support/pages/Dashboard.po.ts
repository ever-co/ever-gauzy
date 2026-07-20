import { verifyElementIsVisible, clickButton, verifyElementIfVisible } from '../util';
import { DashboardPage } from '../../../src/support/Base/pageobjects/DashboardPageObject';

export const verifyCreateButton = async () => verifyElementIsVisible(DashboardPage.createButtonCss);
export const clickUserName = async () => clickButton(DashboardPage.userNameCss);
export const verifyAccountingDashboard = async () => verifyElementIsVisible(DashboardPage.settingBlockCss);
export const verifyAccountingDashboardIfVisible = async () =>
	verifyElementIfVisible(DashboardPage.childerElementCss, DashboardPage.settingBlockCssTwo);
