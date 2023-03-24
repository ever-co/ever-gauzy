import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as smsGatewaysPage from '../support/Base/pages/SMSGateways.po';
import { SMSGatewaysPageData } from '../support/Base/pagedata/SMSGatewaysPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let checked = 'be.checked';
let notChecked = 'not.checked';

describe('SMS Gateways Test', () => {
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
