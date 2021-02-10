import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	verifyText,
	clickElementByText,
	verifyStateByIndex
} from '../utils/util';
import { RolesPermissionsPage } from '../pageobjects/RolesPermissionsPageObject';

export const rolesDropdownVisible = () => {
	verifyElementIsVisible(RolesPermissionsPage.rolesDropdownCss);
};

export const clickRolesDropdown = () => {
	clickButton(RolesPermissionsPage.rolesDropdownCss);
};

export const rolesDropdownOptionVisible = () => {
	verifyElementIsVisible(RolesPermissionsPage.dropdownOptionCss);
};

export const selectRoleFromDropdown = (text) => {
	clickElementByText(RolesPermissionsPage.dropdownOptionCss, text);
};

export const generalSettingsCardVisible = () => {
	verifyElementIsVisible(RolesPermissionsPage.cardBodyCss);
};

export const verifyTextExist = (text) => {
	verifyText(RolesPermissionsPage.textCss, text);
};

export const verifyState = (index, state) => {
	verifyStateByIndex(RolesPermissionsPage.checkboxCss, index, state);
};

export const selectRoleByIndex = (index) => {
	clickButtonByIndex(RolesPermissionsPage.dropdownOptionCss, index);
};
