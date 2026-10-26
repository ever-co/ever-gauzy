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
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone,
	clickAndAwaitDialogClose,
	scopeGridTo
} from '../util';
import { expect } from '@playwright/test';
import { getPage } from '../page-context';
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
	// Send sits in the invite dialog footer, right after the nb-datepicker overlay was opened/closed by
	// the appliedDate field. A coordinate click (even force) lands on the fading cdk-overlay backdrop and
	// the dialog stays open (invite never created), so the click is dispatched straight to the element.
	// The button is [disabled] while the email form is invalid: clickAndAwaitDialogClose waits for it to be
	// enabled, dispatches (click)="add()", and waits for ga-invite-mutation to detach (add() only closes the
	// dialog once the invites were saved). Whether the invite really exists is asserted by the next steps.
	await clickAndAwaitDialogClose(ManageCandidatesInvitesPage.saveButtonCss, ManageCandidatesInvitesPage.inviteDialogCss);
};

// Narrow the server-paginated invites grid to this scenario's email (best-effort: no-op when the grid has
// no filter row). Invites accumulate across scenarios on the shared serial DB, so the new one is not
// guaranteed to be on page 1; the email filter is a server-side ILIKE, so case differences don't matter.
export const scopeGridToInvite = async (email: string) => {
	await scopeGridTo(ManageCandidatesInvitesPage.emailFilterInputCss, email);
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
	// Selecting a grid row toggles selection and enables the toolbar (Resend/Delete are
	// [disabled]="disableButton"). Settle the grid first so the row isn't re-rendered out from under the
	// click (which would lose selection), then click once and poll the Delete toolbar button's real
	// `disabled` attr; only re-click if selection didn't take. Never rapid re-click — that toggles it off.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	const row = getPage().locator(ManageCandidatesInvitesPage.selectTableRowCss).filter({ hasText: text }).first();
	const toolbarBtn = getPage().locator(ManageCandidatesInvitesPage.deleteInviteButtonCss).first();

	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await toolbarBtn.getAttribute('disabled');
		if (disabled === null) return; // enabled -> row is selected
		await getPage().waitForTimeout(800);
		if (i === 2) await row.click({ force: true }); // single deliberate re-click if selection was lost
	}
};

export const resendButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const clickResendButton = async () => {
	// Toolbar Resend button: dispatch the click so the (click)="resendInvite()" handler fires even if
	// a fading backdrop from the just-closed invite dialog still overlays the toolbar.
	await dispatchClick(ManageCandidatesInvitesPage.resendInviteButtonCss);
};

export const confirmResendButtonVisible = async () => {
	await verifyElementIsVisible(
		ManageCandidatesInvitesPage.confirmResendInviteButtonCss
	);
};

export const clickConfirmResendButton = async () => {
	// OK button inside the resend-confirmation nb-dialog. Dispatch the click so the (click)="confirm()"
	// handler fires past the dialog's own cdk-overlay backdrop.
	await dispatchClick(ManageCandidatesInvitesPage.confirmResendInviteButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const clickDeleteButton = async () => {
	// Toolbar Delete button: dispatch the click so the (click)="deleteInvite()" handler fires even if
	// a fading backdrop from the just-closed resend dialog still overlays the toolbar.
	await dispatchClick(ManageCandidatesInvitesPage.deleteInviteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
};

// The invite delete dialog (ga-invite-delete-confirmation) asks to type the invitee's email back before
// its Delete button enables (an irreversible revoke). Type the exact email and wait for the button to
// enable, so the confirmation that follows is a real one.
export const enterDeleteConfirmation = async (email: string) => {
	const input = getPage().locator(ManageCandidatesInvitesPage.deleteConfirmationInputCss).first();
	await input.waitFor({ state: 'visible', timeout: 24000 });
	await input.fill(String(email));
	await expect(getPage().locator(ManageCandidatesInvitesPage.confirmDeleteButtonCss).first()).toBeEnabled({
		timeout: 24000
	});
};

export const clickConfirmDeleteButton = async () => {
	// Delete button inside the delete-confirmation nb-dialog. Dispatched so the (click)="delete()" handler
	// fires past the dialog's own cdk-overlay backdrop; then wait for the dialog to close (it closes with
	// 'ok', which is what triggers the DELETE request).
	await clickAndAwaitDialogClose(
		ManageCandidatesInvitesPage.confirmDeleteButtonCss,
		ManageCandidatesInvitesPage.deleteDialogCss
	);
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
