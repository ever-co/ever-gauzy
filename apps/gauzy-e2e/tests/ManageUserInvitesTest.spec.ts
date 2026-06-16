import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as manageUserInvitesPage from './support/pages/ManageUserInvites.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Manage invites test', () => {
	test('Manage invites test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to copy invite', async () => {
			await getPage().goto('/#/pages/users');
			await manageUserInvitesPage.manageInvitesButtonVisible();
			await manageUserInvitesPage.clickManageInvitesButton();
			await manageUserInvitesPage.gridButtonVisible();
			await manageUserInvitesPage.clickGridButton(1);
			await manageUserInvitesPage.tableBodyExists();
			await manageUserInvitesPage.clickTableRow(0);
			await manageUserInvitesPage.copyLinkButtonVisible();
			await manageUserInvitesPage.clickCopyLinkButton();
		});

		await test.step('Should be able to resend invite', async () => {
			await manageUserInvitesPage.waitMessageToHide();
			await manageUserInvitesPage.clickTableRow(0);
			await manageUserInvitesPage.resendInviteButtonVisible();
			await manageUserInvitesPage.clickResendInviteButton();
			await manageUserInvitesPage.cancelResendInviteButtonVisible();
			await manageUserInvitesPage.clickCancelResendInviteButton();
			await manageUserInvitesPage.clickResendInviteButton();
			await manageUserInvitesPage.confirmResendInviteButtonVisible();
			await manageUserInvitesPage.clickConfirmResendInviteButton();
		});

		await test.step('Should be able to delete invite', async () => {
			await manageUserInvitesPage.waitMessageToHide();
			await manageUserInvitesPage.clickTableRow(0);
			await manageUserInvitesPage.deleteInviteButtonVisible();
			await manageUserInvitesPage.clickDeleteInviteButton();
			await manageUserInvitesPage.cancelDeleteInviteButtonVisible();
			await manageUserInvitesPage.clickCancelDeleteInviteButton();
			await manageUserInvitesPage.clickDeleteInviteButton();
			await manageUserInvitesPage.confirmDeleteInviteButtonVisible();
			await manageUserInvitesPage.clickConfirmDeleteInviteButton();
		});
	});
});
