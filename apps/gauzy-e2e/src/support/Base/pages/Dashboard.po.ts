import { verifyElementIsVisible, clickButton, verifyElementIfVisible } from '../utils/util';
import { DashboardPage } from '../pageobjects/DashboardPageObject';

export const verifyCreateButton = () => {
	verifyElementIsVisible(DashboardPage.createButtonCss);
};

export const clickUserName = () => {
	clickButton(DashboardPage.userNameCss);
};

export const verifyAccountingDashboard = () => {
	verifyElementIsVisible(DashboardPage.settingBlockCss);
}

export const verifyAccountingDashboardIfVisible = () => {
	verifyElementIfVisible(DashboardPage.childerElementCss, DashboardPage.settingBlockCssTwo)
}
