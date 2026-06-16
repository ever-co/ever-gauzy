import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	verifyText,
	verifyTextNotExisting,
	waitElementToHide,
	getLastElement
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationDepartmentsPage } from '../../../src/support/Base/pageobjects/OrganizationDepartmentsPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(OrganizationDepartmentsPage.gridButtonCss, index);
};

export const addDepartmentButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const clickAddDepartmentButton = async () => {
	await clickButton(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationDepartmentsPage.nameInputCss);
	await enterInput(OrganizationDepartmentsPage.nameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationDepartmentsPage.selectEmployeeDropdownOptionCss, index);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationDepartmentsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	//clickButtonByIndex(OrganizationDepartmentsPage.tagsDropdownOption, index);
	await getLastElement(OrganizationDepartmentsPage.tagsDropdownOption);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationDepartmentsPage.footerCss);
};

export const saveDepartmentButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const clickSaveDepartmentButton = async () => {
	await clickButton(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.selectTableRowCss);
};

export const selectTableRow = async () => {
	await getLastElement(OrganizationDepartmentsPage.selectTableRowCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const verifyDepartmentExists = async (text: string) => {
	await verifyText(OrganizationDepartmentsPage.verifyDepartmentCss, text);
};

export const verifyDepartmentIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationDepartmentsPage.verifyDepartmentCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationDepartmentsPage.toastrMessageCss);
};
