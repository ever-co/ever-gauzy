import { When } from '../../support/bdd';
import * as organizationEquipmentPage from '../../support/pages/OrganizationEquipment.po';
import { OrganizationEquipmentPageData } from '../../../src/support/Base/pagedata/OrganizationEquipmentPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain OrganizationEquipmentTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background step
// is defined once in common.steps.ts.

// POLLUTION RESILIENCE (Round 5 #1): the suite runs serially against ONE shared DB, so by the time this spec
// runs the equipment / request / policy grids have ACCUMULATED rows from earlier specs and failed/retried
// runs. The PageData defaults ("Car", "BMW", "Default policy") are NOT unique — a leftover same-named row makes
// a blind row-0 select / verify-exists / verify-deleted grab or assert the WRONG record. Create everything with
// UNIQUE faker names and scope every downstream action (row select, verify-exists, verify-deleted) to those
// names so the spec passes in the full suite, not just in isolation (mirrors the green ApprovalRequestTest).
let equipmentName = ' ';
let requestName = ' ';
let policyName = ' ';

When('I add a new equipment', async () => {
	equipmentName = `Equipment ${faker.string.alphanumeric(8)}`;
	requestName = `Request ${faker.string.alphanumeric(8)}`;
	policyName = `Policy ${faker.string.alphanumeric(8)}`;

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

When('I add an equipment sharing policy', async () => {
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

When('I request equipment sharing', async () => {
	await organizationEquipmentPage.requestButtonVisible();
	await organizationEquipmentPage.clickRequestButton();
	await organizationEquipmentPage.requestNameInputVisible();
	await organizationEquipmentPage.enterRequestNameInputData(requestName);
	await organizationEquipmentPage.selectEquipmentDropdownVisible();
	await organizationEquipmentPage.clickEquipmentDropdown();
	// Pick OUR uniquely-named equipment by name (not index-0): the request grid identifies each
	// row by sharing.equipment.name, so on the polluted shared grid a blind index-0 would attach a
	// different equipment and break the by-name verify / row-select / verify-deleted steps below.
	await organizationEquipmentPage.selectEquipmentFromDropdownByName(equipmentName);
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
	// The sharing grid's first column renders sharing.equipment.name — NOT the request's own `name`
	// (EquipmentSharingComponent resultMap). Verify by the equipment name; requestName never renders.
	await organizationEquipmentPage.verifySharingExists(equipmentName);
	await organizationEquipmentPage.clickBackButton();
});

When('I edit the equipment', async () => {
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

When('I edit the equipment sharing request', async () => {
	await organizationEquipmentPage.equipmentSharingButtonVisible();
	await organizationEquipmentPage.clickEquipmentSharingButton();
	// The sharing grid shows sharing.equipment.name, so OUR request row is found by the unique
	// EQUIPMENT name (not the request's own name, which the grid never renders), pollution-resilient.
	await organizationEquipmentPage.selectTableRow(equipmentName);
	await organizationEquipmentPage.editButtonVisible();
	await organizationEquipmentPage.clickEditButton();
	await organizationEquipmentPage.requestNameInputVisible();
	await organizationEquipmentPage.enterRequestNameInputData(requestName);
	await organizationEquipmentPage.selectEquipmentDropdownVisible();
	await organizationEquipmentPage.clickEquipmentDropdown();
	// Pick OUR uniquely-named equipment by name (not index-0): the request grid identifies each
	// row by sharing.equipment.name, so on the polluted shared grid a blind index-0 would attach a
	// different equipment and break the by-name verify / row-select / verify-deleted steps below.
	await organizationEquipmentPage.selectEquipmentFromDropdownByName(equipmentName);
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

When('I delete the equipment sharing request', async () => {
	await organizationEquipmentPage.waitMessageToHide();
	// Select + verify-deleted by OUR unique EQUIPMENT name — the sharing grid renders
	// sharing.equipment.name for the request row (not its own name), and only THIS spec's request
	// references THIS unique equipment, so its absence (count 0) proves the request was deleted.
	await organizationEquipmentPage.selectTableRow(equipmentName);
	await organizationEquipmentPage.deleteButtonVisible();
	await organizationEquipmentPage.clickDeleteButton();
	await organizationEquipmentPage.confirmDeleteButtonVisible();
	await organizationEquipmentPage.clickConfirmDeleteButton();
	await organizationEquipmentPage.waitMessageToHide();
	await organizationEquipmentPage.verifyEquipmentIsDeleted(equipmentName);
});

When('I edit the equipment sharing policy', async () => {
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

When('I delete the equipment sharing policy', async () => {
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
