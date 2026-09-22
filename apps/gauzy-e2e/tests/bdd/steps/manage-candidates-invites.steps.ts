import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as manageCandidatesInvitesPage from '../../support/pages/ManageCandidatesInvites.po';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain ManageCandidatesInvitesTest.spec.ts: the single test() -> one Scenario,
// each test.step() -> one When step whose body is the verbatim .po call sequence (verification folded
// in), so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as
// the default user` Background step is defined once in common.steps.ts. `email` is faker-generated at
// the top of test() and used across all three steps, so it lives at module scope and is initialised at
// the start of the first step.

let email = ' ';

When('I invite a candidate', async () => {
	email = faker.internet.exampleEmail();

	await getPage().goto('/#/pages/employees/candidates/invites');
	await manageCandidatesInvitesPage.inviteButtonVisible();
	await manageCandidatesInvitesPage.clickInviteButton();
	await manageCandidatesInvitesPage.emailInputVisible();
	await manageCandidatesInvitesPage.enterEmailInputData(email);
	await manageCandidatesInvitesPage.dateInputVisible();
	await manageCandidatesInvitesPage.enterDateInputData();
	await manageCandidatesInvitesPage.clickKeyboardButtonByKeyCode(9);
	await manageCandidatesInvitesPage.saveButtonVisible();
	await manageCandidatesInvitesPage.clickSaveButton();
	await manageCandidatesInvitesPage.waitMessageToHide();
	await manageCandidatesInvitesPage.verifyInviteExist(email);
});

When('I resend the candidate invite', async () => {
	await manageCandidatesInvitesPage.tableRowVisible();
	await manageCandidatesInvitesPage.selectTableRow(email);
	await manageCandidatesInvitesPage.resendButtonVisible();
	await manageCandidatesInvitesPage.clickResendButton();
	await manageCandidatesInvitesPage.confirmResendButtonVisible();
	await manageCandidatesInvitesPage.clickConfirmResendButton();
});

When('I delete the candidate invite', async () => {
	await manageCandidatesInvitesPage.waitMessageToHide();
	await manageCandidatesInvitesPage.tableRowVisible();
	await manageCandidatesInvitesPage.selectTableRow(email);
	await manageCandidatesInvitesPage.deleteButtonVisible();
	await manageCandidatesInvitesPage.clickDeleteButton();
	await manageCandidatesInvitesPage.confirmDeleteButtonVisible();
	await manageCandidatesInvitesPage.clickConfirmDeleteButton();
	await manageCandidatesInvitesPage.verifyInviteIsDeleted(email);
});
