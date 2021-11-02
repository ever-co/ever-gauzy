import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	clickButtonWithForce,
	waitForDropdownToLoad,
	clickButtonDouble,
	verifyByText
} from '../utils/util';
import { ProposalsPage } from '../pageobjects/ProposalsPageObject';
import { CustomCommands } from '../../../support/commands';

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
	clickButtonWithForce(ProposalsPage.registerProposalButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButtonDouble(ProposalsPage.selectEmployeeDropdownCss);
	clickButton(ProposalsPage.selectEmployeeDropdownCss);
	waitForDropdownToLoad(ProposalsPage.selectEmployeeDropdownOptionCss)
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
	const date = dayjs().format('MMM D, YYYY');
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

export const enterJobPostContentInputData = (data, index) => {
	CustomCommands.getIframeBody(index).find('p').type(data);
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

export const clickDetailsButton = (index) => {
	cy.intercept('GET', '/api/proposal/*').as('waitToLoad');
	clickButtonByIndex(ProposalsPage.detailsButtonCss, index);
	cy.wait('@waitToLoad');
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

export const confirmStatusButtonVisible = () => {
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

export const waitMessageToHide = () => {
	waitElementToHide(ProposalsPage.toastrMessageCss);
};

export const verifyProposalIsDeleted = (text) => {
	verifyTextNotExisting(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = (text) => {
	verifyText(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalAccepted = () => {
	verifyElementIsVisible(ProposalsPage.acceptedproposalCss);
};

export const manageTemplatesBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.manageTemplatesBtnCss);
};

export const clickManageTemplatesBtn = (index) => {
	clickButtonByIndex(ProposalsPage.manageTemplatesBtnCss, index);
};

export const addProposalTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.addProposalTemplateBtnCss);
};

export const clickAddProposalTemplateBtn = () => {
	clickButton(ProposalsPage.addProposalTemplateBtnCss);
};

export const templateNameInputVisible = () => {
	verifyElementIsVisible(ProposalsPage.templateNameInputCss);
};

export const enterTemplateName = (name) => {
	clearField(ProposalsPage.templateNameInputCss);
	enterInput(ProposalsPage.templateNameInputCss, name);
};

export const saveTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.saveTemplateBtnCss);
};

export const clickSaveTemplateBtn = () => {
	clickButton(ProposalsPage.saveTemplateBtnCss);
};

export const editTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.editProposalTemplateBtnCss);
};

export const clickEditTemplateBtn = (index) => {
	clickButtonByIndex(ProposalsPage.editProposalTemplateBtnCss, index);
};

export const deleteTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const clickDeleteTemplateBtn = () => {
	clickButton(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const rejectDeleteTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.rejectDeleteBtnCss);
};

export const confirmDeleteTemplateBtnVisible = () => {
	verifyElementIsVisible(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const clickConfirmDeleteTemplateBtn = () => {
	clickButton(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const enterProposalTemplateContent = (data, index) => {
	CustomCommands.getIframeBody(index).find('p').type(data);
};

export const verifyProposalTemplate = (name) => {
	verifyText(ProposalsPage.verifyProposalTemplateCss, name);
};

export const employeeMultiSelectVisible = () => {
	verifyElementIsVisible(ProposalsPage.employeeMultyseelectCss);
};

export const clickEmployeeMultiSelect = () => {
	clickButton(ProposalsPage.employeeMultyseelectCss);
};

export const selectEmployeeFromMultiSelectDropdown = (index) => {
	clickButtonByIndex(
		ProposalsPage.employeeMultiSelectDropdownOptionCss,
		index
	);
};

export const verifyEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownOptionCss)
	waitForDropdownToLoad(ProposalsPage.selectEmployeeDropdownOptionCss)
}

export const verifyHeaderTitle = (text: string) => {
	verifyByText(ProposalsPage.headerTitleCss, text)
}