import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	dispatchClickWhenSettled
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InviteUserPage } from '../../../src/support/Base/pageobjects/InviteUserPageObject';

export const inviteButtonVisible = async () => verifyElementIsVisible(InviteUserPage.inviteButtonCss);

// The Users card is `[nbSpinner]="loading"`; its overlay covers the header toolbar while the grid
// loads, and the spec clicks Invite ~1.9s after navigating. The old force-click was delivered at the
// button's coordinates, landed on the overlay, and the dialog never opened (#emails not found).
// Settle, dispatch straight at the button, and confirm the dialog opened.
export const clickInviteButton = async () =>
	dispatchClickWhenSettled(InviteUserPage.inviteButtonCss, InviteUserPage.emailInputCss);

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

export const clickSendInviteButton = async () => clickButton(InviteUserPage.sendInviteButtonCss);
