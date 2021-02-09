import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import { ManageInterviewsPageData } from '../support/Base/pagedata/ManageInterviewsPageData';
import * as manageInterviewsPage from '../support/Base/pages/ManageInterviews.po';
import { CustomCommands } from '../support/commands';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as inviteCandidatePage from '../support/Base/pages/Candidates.po';
import * as faker from 'faker';

let email = ' ';
let secondEmail = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

describe('Manage interviews test', () => {
	before(() => {
		email = faker.internet.email();
		secondEmail = faker.internet.email();
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add interview', () => {
		CustomCommands.addCandidate(
			inviteCandidatePage,
			firstName,
			lastName,
			username,
			email,
			password,
			imgUrl
		);
		cy.visit('/#/pages/employees/candidates/interviews/calendar');
		manageInterviewsPage.addInterviewButtonVisible();
		manageInterviewsPage.clickAddInterviewButton();
		manageInterviewsPage.candidateDropdownVisible();
		manageInterviewsPage.clickCandidateDropdown();
		manageInterviewsPage.candidateDropdownOptionVisible();
		manageInterviewsPage.selectCandidateFromDropdown(0);
		manageInterviewsPage.titleInputVisible();
		manageInterviewsPage.enterTitleInputData(
			ManageInterviewsPageData.title
		);
		manageInterviewsPage.dateInputVisible();
		manageInterviewsPage.enterDateInputData();
		manageInterviewsPage.clickKeyboardButtonByKeyCode(9);
		manageInterviewsPage.employeeDropdownVisible();
		manageInterviewsPage.clickEmployeeDropdown();
		manageInterviewsPage.employeeDropdownOptionVisible();
		manageInterviewsPage.clickEmployeeDropdownOption(0);
		manageInterviewsPage.clickKeyboardButtonByKeyCode(9);
		manageInterviewsPage.interviewTypeButtonVisible();
		manageInterviewsPage.clickInterviewTypeButton(1);
		manageInterviewsPage.loactioninputVisible();
		manageInterviewsPage.enterLocationInputData(
			ManageInterviewsPageData.location
		);
		manageInterviewsPage.noteInputVisible();
		manageInterviewsPage.enterNoteInputData(ManageInterviewsPageData.note);
		manageInterviewsPage.nextButtonVisible();
		manageInterviewsPage.clickNextButton();
		manageInterviewsPage.nextStepButtonVisible();
		manageInterviewsPage.clickNextStepButton();
		manageInterviewsPage.notifyCandidateCheckboxVisible();
		manageInterviewsPage.clickNotifyCandidateCheckbox(0);
		manageInterviewsPage.scrollElement();
		manageInterviewsPage.saveButtonVisible();
		manageInterviewsPage.clickSaveButton();
		manageInterviewsPage.waitMessageToHide();
		cy.visit('/#/pages/employees/candidates/interviews/interview_panel');
		manageInterviewsPage.verifySheduleExist(`${firstName} ${lastName}`);
	});
});
