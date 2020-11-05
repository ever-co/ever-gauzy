import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as manageUserInvitesPage from '../support/Base/pages/ManageUserInvites.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Manage invites test', () => {
	before(() => {
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
	it('Should be able to copy invite', () => {
		cy.visit('/#/pages/users');
		manageUserInvitesPage.manageInvitesButtonVisible();
		manageUserInvitesPage.clickManageInvitesButton();
		manageUserInvitesPage.gridButtonVisible();
		manageUserInvitesPage.clickGridButton();
		manageUserInvitesPage.tableBodyExists();
		manageUserInvitesPage.clickTableRow(0);
		manageUserInvitesPage.copyLinkButtonVisible();
		manageUserInvitesPage.clickCopyLinkButton();
	});
	it('Should be able to resend invite', () => {
		manageUserInvitesPage.resendInviteButtonVisible();
		manageUserInvitesPage.clickResendInviteButton();
		manageUserInvitesPage.cancelResendInviteButtonVisible();
		manageUserInvitesPage.clickCancelResendInviteButton();
		manageUserInvitesPage.clickResendInviteButton();
		manageUserInvitesPage.confirmResendInviteButtonVisible();
		manageUserInvitesPage.clickConfirmResendInviteButton();
	});
	it('Should be able to delete invite', () => {
		manageUserInvitesPage.clickTableRow(0);
		manageUserInvitesPage.deleteInviteButtonVisible();
		manageUserInvitesPage.clickDeleteInviteButton();
		manageUserInvitesPage.cancelDeleteInviteButtonVisible();
		manageUserInvitesPage.clickCancelDeleteInviteButton();
		manageUserInvitesPage.clickDeleteInviteButton();
		manageUserInvitesPage.confirmDeleteInviteButtonVisible();
		manageUserInvitesPage.clickConfirmDeleteInviteButton();
	});
});
