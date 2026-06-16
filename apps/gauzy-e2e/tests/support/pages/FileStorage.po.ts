import {
	verifyText,
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	waitElementToHide
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { FileStoragePage } from '../../../src/support/Base/pageobjects/FileStoragePageObject';

export const verifyHeader = async (text) => {
	await verifyText(FileStoragePage.headerTextCss, text);
};

export const verifySubheader = async (text) => {
	await verifyText(FileStoragePage.subheaderTextCss, text);
};

export const dropdownVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.selectDropdownCss);
};

export const clickDropdown = async () => {
	await clickButton(FileStoragePage.selectDropdownCss);
};

export const dropdownOptionVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.optionDropdownCss);
};

export const selectOptionFromDropdown = async (index) => {
	await clickButtonByIndex(FileStoragePage.optionDropdownCss, index);
};

export const accessKeyInputVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.accesskeyIdInputCss);
};

export const enterAccessKeyInputData = async (data) => {
	await clearField(FileStoragePage.accesskeyIdInputCss);
	await enterInput(FileStoragePage.accesskeyIdInputCss, data);
};

export const secretKeyInputVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.secretAccessKeyInputCss);
};

export const enterSecretKeyInputData = async (data) => {
	await clearField(FileStoragePage.secretAccessKeyInputCss);
	await enterInput(FileStoragePage.secretAccessKeyInputCss, data);
};

export const regionInputVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.regionInputCss);
};

export const enterRegionInputData = async (data) => {
	await clearField(FileStoragePage.regionInputCss);
	await enterInput(FileStoragePage.regionInputCss, data);
};

export const bucketInputVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.bucketInputCss);
};

export const enterBucketInputData = async (data) => {
	await clearField(FileStoragePage.bucketInputCss);
	await enterInput(FileStoragePage.bucketInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(FileStoragePage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(FileStoragePage.saveButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(FileStoragePage.toastrMessageCss);
};
