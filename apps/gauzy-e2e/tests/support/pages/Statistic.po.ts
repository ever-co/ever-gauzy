import { verifyElementIsVisible, verifyText, clickButtonByIndex } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { StatisticPage } from '../../../src/support/Base/pageobjects/StatisticPageObject';

export const headerTextExist = async (text: string) => verifyText(StatisticPage.headerTextCss, text);

export const subheaderTextExist = async (text: string) => verifyText(StatisticPage.subheaderTextCss, text);

export const verifyAccordionVisible = async () => verifyElementIsVisible(StatisticPage.accordionItemCss);

export const clickSubheaderByIndex = async (index: number) => clickButtonByIndex(StatisticPage.accordionItemCss, index);

export const verifyNoDataText = async (text: string) => verifyText(StatisticPage.noDataTextCss, text);
