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
	waitElementToLoad
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { JobsProposalsPage } from '../../../src/support/Base/pageobjects/JobsProposalsPageObject';

// CKEditor wysiwyg iframe — content is entered into the editor body, not the <ckeditor> host.
const ckeditorIframeCss = 'iframe[class="cke_wysiwyg_frame cke_reset"]';

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
	// Wait for the nb-select overlay (option-list) to render before selecting an option.
	await waitElementToLoad(JobsProposalsPage.selectEmployeeDropdownOptionCss);
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
	// Content is a CKEditor4 widget — the [formcontrolname="content"] host is not fillable.
	// Type into the editor body inside its wysiwyg iframe (content is optional, so this never
	// blocks Save, but we still populate it to mirror the intended flow).
	await getPage().frameLocator(ckeditorIframeCss).first().locator('body').fill(String(data));
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
