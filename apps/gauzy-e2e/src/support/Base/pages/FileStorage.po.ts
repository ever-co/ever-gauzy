import {
	verifyText,
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	waitElementToHide
} from '../utils/util';
import { FileStoragePage } from '../pageobjects/FileStoragePageObject';

export const verifyHeader = (text) => {
	cy.intercept('GET', '/api/user-organization*').as('waitUserOrganization');
	cy.wait('@waitUserOrganization');
	verifyText(FileStoragePage.headerTextCss, text);
};

export const verifySubheader = (text) => {
	verifyText(FileStoragePage.subheaderTextCss, text);
};

export const dropdownVisible = () => {
	verifyElementIsVisible(FileStoragePage.selectDropdownCss);
};

export const clickDropdown = () => {
	clickButton(FileStoragePage.selectDropdownCss);
};

export const dropdownOptionVisible = () => {
	verifyElementIsVisible(FileStoragePage.optionDropdownCss);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(FileStoragePage.optionDropdownCss, index);
};

export const accessKeyInputVisible = () => {
	verifyElementIsVisible(FileStoragePage.accesskeyIdInputCss);
};

export const enterAccessKeyInputData = (data) => {
	clearField(FileStoragePage.accesskeyIdInputCss);
	enterInput(FileStoragePage.accesskeyIdInputCss, data);
};

export const secretKeyInputVisible = () => {
	verifyElementIsVisible(FileStoragePage.secretAccessKeyInputCss);
};

export const enterSecretKeyInputData = (data) => {
	clearField(FileStoragePage.secretAccessKeyInputCss);
	enterInput(FileStoragePage.secretAccessKeyInputCss, data);
};

export const regioninputVisible = () => {
	verifyElementIsVisible(FileStoragePage.regionInputCss);
};

export const enterRegionInputData = (data) => {
	clearField(FileStoragePage.regionInputCss);
	enterInput(FileStoragePage.regionInputCss, data);
};

export const bucketInputVisible = () => {
	verifyElementIsVisible(FileStoragePage.bucketInputCss);
};

export const enterBucketInputData = (data) => {
	clearField(FileStoragePage.bucketInputCss);
	enterInput(FileStoragePage.bucketInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(FileStoragePage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(FileStoragePage.saveButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(FileStoragePage.toastrMessageCss);
};
