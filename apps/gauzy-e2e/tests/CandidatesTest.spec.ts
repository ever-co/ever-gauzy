import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as inviteCandidatePage from './support/pages/Candidates.po';
import { faker } from '@faker-js/faker';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

let email = ' ';
let secondEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

test.describe('Invite candidate test', () => {
	test('Invite candidate test', async () => {
		email = faker.internet.exampleEmail();
		secondEmail = faker.internet.exampleEmail();
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		// imgUrl MUST end in a real image extension AND be a loadable image. The basic-info form's
		// imageUrl cross-field validator (UrlPatternValidator.imageUrlValidator, pattern
		// .png|.jpg|.jpeg|.gif|.svg) marks the whole form invalid for an extension-less URL, and the
		// <img> onerror handler (_setupLogoUrlValidation) sets {invalidUrl:true} if the URL can't load
		// — either way candidate-mutation.addCandidate() silently skips the push (it only pushes when
		// `this.form.valid`), so NO candidate is created and verifyCandidateExists fails. The default
		// faker.image.avatar() randomly returns an extension-less GitHub avatar URL (~50% of runs),
		// which is what made this spec flaky. personPortrait() always returns a real, loadable CDN
		// image ending in `.jpg`, satisfying both the regex validator and the image-load check.
		imgUrl = faker.image.personPortrait();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to send invite', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			// addTag ends on /#/pages/organization/tags. A bare goto() to another hash route is a
			// SAME-DOCUMENT no-op (the Angular hash-router never re-renders, leaving the tags screen
			// mounted), so force the hash + settle, then wait for the candidates header before acting.
			await inviteCandidatePage.openCandidatesPage();
			await inviteCandidatePage.gridBtnExists();
			await inviteCandidatePage.gridBtnClick(1);
			await inviteCandidatePage.inviteButtonVisible();
			await inviteCandidatePage.clickInviteButton();
			await inviteCandidatePage.emailInputVisible();
			await inviteCandidatePage.enterEmailData(email);
			await inviteCandidatePage.enterEmailData(secondEmail);
			await inviteCandidatePage.inviteDateInputVisible();
			await inviteCandidatePage.enterInviteDateInputData();
			await inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
			await inviteCandidatePage.sendInviteButtonVisible();
			await inviteCandidatePage.clickSendInviteButton();
		});

		await test.step('Should be able to add new candidate', async () => {
			await inviteCandidatePage.addCandidateButtonVisible();
			await inviteCandidatePage.clickAddCandidateButton(0);
			await inviteCandidatePage.firstNameInputVisible();
			await inviteCandidatePage.enterFirstNameInputData(firstName);
			await inviteCandidatePage.lastNameInputVisible();
			await inviteCandidatePage.enterLastNameInputData(lastName);
			await inviteCandidatePage.usernameInputVisible();
			await inviteCandidatePage.enterUsernameInputData(username);
			await inviteCandidatePage.candidateEmailInputVisible();
			await inviteCandidatePage.enterCandidateEmailInputData(email);
			await inviteCandidatePage.passwordInputVisible();
			await inviteCandidatePage.enterPasswordInputData(password);
			await inviteCandidatePage.candidateDateInputVisible();
			await inviteCandidatePage.enterCandidateDateInputData();
			await inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
			await inviteCandidatePage.tagsDropdownVisible();
			await inviteCandidatePage.clickAddTagsDropdown();
			await inviteCandidatePage.selectTagsFromDropdown(0);
			await inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
			await inviteCandidatePage.imageInputVisible();
			await inviteCandidatePage.enterImageInputData(imgUrl);
			await inviteCandidatePage.nextButtonVisible();
			await inviteCandidatePage.clickNextButton();
			await inviteCandidatePage.nextStepButtonVisible();
			await inviteCandidatePage.clickNextStepButton();
			await inviteCandidatePage.allCurrentCandidatesButtonVisible();
			await inviteCandidatePage.clickAllCurrentCandidatesButton();
			await inviteCandidatePage.waitMessageToHide();
			await inviteCandidatePage.verifyCandidateExists(`${firstName} ${lastName}`);
		});

		await test.step('Should be able to reject candidate', async () => {
			// Scope to the candidate we just created (status APPLIED) — the toolbar Reject button is
			// gated on status === APPLIED, so a polluted non-APPLIED row at index 0 would hide it.
			await inviteCandidatePage.selectTableRow(`${firstName} ${lastName}`);
			await inviteCandidatePage.rejectButtonVisible();
			await inviteCandidatePage.clickRejectButton();
			await inviteCandidatePage.confirmActionButtonVisible();
			await inviteCandidatePage.clickConfirmActionButton();
			await inviteCandidatePage.waitMessageToHide();
			await inviteCandidatePage.verifyBadgeClass();
		});

		await test.step('Should be able to edit candidate', async () => {
			await inviteCandidatePage.waitMessageToHide();
			await inviteCandidatePage.selectTableRow(`${firstName} ${lastName}`);
			await inviteCandidatePage.editButtonVisible();
			await inviteCandidatePage.clickEditButton();
			await inviteCandidatePage.saveEditButtonVisible();
			await inviteCandidatePage.clickSaveEditButton();
			await inviteCandidatePage.backButtonVisible();
			await inviteCandidatePage.clickBackButton();
		});

		await test.step('Should be able to archive candidate', async () => {
			await inviteCandidatePage.waitMessageToHide();
			await inviteCandidatePage.selectTableRow(`${firstName} ${lastName}`);
			await inviteCandidatePage.archiveButtonVisible();
			await inviteCandidatePage.clickArchiveButton();
			await inviteCandidatePage.confirmActionButtonVisible();
			await inviteCandidatePage.clickConfirmActionButton();
			await inviteCandidatePage.waitMessageToHide();
			// Scope the "is gone" check to our candidate's name — other candidates' grid rows may remain.
			await inviteCandidatePage.verifyElementIsDeleted(`${firstName} ${lastName}`);
		});
	});
});
