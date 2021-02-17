import { verifyElementIsVisible, clickButton, verifyText } from '../utils/util';
import { MessageButton } from '../pageobjects/MessageButtonPageObject';

export const messageButtonVisible = () => {
	verifyElementIsVisible(MessageButton.messageButtonCss);
};

export const clickMessageButton = () => {
	clickButton(MessageButton.messageButtonCss);
};

export const verifyTextExist = (text) => {
	verifyText(MessageButton.menuItemCss, text);
};
