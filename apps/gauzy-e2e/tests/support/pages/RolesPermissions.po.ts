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
	// The nbAutocomplete options render the raw role enum value (e.g. "SUPER_ADMIN"), not the
	// friendly label ("Super Admin") the pagedata supplies. Normalise label -> enum before matching:
	// uppercase + spaces to underscores ("Super Admin" -> "SUPER_ADMIN", "Data Entry" -> "DATA_ENTRY").
	const roleEnum = text.trim().toUpperCase().replace(/\s+/g, '_');
	await clickElementByText(RolesPermissionsPage.dropdownOptionCss, roleEnum);
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
