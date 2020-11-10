import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex
} from '../utils/util';
import { ProposalsPage } from '../pageobjects/ProposalsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ProposalsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ProposalsPage.gridButtonCss, index);
};

export const registerProposalButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.registerProposalButtonCss);
};

export const clickRegisterProposalButton = () => {
	clickButton(ProposalsPage.registerProposalButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(ProposalsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(ProposalsPage.selectEmployeeDropdownOptionCss, index);
};

export const jobPostInputVisible = () => {
	verifyElementIsVisible(ProposalsPage.jobPostUrlInputCss);
};

export const enterJobPostInputData = (data) => {
	clearField(ProposalsPage.jobPostUrlInputCss);
	enterInput(ProposalsPage.jobPostUrlInputCss, data);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(ProposalsPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(ProposalsPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(ProposalsPage.dateInputCss, date);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(ProposalsPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(ProposalsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(ProposalsPage.tagsDropdownOption, index);
};

export const jobPostContentTextareaVisible = () => {
	verifyElementIsVisible(ProposalsPage.jobPostContentInputCss);
};

export const enterJobPostContentInputData = (data) => {
	clickButton(ProposalsPage.jobPostContentInputCss);
	clearField(ProposalsPage.jobPostContentInputCss);
	enterInput(ProposalsPage.jobPostContentInputCss, data);
};

export const proposalContentTextareaVisible = () => {
	verifyElementIsVisible(ProposalsPage.proposalContentInputCss);
};

export const enterProposalContentInputData = (data) => {
	clickButton(ProposalsPage.proposalContentInputCss);
	clearField(ProposalsPage.proposalContentInputCss);
	enterInput(ProposalsPage.proposalContentInputCss, data);
};

export const saveProposalButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.saveProposalButtonCss);
};

export const clickSaveProposalButton = () => {
	clickButton(ProposalsPage.saveProposalButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ProposalsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ProposalsPage.selectTableRowCss, index);
};

export const detailsButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.detailsButtonCss);
};

export const clickDetailsButton = () => {
	clickButton(ProposalsPage.detailsButtonCss);
};

export const editProposalButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.editProposalButtonCss);
};

export const clickEditProposalButton = () => {
	clickButton(ProposalsPage.editProposalButtonCss);
};

export const markAsStatusButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.markAsStatusButtonCss);
};

export const clickMarkAsStatusButton = () => {
	clickButton(ProposalsPage.markAsStatusButtonCss);
};

export const confrimStatusButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.confirmStatusButtonCss);
};

export const clickConfirmStatusButton = () => {
	clickButton(ProposalsPage.confirmStatusButtonCss);
};

export const deleteProposalButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.deleteProposalButtonCss);
};

export const clickDeleteProposalButton = () => {
	clickButton(ProposalsPage.deleteProposalButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(ProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(ProposalsPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(ProposalsPage.cardBodyCss);
};
