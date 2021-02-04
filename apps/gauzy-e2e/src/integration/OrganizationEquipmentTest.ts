import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationEquipmentPage from '../support/Base/pages/OrganizationEquipment.po';
import { OrganizationEquipmentPageData } from '../support/Base/pagedata/OrganizationEquipmentPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

describe('Organization equipment test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new equipment', () => {
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/organization/equipment');
		organizationEquipmentPage.gridBtnExists();
		organizationEquipmentPage.gridBtnClick(1);
		organizationEquipmentPage.addEquipmentButtonVisible();
		organizationEquipmentPage.clickAddEqupmentButton();
		organizationEquipmentPage.nameInputVisible();
		organizationEquipmentPage.enterNameInputData(
			OrganizationEquipmentPageData.name
		);
		organizationEquipmentPage.typeInputVisible();
		organizationEquipmentPage.enterTypeInputData(
			OrganizationEquipmentPageData.type
		);
		organizationEquipmentPage.serialNumberInputVisible();
		organizationEquipmentPage.enterSerialNumberInputData(
			OrganizationEquipmentPageData.sn
		);
		organizationEquipmentPage.manufacturedYearInputVisible();
		organizationEquipmentPage.enterManufacturedYearInputData(
			OrganizationEquipmentPageData.year
		);
		organizationEquipmentPage.initialCostInputVisible();
		organizationEquipmentPage.enterInitialCostInputData(
			OrganizationEquipmentPageData.cost
		);
		organizationEquipmentPage.sharePeriodInputVisible();
		organizationEquipmentPage.enterSharePeriodInputData(
			OrganizationEquipmentPageData.period
		);
		organizationEquipmentPage.tagsDropdownVisible();
		organizationEquipmentPage.clickTagsDropdwon();
		organizationEquipmentPage.selectTagFromDropdown(0);
		organizationEquipmentPage.clickCardBody();
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.verifyEquipmentExists(
			OrganizationEquipmentPageData.name
		);
	});
	it('Should be able to add equipment policy', () => {
		organizationEquipmentPage.equipmentSharingButtonVisible();
		organizationEquipmentPage.clickEquipmentSharingButton();
		organizationEquipmentPage.sharingpolicyButtonVisible();
		organizationEquipmentPage.clickSharingPolicyButton();
		organizationEquipmentPage.addPolicyButtonVisible();
		organizationEquipmentPage.clickAddPolicyButton();
		organizationEquipmentPage.policyNameInputVisible();
		organizationEquipmentPage.enterPolicyNameInputData(
			OrganizationEquipmentPageData.policy
		);
		organizationEquipmentPage.policyDescriptionInputVisible();
		organizationEquipmentPage.enterPolicyDescriptionInputData(
			OrganizationEquipmentPageData.description
		);
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.verifyPolicyExists(
			OrganizationEquipmentPageData.policy
		);
		organizationEquipmentPage.backButtonVisible();
		organizationEquipmentPage.clickBackButton();
	});
	it('Should be able to request equipment sharing', () => {
		organizationEquipmentPage.requestButtonVisible();
		organizationEquipmentPage.clickRequestButton();
		organizationEquipmentPage.requestNameInputVisible();
		organizationEquipmentPage.enterRequestNameInputData(
			OrganizationEquipmentPageData.requestName
		);
		organizationEquipmentPage.selectEquipmentDropdownVisible();
		organizationEquipmentPage.clickEquipmentDropdown();
		organizationEquipmentPage.selectEquipmentFromDropdown(0);
		organizationEquipmentPage.approvalPolicyDropdownVisible();
		organizationEquipmentPage.clickSelectPolicyDropdown();
		organizationEquipmentPage.selectPolicyFromDropdown(0);
		organizationEquipmentPage.selectEmployeeDropdownVisible();
		organizationEquipmentPage.clickEmployeeDropdown();
		organizationEquipmentPage.selectEmployeeFromDrodpwon(0);
		organizationEquipmentPage.clickKeyboardButtonByKeyCode(9);
		organizationEquipmentPage.dateInputVisible();
		organizationEquipmentPage.enterDateData();
		organizationEquipmentPage.startDateInputVisible();
		organizationEquipmentPage.enterStartDateData();
		organizationEquipmentPage.endDateInputVisible();
		organizationEquipmentPage.enterEndDateData();
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.verifySharingExists(
			OrganizationEquipmentPageData.requestName
		);
		organizationEquipmentPage.clickBackButton();
	});
	it('Should be able to edit equipment', () => {
		organizationEquipmentPage.tableRowVisible();
		organizationEquipmentPage.selectTableRow(0);
		organizationEquipmentPage.editButtonVisible();
		organizationEquipmentPage.clickEditButton();
		organizationEquipmentPage.nameInputVisible();
		organizationEquipmentPage.enterNameInputData(
			OrganizationEquipmentPageData.name
		);
		organizationEquipmentPage.typeInputVisible();
		organizationEquipmentPage.enterTypeInputData(
			OrganizationEquipmentPageData.type
		);
		organizationEquipmentPage.serialNumberInputVisible();
		organizationEquipmentPage.enterSerialNumberInputData(
			OrganizationEquipmentPageData.sn
		);
		organizationEquipmentPage.manufacturedYearInputVisible();
		organizationEquipmentPage.enterManufacturedYearInputData(
			OrganizationEquipmentPageData.year
		);
		organizationEquipmentPage.initialCostInputVisible();
		organizationEquipmentPage.enterInitialCostInputData(
			OrganizationEquipmentPageData.cost
		);
		organizationEquipmentPage.sharePeriodInputVisible();
		organizationEquipmentPage.enterSharePeriodInputData(
			OrganizationEquipmentPageData.period
		);
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
	});
	it('Should be able to edit equipment request', () => {
		organizationEquipmentPage.equipmentSharingButtonVisible();
		organizationEquipmentPage.clickEquipmentSharingButton();
		organizationEquipmentPage.selectTableRow(0);
		organizationEquipmentPage.editButtonVisible();
		organizationEquipmentPage.clickEditButton();
		organizationEquipmentPage.requestNameInputVisible();
		organizationEquipmentPage.enterRequestNameInputData(
			OrganizationEquipmentPageData.requestName
		);
		organizationEquipmentPage.selectEquipmentDropdownVisible();
		organizationEquipmentPage.clickEquipmentDropdown();
		organizationEquipmentPage.selectEquipmentFromDropdown(0);
		organizationEquipmentPage.approvalPolicyDropdownVisible();
		organizationEquipmentPage.clickSelectPolicyDropdown();
		organizationEquipmentPage.selectPolicyFromDropdown(0);
		organizationEquipmentPage.selectEmployeeDropdownVisible();
		organizationEquipmentPage.clickEmployeeDropdown();
		organizationEquipmentPage.selectEmployeeFromDrodpwon(0);
		organizationEquipmentPage.clickKeyboardButtonByKeyCode(9);
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
	});
	it('Should be able to delete equipment request', () => {
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.selectTableRow(0);
		organizationEquipmentPage.deleteButtonVisible();
		organizationEquipmentPage.clickDeleteButton();
		organizationEquipmentPage.confirmDeleteButtonVisible();
		organizationEquipmentPage.clickConfirmDeleteButton();
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.verifyEquipmentIsDeleted();
	});
	it('Should be able to edit policy', () => {
		organizationEquipmentPage.sharingpolicyButtonVisible();
		organizationEquipmentPage.clickSharingPolicyButton();
		organizationEquipmentPage.selectTableRow(0);
		organizationEquipmentPage.editButtonVisible();
		organizationEquipmentPage.clickEditButton();
		organizationEquipmentPage.policyNameInputVisible();
		organizationEquipmentPage.enterPolicyNameInputData(
			OrganizationEquipmentPageData.policy
		);
		organizationEquipmentPage.policyDescriptionInputVisible();
		organizationEquipmentPage.enterPolicyDescriptionInputData(
			OrganizationEquipmentPageData.description
		);
		organizationEquipmentPage.saveButtonVisible();
		organizationEquipmentPage.clickSaveButton();
	});
	it('Should be able to delete policy', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.selectTableRow(0);
		organizationEquipmentPage.deleteButtonVisible();
		organizationEquipmentPage.clickDeleteButton();
		organizationEquipmentPage.confirmDeleteButtonVisible();
		organizationEquipmentPage.clickConfirmDeleteButton();
		organizationEquipmentPage.waitMessageToHide();
		organizationEquipmentPage.verifyPolicyIsDeleted();
	});
});
