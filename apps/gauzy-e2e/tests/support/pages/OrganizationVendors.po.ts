import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationVendorsPage } from '../../../src/support/Base/pageobjects/OrganizationVendorsPageObject';

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.addVendorButtonCss);
};

export const clickAddVendorButton = async () => {
	await clickButton(OrganizationVendorsPage.addVendorButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.nameInputCss);
	await enterInput(OrganizationVendorsPage.nameInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.phoneInputCss);
};

export const enterPhoneInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.phoneInputCss);
	await enterInput(OrganizationVendorsPage.phoneInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.emailInputCss);
};

export const enterEmailInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.emailInputCss);
	await enterInput(OrganizationVendorsPage.emailInputCss, data);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.websiteInputCss);
	await enterInput(OrganizationVendorsPage.websiteInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationVendorsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.tagsDropdownOption, index);
};

export const saveVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.saveVendorButtonCss);
};

export const clickSaveVendorButton = async () => {
	await clickButton(OrganizationVendorsPage.saveVendorButtonCss);
};

export const editVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.editVendorButtonCss);
};

export const clickEditVendorButton = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.editVendorButtonCss, index);
};

export const deleteVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.deleteVendorButtonCss);
};

export const clickDeleteVendorButton = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.deleteVendorButtonCss, index);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationVendorsPage.toastrMessageCss);
};

export const verifyVendorExists = async (text: string) => {
	await verifyText(OrganizationVendorsPage.verifyVendorCss, text);
};

export const verifyVendorIsDeleted = async () => {
	await verifyElementNotExist(OrganizationVendorsPage.verifyVendorCss);
};
