import { clickButton } from '../utils/util';
import { LogoutPage } from '../pageobjects/LogoutPageObject';

export const clickLogoutButton = () => {
	clickButton(LogoutPage.logoutButtonCss);
};
