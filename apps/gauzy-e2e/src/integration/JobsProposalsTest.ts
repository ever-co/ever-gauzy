import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as jobProposalsPage from '../support/Base/pages/JobsProposals.po';
import { JobsProposalsPageData } from '../support/Base/pagedata/JobsProposalsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Job proposals test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to add new job proposal', () => {
		cy.visit('/#/pages/jobs/proposal-template');
		jobProposalsPage.addButtonVisible();
		jobProposalsPage.clickAddButton();
		jobProposalsPage.selectEmployeeDropdownVisible();
		jobProposalsPage.clickEmployeeDropdown();
		jobProposalsPage.selectEmployeeFromDropdown(1);
		jobProposalsPage.nameInputVisible();
		jobProposalsPage.enterNameInputData(JobsProposalsPageData.name);
		jobProposalsPage.contentInputVisible();
		jobProposalsPage.enterContentInputData(JobsProposalsPageData.content);
		jobProposalsPage.saveButtonVisible();
		jobProposalsPage.clickSaveButton();
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.verifyProposalExists(JobsProposalsPageData.name);
	});
	it('Should be able to edit job proposal', () => {
		jobProposalsPage.selectTableRow(0);
		jobProposalsPage.editButtonVisible();
		jobProposalsPage.clickEditButton(JobsProposalsPageData.editButton);
		jobProposalsPage.nameInputVisible();
		jobProposalsPage.enterNameInputData(JobsProposalsPageData.editName);
		jobProposalsPage.saveButtonVisible();
		jobProposalsPage.clickSaveButton();
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.verifyProposalExists(JobsProposalsPageData.editName);
	});
	it('Should be able to make proposal default', () => {
		jobProposalsPage.makeDefaultButtonVisible();
		jobProposalsPage.clickMakeDefaultButton(JobsProposalsPageData.makeDefaultButton);
	});
	it('Should be able to delete job proposal', () => {
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.deleteButtonVisible();
		jobProposalsPage.clickDeleteButton();
		jobProposalsPage.confirmDeleteButtonVisible();
		jobProposalsPage.clickConfirmDeleteButton();
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.verifyElementIsDeleted(JobsProposalsPageData.editName);
	});
});
