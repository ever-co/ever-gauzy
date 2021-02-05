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
} from '../utils/util';
import { JobsProposalsPage } from '../pageobjects/JobsProposalsPageObject';

export const addButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(JobsProposalsPage.addButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(JobsProposalsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(
		JobsProposalsPage.selectEmployeeDropdownOptionCss,
		index
	);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(JobsProposalsPage.nameInputCss);
	enterInput(JobsProposalsPage.nameInputCss, data);
};

export const contentInputVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.contentInputCss);
};

export const enterContentInputData = (data) => {
	typeOverTextarea(JobsProposalsPage.contentInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(JobsProposalsPage.saveButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(JobsProposalsPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.editButtonCss);
};

export const clickEditButton = (text) => {
	clickElementByText(JobsProposalsPage.editButtonCss, text);
};

export const makeDefaultButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.makeDefaultButtonCss);
};

export const clickMakeDefaultButton = (text) => {
	clickElementByText(JobsProposalsPage.makeDefaultButtonCss, text);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(JobsProposalsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(JobsProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(JobsProposalsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(JobsProposalsPage.toastrMessageCss);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(JobsProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = (text) => {
	verifyText(JobsProposalsPage.verifyProposalCss, text);
};
