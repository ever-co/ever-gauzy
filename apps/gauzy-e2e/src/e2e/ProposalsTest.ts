import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import { faker } from '@faker-js/faker';
import * as proposalsPage from '../support/Base/pages/Proposals.po';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let jobPostUrl = ' ';
let editJobPostUrl = ' ';
let proposalContent = ' ';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Proposals test', () => {
	before(() => {
		jobPostUrl = faker.internet.url();
		editJobPostUrl = faker.internet.url();
		proposalContent = faker.lorem.paragraph();

		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to add new proposal', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/sales/proposals');
		proposalsPage.gridBtnExists();
		proposalsPage.gridBtnClick(1);
		proposalsPage.registerProposalButtonVisible();
		proposalsPage.clickRegisterProposalButton();
		proposalsPage.selectEmployeeDropdownVisible();
		proposalsPage.clickEmployeeDropdown();
		proposalsPage.selectEmployeeFromDropdown(1);
		proposalsPage.jobPostInputVisible();
		proposalsPage.enterJobPostInputData(jobPostUrl);
		proposalsPage.dateInputVisible();
		proposalsPage.enterDateInputData();
		proposalsPage.tagsDropdownVisible();
		proposalsPage.clickTagsDropdown();
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
		proposalsPage.clickTagsDropdown();
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
		proposalsPage.confirmStatusButtonVisible();
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
