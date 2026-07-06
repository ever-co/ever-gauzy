import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as customSMTPPage from '../../support/pages/CustomSMTP.po';
import { CustomSMTPPageData } from '../../../src/support/Base/pagedata/CustomSMTPPageData';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain CustomSMTPTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts. The faker-generated username/password were declared at the
// top of the plain spec and initialised at the start of test(); here they are module-scoped and
// initialised at the start of the (only) step body.

let username = ' ';
let password = ' ';

When('I add a new SMTP transfer protocol', async () => {
	username = faker.internet.username();
	password = faker.internet.password();

	await getPage().goto('/#/pages/settings/custom-smtp/tenant');
	await customSMTPPage.hostInputVisible();
	await customSMTPPage.enterHostInputData(CustomSMTPPageData.host);
	await customSMTPPage.portInputVisible();
	await customSMTPPage.enterPortInputData(CustomSMTPPageData.port);
	await customSMTPPage.secureDropdownVisible();
	await customSMTPPage.clickSecureDropdown();
	await customSMTPPage.selectSecureOptionFromDropdown(CustomSMTPPageData.secure);
	await customSMTPPage.usernameInputVisible();
	await customSMTPPage.enterUsernameInputData(username);
	await customSMTPPage.passwordInputVisible();
	await customSMTPPage.enterPasswordInputData(password);
	await customSMTPPage.saveButtonVisible();
	await customSMTPPage.clickSaveButton();
});
