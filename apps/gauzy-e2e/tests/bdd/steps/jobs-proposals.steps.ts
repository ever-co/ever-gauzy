import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as jobProposalsPage from '../../support/pages/JobsProposals.po';
import { JobsProposalsPageData } from '../../../src/support/Base/pagedata/JobsProposalsPageData';

// Converted 1:1 from the plain JobsProposalsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts.

When('I add a new job proposal', async () => {
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

When('I edit the job proposal', async () => {
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

When('I make the job proposal default', async () => {
	// Saving the edit refreshes the grid and clears the selection (clearItem on templates$), so the
	// toolbar Make Default is disabled until a row is re-selected — re-select first (mirrors the
	// Estimates CRUD flow, which re-selects the row at the start of every toolbar step).
	await jobProposalsPage.selectTableRow(0);
	await jobProposalsPage.makeDefaultButtonVisible();
	await jobProposalsPage.clickMakeDefaultButton(
		JobsProposalsPageData.makeDefaultButton
	);
});

When('I delete the job proposal', async () => {
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
