import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	waitElementToHide,
	verifyText,
	enterInputConditionally,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	verifyByText,
	vefiryByLength,
	verifyTextNotExisting
} from '../utils/util';
import { ManageCandidatesInvitesPage } from '../pageobjects/ManageCandidatesInvitesPageObject';

export const inviteButtonVisible = () => {
	
	verifyElementIsVisible(ManageCandidatesInvitesPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(ManageCandidatesInvitesPage.inviteButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.emailInputCss);
};

export const enterEmailInputData = (data) => {
	enterInputConditionally(ManageCandidatesInvitesPage.emailInputCss, data);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(ManageCandidatesInvitesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	enterInput(ManageCandidatesInvitesPage.dateInputCss, date);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ManageCandidatesInvitesPage.saveButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageCandidatesInvitesPage.toastrMessageCss);
};

export const verifyInviteExist = (text) => {
	verifyText(ManageCandidatesInvitesPage.verifyEmailCss, text);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.selectTableRowCss);
};

export const selectTableRow = (text) => {
	clickElementByText(ManageCandidatesInvitesPage.selectTableRowCss, text);
};

export const resendButtonVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const clickResendButton = () => {
	clickButton(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const confirmResendButtonVisible = () => {
	verifyElementIsVisible(
		ManageCandidatesInvitesPage.confirmResendInviteButtonCss
	);
};

export const clickConfirmResendButton = () => {
	clickButton(ManageCandidatesInvitesPage.confirmResendInviteButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const verifyHeaderOfThePage = (header: string) => {
	verifyByText(ManageCandidatesInvitesPage.headerPageCss, header)
};

export const verifyEmailPlaceholder = () => {
	verifyElementIsVisible(ManageCandidatesInvitesPage.emailPlaceholderCss)
};

export const enterEmailPlaceholder = (email: string) => {
	enterInput(ManageCandidatesInvitesPage.emailPlaceholderCss, email)
}

export const verifySearchResult = (length: number) =>{
	vefiryByLength(ManageCandidatesInvitesPage.selectTableRowCss, length);
};

export const clearEmailField = () => {
	clearField(ManageCandidatesInvitesPage.emailPlaceholderCss);
};

export const verifyInviteIsDeleted = (text: string) => {
	verifyTextNotExisting(ManageCandidatesInvitesPage.selectTableRowCss, text)
}