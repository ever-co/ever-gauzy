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
	vefiryByLength,
	verifyTextNotExisting
} from '../utils/util';
import { ApprovalRequestPage } from '../pageobjects/ApprovalRequestPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ApprovalRequestPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ApprovalRequestPage.gridButtonCss, index);
};

export const addApprovalButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickAddApprovalButton = () => {
	clickButton(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(ApprovalRequestPage.nameInputCss);
	enterInput(ApprovalRequestPage.nameInputCss, data);
};

export const minCountInputVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.minCountInputCss);
};

export const enterMinCountInputData = (data) => {
	enterInput(ApprovalRequestPage.minCountInputCss, data);
};

export const approvalPolicyDropdownVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const clickApprovalPolicyDropdown = () => {
	clickButton(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const selectApprovalPolicyOptionDropdown = (text) => {
	clickElementByText(
		ApprovalRequestPage.checkApprovalPolicyDropdownOptionCss,
		text
	);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(ApprovalRequestPage.usersMultiSelectCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(ApprovalRequestPage.checkUsersMultiSelectCss, index);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ApprovalRequestPage.saveButtonCss);
};

export const selectTableRowVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ApprovalRequestPage.selectTableRowCss, index);
};

export const editApprovalRequestButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.editApprovalRequestButtonCss);
};

export const clickEditApprovalRequestButton = () => {
	cy.intercept('GET', '/api/approval-policy/request-approval*').as('waitApproval');
	clickButton(ApprovalRequestPage.editApprovalRequestButtonCss);
	cy.wait('@waitApproval');
};

export const deleteApprovalRequestButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const clickDeleteApprovalRequestButton = () => {
	clickButton(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const approvalPolicyButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const clickApprovalPolicyButton = () => {
	clickButton(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.descriptioninputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(ApprovalRequestPage.descriptioninputCss);
	enterInput(ApprovalRequestPage.descriptioninputCss, data);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(ApprovalRequestPage.backButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ApprovalRequestPage.toastrMessageCss);
};

export const verifyApprovalpolicyExists = (text) => {
	verifyText(ApprovalRequestPage.verifyApprovalPolicyCss, text);
};

export const verifyRequestExists = (text) => {
	verifyText(ApprovalRequestPage.verifyRequestCss, text);
};

export const verifyElementIsDeleted = (text: string) => {
	verifyTextNotExisting(ApprovalRequestPage.rowCss, text);
};

export const clickSaveButtonWithForce = () =>{
	clickButtonWithForce(ApprovalRequestPage.saveButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(ApprovalRequestPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(ApprovalRequestPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(ApprovalRequestPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(ApprovalRequestPage.nameInputCss);
};

export const verifyApprovalRefuseButton = (text: string, index: number) => {
	verifyTextByIndex(ApprovalRequestPage.approvalRefuseButtonCss, text, index)
};

export const clickOnApprovalRefuseButton = (text: string) => {
	clickByText(ApprovalRequestPage.approvalRefuseButtonCss, text);
	
};

export const verifyApprovalButtonNotExist = (text: string, index: number) => {
	verifyTextNotExistByIndex(ApprovalRequestPage.approvalRefuseButtonCss, index, text)
};

export const verifyStatus = (text: string) => {
	verifyByText(ApprovalRequestPage.rowCss, text)
};

export const verifyNameInput = () => {
	verifyElementIsVisible(ApprovalRequestPage.searchByNameInputCss);
};

export const searchApprovalRequest = (text: string, length: number) => {
	clearField(ApprovalRequestPage.searchByNameInputCss);
	enterInput(ApprovalRequestPage.searchByNameInputCss, text);
	vefiryByLength(ApprovalRequestPage.approvalStatusCss, length);
};

export const clearNameSearchInput = () => {
	clearField(ApprovalRequestPage.searchByNameInputCss);
};