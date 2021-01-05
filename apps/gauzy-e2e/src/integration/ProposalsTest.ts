import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as proposalsPage from '../support/Base/pages/Proposals.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let jobPostUrl = ' ';
let editJobPostUrl = ' ';

describe('Proposals test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new proposal', () => {
		cy.visit('/#/pages/sales/proposals');
		proposalsPage.gridBtnExists();
		proposalsPage.gridBtnClick(1);
		proposalsPage.registerProposalButtonVisible();
		proposalsPage.clickRegisterProposalButton();
		proposalsPage.selectEmployeeDropdownVisible();
		proposalsPage.clickEmployeeDropdown();
		proposalsPage.selectEmployeeFromDrodpwon(1);
		proposalsPage.jobPostInputVisible();
		proposalsPage.enterJobPostInputData(jobPostUrl);
		proposalsPage.dateInputVisible();
		proposalsPage.enterDateInputData();
		proposalsPage.tagsDropdownVisible();
		proposalsPage.clickTagsDropdwon();
		proposalsPage.selectTagFromDropdown(0);
		proposalsPage.clickCardBody();
		proposalsPage.saveProposalButtonVisible();
		proposalsPage.clickSaveProposalButton();
		proposalsPage.waitMessageToHide();
		proposalsPage.verifyProposalExists(jobPostUrl);
	});
	it('Should be able to edit proposal', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		proposalsPage.waitMessageToHide();
		proposalsPage.tableRowVisible();
		proposalsPage.selectTableRow(0);
		proposalsPage.detailsButtonVisible();
		proposalsPage.clickDetailsButton(0);
		proposalsPage.editProposalButtonVisible();
		proposalsPage.clickEditProposalButton();
		proposalsPage.jobPostInputVisible();
		proposalsPage.enterJobPostInputData(editJobPostUrl);
		proposalsPage.tagsDropdownVisible();
		proposalsPage.clickTagsDropdwon();
		proposalsPage.selectTagFromDropdown(0);
		proposalsPage.clickCardBody();
		proposalsPage.saveProposalButtonVisible();
		proposalsPage.clickSaveProposalButton();
	});
	it('Should be able to mark proposal as Accepted', () => {
		proposalsPage.waitMessageToHide();
		proposalsPage.selectTableRow(0);
		proposalsPage.markAsStatusButtonVisible();
		proposalsPage.clickMarkAsStatusButton();
		proposalsPage.confrimStatusButtonVisible();
		proposalsPage.clickConfirmStatusButton();
		proposalsPage.waitMessageToHide();
		proposalsPage.verifyProposalAccepted();
	});
	it('Should be able to delete proposal', () => {
		proposalsPage.selectTableRow(0);
		proposalsPage.deleteProposalButtonVisible();
		proposalsPage.clickDeleteProposalButton();
		proposalsPage.confirmDeleteButtonVisible();
		proposalsPage.clickConfirmDeleteButton();
		proposalsPage.waitMessageToHide();
		proposalsPage.verifyProposalIsDeleted(editJobPostUrl);
	});
});
