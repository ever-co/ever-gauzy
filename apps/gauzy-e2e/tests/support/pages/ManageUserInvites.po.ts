import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	waitElementToHide,
	enterInputConditionally,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyByText,
	verifyByLength
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { ManageUserInvitesPage } from '../../../src/support/Base/pageobjects/ManageUserInvitesPageObject';

export const manageInvitesButtonVisible = async () => {
	await getPage().waitForResponse((res) => res.url().includes('/api/user-organization'));
	await verifyElementIsVisible(ManageUserInvitesPage.manageInvitesButtonCss);
};

export const clickManageInvitesButton = async () => clickButton(ManageUserInvitesPage.manageInvitesButtonCss);

export const gridButtonVisible = async () => {
	const waitInvites = getPage().waitForResponse((res) => res.url().includes('/api/invite'));
	await verifyElementIsVisible(ManageUserInvitesPage.gridButtonCss);
	await waitInvites;
};

export const clickGridButton = async (index: number) => clickButtonByIndex(ManageUserInvitesPage.gridButtonCss, index);

export const tableBodyExists = async () => verifyElementIsVisible(ManageUserInvitesPage.selectTableRowCss);

export const clickTableRow = async (index: number) =>
	clickButtonByIndex(ManageUserInvitesPage.selectTableRowCss, index);

export const copyLinkButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.copyLinkButtonCss);

export const clickCopyLinkButton = async () => clickButton(ManageUserInvitesPage.copyLinkButtonCss);

export const resendInviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.resendInviteButtonCss);

export const clickResendInviteButton = async () => clickButton(ManageUserInvitesPage.resendInviteButtonCss);

export const cancelResendInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.cancelResendInviteButtonCss);

export const clickCancelResendInviteButton = async () =>
	clickButton(ManageUserInvitesPage.cancelResendInviteButtonCss);

export const confirmResendInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.confirmResendInviteButtonCss);

export const clickConfirmResendInviteButton = async () =>
	clickButton(ManageUserInvitesPage.confirmResendInviteButtonCss);

export const deleteInviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.deleteInviteButtonCss);

export const clickDeleteInviteButton = async () => clickButton(ManageUserInvitesPage.deleteInviteButtonCss);

export const cancelDeleteInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.cancelDeleteInviteButtonCss);

export const clickCancelDeleteInviteButton = async () =>
	clickButton(ManageUserInvitesPage.cancelDeleteInviteButtonCss);

export const confirmDeleteInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.confirmDeleteInviteButtonCss);

export const clickConfirmDeleteInviteButton = async () =>
	clickButton(ManageUserInvitesPage.confirmDeleteInviteButtonCss);

export const waitMessageToHide = async () => waitElementToHide(ManageUserInvitesPage.toastrMessageCss);

export const inviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.inviteButtonCss);

export const clickInviteButton = async () => clickButton(ManageUserInvitesPage.inviteButtonCss);

export const emailInputVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.emailInputCss);

export const enterEmailInputData = async (data: string) =>
	enterInputConditionally(ManageUserInvitesPage.emailInputCss, data);

export const dateInputVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.dateInputCss);

export const enterDateInputData = async () => {
	await clearField(ManageUserInvitesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageUserInvitesPage.dateInputCss, date);
};

export const saveButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.saveButtonCss);

export const clickSaveButton = async () => clickButton(ManageUserInvitesPage.saveButtonCss);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const verifyInviteExist = async (name: string) => {
	await verifyByLength(ManageUserInvitesPage.clientsTableRow, 1);
	await verifyByText(ManageUserInvitesPage.clientsTableData, name);
};

export const verifyRoleSelect = async () => verifyElementIsVisible(ManageUserInvitesPage.rolesInputCss);

export const clickOnRoleSelect = async () => clickButton(ManageUserInvitesPage.rolesInputCss);

export const verifyRolesDropdown = async () => verifyElementIsVisible(ManageUserInvitesPage.rolesDropdownCss);

export const clickRolesDropdown = async (index: number) =>
	clickButtonByIndex(ManageUserInvitesPage.rolesDropdownCss, index);

export const verifyEmailInput = async () => verifyElementIsVisible(ManageUserInvitesPage.searchEmailInputCss);

export const searchByEmail = async (name: string) => {
	await clearField(ManageUserInvitesPage.searchEmailInputCss);
	await enterInput(ManageUserInvitesPage.searchEmailInputCss, name);
};
