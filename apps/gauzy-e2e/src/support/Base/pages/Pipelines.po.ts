import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	enterInputByIndex,
	verifyElementIsVisibleByIndex,
	clearFieldByIndex,
	vefiryByLength

} from '../utils/util';
import { PipelinesPage } from '../pageobjects/PipelinesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(PipelinesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(PipelinesPage.gridButtonCss, index);
};

export const addPipelineButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.addPipelineButtonCss);
};

export const clickAddPipelineButton = () => {
	clickButton(PipelinesPage.addPipelineButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(PipelinesPage.pipelineNameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(PipelinesPage.pipelineNameInputCss);
	enterInput(PipelinesPage.pipelineNameInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(PipelinesPage.descriptioninputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(PipelinesPage.descriptioninputCss);
	enterInput(PipelinesPage.descriptioninputCss, data);
};

export const createPipelineButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.createPipelineButtonCss);
};

export const clickCreatePipelineButton = () => {
	clickButton(PipelinesPage.createPipelineButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(PipelinesPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(PipelinesPage.selectTableRowCss, index);
};

export const editPipelineButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.editPipelineButtonCss);
};

export const clickEditPipelineButton = () => {
	clickButton(PipelinesPage.editPipelineButtonCss);
};

export const updateButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.updateButtonCss);
};

export const clickUpdateButton = () => {
	clickButton(PipelinesPage.updateButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.deletePipelineButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(PipelinesPage.deletePipelineButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(PipelinesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(PipelinesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(PipelinesPage.toastrMessageCss);
};

export const verifyPipelineIsDeleted = (text) => {
	verifyTextNotExisting(PipelinesPage.verifyPipelineCss, text);
};

export const verifyPipelineExists = (text) => {
	verifyText(PipelinesPage.verifyPipelineCss, text);
};

export const enterNameInputDataByIndex = (data:string, index: number) => {
	clearFieldByIndex(PipelinesPage.pipelineNameInputCss, index);
	enterInputByIndex(PipelinesPage.pipelineNameInputCss, data ,index);
};

export const verifyStageButton = () => {
	verifyElementIsVisible(PipelinesPage.stageButtonCss);
};

export const clickOnStageButton = () => {
	clickButton(PipelinesPage.stageButtonCss); 
};

export const verifyStageNameInput = (index: number) => {
	verifyElementIsVisibleByIndex(PipelinesPage.pipelineNameInputCss, index);
};

export const enterDescriptionInputDataByIndex = (data:string, index: number) => {
	clearFieldByIndex(PipelinesPage.descriptioninputCss, index);
	enterInputByIndex(PipelinesPage.descriptioninputCss, data ,index);
};

export const verifySearchResult = (length: number) =>{
	vefiryByLength(PipelinesPage.selectTableRowCss, length);
};

export const verifyNamePlaceholder = () => {
	verifyElementIsVisible(PipelinesPage.namePlaceholderCss);
};

export const enterNamePlaceholder = (name: string) => {
	clearField(PipelinesPage.namePlaceholderCss);
	cy.intercept('GET', '/api/pipelines/pagination*').as('waitResult');
	enterInput(PipelinesPage.namePlaceholderCss, name);
	cy.wait('@waitResult');
};

export const verifyDetailsButton = () => {
	verifyElementIsVisible(PipelinesPage.detailsButtonCss);
};

export const clickViewDetailsButton = () => {
	cy.intercept('GET', '/api/pipelines*').as('waitPipelines');
	clickButton(PipelinesPage.detailsButtonCss);
	cy.wait('@waitPipelines');
};

export const verifyTitleInput = () => {
	verifyElementIsVisible(PipelinesPage.titleInputCss);
};

export const enterTitleInput = (data: string) => {
	enterInput(PipelinesPage.titleInputCss, data);
};

export const verifyCreateButton = () => {
	verifyElementIsVisible(PipelinesPage.createDealButtonCss);
};

export const clickOnCreateDealButton = () => {
	clickButton(PipelinesPage.createDealButtonCss);
};

export const verifyAddDealButton = () => {
	verifyElementIsVisible(PipelinesPage.addDealPipelineButtonCss);
};

export const clickAddDealButton = () => {
	clickButton(PipelinesPage.addDealPipelineButtonCss);
};

export const verifyProbabilityInput = () => {
	verifyElementIsVisible(PipelinesPage.probabilityInputCss);
};

export const clickOnProbabilityInput = () => {
	clickButton(PipelinesPage.probabilityInputCss);
};

export const clickDropdownOption = (index: number) => {
	clickButtonByIndex(PipelinesPage.dropdownOptionCss, index)
};

export const verifyBackButton = () => {
	verifyElementIsVisible(PipelinesPage.backButtonCss);
};

export const clickOnBackButton = () => {
	clickButton(PipelinesPage.backButtonCss);
};