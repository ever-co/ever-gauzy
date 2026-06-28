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
			// Demo org has a single employee ("Default Employee") — option index 0, not 1
			// (.nth(1) never resolves and times out).
			await jobProposalsPage.selectEmployeeFromDropdown(0);
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
			// Saving the edit refreshes the grid and clears the selection (clearItem on templates$), so the
			// toolbar Make Default is disabled until a row is re-selected — re-select first (mirrors the
			// Estimates CRUD flow, which re-selects the row at the start of every toolbar step).
			await jobProposalsPage.selectTableRow(0);
			await jobProposalsPage.makeDefaultButtonVisible();
			await jobProposalsPage.clickMakeDefaultButton(
				JobsProposalsPageData.makeDefaultButton
			);
		});

		await test.step('Should be able to delete job proposal', async () => {
			await jobProposalsPage.waitMessageToHide();
			// Make Default also refreshes the grid and clears selection — re-select before deleting so the
			// Delete toolbar button is enabled and deleteProposalTemplate() has a selectedItem to remove.
			await jobProposalsPage.selectTableRow(0);
			await jobProposalsPage.deleteButtonVisible();
			await jobProposalsPage.clickDeleteButton();
			// Delete is a two-step confirmation: the trash button opens ConfirmComponent (Yes/No), and only on
			// "Yes" does deleteProposalTemplate() open the second DeleteConfirmationComponent (Cancel/OK).
			await jobProposalsPage.confirmFirstDialogVisible();
			await jobProposalsPage.clickConfirmFirstDialogButton();
			await jobProposalsPage.confirmDeleteButtonVisible();
			await jobProposalsPage.clickConfirmDeleteButton();
			await jobProposalsPage.waitMessageToHide();
			await jobProposalsPage.verifyElementIsDeleted(JobsProposalsPageData.editName);
		});
	});
});
