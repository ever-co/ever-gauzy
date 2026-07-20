import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as smsGatewaysPage from '../../support/pages/SMSGateways.po';
import { SMSGatewaysPageData } from '../../../src/support/Base/pagedata/SMSGatewaysPageData';

// Converted 1:1 from the plain SMSGatewaysTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

let checked = 'be.checked';
let notChecked = 'not.checked';

When('I verify the SMS gateways settings', async () => {
	await getPage().goto('/#/pages/settings/sms-gateway');
	await smsGatewaysPage.headerTextExist(SMSGatewaysPageData.headerText);
	await smsGatewaysPage.subheaderTextExist(SMSGatewaysPageData.subheaderText);
	await smsGatewaysPage.checkboxVisible();
	await smsGatewaysPage.verifyState(0, notChecked);
	await smsGatewaysPage.clickCheckbox();
	await smsGatewaysPage.verifyState(0, checked);
});
