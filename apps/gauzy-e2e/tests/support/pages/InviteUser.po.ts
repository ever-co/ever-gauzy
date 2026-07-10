import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InviteUserPage } from '../../../src/support/Base/pageobjects/InviteUserPageObject';

export const inviteButtonVisible = async () => verifyElementIsVisible(InviteUserPage.inviteButtonCss);

export const clickInviteButton = async () => clickButton(InviteUserPage.inviteButtonCss);

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
