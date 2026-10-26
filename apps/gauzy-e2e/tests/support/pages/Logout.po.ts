import { dispatchClick, verifyElementIsVisible } from '../util';
import { LogoutPage } from '../../../src/support/Base/pageobjects/LogoutPageObject';

// Note: the Cypress version swallowed uncaught:exception; Playwright doesn't fail on page errors
// by default, so that guard is unnecessary here.
//
// The Sign out row sits in the account panel that DashboardPage.clickUserName() opens. Wait for the panel
// to render the link, then dispatch the click straight at it: RouterLink navigates to /auth/logout
// (NbLogoutComponent -> strategy logout -> redirect to the login screen) and a coordinate click could be
// intercepted by whatever overlaps the lower-left panel while it renders.
export const clickLogoutButton = async () => {
	await verifyElementIsVisible(LogoutPage.logoutButtonCss);
	await dispatchClick(LogoutPage.logoutButtonCss);
};
