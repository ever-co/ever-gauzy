import {
	verifyElementIsVisible,
	verifyText,
	verifyTextByIndex
} from '../utils/util';
import { ImportExportPage } from '../pageobjects/ImportExportPageObject';

export const headerTextExist = (text) => {
	verifyText(ImportExportPage.headerTextCss, text);
};

export const subheaderTextExist = (text) => {
	verifyText(ImportExportPage.subheaderTextCss, text);
};

export const infoTextExist = (text) => {
	verifyText(ImportExportPage.infoTextCss, text);
};

export const importButtonVisible = () => {
	verifyElementIsVisible(ImportExportPage.importButtonCss);
};

export const exportButtonVisible = () => {
	verifyElementIsVisible(ImportExportPage.exportButtonCss);
};

export const downloadButtonVisible = () => {
	verifyElementIsVisible(ImportExportPage.downloadTemplatesButtonCss);
};
