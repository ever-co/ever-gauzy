import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
	verifyElementIsNotVisible
} from '../utils/util';
import { OrganizationEquipmentPage } from '../pageobjects/OrganizationEquipmentPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationEquipmentPage.gridButtonCss, index);
};

export const addEquipmentButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddEqupmentButton = () => {
	clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationEquipmentPage.nameInputCss);
	enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const typeInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.typeInputCss);
};

export const enterTypeInputData = (data) => {
	clearField(OrganizationEquipmentPage.typeInputCss);
	enterInput(OrganizationEquipmentPage.typeInputCss, data);
};

export const serialNumberInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.serialNumberInputCss);
};

export const enterSerialNumberInputData = (data) => {
	clearField(OrganizationEquipmentPage.serialNumberInputCss);
	enterInput(OrganizationEquipmentPage.serialNumberInputCss, data);
};

export const manufacturedYearInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.manufacturedYearInputCss);
};

export const enterManufacturedYearInputData = (data) => {
	clearField(OrganizationEquipmentPage.manufacturedYearInputCss);
	enterInput(OrganizationEquipmentPage.manufacturedYearInputCss, data);
};

export const initialCostInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.initialCostInputCss);
};

export const enterInitialCostInputData = (data) => {
	clearField(OrganizationEquipmentPage.initialCostInputCss);
	enterInput(OrganizationEquipmentPage.initialCostInputCss, data);
};

export const sharePeriodInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.maxSharePeriodInputCss);
};

export const enterSharePeriodInputData = (data) => {
	clearField(OrganizationEquipmentPage.maxSharePeriodInputCss);
	enterInput(OrganizationEquipmentPage.maxSharePeriodInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(OrganizationEquipmentPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(OrganizationEquipmentPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(OrganizationEquipmentPage.footerCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const equipmentSharingButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const clickEquipmentSharingButton = () => {
	clickButton(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const sharingPolicyButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationEquipmentPage.equipmentSharingPolicyButtonCss
	);
};

export const clickSharingPolicyButton = () => {
	clickButton(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const addPolicyButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddPolicyButton = () => {
	clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const policyNameInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterPolicyNameInputData = (data) => {
	clearField(OrganizationEquipmentPage.nameInputCss);
	enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const policyDescriptionInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.policyDescriptionInputCss);
};

export const enterPolicyDescriptionInputData = (data) => {
	clearField(OrganizationEquipmentPage.policyDescriptionInputCss);
	enterInput(OrganizationEquipmentPage.policyDescriptionInputCss, data);
};

export const savePolicyButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSavePolicyButton = () => {
	clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(OrganizationEquipmentPage.backButtonCss);
};

export const requestButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickRequestButton = () => {
	clickButton(OrganizationEquipmentPage.addButtonCss);
};

export const requestNameInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterRequestNameInputData = (data) => {
	clearField(OrganizationEquipmentPage.nameInputCss);
	enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const selectEquipmentDropdownVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.selectEqupmentDropdownCss);
};

export const clickEquipmentDropdown = () => {
	clickButton(OrganizationEquipmentPage.selectEqupmentDropdownCss);
};

export const selectEquipmentFromDropdown = (index) => {
	clickButtonByIndex(
		OrganizationEquipmentPage.selectEquipmentDropdownOptionCss,
		index
	);
};

export const approvalPolicyDropdownVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const clickSelectPolicyDropdown = () => {
	clickButton(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const selectPolicyFromDropdown = (index) => {
	clickButtonByIndex(
		OrganizationEquipmentPage.selectPolicyDropdownOptionCss,
		index
	);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(
		OrganizationEquipmentPage.selectEmployeeDropdownOptionCss,
		index
	);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.dateInputCss);
};

export const enterDateData = () => {
	clearField(OrganizationEquipmentPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(OrganizationEquipmentPage.dateInputCss, date);
};

export const startDateInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.startDateInputCss);
};

export const enterStartDateData = () => {
	clearField(OrganizationEquipmentPage.startDateInputCss);
	const date = Cypress.moment().add(1, 'days').format('MMM D, YYYY');
	enterInput(OrganizationEquipmentPage.startDateInputCss, date);
};

export const endDateInputVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.endDateInputCss);
};

export const enterEndDateData = () => {
	clearField(OrganizationEquipmentPage.endDateInputCss);
	const date = Cypress.moment().add(2, 'days').format('MMM D, YYYY');
	enterInput(OrganizationEquipmentPage.endDateInputCss, date);
};

export const saveRequestButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveRequestButton = () => {
	clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationEquipmentPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationEquipmentPage.toastrMessageCss);
};

export const verifyPolicyExists = (text) => {
	verifyText(OrganizationEquipmentPage.verifyPolicyCss, text);
};

export const verifyPolicyIsDeleted = () => {
	verifyElementNotExist(OrganizationEquipmentPage.verifyPolicyCss);
};

export const verifySharingExists = (text) => {
	verifyText(OrganizationEquipmentPage.verifySharingCss, text);
};

export const verifySharingIsDeleted = () => {
	verifyElementNotExist(OrganizationEquipmentPage.verifySharingCss);
};

export const verifyEquipmentExists = (text) => {
	verifyText(OrganizationEquipmentPage.verifyEquipmentCss, text);
};

export const verifyEquipmentIsDeleted = () => {
	verifyElementNotExist(OrganizationEquipmentPage.verifyEquipmentCss);
};

export const waitSpinnerToDisappear = () => {
	verifyElementNotExist(OrganizationEquipmentPage.spinnerCss);
};
