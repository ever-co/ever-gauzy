import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationEquipmentPage from './support/pages/OrganizationEquipment.po';
import { OrganizationEquipmentPageData } from '../src/support/Base/pagedata/OrganizationEquipmentPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';

// POLLUTION RESILIENCE (Round 5 #1): the suite runs serially against ONE shared DB, so by the time this spec
// runs the equipment / request / policy grids have ACCUMULATED rows from earlier specs and failed/retried
// runs. The PageData defaults ("Car", "BMW", "Default policy") are NOT unique — a leftover same-named row makes
// a blind row-0 select / verify-exists / verify-deleted grab or assert the WRONG record. Create everything with
// UNIQUE faker names and scope every downstream action (row select, verify-exists, verify-deleted) to those
// names so the spec passes in the full suite, not just in isolation (mirrors the green ApprovalRequestTest).
let equipmentName = ' ';
let requestName = ' ';
let policyName = ' ';

test.describe('Organization equipment test', () => {
	test('Organization equipment test', async () => {
		equipmentName = `Equipment ${faker.string.alphanumeric(8)}`;
		requestName = `Request ${faker.string.alphanumeric(8)}`;
		policyName = `Policy ${faker.string.alphanumeric(8)}`;

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new equipment', async () => {
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			// Robust hash navigation: a bare goto() right after the addTag CustomCommand (ends on the
			// tags route) is a same-document no-op, leaving the page on the tags screen where the shared
			// Add button selector also matches. navigateToEquipment forces the hash + waits for the
			// equipment grid header so the Add click lands on the equipment page (root cause #8).
			await organizationEquipmentPage.navigateToEquipment();
			await organizationEquipmentPage.gridBtnExists();
			await organizationEquipmentPage.gridBtnClick(1);
			await organizationEquipmentPage.addEquipmentButtonVisible();
			await organizationEquipmentPage.clickAddEquipmentButton();
			await organizationEquipmentPage.nameInputVisible();
			await organizationEquipmentPage.enterNameInputData(equipmentName);
			await organizationEquipmentPage.typeInputVisible();
			await organizationEquipmentPage.enterTypeInputData(
				OrganizationEquipmentPageData.type
			);
			await organizationEquipmentPage.serialNumberInputVisible();
			await organizationEquipmentPage.enterSerialNumberInputData(
				OrganizationEquipmentPageData.sn
			);
			await organizationEquipmentPage.manufacturedYearInputVisible();
			await organizationEquipmentPage.enterManufacturedYearInputData(
				OrganizationEquipmentPageData.year
			);
			await organizationEquipmentPage.initialCostInputVisible();
			await organizationEquipmentPage.enterInitialCostInputData(
				OrganizationEquipmentPageData.cost
			);
			await organizationEquipmentPage.sharePeriodInputVisible();
			await organizationEquipmentPage.enterSharePeriodInputData(
				OrganizationEquipmentPageData.period
			);
			await organizationEquipmentPage.tagsDropdownVisible();
			await organizationEquipmentPage.clickTagsDropdown();
			await organizationEquipmentPage.selectTagFromDropdown(0);
			await organizationEquipmentPage.clickCardBody();
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
			await organizationEquipmentPage.waitMessageToHide();
			await organizationEquipmentPage.verifyEquipmentExists(equipmentName);
		});

		await test.step('Should be able to add equipment policy', async () => {
			await organizationEquipmentPage.equipmentSharingButtonVisible();
			await organizationEquipmentPage.clickEquipmentSharingButton();
			await organizationEquipmentPage.sharingPolicyButtonVisible();
			await organizationEquipmentPage.clickSharingPolicyButton();
			await organizationEquipmentPage.addPolicyButtonVisible();
			await organizationEquipmentPage.clickAddPolicyButton();
			await organizationEquipmentPage.policyNameInputVisible();
			await organizationEquipmentPage.enterPolicyNameInputData(policyName);
			await organizationEquipmentPage.policyDescriptionInputVisible();
			await organizationEquipmentPage.enterPolicyDescriptionInputData(
				OrganizationEquipmentPageData.description
			);
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
			await organizationEquipmentPage.waitMessageToHide();
			await organizationEquipmentPage.verifyPolicyExists(policyName);
			await organizationEquipmentPage.backButtonVisible();
			await organizationEquipmentPage.clickBackButton();
		});

		await test.step('Should be able to request equipment sharing', async () => {
			await organizationEquipmentPage.requestButtonVisible();
			await organizationEquipmentPage.clickRequestButton();
			await organizationEquipmentPage.requestNameInputVisible();
			await organizationEquipmentPage.enterRequestNameInputData(requestName);
			await organizationEquipmentPage.selectEquipmentDropdownVisible();
			await organizationEquipmentPage.clickEquipmentDropdown();
			await organizationEquipmentPage.selectEquipmentFromDropdown(0);
			await organizationEquipmentPage.approvalPolicyDropdownVisible();
			await organizationEquipmentPage.clickSelectPolicyDropdown();
			await organizationEquipmentPage.selectPolicyFromDropdown(0);
			await organizationEquipmentPage.selectEmployeeDropdownVisible();
			await organizationEquipmentPage.clickEmployeeDropdown();
			await organizationEquipmentPage.selectEmployeeFromDropdown(0);
			await organizationEquipmentPage.clickKeyboardButtonByKeyCode(9);
			await organizationEquipmentPage.dateInputVisible();
			await organizationEquipmentPage.enterDateData();
			await organizationEquipmentPage.startDateInputVisible();
			await organizationEquipmentPage.enterStartDateData();
			await organizationEquipmentPage.endDateInputVisible();
			await organizationEquipmentPage.enterEndDateData();
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
			await organizationEquipmentPage.waitMessageToHide();
			await organizationEquipmentPage.verifySharingExists(requestName);
			await organizationEquipmentPage.clickBackButton();
		});

		await test.step('Should be able to edit equipment', async () => {
			await organizationEquipmentPage.tableRowVisible();
			// Select OUR equipment row by its unique name (pollution-resilient), not by index.
			await organizationEquipmentPage.selectTableRow(equipmentName);
			await organizationEquipmentPage.editButtonVisible();
			await organizationEquipmentPage.clickEditButton();
			await organizationEquipmentPage.nameInputVisible();
			await organizationEquipmentPage.enterNameInputData(equipmentName);
			await organizationEquipmentPage.typeInputVisible();
			await organizationEquipmentPage.enterTypeInputData(
				OrganizationEquipmentPageData.type
			);
			await organizationEquipmentPage.serialNumberInputVisible();
			await organizationEquipmentPage.enterSerialNumberInputData(
				OrganizationEquipmentPageData.sn
			);
			await organizationEquipmentPage.manufacturedYearInputVisible();
			await organizationEquipmentPage.enterManufacturedYearInputData(
				OrganizationEquipmentPageData.year
			);
			await organizationEquipmentPage.initialCostInputVisible();
			await organizationEquipmentPage.enterInitialCostInputData(
				OrganizationEquipmentPageData.cost
			);
			await organizationEquipmentPage.sharePeriodInputVisible();
			await organizationEquipmentPage.enterSharePeriodInputData(
				OrganizationEquipmentPageData.period
			);
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
		});

		await test.step('Should be able to edit equipment request', async () => {
			await organizationEquipmentPage.equipmentSharingButtonVisible();
			await organizationEquipmentPage.clickEquipmentSharingButton();
			// Select OUR request row by its unique name (pollution-resilient), not by index.
			await organizationEquipmentPage.selectTableRow(requestName);
			await organizationEquipmentPage.editButtonVisible();
			await organizationEquipmentPage.clickEditButton();
			await organizationEquipmentPage.requestNameInputVisible();
			await organizationEquipmentPage.enterRequestNameInputData(requestName);
			await organizationEquipmentPage.selectEquipmentDropdownVisible();
			await organizationEquipmentPage.clickEquipmentDropdown();
			await organizationEquipmentPage.selectEquipmentFromDropdown(0);
			await organizationEquipmentPage.approvalPolicyDropdownVisible();
			await organizationEquipmentPage.clickSelectPolicyDropdown();
			await organizationEquipmentPage.selectPolicyFromDropdown(0);
			await organizationEquipmentPage.selectEmployeeDropdownVisible();
			await organizationEquipmentPage.clickEmployeeDropdown();
			await organizationEquipmentPage.selectEmployeeFromDropdown(0);
			await organizationEquipmentPage.clickKeyboardButtonByKeyCode(9);
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
		});

		await test.step('Should be able to delete equipment request', async () => {
			await organizationEquipmentPage.waitMessageToHide();
			// Select + verify-deleted by OUR unique request name (the request keeps its name through the edit
			// step above, which re-entered the same requestName), not by index / whole-grid-empty.
			await organizationEquipmentPage.selectTableRow(requestName);
			await organizationEquipmentPage.deleteButtonVisible();
			await organizationEquipmentPage.clickDeleteButton();
			await organizationEquipmentPage.confirmDeleteButtonVisible();
			await organizationEquipmentPage.clickConfirmDeleteButton();
			await organizationEquipmentPage.waitMessageToHide();
			await organizationEquipmentPage.verifyEquipmentIsDeleted(requestName);
		});

		await test.step('Should be able to edit policy', async () => {
			await organizationEquipmentPage.sharingPolicyButtonVisible();
			await organizationEquipmentPage.clickSharingPolicyButton();
			// Select OUR policy row by its unique name (pollution-resilient), not by index.
			await organizationEquipmentPage.selectTableRow(policyName);
			await organizationEquipmentPage.editButtonVisible();
			await organizationEquipmentPage.clickEditButton();
			await organizationEquipmentPage.policyNameInputVisible();
			await organizationEquipmentPage.enterPolicyNameInputData(policyName);
			await organizationEquipmentPage.policyDescriptionInputVisible();
			await organizationEquipmentPage.enterPolicyDescriptionInputData(
				OrganizationEquipmentPageData.description
			);
			await organizationEquipmentPage.saveButtonVisible();
			await organizationEquipmentPage.clickSaveButton();
		});

		await test.step('Should be able to delete policy', async () => {
			await organizationEquipmentPage.waitMessageToHide();
			// Select + verify-deleted by OUR unique policy name (kept through the edit step), not by index.
			await organizationEquipmentPage.selectTableRow(policyName);
			await organizationEquipmentPage.deleteButtonVisible();
			await organizationEquipmentPage.clickDeleteButton();
			await organizationEquipmentPage.confirmDeleteButtonVisible();
			await organizationEquipmentPage.clickConfirmDeleteButton();
			await organizationEquipmentPage.waitMessageToHide();
			await organizationEquipmentPage.verifyPolicyIsDeleted(policyName);
		});
	});
});
