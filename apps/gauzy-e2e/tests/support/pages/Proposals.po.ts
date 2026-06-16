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
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ProposalsPage } from '../../../src/support/Base/pageobjects/ProposalsPageObject';

// CKEditor wysiwyg iframe — matches the Cypress CustomCommands.getIframeBody selector.
const ckeditorIframeCss = 'iframe[class="cke_wysiwyg_frame cke_reset"]';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(ProposalsPage.gridButtonCss);
};

export const gridBtnClick = async (index) => {
	await clickButtonByIndex(ProposalsPage.gridButtonCss, index);
};

export const registerProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.registerProposalButtonCss);
};

export const clickRegisterProposalButton = async () => {
	await clickButtonWithForce(ProposalsPage.registerProposalButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButtonDouble(ProposalsPage.selectEmployeeDropdownCss);
	await clickButton(ProposalsPage.selectEmployeeDropdownCss);
	await waitForDropdownToLoad(ProposalsPage.selectEmployeeDropdownOptionCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(ProposalsPage.selectEmployeeDropdownOptionCss, index);
};

export const jobPostInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.jobPostUrlInputCss);
};

export const enterJobPostInputData = async (data) => {
	await clearField(ProposalsPage.jobPostUrlInputCss);
	await enterInput(ProposalsPage.jobPostUrlInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ProposalsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ProposalsPage.dateInputCss, date);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ProposalsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ProposalsPage.tagsDropdownOption, index);
};

export const jobPostContentTextareaVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.jobPostContentInputCss);
};

export const enterJobPostContentInputData = async (data, index) => {
	await getPage().frameLocator(ckeditorIframeCss).nth(index).locator('p').fill(String(data));
};

export const proposalContentTextareaVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.proposalContentInputCss);
};

export const enterProposalContentInputData = async (data) => {
	await clickButton(ProposalsPage.proposalContentInputCss);
	await clearField(ProposalsPage.proposalContentInputCss);
	await enterInput(ProposalsPage.proposalContentInputCss, data);
};

export const saveProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.saveProposalButtonCss);
};

export const clickSaveProposalButton = async () => {
	await clickButton(ProposalsPage.saveProposalButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(ProposalsPage.selectTableRowCss, index);
};

export const detailsButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.detailsButtonCss);
};

export const clickDetailsButton = async (index) => {
	await clickButtonByIndex(ProposalsPage.detailsButtonCss, index);
};

export const editProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.editProposalButtonCss);
};

export const clickEditProposalButton = async () => {
	await clickButton(ProposalsPage.editProposalButtonCss);
};

export const markAsStatusButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.markAsStatusButtonCss);
};

export const clickMarkAsStatusButton = async () => {
	await clickButton(ProposalsPage.markAsStatusButtonCss);
};

export const confirmStatusButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmStatusButtonCss);
};

export const clickConfirmStatusButton = async () => {
	await clickButton(ProposalsPage.confirmStatusButtonCss);
};

export const deleteProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.deleteProposalButtonCss);
};

export const clickDeleteProposalButton = async () => {
	await clickButton(ProposalsPage.deleteProposalButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ProposalsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(ProposalsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ProposalsPage.toastrMessageCss);
};

export const verifyProposalIsDeleted = async (text) => {
	await verifyTextNotExisting(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = async (text) => {
	await verifyText(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalAccepted = async () => {
	await verifyElementIsVisible(ProposalsPage.acceptedProposalCss);
};

export const manageTemplatesBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.manageTemplatesBtnCss);
};

export const clickManageTemplatesBtn = async (index) => {
	await clickButtonByIndex(ProposalsPage.manageTemplatesBtnCss, index);
};

export const addProposalTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.addProposalTemplateBtnCss);
};

export const clickAddProposalTemplateBtn = async () => {
	await clickButton(ProposalsPage.addProposalTemplateBtnCss);
};

export const templateNameInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.templateNameInputCss);
};

export const enterTemplateName = async (name) => {
	await clearField(ProposalsPage.templateNameInputCss);
	await enterInput(ProposalsPage.templateNameInputCss, name);
};

export const saveTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.saveTemplateBtnCss);
};

export const clickSaveTemplateBtn = async () => {
	await clickButton(ProposalsPage.saveTemplateBtnCss);
};

export const editTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.editProposalTemplateBtnCss);
};

export const clickEditTemplateBtn = async (index) => {
	await clickButtonByIndex(ProposalsPage.editProposalTemplateBtnCss, index);
};

export const deleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const clickDeleteTemplateBtn = async () => {
	await clickButton(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const rejectDeleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.rejectDeleteBtnCss);
};

export const confirmDeleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const clickConfirmDeleteTemplateBtn = async () => {
	await clickButton(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const enterProposalTemplateContent = async (data, index) => {
	await getPage().frameLocator(ckeditorIframeCss).nth(index).locator('p').fill(String(data));
};

export const verifyProposalTemplate = async (name) => {
	await verifyText(ProposalsPage.verifyProposalTemplateCss, name);
};

export const employeeMultiSelectVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.employeeMultiSelectCss);
};

export const clickEmployeeMultiSelect = async () => {
	await clickButton(ProposalsPage.employeeMultiSelectCss);
};

export const selectEmployeeFromMultiSelectDropdown = async (index) => {
	await clickButtonByIndex(ProposalsPage.employeeMultiSelectDropdownOptionCss, index);
};

export const verifyEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownOptionCss);
	await waitForDropdownToLoad(ProposalsPage.selectEmployeeDropdownOptionCss);
};

export const verifyHeaderTitle = async (text: string) => {
	await verifyByText(ProposalsPage.headerTitleCss, text);
};
