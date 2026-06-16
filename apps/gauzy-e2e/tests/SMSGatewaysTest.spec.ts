import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as smsGatewaysPage from './support/pages/SMSGateways.po';
import { SMSGatewaysPageData } from '../src/support/Base/pagedata/SMSGatewaysPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let checked = 'be.checked';
let notChecked = 'not.checked';

test.describe('SMS Gateways Test', () => {
	test('SMS Gateways Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to verify SMS Gateways', async () => {
			await getPage().goto('/#/pages/settings/sms-gateway');
			await smsGatewaysPage.headerTextExist(SMSGatewaysPageData.headerText);
			await smsGatewaysPage.subheaderTextExist(SMSGatewaysPageData.subheaderText);
			await smsGatewaysPage.checkboxVisible();
			await smsGatewaysPage.verifyState(0, notChecked);
			await smsGatewaysPage.clickCheckbox();
			await smsGatewaysPage.verifyState(0, checked);
		});
	});
});
