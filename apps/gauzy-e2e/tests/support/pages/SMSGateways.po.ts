import { verifyElementIsVisible, clickButton, verifyText, verifyStateByIndex } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { SMSGatewaysPage } from '../../../src/support/Base/pageobjects/SMSGatewaysPageObject';

export const headerTextExist = async (text: string) => verifyText(SMSGatewaysPage.headerTextCss, text);

export const subheaderTextExist = async (text: string) => verifyText(SMSGatewaysPage.subheaderTextCss, text);

export const checkboxVisible = async () => verifyElementIsVisible(SMSGatewaysPage.checkboxCss);

export const clickCheckbox = async () => clickButton(SMSGatewaysPage.checkboxCss);

export const verifyState = async (index: number, state: string) =>
	verifyStateByIndex(SMSGatewaysPage.inputCheckBoxCss, index, state);
