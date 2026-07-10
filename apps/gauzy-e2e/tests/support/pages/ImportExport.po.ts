import { clearField, clickButton, enterInput, uploadMediaInput, verifyElementIsVisible, verifyText } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ImportExportPage } from '../../../src/support/Base/pageobjects/ImportExportPageObject';

export const headerTextExist = async (text: string) => verifyText(ImportExportPage.headerTextCss, text);

export const subheaderTextExist = async (text: string) => verifyText(ImportExportPage.subheaderTextCss, text);

export const infoTextExist = async (text: string) => verifyText(ImportExportPage.infoTextCss, text);

export const importButtonVisible = async () => verifyElementIsVisible(ImportExportPage.importBtnCss);

export const exportBtnVisible = async () => verifyElementIsVisible(ImportExportPage.exportBtnCss);

export const downloadBtnVisible = async () => verifyElementIsVisible(ImportExportPage.downloadTemplatesButtonCss);

export const clickImportBtn = async () => clickButton(ImportExportPage.importBtnCss);

export const browseFilesBtnVisible = async () => verifyElementIsVisible(ImportExportPage.browseFilesBtnCss);

export const clickBrowseFilesBtn = async () => clickButton(ImportExportPage.browseFilesBtnCss);

export const uploadFile = async (filepath: string) => uploadMediaInput(ImportExportPage.fileInputCss, filepath);

export const importFileBtnVisible = async () => verifyElementIsVisible(ImportExportPage.importFileBtnCss);

export const clickImportFileBtn = async () => clickButton(ImportExportPage.importFileBtnCss);

export const removeFileBtnVisible = async () => verifyElementIsVisible(ImportExportPage.removeFileBtnCss);

export const clickRemoveFileBtn = async () => clickButton(ImportExportPage.removeFileBtnCss);

export const verifyFileName = async (fileName: string) => verifyText(ImportExportPage.verifyFileNameCss, fileName);

export const verifyUploadStatus = async () => verifyElementIsVisible(ImportExportPage.verifyUploadStatusCss);

export const migrateBtnVisible = async () => verifyElementIsVisible(ImportExportPage.migrateBtnCss);

export const clickMigrateBtn = async () => clickButton(ImportExportPage.migrateBtnCss);

export const okBtnVisible = async () => verifyElementIsVisible(ImportExportPage.okBtnCss);

export const passwordInputVisible = async () => verifyElementIsVisible(ImportExportPage.passwordInputCss);

export const enterPassword = async (pass: string) => {
	await clearField(ImportExportPage.passwordInputCss);
	await enterInput(ImportExportPage.passwordInputCss, pass);
};

export const cancelBtnVisible = async () => verifyElementIsVisible(ImportExportPage.cancelBtnCss);

export const clickCancelBtn = async () => clickButton(ImportExportPage.cancelBtnCss);
