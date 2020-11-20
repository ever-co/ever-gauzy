import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as faker from 'faker';
import * as proposalsPage from '../support/Base/pages/Proposals.po';
import { ProposalsPageData } from '../support/Base/pagedata/ProposalsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

let jobPostUrl = ' ';
let jobPostContent = ' ';
let proposalContent = ' ';

describe('Proposals test', () => {
	before(() => {
		jobPostUrl = faker.internet.url();
		jobPostContent = faker.lorem.paragraph();
		proposalContent = faker.lorem.paragraph();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new proposal', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
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
	});
	it('Should be able to edit proposal', () => {
		proposalsPage.waitMessageToHide();
		proposalsPage.tableRowVisible();
		proposalsPage.selectTableRow(0);
		proposalsPage.detailsButtonVisible();
		proposalsPage.clickDetailsButton(0);
		proposalsPage.editProposalButtonVisible();
		proposalsPage.clickEditProposalButton();
		proposalsPage.jobPostInputVisible();
		proposalsPage.enterJobPostInputData(jobPostUrl);
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
	});
	it('Should be able to delete proposal', () => {
		proposalsPage.waitMessageToHide();
		proposalsPage.selectTableRow(0);
		proposalsPage.deleteProposalButtonVisible();
		proposalsPage.clickDeleteProposalButton();
		proposalsPage.confirmDeleteButtonVisible();
		proposalsPage.clickConfirmDeleteButton();
	});
});
