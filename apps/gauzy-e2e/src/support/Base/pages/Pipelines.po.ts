import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	enterInputByIndex
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

export const clickUpdateButon = () => {
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
	clearField(PipelinesPage.pipelineNameInputCss);
	enterInputByIndex(PipelinesPage.pipelineNameInputCss, data ,index);
};