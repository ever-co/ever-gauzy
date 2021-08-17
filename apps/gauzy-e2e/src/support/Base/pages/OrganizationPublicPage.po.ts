import {
	clickButton,
	clickByText,
	clickElementByText,
	enterInput,
	verifyByText,
	verifyElementIsVisible,
	waitElementToHide,
	waitUntil
} from './../utils/util';
import { OrganizationPublicPage } from '../pageobjects/OrganizationPublicPagePageObject';

export const organizationDropdownVisible = () => {
	verifyElementIsVisible(OrganizationPublicPage.organizationDropdownCss);
};

export const clickOrganizationDropdown = () => {
	clickButton(OrganizationPublicPage.organizationDropdownCss);
};

export const selectOrganization = (name: string) => {
	clickElementByText(
		OrganizationPublicPage.organizationDropdownOptionsCss,
		name
	);
};

export const organizationNameFilterInputVisible = () => {
	verifyElementIsVisible(OrganizationPublicPage.nameFilterInputCss);
};

export const enterOrganizationNameFilterInputData = (name: string) => {
	enterInput(OrganizationPublicPage.nameFilterInputCss, name);
	waitUntil(2000);
};

export const verifyOrganizationNameTableRowContains = (text: string) => {
	verifyByText(OrganizationPublicPage.organizationNameTableCellCss, text);
};

export const selectOrganizationTableRow = () => {
	clickButton(OrganizationPublicPage.organizationTableRowCss);
};

export const manageBtnExists = () => {
	verifyElementIsVisible(OrganizationPublicPage.manageButtonCss);
};

export const manageBtnClick = () => {
	clickButton(OrganizationPublicPage.manageButtonCss);
};

export const profileLinkInputVisisble = () => {
	waitUntil(1000);
	verifyElementIsVisible(OrganizationPublicPage.profileLinkInputCss);
};

export const enterProfileLinkInputData = (data: string) => {
	enterInput(OrganizationPublicPage.profileLinkInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationPublicPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationPublicPage.saveButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationPublicPage.toastrMessageCss);
};
