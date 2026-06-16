import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as messageButton from './support/pages/MessageButton.po';
import { MessageButtonData } from '../src/support/Base/pagedata/MessageButtonPageData';
import { CustomCommands } from './support/commands';

test.describe('Message button test', () => {
	test('Message button test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify menu items exist', async () => {
			await messageButton.messageButtonVisible();
			await messageButton.clickMessageButton();
			await messageButton.verifyTextExist(MessageButtonData.supportChat);
			await messageButton.verifyTextExist(MessageButtonData.faq);
			await messageButton.verifyTextExist(MessageButtonData.help);
			await messageButton.verifyTextExist(MessageButtonData.about);
		});
	});
});
