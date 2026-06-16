import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	verifyText,
	clickElementByText,
	verifyStateByIndex
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RolesPermissionsPage } from '../../../src/support/Base/pageobjects/RolesPermissionsPageObject';

export const rolesDropdownVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.rolesDropdownCss);
};

export const clickRolesDropdown = async () => {
	await clickButton(RolesPermissionsPage.rolesDropdownCss);
};

export const rolesDropdownOptionVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.dropdownOptionCss);
};

export const selectRoleFromDropdown = async (text: string) => {
	await clickElementByText(RolesPermissionsPage.dropdownOptionCss, text);
};

export const generalSettingsCardVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.cardBodyCss);
};

export const verifyTextExist = async (text: string) => {
	await verifyText(RolesPermissionsPage.textCss, text);
};

export const verifyState = async (index: number, state: string) => {
	await verifyStateByIndex(RolesPermissionsPage.checkboxCss, index, state);
};

export const selectRoleByIndex = async (index: number) => {
	await clickButtonByIndex(RolesPermissionsPage.dropdownOptionCss, index);
};
