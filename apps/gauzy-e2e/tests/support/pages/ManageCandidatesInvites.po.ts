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
	verifyByLength,
	verifyTextNotExisting
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageCandidatesInvitesPage } from '../../../src/support/Base/pageobjects/ManageCandidatesInvitesPageObject';

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.emailInputCss);
};

export const enterEmailInputData = async (data) => {
	await enterInputConditionally(ManageCandidatesInvitesPage.emailInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ManageCandidatesInvitesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageCandidatesInvitesPage.dateInputCss, date);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.saveButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageCandidatesInvitesPage.toastrMessageCss);
};

export const verifyInviteExist = async (text) => {
	await verifyText(ManageCandidatesInvitesPage.verifyEmailCss, text);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.selectTableRowCss);
};

export const selectTableRow = async (text) => {
	await clickElementByText(ManageCandidatesInvitesPage.selectTableRowCss, text);
};

export const resendButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const clickResendButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const confirmResendButtonVisible = async () => {
	await verifyElementIsVisible(
		ManageCandidatesInvitesPage.confirmResendInviteButtonCss
	);
};

export const clickConfirmResendButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.confirmResendInviteButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const verifyHeaderOfThePage = async (header: string) => {
	await verifyByText(ManageCandidatesInvitesPage.headerPageCss, header);
};

export const verifyEmailPlaceholder = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.emailPlaceholderCss);
};

export const enterEmailPlaceholder = async (email: string) => {
	await enterInput(ManageCandidatesInvitesPage.emailPlaceholderCss, email);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(ManageCandidatesInvitesPage.selectTableRowCss, length);
};

export const clearEmailField = async () => {
	await clearField(ManageCandidatesInvitesPage.emailPlaceholderCss);
};

export const verifyInviteIsDeleted = async (text: string) => {
	await verifyTextNotExisting(ManageCandidatesInvitesPage.selectTableRowCss, text);
};
