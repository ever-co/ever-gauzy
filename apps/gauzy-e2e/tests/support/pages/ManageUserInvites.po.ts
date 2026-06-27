import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clickButtonByIndex,
	waitElementToHide,
	enterInputConditionally,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyByText,
	verifyByLength,
	dispatchClick,
	waitForSpinnerGone
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
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tableBodyExists = async () => verifyElementIsVisibleByIndex(ManageUserInvitesPage.selectTableRowCss, 0);

export const clickTableRow = async (index: number) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Copy/Resend/Delete are gated on
	// the selected invite). Settle the grid first so the row isn't re-rendered out from under the click
	// (which would lose selection), then click once and poll the Delete toolbar button's real `disabled`
	// attr; only re-click if selection didn't take. Never rapid re-click — that toggles it back off.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	// Copy + Resend only render for an invite whose status is INVITED (the seed assigns each invite a
	// RANDOM status, so a blind nth(0) often lands on ACCEPTED/EXPIRED and those buttons never appear).
	// Prefer a row whose status cell reads "INVITED"; fall back to the requested index if none is shown.
	const invitedRows = getPage()
		.locator(ManageUserInvitesPage.selectTableRowCss)
		.filter({ hasText: 'INVITED' });
	const row = (await invitedRows.count()) > 0
		? invitedRows.first()
		: getPage().locator(ManageUserInvitesPage.selectTableRowCss).nth(index);
	const toolbarBtn = getPage().locator(ManageUserInvitesPage.deleteInviteButtonCss).first();

	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await toolbarBtn.getAttribute('disabled');
		if (disabled === null) return; // enabled -> row is selected
		await getPage().waitForTimeout(800);
		if (i === 2) await row.click({ force: true }); // single deliberate re-click if selection was lost
	}
};

export const copyLinkButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.copyLinkButtonCss);

export const clickCopyLinkButton = async () =>
	// Toolbar Copy-link button: dispatch so (click)="copyToClipboard()" fires even if a fading overlay
	// backdrop still sits over the toolbar after grid settle.
	dispatchClick(ManageUserInvitesPage.copyLinkButtonCss);

export const resendInviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.resendInviteButtonCss);

export const clickResendInviteButton = async () =>
	// Toolbar Resend button: dispatch so (click)="resendInvite()" fires even when a fading cdk-overlay
	// backdrop from the just-cancelled resend dialog still overlays the toolbar (the spec re-clicks this
	// right after closing the dialog).
	dispatchClick(ManageUserInvitesPage.resendInviteButtonCss);

export const cancelResendInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.cancelResendInviteButtonCss);

export const clickCancelResendInviteButton = async () =>
	// Cancel inside the resend-confirmation nb-dialog: dispatch past the dialog's own backdrop.
	dispatchClick(ManageUserInvitesPage.cancelResendInviteButtonCss);

export const confirmResendInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.confirmResendInviteButtonCss);

export const clickConfirmResendInviteButton = async () =>
	// OK inside the resend-confirmation nb-dialog: dispatch so (click)="confirm()" fires past the
	// dialog's own backdrop.
	dispatchClick(ManageUserInvitesPage.confirmResendInviteButtonCss);

export const deleteInviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.deleteInviteButtonCss);

export const clickDeleteInviteButton = async () =>
	// Toolbar Delete button: dispatch so (click)="deleteInvite()" fires even when a fading backdrop from
	// the just-closed resend/delete dialog still overlays the toolbar (the spec re-clicks after cancel).
	dispatchClick(ManageUserInvitesPage.deleteInviteButtonCss);

export const cancelDeleteInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.cancelDeleteInviteButtonCss);

export const clickCancelDeleteInviteButton = async () =>
	// Cancel inside the delete-confirmation nb-dialog: dispatch past the dialog's own backdrop.
	dispatchClick(ManageUserInvitesPage.cancelDeleteInviteButtonCss);

export const confirmDeleteInviteButtonVisible = async () =>
	verifyElementIsVisible(ManageUserInvitesPage.confirmDeleteInviteButtonCss);

export const clickConfirmDeleteInviteButton = async () =>
	// OK inside the delete-confirmation nb-dialog: dispatch so (click)="delete()" fires past the
	// dialog's own backdrop.
	dispatchClick(ManageUserInvitesPage.confirmDeleteInviteButtonCss);

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
