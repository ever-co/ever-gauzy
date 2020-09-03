import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex
} from '../utils/util';
import { DeleteOrganizationPage } from '../pageobjects/DeleteOrganizationPageObject';

export const tableExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.table);
};

export const selectTableRow = () => {
	cy.get(DeleteOrganizationPage.table).eq(2);
};

export const deleteBtnExists = () => {
	verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

export const deleteBtnClick = () => {
	clickButton(DeleteOrganizationPage.deleteButtonCss);
};

export const clickDashboardCard = (data) => {
	clickButtonByIndex(DeleteOrganizationPage.gotoDashboardCardCss, data);
};
