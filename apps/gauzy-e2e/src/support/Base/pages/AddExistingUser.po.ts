import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementIfVisible
} from '../utils/util';
import { AddExistingUserPage } from '../pageobjects/AddExistingUserPageObject';

export const addExistingUsersButtonvisible = () => {
	verifyElementIsVisible(AddExistingUserPage.addUserButtonCss);
};

export const clickAddExistingUsersButton = () => {
	clickButton(AddExistingUserPage.addUserButtonCss);
};

export const usersMultyselectVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.usersMultyselectCss);
};

export const clickUsersMultyselect = () => {
	clickButton(AddExistingUserPage.usersMultyselectCss);
};

export const selectUsersFromDropdown = (index) => {
	clickElementIfVisible(AddExistingUserPage.checkUsersMultyselectCss, index);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickCancelButton = () => {
	clickButton(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveUsersButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.saveSelectedUsersButtonCss);
};

export const clickSaveUsersButton = () => {
	clickButton(AddExistingUserPage.saveSelectedUsersButtonCss);
};
