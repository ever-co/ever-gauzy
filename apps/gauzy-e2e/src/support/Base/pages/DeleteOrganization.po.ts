import { verifyElementIsVisible, clickButtonByIndex } from '../utils/util';
import { DeleteOrganizationPage } from '../pageobjects/DeleteOrganizationPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(DeleteOrganizationPage.gridButtonCss, index);
};

export const deleteBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

export const deleteBtnClick = (index) => {
	clickButtonByIndex(DeleteOrganizationPage.deleteButtonCss, index);
};

export const confirmBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.confirmDeleteCss);
};

export const confirmBtnClick = (index) => {
	clickButtonByIndex(DeleteOrganizationPage.confirmDeleteCss, index);
};
