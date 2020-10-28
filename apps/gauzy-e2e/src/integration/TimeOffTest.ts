import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timeOffPage from '../support/Base/pages/TimeOff.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Add existing user/s test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should be able to request time off', () => {
		cy.visit('/#/pages/employees/time-off');
		timeOffPage.requestButtonVisible();
		timeOffPage.clickRequestButton();
		timeOffPage.employeeDropdownVisible();
		timeOffPage.clickEmployeeDropdown();
		timeOffPage.selectEmployeeFromDropdown(0);
		timeOffPage.selectEmployeeFromDropdown(3);
	});
});
