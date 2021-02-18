import {
	verifyElementIsVisible,
	verifyText,
	clickButtonByIndex
} from '../utils/util';
import { StatisticPage } from '../pageobjects/StatisticPageObject';

export const headerTextExist = (text) => {
	verifyText(StatisticPage.headerTextCss, text);
};

export const subheaderTextExist = (text) => {
	verifyText(StatisticPage.subheaderTextCss, text);
};

export const verifyAccordionVisible = () => {
	verifyElementIsVisible(StatisticPage.accordionItemCss);
};

export const clickSubheaderByIndex = (index) => {
	clickButtonByIndex(StatisticPage.accordionItemCss, index);
};

export const verifyNoDataText = (text) => {
	verifyText(StatisticPage.noDataTextCss, text);
};
