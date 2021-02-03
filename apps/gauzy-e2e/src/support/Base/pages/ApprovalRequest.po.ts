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
	verifyElementNotExist
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
	clearField(ApprovalRequestPage.minCountInputCss);
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
	verifyElementIsVisible(ApprovalRequestPage.usersMultyselectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(ApprovalRequestPage.usersMultyselectCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(ApprovalRequestPage.checkUsersMultyselectCss, index);
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
	clickButton(ApprovalRequestPage.editApprovalRequestButtonCss);
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

export const verifyElementIsDeleted = () => {
	verifyElementNotExist(ApprovalRequestPage.verifyRequestCss);
};
