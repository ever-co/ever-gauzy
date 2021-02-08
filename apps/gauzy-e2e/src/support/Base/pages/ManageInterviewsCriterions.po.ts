import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { ManageInterviewsCriterionsPage } from '../pageobjects/ManageInterviewsCriterionsPageObject';

export const technologyInputVisible = () => {
	verifyElementIsVisible(ManageInterviewsCriterionsPage.nameInputCss);
};

export const enterTechonologyInputData = (data) => {
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
