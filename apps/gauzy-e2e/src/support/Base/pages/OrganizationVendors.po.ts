import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { OrganizationVendorsPage } from '../pageobjects/OrganizationVendorsPageObject';

export const gridButtonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.gridButtonCss);
};

export const clickGridButton = (index) => {
	clickButtonByIndex(OrganizationVendorsPage.gridButtonCss, index);
};

export const addVendorButtonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.addVendorButtonCss);
};

export const clickAddVendorButton = () => {
	clickButton(OrganizationVendorsPage.addVendorButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationVendorsPage.nameInputCss);
	enterInput(OrganizationVendorsPage.nameInputCss, data);
};

export const phoneInputVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.phoneInputCss);
};

export const enterPhoneInputData = (data) => {
	clearField(OrganizationVendorsPage.phoneInputCss);
	enterInput(OrganizationVendorsPage.phoneInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.emailInputCss);
};

export const enterEmailInputData = (data) => {
	clearField(OrganizationVendorsPage.emailInputCss);
	enterInput(OrganizationVendorsPage.emailInputCss, data);
};

export const websiteInputVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.websiteInputCss);
};

export const enterWebsiteInputData = (data) => {
	clearField(OrganizationVendorsPage.websiteInputCss);
	enterInput(OrganizationVendorsPage.websiteInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(OrganizationVendorsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(OrganizationVendorsPage.tagsDropdownOption, index);
};

export const saveVendorButtonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.saveVendorbuttonCss);
};

export const clickSaveVendorButton = () => {
	clickButton(OrganizationVendorsPage.saveVendorbuttonCss);
};

export const editVendorButtonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.editVendorButtonCss);
};

export const clickEditVendorButton = (index) => {
	clickButtonByIndex(OrganizationVendorsPage.editVendorButtonCss, index);
};

export const deleteVendorButtonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.deleteVendorButtonCss);
};

export const clickDeleteVendorButton = (index) => {
	clickButtonByIndex(OrganizationVendorsPage.deleteVendorButtonCss, index);
};

export const confirmDeletebuttonVisible = () => {
	verifyElementIsVisible(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
