import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as customSMTPPage from '../support/Base/pages/CustomSMTP.po';
import { CustomSMTPPageData } from '../support/Base/pagedata/CustomSMTPPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';

let username = ' ';
let password = ' ';

describe('Add SMTP server test', () => {
	before(() => {
		username = faker.internet.userName();
		password = faker.internet.password();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add new transfer protocol', () => {
		cy.visit('/#/pages/settings/custom-smtp/tenant');
		customSMTPPage.hostInputVisible();
		customSMTPPage.enterHostInputData(CustomSMTPPageData.host);
		customSMTPPage.portInputVisible();
		customSMTPPage.enterPortInputData(CustomSMTPPageData.port);
		customSMTPPage.secureDropdownVisible();
		customSMTPPage.clickSecureDropdown();
		customSMTPPage.selectSecureOptionFromDropdown(
			CustomSMTPPageData.secure
		);
		customSMTPPage.usernameInputVisible();
		customSMTPPage.enterUsernameInputData(username);
		customSMTPPage.passwordInputVisible();
		customSMTPPage.enterPasswordInputData(password);
		customSMTPPage.saveButtonVisible();
		customSMTPPage.clickSaveButton();
	});
});
