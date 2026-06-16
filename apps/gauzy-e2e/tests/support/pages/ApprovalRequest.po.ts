import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	clickButtonWithForce,
	clickByText,
	verifyTextByIndex,
	verifyTextNotExistByIndex,
	verifyByText,
	verifyByLength,
	verifyTextNotExisting
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ApprovalRequestPage } from '../../../src/support/Base/pageobjects/ApprovalRequestPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.gridButtonCss);
};

export const gridBtnClick = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.gridButtonCss, index);
};

export const addApprovalButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickAddApprovalButton = async () => {
	await clickButton(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ApprovalRequestPage.nameInputCss);
	await enterInput(ApprovalRequestPage.nameInputCss, data);
};

export const minCountInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.minCountInputCss);
};

export const enterMinCountInputData = async (data) => {
	await enterInput(ApprovalRequestPage.minCountInputCss, data);
};

export const approvalPolicyDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const clickApprovalPolicyDropdown = async () => {
	await clickButton(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const selectApprovalPolicyOptionDropdown = async (text) => {
	await clickElementByText(ApprovalRequestPage.checkApprovalPolicyDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(ApprovalRequestPage.usersMultiSelectCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.checkUsersMultiSelectCss, index);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(ApprovalRequestPage.saveButtonCss);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.selectTableRowCss, index);
};

export const editApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.editApprovalRequestButtonCss);
};

export const clickEditApprovalRequestButton = async () => {
	const page = getPage();
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/approval-policy/request-approval')),
		clickButton(ApprovalRequestPage.editApprovalRequestButtonCss)
	]);
};

export const deleteApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const clickDeleteApprovalRequestButton = async () => {
	await clickButton(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const approvalPolicyButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const clickApprovalPolicyButton = async () => {
	await clickButton(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(ApprovalRequestPage.descriptionInputCss);
	await enterInput(ApprovalRequestPage.descriptionInputCss, data);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(ApprovalRequestPage.backButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ApprovalRequestPage.toastrMessageCss);
};

export const verifyApprovalPolicyExists = async (text) => {
	await verifyText(ApprovalRequestPage.verifyApprovalPolicyCss, text);
};

export const verifyRequestExists = async (text) => {
	await verifyText(ApprovalRequestPage.verifyRequestCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(ApprovalRequestPage.tableBodyCss, text);
};

export const clickSaveButtonWithForce = async () => {
	await clickButtonWithForce(ApprovalRequestPage.saveButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ApprovalRequestPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(ApprovalRequestPage.nameInputCss);
};

export const verifyApprovalRefuseButton = async (text: string, index: number) => {
	await verifyTextByIndex(ApprovalRequestPage.approvalRefuseButtonCss, text, index);
};

export const clickOnApprovalRefuseButton = async (text: string) => {
	await clickByText(ApprovalRequestPage.approvalRefuseButtonCss, text);
};

export const verifyApprovalButtonNotExist = async (text: string, index: number) => {
	await verifyTextNotExistByIndex(ApprovalRequestPage.approvalRefuseButtonCss, index, text);
};

export const verifyStatus = async (text: string) => {
	await verifyByText(ApprovalRequestPage.rowCss, text);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.searchByNameInputCss);
};

export const searchApprovalRequest = async (text: string, length: number) => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
	await enterInput(ApprovalRequestPage.searchByNameInputCss, text);
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};

export const clearNameSearchInput = async () => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
};

export const waitTableLoad = async (length: number) => {
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};
