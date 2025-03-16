import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as manageCandidatesInvitesPage from '../support/Base/pages/ManageCandidatesInvites.po';
import { CustomCommands } from '../support/commands';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { faker } from '@faker-js/faker';

let email = ' ';

describe('Manage candidates invites test', () => {
	before(() => {
		email = faker.internet.exampleEmail();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to invite candidate', () => {
		cy.visit('/#/pages/employees/candidates/invites');
		manageCandidatesInvitesPage.inviteButtonVisible();
		manageCandidatesInvitesPage.clickInviteButton();
		manageCandidatesInvitesPage.emailInputVisible();
		manageCandidatesInvitesPage.enterEmailInputData(email);
		manageCandidatesInvitesPage.dateInputVisible();
		manageCandidatesInvitesPage.enterDateInputData();
		manageCandidatesInvitesPage.clickKeyboardButtonByKeyCode(9);
		manageCandidatesInvitesPage.saveButtonVisible();
		manageCandidatesInvitesPage.clickSaveButton();
		manageCandidatesInvitesPage.waitMessageToHide();
		manageCandidatesInvitesPage.verifyInviteExist(email);
	});
	it('Should be able to resend invite', () => {
		manageCandidatesInvitesPage.tableRowVisible();
		manageCandidatesInvitesPage.selectTableRow(email);
		manageCandidatesInvitesPage.resendButtonVisible();
		manageCandidatesInvitesPage.clickResendButton();
		manageCandidatesInvitesPage.confirmResendButtonVisible();
		manageCandidatesInvitesPage.clickConfirmResendButton();
	});
	it('Should be able to resend invite', () => {
		manageCandidatesInvitesPage.waitMessageToHide();
		manageCandidatesInvitesPage.tableRowVisible();
		manageCandidatesInvitesPage.selectTableRow(email);
		manageCandidatesInvitesPage.deleteButtonVisible();
		manageCandidatesInvitesPage.clickDeleteButton();
		manageCandidatesInvitesPage.confirmDeleteButtonVisible();
		manageCandidatesInvitesPage.clickConfirmDeleteButton();
		manageCandidatesInvitesPage.verifyInviteIsDeleted(email);
	});
});
