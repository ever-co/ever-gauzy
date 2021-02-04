import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as manageUserInvitesPage from '../support/Base/pages/ManageUserInvites.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Manage invites test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
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
		manageUserInvitesPage.waitMessageToHide();
		manageUserInvitesPage.clickTableRow(0);
		manageUserInvitesPage.resendInviteButtonVisible();
		manageUserInvitesPage.clickResendInviteButton();
		manageUserInvitesPage.cancelResendInviteButtonVisible();
		manageUserInvitesPage.clickCancelResendInviteButton();
		manageUserInvitesPage.clickResendInviteButton();
		manageUserInvitesPage.confirmResendInviteButtonVisible();
		manageUserInvitesPage.clickConfirmResendInviteButton();
	});
	it('Should be able to delete invite', () => {
		manageUserInvitesPage.waitMessageToHide();
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
