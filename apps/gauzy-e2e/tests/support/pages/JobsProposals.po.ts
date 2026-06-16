import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	verifyTextNotExisting,
	verifyText,
	typeOverTextarea
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { JobsProposalsPage } from '../../../src/support/Base/pageobjects/JobsProposalsPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(JobsProposalsPage.addButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(JobsProposalsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(
		JobsProposalsPage.selectEmployeeDropdownOptionCss,
		index
	);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(JobsProposalsPage.nameInputCss);
	await enterInput(JobsProposalsPage.nameInputCss, data);
};

export const contentInputVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.contentInputCss);
};

export const enterContentInputData = async (data) => {
	await typeOverTextarea(JobsProposalsPage.contentInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(JobsProposalsPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(JobsProposalsPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.editButtonCss);
};

export const clickEditButton = async (text) => {
	await clickElementByText(JobsProposalsPage.editButtonCss, text);
};

export const makeDefaultButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.makeDefaultButtonCss);
};

export const clickMakeDefaultButton = async (text) => {
	await clickElementByText(JobsProposalsPage.makeDefaultButtonCss, text);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(JobsProposalsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(JobsProposalsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(JobsProposalsPage.toastrMessageCss);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(JobsProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = async (text) => {
	await verifyText(JobsProposalsPage.verifyProposalCss, text);
};
