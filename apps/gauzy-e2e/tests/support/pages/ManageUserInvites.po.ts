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
	waitForSpinnerGone,
	clickElementByText,
	clickWhenEnabled,
	dispatchClickWhenSettled,
	scopeGridTo,
	verifyElementNotExist,
	verifyTextNotExisting
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

export const clickTableRow = async (index: number, text?: string) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Copy/Resend/Delete are gated on
	// the selected invite). Settle the grid first so the row isn't re-rendered out from under the click
	// (which would lose selection), then click once and poll the Delete toolbar button's real `disabled`
	// attr; only re-click if selection didn't take. Never rapid re-click — that toggles it back off.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	// Prefer the invite this scenario created (`text` = its email): it is INVITED and carries a token,
	// so Copy link + Resend render for it. Otherwise Copy + Resend only render for an invite whose status
	// is INVITED (seeded invites get a RANDOM status, so a blind nth(0) can land on ACCEPTED/EXPIRED and
	// those buttons never appear): prefer a row whose status cell reads "INVITED", and fall back to the
	// requested index if none is shown.
	const rows = getPage().locator(ManageUserInvitesPage.selectTableRowCss);
	let row = rows.nth(index);
	if (text) {
		// The caller asked for ITS invite: wait for that row and fail if it never shows. Falling back to
		// another row would copy/resend/delete an unrelated invite and still pass (the delete dialog's
		// type-to-confirm phrase is read from whichever invite was selected).
		row = rows.filter({ hasText: text }).first();
		await row.waitFor({ state: 'visible', timeout: 24_000 }).catch(() => {
			throw new Error(`clickTableRow: no invite row for "${text}" in the invites grid.`);
		});
	} else {
		const invitedRows = rows.filter({ hasText: 'INVITED' });
		if ((await invitedRows.count()) > 0) {
			row = invitedRows.first();
		}
	}
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

// The invite delete dialog (InviteDeleteConfirmationComponent, #10761) keeps Delete disabled, and its
// delete() returns early, until the invitee's email is typed back exactly. Read the phrase the dialog
// asks for and type it, as a user has to. Remembered so the confirm step can prove that row is gone.
let deletedInvitePhrase = '';
export const typeDeleteConfirmation = async (): Promise<string> => {
	const phrase = getPage().locator(ManageUserInvitesPage.deleteConfirmationPhraseCss).first();
	await phrase.waitFor({ state: 'visible', timeout: 24_000 });
	deletedInvitePhrase = ((await phrase.textContent()) || '').trim();
	await enterInput(ManageUserInvitesPage.deleteConfirmationInputCss, deletedInvitePhrase);
	return deletedInvitePhrase;
};

export const clickConfirmDeleteInviteButton = async () => {
	// Delete is enabled only once the typed email matches; gate on that, then click it.
	await clickWhenEnabled(ManageUserInvitesPage.confirmDeleteInviteButtonCss, { force: true });
	// delete() closes the dialog with 'ok' only for a confirmed phrase; the page then deletes the invite
	// and reloads the grid. Prove both: the dialog closed and the deleted invite's row is gone.
	await verifyElementNotExist(ManageUserInvitesPage.deleteInviteDialogCss);
	if (deletedInvitePhrase) {
		await verifyTextNotExisting(ManageUserInvitesPage.selectTableRowCss, deletedInvitePhrase);
	}
};

export const waitMessageToHide = async () => waitElementToHide(ManageUserInvitesPage.toastrMessageCss);

export const inviteButtonVisible = async () => verifyElementIsVisible(ManageUserInvitesPage.inviteButtonCss);

export const clickInviteButton = async () =>
	// The invites card is [nbSpinner]="loading" while the grid loads; settle, dispatch at the header
	// Invite button and confirm the invite dialog opened (its #emails tag input).
	dispatchClickWhenSettled(ManageUserInvitesPage.inviteButtonCss, ManageUserInvitesPage.emailInputCss);

// Narrow the invites grid to one email (server-side LIKE on the Email column filter) so the invite this
// scenario created is on page 1 whatever else earlier specs left in the shard's DB. Best-effort: when the
// filter row is absent the grid is left as is and clickTableRow still prefers the row with that email.
export const filterByEmail = async (email: string) => {
	await scopeGridTo(ManageUserInvitesPage.emailFilterInputCss, email);
};

/**
 * Create a USER invite through the invites page's own Invite dialog (the same InviteMutationComponent the
 * Users page opens) and wait until it was sent.
 *
 * The scenario used to find its invites already in the grid: from the DEMO seed's random invites or from
 * invite-user.feature running earlier in the same shard. CI seeds with DEMO=false (seedBasicDefaultData
 * creates no invites) and invite-user runs in another shard, so on stage run 40364004456 the grid read
 * "You have not invited any users." and there was nothing to copy, resend or delete. Creating the invite
 * here makes the scenario independent of seed and shard order; a fresh invite is INVITED and carries a
 * token, so Copy link and Resend render for it.
 */
export const createUserInvite = async (email: string, role: string) => {
	await clickInviteButton();
	await enterEmailInputData(email);
	await clickButton(ManageUserInvitesPage.rolesInputCss);
	await clickElementByText(ManageUserInvitesPage.rolesDropdownCss, role);
	await clickSaveButton();
};

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

export const clickSaveButton = async () => {
	// Send is [disabled]="emailInviteForm.form.invalid" (an email tag + a role are required for a USER
	// invite); gate on enabled, then wait for the dialog to close: invite-mutation add() closes it only
	// once the invites were created.
	await clickWhenEnabled(ManageUserInvitesPage.saveButtonCss, { force: true });
	await verifyElementNotExist(ManageUserInvitesPage.inviteDialogCss);
};

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
