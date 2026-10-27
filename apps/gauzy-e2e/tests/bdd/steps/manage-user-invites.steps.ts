import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as manageUserInvitesPage from '../../support/pages/ManageUserInvites.po';
import { faker } from '@faker-js/faker';
import { ManageUserInvitesPageData } from '../../../src/support/Base/pagedata/ManageUserInvitesPageData';

// Converted 1:1 from the plain ManageUserInvitesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.
//
// The scenario now creates the invite it manages (ManageUserInvites.po createUserInvite) instead of
// relying on one already being in the grid: the CI seed (DEMO=false) creates no invites and
// invite-user.feature runs in another shard, so the grid was empty ("You have not invited any users.").
// The email is lower-cased so the row text, the server-side LIKE filter and the delete dialog's
// type-to-confirm phrase all compare the same string.

let inviteEmail = ' ';

When('I copy an invite', async () => {
	inviteEmail = faker.internet.exampleEmail().toLowerCase();

	await getPage().goto('/#/pages/users');
	await manageUserInvitesPage.manageInvitesButtonVisible();
	await manageUserInvitesPage.clickManageInvitesButton();
	await manageUserInvitesPage.gridButtonVisible();
	await manageUserInvitesPage.clickGridButton(1);
	await manageUserInvitesPage.inviteButtonVisible();
	await manageUserInvitesPage.createUserInvite(inviteEmail, ManageUserInvitesPageData.role);
	await manageUserInvitesPage.filterByEmail(inviteEmail);
	await manageUserInvitesPage.tableBodyExists();
	await manageUserInvitesPage.clickTableRow(0, inviteEmail);
	await manageUserInvitesPage.copyLinkButtonVisible();
	await manageUserInvitesPage.clickCopyLinkButton();
});

When('I resend an invite', async () => {
	await manageUserInvitesPage.waitMessageToHide();
	await manageUserInvitesPage.clickTableRow(0, inviteEmail);
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
	await manageUserInvitesPage.clickTableRow(0, inviteEmail);
	await manageUserInvitesPage.deleteInviteButtonVisible();
	await manageUserInvitesPage.clickDeleteInviteButton();
	await manageUserInvitesPage.cancelDeleteInviteButtonVisible();
	await manageUserInvitesPage.clickCancelDeleteInviteButton();
	await manageUserInvitesPage.clickDeleteInviteButton();
	await manageUserInvitesPage.confirmDeleteInviteButtonVisible();
	// #10761: the delete dialog only enables Delete once the invitee's email is typed back.
	await manageUserInvitesPage.typeDeleteConfirmation();
	await manageUserInvitesPage.clickConfirmDeleteInviteButton();
});
