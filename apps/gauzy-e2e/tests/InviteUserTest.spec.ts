import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as inviteUserPage from './support/pages/InviteUser.po';
import { faker } from '@faker-js/faker';
import { InviteUserPageData } from '../src/support/Base/pagedata/InviteUserPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let email = ' ';
let secEmail = ' ';

test.describe('Invite user/s test', () => {
	test('Invite user/s test', async () => {
		email = faker.internet.exampleEmail();
		secEmail = faker.internet.exampleEmail();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to send invite', async () => {
			await getPage().goto('/#/pages/users');
			await inviteUserPage.inviteButtonVisible();
			await inviteUserPage.clickInviteButton();
			await inviteUserPage.emailInputVisible();
			await inviteUserPage.enterEmailData(email);
			await inviteUserPage.enterEmailData(secEmail);
			await inviteUserPage.dateInputVisible();
			await inviteUserPage.enterDateData();
			await inviteUserPage.clickKeyboardButtonByKeyCode(9);
			await inviteUserPage.selectRoleVisible();
			await inviteUserPage.chooseRoleSelectData(InviteUserPageData.role);
			await inviteUserPage.sendInviteButtonVisible();
			await inviteUserPage.clickSendInviteButton();
		});
	});
});
