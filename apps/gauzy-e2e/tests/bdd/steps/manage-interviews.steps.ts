import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { ManageInterviewsPageData } from '../../../src/support/Base/pagedata/ManageInterviewsPageData';
import * as manageInterviewsPage from '../../support/pages/ManageInterviews.po';
import { CustomCommands } from '../../support/commands';
import * as inviteCandidatePage from '../../support/pages/Candidates.po';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain ManageInterviewsTest.spec.ts: the single test() -> one Scenario, its
// single test.step() -> one When step whose body is the verbatim .po call sequence (candidate creation
// + interview scheduling + verification), so runtime behaviour is identical to the already-CI-tested
// spec. The faker-generated candidate identity is declared at module scope and initialised at the start
// of the step body. The `Given I am logged in as the default user` Background step is defined once in
// common.steps.ts.

let email = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

When('I add an interview for a candidate', async () => {
	email = faker.internet.exampleEmail();
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	password = faker.internet.password();
	imgUrl = faker.image.avatar();

	await CustomCommands.addCandidate(
		inviteCandidatePage,
		firstName,
		lastName,
		username,
		email,
		password,
		imgUrl
	);
	await getPage().goto('/#/pages/employees/candidates/interviews/calendar');
	await manageInterviewsPage.addInterviewButtonVisible();
	await manageInterviewsPage.clickAddInterviewButton();
	await manageInterviewsPage.candidateDropdownVisible();
	await manageInterviewsPage.clickCandidateDropdown();
	await manageInterviewsPage.candidateDropdownOptionVisible();
	// Pick the candidate we just created BY NAME (not index 0): the autocomplete lists every
	// candidate, so selecting index 0 attaches the interview to an arbitrary candidate and the
	// final verify (which looks for THIS candidate's name in the grid) then fails.
	await manageInterviewsPage.selectCandidateFromDropdown(`${firstName} ${lastName}`);
	await manageInterviewsPage.titleInputVisible();
	await manageInterviewsPage.enterTitleInputData(
		ManageInterviewsPageData.title
	);
	await manageInterviewsPage.dateInputVisible();
	await manageInterviewsPage.enterDateInputData();
	await manageInterviewsPage.clickKeyboardButtonByKeyCode(9);
	await manageInterviewsPage.employeeDropdownVisible();
	await manageInterviewsPage.clickEmployeeDropdown();
	await manageInterviewsPage.employeeDropdownOptionVisible();
	await manageInterviewsPage.clickEmployeeDropdownOption(0);
	await manageInterviewsPage.clickKeyboardButtonByKeyCode(9);
	await manageInterviewsPage.interviewTypeButtonVisible();
	await manageInterviewsPage.clickInterviewTypeButton(1);
	await manageInterviewsPage.locationInputVisible();
	await manageInterviewsPage.enterLocationInputData(
		ManageInterviewsPageData.location
	);
	await manageInterviewsPage.noteInputVisible();
	await manageInterviewsPage.enterNoteInputData(ManageInterviewsPageData.note);
	await manageInterviewsPage.nextButtonVisible();
	await manageInterviewsPage.clickNextButton();
	await manageInterviewsPage.nextStepButtonVisible();
	await manageInterviewsPage.clickNextStepButton();
	await manageInterviewsPage.notifyCandidateCheckboxVisible();
	await manageInterviewsPage.clickNotifyCandidateCheckbox(0);
	await manageInterviewsPage.scrollElement();
	await manageInterviewsPage.saveButtonVisible();
	await manageInterviewsPage.clickSaveButton();
	await manageInterviewsPage.waitMessageToHide();
	await getPage().goto('/#/pages/employees/candidates/interviews/interview_panel');
	await manageInterviewsPage.verifyScheduleExist(`${firstName} ${lastName}`);
});
