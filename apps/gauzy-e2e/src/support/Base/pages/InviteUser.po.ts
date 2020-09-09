import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { InviteUserPage } from '../pageobjects/InviteUserPageObject';

export const inviteButtonVisible = () => {
	verifyElementIsVisible(InviteUserPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(InviteUserPage.inviteButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(InviteUserPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInputConditionally(InviteUserPage.emailInputCss, data);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(InviteUserPage.dateInputCss);
};

export const enterDateData = () => {
	clearField(InviteUserPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(InviteUserPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const selectRoleVisible = () => {
	verifyElementIsVisible(InviteUserPage.selectRoleDropdownCss);
};

export const chooseRoleSelectData = (data) => {
	clickButton(InviteUserPage.selectRoleDropdownCss);
	clickElementByText(InviteUserPage.selectRoleDropdownOptionCss, data);
};

export const sendInviteButtonVisible = () => {
	verifyElementIsVisible(InviteUserPage.sendInviteButtonCss);
};

export const clickSendInviteButton = () => {
	clickButton(InviteUserPage.sendInviteButtonCss);
};
