import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as inviteUserPage from '../support/Base/pages/InviteUser.po';
import * as faker from 'faker';
import { InviteUserPageData } from '../support/Base/pagedata/InviteUserPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

let email = ' ';
let secEmail = ' ';

describe('Invite user/s test', () => {
	before(() => {
		email = faker.internet.email();
		secEmail = faker.internet.email();

		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
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
