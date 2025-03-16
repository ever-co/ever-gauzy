import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import * as messageButton from '../support/Base/pages/MessageButton.po';
import { MessageButtonData } from '../support/Base/pagedata/MessageButtonPageData';
import { CustomCommands } from '../support/commands';

describe('Message button test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to verify menu items exist', () => {
		messageButton.messageButtonVisible();
		messageButton.clickMessageButton();
		messageButton.verifyTextExist(MessageButtonData.supportChat);
		messageButton.verifyTextExist(MessageButtonData.faq);
		messageButton.verifyTextExist(MessageButtonData.help);
		messageButton.verifyTextExist(MessageButtonData.about);
	});
});
