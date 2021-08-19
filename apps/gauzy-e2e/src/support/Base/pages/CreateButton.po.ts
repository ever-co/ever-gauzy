import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitUntil
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
	verifyText(CreateButton.teamHeaderCss, text);
};

export const verifyProjectHeaderText = (text) => {
	verifyText(CreateButton.projectHeaderCss, text)
}

export const verifyTimeLogHeaderText = (text) => {
	verifyText(CreateButton.timeLogHeaderTextCss, text);
};

export const verifyProposalHeaderText = (text) => {
	verifyText(CreateButton.proposalHeaderTextCss, text);
};

export const verifyContactHeaderText = (text) => {
	waitUntil(3000);
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
