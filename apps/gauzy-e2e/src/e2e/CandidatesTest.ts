import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as inviteCandidatePage from '../support/Base/pages/Candidates.po';
import { faker } from '@faker-js/faker';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let secondEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

describe('Invite candidate test', () => {
	before(() => {
		email = faker.internet.exampleEmail();
		secondEmail = faker.internet.exampleEmail();
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to send invite', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/employees/candidates');
		inviteCandidatePage.gridBtnExists();
		inviteCandidatePage.gridBtnClick(1);
		inviteCandidatePage.inviteButtonVisible();
		inviteCandidatePage.clickInviteButton();
		inviteCandidatePage.emailInputVisible();
		inviteCandidatePage.enterEmailData(email);
		inviteCandidatePage.enterEmailData(secondEmail);
		inviteCandidatePage.inviteDateInputVisible();
		inviteCandidatePage.enterInviteDateInputData();
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.sendInviteButtonVisible();
		inviteCandidatePage.clickSendInviteButton();
	});
	it('Should be able to add new candidate', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		inviteCandidatePage.addCandidateButtonVisible();
		inviteCandidatePage.clickAddCandidateButton(0);
		inviteCandidatePage.firstNameInputVisible();
		inviteCandidatePage.enterFirstNameInputData(firstName);
		inviteCandidatePage.lastNameInputVisible();
		inviteCandidatePage.enterLastNameInputData(lastName);
		inviteCandidatePage.usernameInputVisible();
		inviteCandidatePage.enterUsernameInputData(username);
		inviteCandidatePage.candidateEmailInputVisible();
		inviteCandidatePage.enterCandidateEmailInputData(email);
		inviteCandidatePage.passwordInputVisible();
		inviteCandidatePage.enterPasswordInputData(password);
		inviteCandidatePage.candidateDateInputVisible();
		inviteCandidatePage.enterCandidateDateInputData();
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.tagsDropdownVisible();
		inviteCandidatePage.clickAddTagsDropdown();
		inviteCandidatePage.selectTagsFromDropdown(0);
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.imageInputVisible();
		inviteCandidatePage.enterImageInputData(imgUrl);
		inviteCandidatePage.nextButtonVisible();
		inviteCandidatePage.clickNextButton();
		inviteCandidatePage.nextStepButtonVisible();
		inviteCandidatePage.clickNextStepButton();
		inviteCandidatePage.allCurrentCandidatesButtonVisible();
		inviteCandidatePage.clickAllCurrentCandidatesButton();
		inviteCandidatePage.waitMessageToHide();
		inviteCandidatePage.verifyCandidateExists(`${firstName} ${lastName}`);
	});
	it('Should be able to reject candidate', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.rejectButtonVisible();
		inviteCandidatePage.clickRejectButton();
		inviteCandidatePage.confirmActionButtonVisible();
		inviteCandidatePage.clickConfirmActionButton();
		inviteCandidatePage.waitMessageToHide();
		inviteCandidatePage.verifyBadgeClass();
	});
	it('Should be able to edit candidate', () => {
		inviteCandidatePage.waitMessageToHide();
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.editButtonVisible();
		inviteCandidatePage.clickEditButton();
		inviteCandidatePage.saveEditButtonVisible();
		inviteCandidatePage.clickSaveEditButton();
		inviteCandidatePage.backButtonVisible();
		inviteCandidatePage.clickBackButton();
	});
	it('Should be able to archive candidate', () => {
		inviteCandidatePage.waitMessageToHide();
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.archiveButtonVisible();
		inviteCandidatePage.clickArchiveButton();
		inviteCandidatePage.confirmActionButtonVisible();
		inviteCandidatePage.clickConfirmActionButton();
		inviteCandidatePage.waitMessageToHide();
		inviteCandidatePage.verifyElementIsDeleted();
	});
});
