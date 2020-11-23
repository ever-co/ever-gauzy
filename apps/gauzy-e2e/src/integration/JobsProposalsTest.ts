import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as jobProposalsPage from '../support/Base/pages/JobsProposals.po';
import { JobsProposalsPageData } from '../support/Base/pagedata/JobsProposalsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Job proposals test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new job proposal', () => {
		cy.visit('/#/pages/jobs/proposal-template');
		jobProposalsPage.addButtonVisible();
		jobProposalsPage.clickAddButton();
		jobProposalsPage.selectEmployeeDropdownVisible();
		jobProposalsPage.clickEmployeeDropdown();
		jobProposalsPage.selectEmployeeFromDrodpwon(1);
		jobProposalsPage.nameInputVisible();
		jobProposalsPage.enterNameInputData(JobsProposalsPageData.name);
		jobProposalsPage.contentInputVisible();
		jobProposalsPage.enterContentInputData(JobsProposalsPageData.content);
		jobProposalsPage.saveButtonVisible();
		jobProposalsPage.clickSaveButton();
	});
	it('Should be able to edit job proposal', () => {
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.selectTableRow(0);
		jobProposalsPage.selectTableRow(0);
		jobProposalsPage.editButtonVisible();
		jobProposalsPage.clickEditButton(JobsProposalsPageData.editButton);
		jobProposalsPage.nameInputVisible();
		jobProposalsPage.enterNameInputData(JobsProposalsPageData.name);
		jobProposalsPage.contentInputVisible();
		jobProposalsPage.enterContentInputData(JobsProposalsPageData.content);
		jobProposalsPage.saveButtonVisible();
		jobProposalsPage.clickSaveButton();
	});
	it('Should be able to make proposal default', () => {
		jobProposalsPage.makeDefaultButtonVisible();
		jobProposalsPage.clickMakeDefaultButton(
			JobsProposalsPageData.makeDefaultButton
		);
	});
	it('Should be able to delete job proposal', () => {
		jobProposalsPage.waitMessageToHide();
		jobProposalsPage.deleteButtonVisible();
		jobProposalsPage.clickDeleteButton();
		jobProposalsPage.confirmDeleteButtonVisible();
		jobProposalsPage.clickConfirmDeleteButton();
	});
});
