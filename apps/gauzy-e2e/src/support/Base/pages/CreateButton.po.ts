import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText
} from '../utils/util';
import { CreateButton } from '../pageobjects/CreateButtonPageObject';

export const createButtonVisible = () => {
	verifyElementIsVisible(CreateButton.createButtonCss);
};

export const clickCreatebutton = () => {
	clickButton(CreateButton.createButtonCss);
};

export const verifyTextExist = (text) => {
	verifyText(CreateButton.titleTextCss, text);
};

export const clickOptionByText = (text) => {
	clickElementByText(CreateButton.createButtonOptionCss, text);
};

export const verifyNbCardH4Header = (text) => {
	verifyText(CreateButton.nbCardh4Css, text);
};

export const verifyNbCardH5Header = (text) => {
	verifyText(CreateButton.nbCardh5Css, text);
};

export const verifyDivH4Header = (text) => {
	verifyText(CreateButton.divh4Css, text);
};

export const verifyTimeLogHeaderText = (text) => {
	verifyText(CreateButton.timeLogHeaderTextCss, text);
};

export const verifyProposalHeaderText = (text) => {
	verifyText(CreateButton.proposalHeaderTextCss, text);
};

export const verifyContactHeaderText = (text) => {
	verifyText(CreateButton.contactHeaderTextCss, text);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(CreateButton.cancelButtonCss);
};

export const clickCancelButton = () => {
	clickButton(CreateButton.cancelButtonCss);
};

export const closeButtonVisible = () => {
	verifyElementIsVisible(CreateButton.closeButtonCss);
};

export const clickCloseButton = () => {
	clickButton(CreateButton.closeButtonCss);
};
