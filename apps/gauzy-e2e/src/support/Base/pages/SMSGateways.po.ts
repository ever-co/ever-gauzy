import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	verifyStateByIndex
} from '../utils/util';
import { SMSGatewaysPage } from '../pageobjects/SMSGatewaysPageObject';

export const headerTextExist = (text) => {
	verifyText(SMSGatewaysPage.headerTextCss, text);
};

export const subheaderTextExist = (text) => {
	verifyText(SMSGatewaysPage.subheaderTextCss, text);
};

export const checkboxVisible = () => {
	verifyElementIsVisible(SMSGatewaysPage.checkboxCss);
};

export const clickCheckbox = () => {
	clickButton(SMSGatewaysPage.checkboxCss);
};

export const verifyState = (index, state) => {
	verifyStateByIndex(SMSGatewaysPage.inputCheckBoxCss, index, state);
};
