import { verifyElementIsVisible, clickButton, verifyElementIfVisible, verifyText } from '../utils/util';
import { DashboardPage } from '../pageobjects/DashboardPageObject';

export const verifyCreateButton = () => {
	verifyElementIsVisible(DashboardPage.createButton);
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
