import {
	clearField,
	clickButton,
	enterInput,
	uploadMediaInput,
	verifyElementIsVisible,
	verifyText
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
	verifyElementIsVisible(ImportExportPage.importBtnCss);
};

export const exportBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.exportBtnCss);
};

export const downloadBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.downloadTemplatesButtonCss);
};

export const clickImportBtn = () => {
	clickButton(ImportExportPage.importBtnCss);
};

export const browseFilesBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.browseFilesBtnCss);
};

export const clickBrowseFilesBtn = () => {
	clickButton(ImportExportPage.browseFilesBtnCss);
};

export const uploadFile = (filepath) => {
	uploadMediaInput(ImportExportPage.fileInputCss, filepath);
};

export const importFileBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.importFileBtnCss);
};

export const clickImportFileBtn = () => {
	clickButton(ImportExportPage.importFileBtnCss);
};

export const removeFileBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.removeFileBtnCss);
};

export const clickRemoveFileBtn = () => {
	clickButton(ImportExportPage.removeFileBtnCss);
};

export const verifyFileName = (fileName) => {
	verifyText(ImportExportPage.verifyFileNameCss, fileName);
};

export const verifyUploadStatus = () => {
	verifyElementIsVisible(ImportExportPage.verifyUploadStatusCss);
};

export const migrateBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.migrateBtnCss);
};

export const clickMigrateBtn = () => {
	clickButton(ImportExportPage.migrateBtnCss);
};

export const okBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.okBtnCss);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(ImportExportPage.passwordInputCss);
};

export const enterPassword = (pass) => {
	clearField(ImportExportPage.passwordInputCss);
	enterInput(ImportExportPage.passwordInputCss, pass);
};

export const cancelBtnVisible = () => {
	verifyElementIsVisible(ImportExportPage.cancelBtnCss);
};

export const clickCancelBtn = () => {
	clickButton(ImportExportPage.cancelBtnCss);
};
