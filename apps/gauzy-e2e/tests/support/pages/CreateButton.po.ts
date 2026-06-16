import { verifyElementIsVisible, clickButton, clickElementByText, verifyText, waitUntil } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CreateButton } from '../../../src/support/Base/pageobjects/CreateButtonPageObject';

export const createButtonVisible = async () => {
	await verifyElementIsVisible(CreateButton.createButtonCss);
};

export const clickCreateButton = async () => {
	await clickButton(CreateButton.createButtonCss);
};

export const verifyTextExist = async (text) => {
	await verifyText(CreateButton.titleTextCss, text);
};

export const clickOptionByText = async (text) => {
	await clickElementByText(CreateButton.createButtonOptionCss, text);
};

export const verifyNbCardH4Header = async (text) => {
	await verifyText(CreateButton.nbCardh4Css, text);
};

export const verifyNbCardH5Header = async (text) => {
	await verifyText(CreateButton.nbCardh5Css, text);
};

export const verifyDivH4Header = async (text) => {
	await verifyText(CreateButton.teamHeaderCss, text);
};

export const verifyProjectHeaderText = async (text) => {
	await verifyText(CreateButton.projectHeaderCss, text);
};

export const verifyTimeLogHeaderText = async (text) => {
	await verifyText(CreateButton.timeLogHeaderTextCss, text);
};

export const verifyProposalHeaderText = async (text) => {
	await verifyText(CreateButton.proposalHeaderTextCss, text);
};

export const verifyContactHeaderText = async (text) => {
	await waitUntil(3000);
	await verifyText(CreateButton.contactHeaderTextCss, text);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(CreateButton.cancelButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(CreateButton.cancelButtonCss);
};

export const closeButtonVisible = async () => {
	await verifyElementIsVisible(CreateButton.closeButtonCss);
};

export const clickCloseButton = async () => {
	await clickButton(CreateButton.closeButtonCss);
};
