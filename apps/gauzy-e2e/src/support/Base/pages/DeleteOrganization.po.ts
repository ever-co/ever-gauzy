import { verifyElementIsVisible, clickButtonByIndex } from '../utils/util';
import { DeleteOrganizationPage } from '../pageobjects/DeleteOrganizationPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.gridButtonCss);
};

export const gridBtnClick = () => {
	clickButtonByIndex(DeleteOrganizationPage.gridButtonCss, 0);
};

export const deleteBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

export const deleteBtnClick = () => {
	clickButtonByIndex(DeleteOrganizationPage.deleteButtonCss, 2);
};

export const confirmBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.confirmDeleteCss);
};

export const confirmBtnClick = () => {
	clickButtonByIndex(DeleteOrganizationPage.confirmDeleteCss, 0);
};
