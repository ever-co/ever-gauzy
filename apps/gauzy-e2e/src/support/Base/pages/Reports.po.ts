import { verifyText, verifyStateByIndex } from '../utils/util';
import { ReportsPage } from '../pageobjects/ReportsPageObject';

export const verifyHeader = (text) => {
	verifyText(ReportsPage.headerTextCss, text);
};

export const verifySubheader = (text) => {
	verifyText(ReportsPage.subheaderTextCss, text);
};

export const verifyTitle = (text) => {
	verifyText(ReportsPage.titleCss, text);
};

export const verifyCheckboxState = (index, state) => {
	verifyStateByIndex(ReportsPage.checkboxCss, index, state);
};
