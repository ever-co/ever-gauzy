import { clickButton } from '../util';
import { LogoutPage } from '../../../src/support/Base/pageobjects/LogoutPageObject';

// Note: the Cypress version swallowed uncaught:exception; Playwright doesn't fail on page errors
// by default, so that guard is unnecessary here.
export const clickLogoutButton = async () => clickButton(LogoutPage.logoutButtonCss);
