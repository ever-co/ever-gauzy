import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../utils/util';
import { ManageInterviewsCriterionsPage } from '../pageobjects/ManageInterviewsCriterionsPageObject';

export const technologyInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsCriterionsPage.nameInputCss);
};

export const enterTechonologyInputData = (data) => {
	clickButton(ManageInterviewsCriterionsPage.nameInputCss);
	clearField(ManageInterviewsCriterionsPage.nameInputCss);
	enterInput(ManageInterviewsCriterionsPage.nameInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsCriterionsPage.saveButtonCss);
};

export const clickSaveButton = (index) => {
	clickButtonByIndex(ManageInterviewsCriterionsPage.saveButtonCss, index);
};

export const verifyTechnologyTextExist = (text) => {
	verifyText(ManageInterviewsCriterionsPage.verifyTechnologyTextCss, text);
};

export const verifyTechnologyIsDeleted = () => {
	verifyElementNotExist(
		ManageInterviewsCriterionsPage.verifyTechnologyTextCss
	);
};

export const editTechnologyButtonVisible = () => {
	verifyElementIsVisible(
		ManageInterviewsCriterionsPage.editTechnologyButtonCss
	);
};

export const clickEditTechnologyButton = () => {
	clickButton(ManageInterviewsCriterionsPage.editTechnologyButtonCss);
};

export const deleteTechnologyButtonVisible = () => {
	verifyElementIsVisible(
		ManageInterviewsCriterionsPage.deleteTechnologyButtonCss
	);
};

export const clickDeleteTechnologyButton = () => {
	clickButton(ManageInterviewsCriterionsPage.deleteTechnologyButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageInterviewsCriterionsPage.toastrMessageCss);
};

export const qualityInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsCriterionsPage.qualityInputCss);
};

export const enterQualityInputData = (data) => {
	clickButton(ManageInterviewsCriterionsPage.qualityInputCss);
	clearField(ManageInterviewsCriterionsPage.qualityInputCss);
	enterInput(ManageInterviewsCriterionsPage.qualityInputCss, data);
};

export const verifyQualityTextExist = (text) => {
	verifyText(ManageInterviewsCriterionsPage.verifyQualityTextCss, text);
};

export const editQualityButtonVisible = () => {
	verifyElementIsVisible(ManageInterviewsCriterionsPage.editQualityButtonCss);
};

export const clickEditQualityButton = () => {
	clickButton(ManageInterviewsCriterionsPage.editQualityButtonCss);
};

export const deleteQualityButtonVisible = () => {
	verifyElementIsVisible(
		ManageInterviewsCriterionsPage.deleteQualityButtonCss
	);
};

export const clickDeleteQualityButton = () => {
	clickButton(ManageInterviewsCriterionsPage.deleteQualityButtonCss);
};

export const verifyQualityIsDeleted = () => {
	verifyElementNotExist(ManageInterviewsCriterionsPage.verifyQualityTextCss);
};
