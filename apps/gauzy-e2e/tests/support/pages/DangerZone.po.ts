import { verifyElementIsVisible, clickButton, clearField, enterInput, verifyText, clickButtonByIndex } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { DangerZonePage } from '../../../src/support/Base/pageobjects/DangerZonePageObject';

export const verifyHeaderTextExist = async (text: string) => {
	await verifyText(DangerZonePage.headerTextCss, text);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(DangerZonePage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number = 0) => {
	await clickButtonByIndex(DangerZonePage.deleteButtonCss, index);
};

export const verifyDeleteTextExist = async (text: string) => {
	await verifyText(DangerZonePage.confirmDeleteTextCss, text);
};

export const deleteInputVisible = async () => {
	await verifyElementIsVisible(DangerZonePage.inputCss);
};

export const enterInputData = async (data: string) => {
	await clearField(DangerZonePage.inputCss);
	await enterInput(DangerZonePage.inputCss, data);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(DangerZonePage.confirmDeleteButtonCss);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(DangerZonePage.cancelButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(DangerZonePage.cancelButtonCss);
};

export const verifyDeleteButtonText = async (text: string) => {
	await verifyText(DangerZonePage.deleteButtonCss, text);
};
