import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	waitElementToHide
} from '../utils/util';
import { ManageUserInvitesPage } from '../pageobjects/ManageUserInvitesPageObject';

export const manageInvitesButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.manageInvitesButtonCss);
};

export const clickManageInvitesButton = () => {
	clickButton(ManageUserInvitesPage.manageInvitesButtonCss);
};

export const gridButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.gridButtonCss);
};

export const clickGridButton = () => {
	clickButtonByIndex(ManageUserInvitesPage.gridButtonCss, 1);
};

export const tableBodyExists = () => {
	verifyElementIsVisible(ManageUserInvitesPage.selectTableRowCss);
};

export const clickTableRow = (index) => {
	clickButtonByIndex(ManageUserInvitesPage.selectTableRowCss, index);
};

export const copyLinkButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.copyLinkButtonCss);
};

export const clickCopyLinkButton = () => {
	clickButton(ManageUserInvitesPage.copyLinkButtonCss);
};

export const resendInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.resendInviteButtonCss);
};

export const clickResendInviteButton = () => {
	clickButton(ManageUserInvitesPage.resendInviteButtonCss);
};

export const cancelResendInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.cancelResendInviteButtonCss);
};

export const clickCancelResendInviteButton = () => {
	clickButton(ManageUserInvitesPage.cancelResendInviteButtonCss);
};

export const confirmResendInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.confirmResendInviteButtonCss);
};

export const clickConfirmResendInviteButton = () => {
	clickButton(ManageUserInvitesPage.confirmResendInviteButtonCss);
};

export const deleteInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.deleteInviteButtonCss);
};

export const clickDeleteInviteButton = () => {
	clickButton(ManageUserInvitesPage.deleteInviteButtonCss);
};

export const cancelDeleteInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.cancelDeleteInviteButtonCss);
};

export const clickCancelDeleteInviteButton = () => {
	clickButton(ManageUserInvitesPage.cancelDeleteInviteButtonCss);
};

export const confirmDeleteInviteButtonVisible = () => {
	verifyElementIsVisible(ManageUserInvitesPage.confirmDeleteInviteButtonCss);
};

export const clickConfirmDeleteInviteButton = () => {
	clickButton(ManageUserInvitesPage.confirmDeleteInviteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageUserInvitesPage.toastrMessageCss);
};
