import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	dispatchClickWhenSettled,
	clickWhenEnabled,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InviteUserPage } from '../../../src/support/Base/pageobjects/InviteUserPageObject';

export const inviteButtonVisible = async () => verifyElementIsVisible(InviteUserPage.inviteButtonCss);

// The Users card is `[nbSpinner]="loading"`; its overlay covers the header toolbar while the grid
// loads, and the spec clicks Invite ~1.9s after navigating. The old force-click was delivered at the
// button's coordinates, landed on the overlay, and the dialog never opened (#emails not found).
// Settle, dispatch straight at the button, and confirm the dialog opened.
export const clickInviteButton = async () =>
	// Style only: an arrow body without braces already RETURNS the promise (this was
	// never floating — the step awaits it), so this `await` changes nothing at runtime. It stays
	// because the explicit form is what every sibling helper uses, and because a future edit that adds
	// braces to the arrow would otherwise silently orphan the promise.
	await dispatchClickWhenSettled(InviteUserPage.inviteButtonCss, InviteUserPage.emailInputCss);

export const emailInputVisible = async () => verifyElementIsVisible(InviteUserPage.emailInputCss);

export const enterEmailData = async (data: string) => enterInputConditionally(InviteUserPage.emailInputCss, data);

export const dateInputVisible = async () => verifyElementIsVisible(InviteUserPage.dateInputCss);

export const enterDateData = async () => {
	await clearField(InviteUserPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(InviteUserPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const selectRoleVisible = async () => verifyElementIsVisible(InviteUserPage.selectRoleDropdownCss);

export const chooseRoleSelectData = async (data: string) => {
	await clickButton(InviteUserPage.selectRoleDropdownCss);
	await clickElementByText(InviteUserPage.selectRoleDropdownOptionCss, data);
};

export const sendInviteButtonVisible = async () => verifyElementIsVisible(InviteUserPage.sendInviteButtonCss);

export const clickSendInviteButton = async () => {
	// The send button is [disabled]="emailInviteForm.form.invalid" (emails + role required for a USER
	// invite); a forced click on a still-disabled button is dropped silently, so gate on enabled first.
	await clickWhenEnabled(InviteUserPage.sendInviteButtonCss, { force: true });
	// invite-mutation add() closes the dialog only after the invites were created (on an API error it
	// shows a danger toast and stays open). Waiting for it to close proves the invitations were sent AND
	// keeps the scenario from ending while the create request is still in flight (closing the page then
	// would abort it).
	await verifyElementNotExist(InviteUserPage.inviteDialogCss);
};
