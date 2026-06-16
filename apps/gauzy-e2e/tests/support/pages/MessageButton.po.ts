import { verifyElementIsVisible, clickButton, verifyText } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { MessageButton } from '../../../src/support/Base/pageobjects/MessageButtonPageObject';

export const messageButtonVisible = async () => verifyElementIsVisible(MessageButton.messageButtonCss);

export const clickMessageButton = async () => clickButton(MessageButton.messageButtonCss);

export const verifyTextExist = async (text: string) => verifyText(MessageButton.menuItemCss, text);
