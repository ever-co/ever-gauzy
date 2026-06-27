import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import { faker } from '@faker-js/faker';
import * as proposalsPage from './support/pages/Proposals.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let jobPostUrl = ' ';
let editJobPostUrl = ' ';
let proposalContent = ' ';
let jobPostContent = ' ';
let contactName = ' ';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Proposals test', () => {
	test('Proposals test', async () => {
		jobPostUrl = faker.internet.url();
		editJobPostUrl = faker.internet.url();
		proposalContent = faker.lorem.paragraph();
		jobPostContent = faker.lorem.paragraph();
		contactName = faker.company.name();

		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new proposal', async () => {
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			await getPage().goto('/#/pages/sales/proposals');
			await proposalsPage.gridBtnExists();
			await proposalsPage.gridBtnClick(1);
			await proposalsPage.registerProposalButtonVisible();
			await proposalsPage.clickRegisterProposalButton();
			await proposalsPage.selectEmployeeDropdownVisible();
			await proposalsPage.clickEmployeeDropdown();
			await proposalsPage.selectEmployeeFromDropdown(1);
			// A contact is mandatory: registerProposal() dereferences organizationContact.id, so create one
			// inline via the ga-contact-select add-tag option, otherwise the create silently no-ops.
			await proposalsPage.selectContactFromDropdown(contactName);
			await proposalsPage.jobPostInputVisible();
			await proposalsPage.enterJobPostInputData(jobPostUrl);
			await proposalsPage.dateInputVisible();
			await proposalsPage.enterDateInputData();
			await proposalsPage.tagsDropdownVisible();
			await proposalsPage.clickTagsDropdown();
			await proposalsPage.selectTagFromDropdown(0);
			await proposalsPage.clickCardBody();
			// jobPostContent + proposalContent are Validators.required on the form; Save is [disabled] while
			// the form is invalid, so both CKEditors must be filled before the Save button is clickable.
			await proposalsPage.enterJobPostContentData(jobPostContent);
			await proposalsPage.enterProposalContentData(proposalContent);
			await proposalsPage.saveProposalButtonVisible();
			await proposalsPage.clickSaveProposalButton();
			await proposalsPage.waitMessageToHide();
			await proposalsPage.verifyProposalExists(jobPostUrl);
		});

		await test.step('Should be able to edit proposal', async () => {
			await proposalsPage.waitMessageToHide();
			await proposalsPage.tableRowVisible();
			await proposalsPage.selectTableRow(0);
			await proposalsPage.detailsButtonVisible();
			await proposalsPage.clickDetailsButton(0);
			await proposalsPage.editProposalButtonVisible();
			await proposalsPage.clickEditProposalButton();
			await proposalsPage.jobPostInputVisible();
			await proposalsPage.enterJobPostInputData(editJobPostUrl);
			await proposalsPage.tagsDropdownVisible();
			await proposalsPage.clickTagsDropdown();
			await proposalsPage.selectTagFromDropdown(0);
			await proposalsPage.clickCardBody();
			await proposalsPage.saveProposalButtonVisible();
			await proposalsPage.clickSaveProposalButton();
		});

		await test.step('Should be able to mark proposal as Accepted', async () => {
			await proposalsPage.waitMessageToHide();
			await proposalsPage.selectTableRow(0);
			await proposalsPage.markAsStatusButtonVisible();
			await proposalsPage.clickMarkAsStatusButton();
			await proposalsPage.confirmStatusButtonVisible();
			await proposalsPage.clickConfirmStatusButton();
			await proposalsPage.waitMessageToHide();
			await proposalsPage.verifyProposalAccepted();
		});

		await test.step('Should be able to delete proposal', async () => {
			await proposalsPage.selectTableRow(0);
			await proposalsPage.deleteProposalButtonVisible();
			await proposalsPage.clickDeleteProposalButton();
			await proposalsPage.confirmDeleteButtonVisible();
			await proposalsPage.clickConfirmDeleteButton();
			await proposalsPage.waitMessageToHide();
			await proposalsPage.verifyProposalIsDeleted(editJobPostUrl);
		});
	});
});
