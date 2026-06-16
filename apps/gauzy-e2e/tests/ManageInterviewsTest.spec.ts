import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import { ManageInterviewsPageData } from '../src/support/Base/pagedata/ManageInterviewsPageData';
import * as manageInterviewsPage from './support/pages/ManageInterviews.po';
import { CustomCommands } from './support/commands';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as inviteCandidatePage from './support/pages/Candidates.po';
import { faker } from '@faker-js/faker';

let email = ' ';
let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let imgUrl = ' ';

test.describe('Manage interviews test', () => {
	test('Manage interviews test', async () => {
		email = faker.internet.exampleEmail();
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add interview', async () => {
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
			await manageInterviewsPage.selectCandidateFromDropdown(0);
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
	});
});
