import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as customSMTPPage from './support/pages/CustomSMTP.po';
import { CustomSMTPPageData } from '../src/support/Base/pagedata/CustomSMTPPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';

let username = ' ';
let password = ' ';

test.describe('Add SMTP server test', () => {
	test('Add SMTP server test', async () => {
		username = faker.internet.username();
		password = faker.internet.password();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new transfer protocol', async () => {
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
	});
});
