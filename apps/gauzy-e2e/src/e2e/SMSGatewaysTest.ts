import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as smsGatewaysPage from '../support/Base/pages/SMSGateways.po';
import { SMSGatewaysPageData } from '../support/Base/pagedata/SMSGatewaysPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

const checked = 'be.checked';
const notChecked = 'not.checked';

//! Expected to find element: div.header > h4, but never found it.
describe.skip('SMS Gateways Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should able to verify SMS Gateways', () => {
		cy.visit('/#/pages/settings/sms-gateway');
		smsGatewaysPage.headerTextExist(SMSGatewaysPageData.headerText);
		smsGatewaysPage.subheaderTextExist(SMSGatewaysPageData.subheaderText);
		smsGatewaysPage.checkboxVisible();
		smsGatewaysPage.verifyState(0, notChecked);
		smsGatewaysPage.clickCheckbox();
		smsGatewaysPage.verifyState(0, checked);
	});
});
