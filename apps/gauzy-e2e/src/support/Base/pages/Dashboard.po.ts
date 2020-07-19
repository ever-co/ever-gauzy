import { verifyElementIsVisible, clickButton } from '../utils/util';
import { DashboardPage } from '../pageobjects/DashboardPageObject';
export const verifyCreateButton = () => {
	verifyElementIsVisible(DashboardPage.createButtonCss);
};
export const clickUserName = () => {
	clickButton(DashboardPage.userNameCss);
};
