import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as jobProposalsPage from './support/pages/JobsProposals.po';
import { JobsProposalsPageData } from '../src/support/Base/pagedata/JobsProposalsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Job proposals test', () => {
	test('Job proposals test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new job proposal', async () => {
			await getPage().goto('/#/pages/jobs/proposal-template');
			await jobProposalsPage.addButtonVisible();
			await jobProposalsPage.clickAddButton();
			await jobProposalsPage.selectEmployeeDropdownVisible();
			await jobProposalsPage.clickEmployeeDropdown();
			await jobProposalsPage.selectEmployeeFromDropdown(1);
			await jobProposalsPage.nameInputVisible();
			await jobProposalsPage.enterNameInputData(JobsProposalsPageData.name);
			await jobProposalsPage.contentInputVisible();
			await jobProposalsPage.enterContentInputData(JobsProposalsPageData.content);
			await jobProposalsPage.saveButtonVisible();
			await jobProposalsPage.clickSaveButton();
			await jobProposalsPage.waitMessageToHide();
			await jobProposalsPage.verifyProposalExists(JobsProposalsPageData.name);
		});

		await test.step('Should be able to edit job proposal', async () => {
			await jobProposalsPage.selectTableRow(0);
			await jobProposalsPage.editButtonVisible();
			await jobProposalsPage.clickEditButton(JobsProposalsPageData.editButton);
			await jobProposalsPage.nameInputVisible();
			await jobProposalsPage.enterNameInputData(JobsProposalsPageData.editName);
			await jobProposalsPage.saveButtonVisible();
			await jobProposalsPage.clickSaveButton();
			await jobProposalsPage.waitMessageToHide();
			await jobProposalsPage.verifyProposalExists(JobsProposalsPageData.editName);
		});

		await test.step('Should be able to make proposal default', async () => {
			await jobProposalsPage.makeDefaultButtonVisible();
			await jobProposalsPage.clickMakeDefaultButton(
				JobsProposalsPageData.makeDefaultButton
			);
		});

		await test.step('Should be able to delete job proposal', async () => {
			await jobProposalsPage.waitMessageToHide();
			await jobProposalsPage.deleteButtonVisible();
			await jobProposalsPage.clickDeleteButton();
			await jobProposalsPage.confirmDeleteButtonVisible();
			await jobProposalsPage.clickConfirmDeleteButton();
			await jobProposalsPage.waitMessageToHide();
			await jobProposalsPage.verifyElementIsDeleted(JobsProposalsPageData.editName);
		});
	});
});
