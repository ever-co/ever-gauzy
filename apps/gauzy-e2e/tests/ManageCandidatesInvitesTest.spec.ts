import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as manageCandidatesInvitesPage from './support/pages/ManageCandidatesInvites.po';
import { CustomCommands } from './support/commands';
import * as dashboardPage from './support/pages/Dashboard.po';
import { faker } from '@faker-js/faker';

let email = ' ';

test.describe('Manage candidates invites test', () => {
	test('Manage candidates invites test', async () => {
		email = faker.internet.exampleEmail();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to invite candidate', async () => {
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

		await test.step('Should be able to resend invite', async () => {
			await manageCandidatesInvitesPage.tableRowVisible();
			await manageCandidatesInvitesPage.selectTableRow(email);
			await manageCandidatesInvitesPage.resendButtonVisible();
			await manageCandidatesInvitesPage.clickResendButton();
			await manageCandidatesInvitesPage.confirmResendButtonVisible();
			await manageCandidatesInvitesPage.clickConfirmResendButton();
		});

		await test.step('Should be able to resend invite', async () => {
			await manageCandidatesInvitesPage.waitMessageToHide();
			await manageCandidatesInvitesPage.tableRowVisible();
			await manageCandidatesInvitesPage.selectTableRow(email);
			await manageCandidatesInvitesPage.deleteButtonVisible();
			await manageCandidatesInvitesPage.clickDeleteButton();
			await manageCandidatesInvitesPage.confirmDeleteButtonVisible();
			await manageCandidatesInvitesPage.clickConfirmDeleteButton();
			await manageCandidatesInvitesPage.verifyInviteIsDeleted(email);
		});
	});
});
