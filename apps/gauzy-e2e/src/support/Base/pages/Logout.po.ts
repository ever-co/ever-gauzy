import { clickButton } from '../utils/util';
import { LogoutPage } from '../pageobjects/LogoutPageObject';

export const clickLogoutButton = () => {
	cy.on('uncaught:exception', (err, runnable) => {
		
		return false
	  })
	
	clickButton(LogoutPage.logoutButtonCss);
};
