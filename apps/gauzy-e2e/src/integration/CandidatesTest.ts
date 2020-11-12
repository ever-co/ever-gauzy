import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as inviteCandidatePage from '../support/Base/pages/Candidates.po';
import * as faker from 'faker';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

let email = ' ';
let secondEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

describe('Invite candidate test', () => {
	before(() => {
		email = faker.internet.email();
		secondEmail = faker.internet.email();
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

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
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
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
		inviteCandidatePage.selectTagsFromDrodpwon(0);
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.imageInputvisible();
		inviteCandidatePage.enterImageInputData(imgUrl);
		inviteCandidatePage.nextButtonVisible();
		inviteCandidatePage.clickNextButton();
		inviteCandidatePage.nextStepButtonVisible();
		inviteCandidatePage.clickNextStepButton();
		inviteCandidatePage.allCurrentCandidatesButtonVisible();
		inviteCandidatePage.clickAllCurrentCandidatesButton();
	});
	it('Should be able to reject candidate', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		cy.wait(3000);
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.rejectButtonVisible();
		inviteCandidatePage.clickRejectButton();
		inviteCandidatePage.confirmActionButtonVisible();
		inviteCandidatePage.clickConfirmActionButton();
	});
	it('Should be able to edit candidate', () => {
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.editButtonVisible();
		inviteCandidatePage.clickEditButton();
		inviteCandidatePage.saveEditButtonVisible();
		inviteCandidatePage.clickSaveEditButton();
		inviteCandidatePage.backButtonVisible();
		inviteCandidatePage.clickBackButton();
	});
	it('Should be able to archive candidate', () => {
		inviteCandidatePage.selectTableRow(0);
		inviteCandidatePage.archiveButtonVisible();
		inviteCandidatePage.clickArchiveButton();
		inviteCandidatePage.confirmActionButtonVisible();
		inviteCandidatePage.clickConfirmActionButton();
	});
});
