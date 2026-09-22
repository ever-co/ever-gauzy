import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as manageUserInvitesPage from '../../support/pages/ManageUserInvites.po';

// Converted 1:1 from the plain ManageUserInvitesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I copy an invite', async () => {
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

When('I resend an invite', async () => {
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

When('I delete an invite', async () => {
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
