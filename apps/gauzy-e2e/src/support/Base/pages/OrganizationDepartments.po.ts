import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { OrganizationDepartmentsPage } from '../pageobjects/OrganizationDepartmentsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationDepartmentsPage.gridButtonCss, index);
};

export const addDepaartmentButtonVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const clickAddDepartmentButton = () => {
	clickButton(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationDepartmentsPage.nameInputCss);
	enterInput(OrganizationDepartmentsPage.nameInputCss, data);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(
		OrganizationDepartmentsPage.selectEmployeeDropdownCss
	);
};

export const clickEmployeeDropdown = () => {
	clickButton(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(
		OrganizationDepartmentsPage.selectEmployeeDropdownOptionCss,
		index
	);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(OrganizationDepartmentsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(OrganizationDepartmentsPage.tagsDropdownOption, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = () => {
	clickButton(OrganizationDepartmentsPage.footerCss);
};

export const saveDepartmentButtonVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const clickSaveDepartmentButton = () => {
	clickButton(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationDepartmentsPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationDepartmentsPage.deleteDepartmentButtonCss
	);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const verifyDepartmentExists = (text) => {
	verifyText(OrganizationDepartmentsPage.verifyDepartmentCss, text);
};

export const verifyDepartmentIsDeleted = (text) => {
	verifyTextNotExisting(
		OrganizationDepartmentsPage.verifyDepartmentCss,
		text
	);
};
