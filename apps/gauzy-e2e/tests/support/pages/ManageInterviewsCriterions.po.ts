import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageInterviewsCriterionsPage } from '../../../src/support/Base/pageobjects/ManageInterviewsCriterionsPageObject';

export const technologyInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsCriterionsPage.nameInputCss);
};

export const enterTechnologyInputData = async (data) => {
	await clickButton(ManageInterviewsCriterionsPage.nameInputCss);
	await clearField(ManageInterviewsCriterionsPage.nameInputCss);
	await enterInput(ManageInterviewsCriterionsPage.nameInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsCriterionsPage.saveButtonCss);
};

export const clickSaveButton = async (index) => {
	await clickButtonByIndex(ManageInterviewsCriterionsPage.saveButtonCss, index);
};

export const verifyTechnologyTextExist = async (text) => {
	await verifyText(ManageInterviewsCriterionsPage.verifyTechnologyTextCss, text);
};

export const verifyTechnologyIsDeleted = async () => {
	await verifyElementNotExist(
		ManageInterviewsCriterionsPage.verifyTechnologyTextCss
	);
};

export const editTechnologyButtonVisible = async () => {
	await verifyElementIsVisible(
		ManageInterviewsCriterionsPage.editTechnologyButtonCss
	);
};

export const clickEditTechnologyButton = async () => {
	await clickButton(ManageInterviewsCriterionsPage.editTechnologyButtonCss);
};

export const deleteTechnologyButtonVisible = async () => {
	await verifyElementIsVisible(
		ManageInterviewsCriterionsPage.deleteTechnologyButtonCss
	);
};

export const clickDeleteTechnologyButton = async () => {
	await clickButton(ManageInterviewsCriterionsPage.deleteTechnologyButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageInterviewsCriterionsPage.toastrMessageCss);
};

export const qualityInputVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsCriterionsPage.qualityInputCss);
};

export const enterQualityInputData = async (data) => {
	await clickButton(ManageInterviewsCriterionsPage.qualityInputCss);
	await clearField(ManageInterviewsCriterionsPage.qualityInputCss);
	await enterInput(ManageInterviewsCriterionsPage.qualityInputCss, data);
};

export const verifyQualityTextExist = async (text) => {
	await verifyText(ManageInterviewsCriterionsPage.verifyQualityTextCss, text);
};

export const editQualityButtonVisible = async () => {
	await verifyElementIsVisible(ManageInterviewsCriterionsPage.editQualityButtonCss);
};

export const clickEditQualityButton = async () => {
	await clickButton(ManageInterviewsCriterionsPage.editQualityButtonCss);
};

export const deleteQualityButtonVisible = async () => {
	await verifyElementIsVisible(
		ManageInterviewsCriterionsPage.deleteQualityButtonCss
	);
};

export const clickDeleteQualityButton = async () => {
	await clickButton(ManageInterviewsCriterionsPage.deleteQualityButtonCss);
};

export const verifyQualityIsDeleted = async () => {
	await verifyElementNotExist(ManageInterviewsCriterionsPage.verifyQualityTextCss);
};
