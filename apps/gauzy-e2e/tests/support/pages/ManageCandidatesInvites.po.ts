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
	waitForSpinnerGone
} from '../util';
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
	// Save sits in nb-card-footer of the invite dialog, right after the nb-datepicker overlay was
	// opened/closed by the appliedDate field. A coordinate click (even force) lands on the fading
	// cdk-overlay backdrop and the dialog stays open (invite never created). Dispatch the click
	// straight to the element so the (click)="add()" handler fires regardless of the backdrop.
	await dispatchClick(ManageCandidatesInvitesPage.saveButtonCss);
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

export const clickConfirmDeleteButton = async () => {
	// OK button inside the delete-confirmation nb-dialog. Dispatch the click so the (click)="delete()"
	// handler fires past the dialog's own cdk-overlay backdrop.
	await dispatchClick(ManageCandidatesInvitesPage.confirmDeleteButtonCss);
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
