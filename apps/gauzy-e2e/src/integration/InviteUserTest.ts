import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as inviteUserPage from '../support/Base/pages/InviteUser.po';
import { faker } from '@faker-js/faker';
import { InviteUserPageData } from '../support/Base/pagedata/InviteUserPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let email = ' ';
let secEmail = ' ';

describe('Invite user/s test', () => {
	before(() => {
		email = faker.internet.exampleEmail();
		secEmail = faker.internet.exampleEmail();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to send invite', () => {
		cy.visit('/#/pages/users');
		inviteUserPage.inviteButtonVisible();
		inviteUserPage.clickInviteButton();
		inviteUserPage.emailInputVisible();
		inviteUserPage.enterEmailData(email);
		inviteUserPage.enterEmailData(secEmail);
		inviteUserPage.dateInputVisible();
		inviteUserPage.enterDateData();
		inviteUserPage.clickKeyboardButtonByKeyCode(9);
		inviteUserPage.selectRoleVisible();
		inviteUserPage.chooseRoleSelectData(InviteUserPageData.role);
		inviteUserPage.sendInviteButtonVisible();
		inviteUserPage.clickSendInviteButton();
	});
});
