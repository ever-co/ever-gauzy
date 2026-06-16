import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationEquipmentPage } from '../../../src/support/Base/pageobjects/OrganizationEquipmentPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addEquipmentButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddEquipmentButton = async () => {
	await clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.nameInputCss);
	await enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const typeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.typeInputCss);
};

export const enterTypeInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.typeInputCss);
	await enterInput(OrganizationEquipmentPage.typeInputCss, data);
};

export const serialNumberInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.serialNumberInputCss);
};

export const enterSerialNumberInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.serialNumberInputCss);
	await enterInput(OrganizationEquipmentPage.serialNumberInputCss, data);
};

export const manufacturedYearInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.manufacturedYearInputCss);
};

export const enterManufacturedYearInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.manufacturedYearInputCss);
	await enterInput(OrganizationEquipmentPage.manufacturedYearInputCss, data);
};

export const initialCostInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.initialCostInputCss);
};

export const enterInitialCostInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.initialCostInputCss);
	await enterInput(OrganizationEquipmentPage.initialCostInputCss, data);
};

export const sharePeriodInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.maxSharePeriodInputCss);
};

export const enterSharePeriodInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.maxSharePeriodInputCss);
	await enterInput(OrganizationEquipmentPage.maxSharePeriodInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationEquipmentPage.footerCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const equipmentSharingButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const clickEquipmentSharingButton = async () => {
	await clickButton(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const sharingPolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const clickSharingPolicyButton = async () => {
	await clickButton(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const addPolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddPolicyButton = async () => {
	await clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const policyNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterPolicyNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.nameInputCss);
	await enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const policyDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.policyDescriptionInputCss);
};

export const enterPolicyDescriptionInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.policyDescriptionInputCss);
	await enterInput(OrganizationEquipmentPage.policyDescriptionInputCss, data);
};

export const savePolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSavePolicyButton = async () => {
	await clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(OrganizationEquipmentPage.backButtonCss);
};

export const requestButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickRequestButton = async () => {
	await clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const requestNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterRequestNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.nameInputCss);
	await enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const selectEquipmentDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectEquipmentDropdownCss);
};

export const clickEquipmentDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectEquipmentDropdownCss);
};

export const selectEquipmentFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectEquipmentDropdownOptionCss, index);
};

export const approvalPolicyDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const clickSelectPolicyDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const selectPolicyFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectPolicyDropdownOptionCss, index);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectEmployeeDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.dateInputCss);
};

export const enterDateData = async () => {
	await clearField(OrganizationEquipmentPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.dateInputCss, date);
};

export const startDateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.startDateInputCss);
};

export const enterStartDateData = async () => {
	await clearField(OrganizationEquipmentPage.startDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.startDateInputCss, date);
};

export const endDateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.endDateInputCss);
};

export const enterEndDateData = async () => {
	await clearField(OrganizationEquipmentPage.endDateInputCss);
	const date = dayjs().add(2, 'days').format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.endDateInputCss, date);
};

export const saveRequestButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveRequestButton = async () => {
	await clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationEquipmentPage.toastrMessageCss);
};

export const verifyPolicyExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifyPolicyCss, text);
};

export const verifyPolicyIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifyPolicyCss);
};

export const verifySharingExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifySharingCss, text);
};

export const verifySharingIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifySharingCss);
};

export const verifyEquipmentExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifyEquipmentCss, text);
};

export const verifyEquipmentIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifyEquipmentCss);
};

export const waitSpinnerToDisappear = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.spinnerCss);
};
