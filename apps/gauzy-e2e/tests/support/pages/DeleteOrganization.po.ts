import { verifyElementIsVisible, clickButtonByIndex, clickOrganizationByIndex } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { DeleteOrganizationPage } from '../../../src/support/Base/pageobjects/DeleteOrganizationPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number = 1) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const deleteBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

export const deleteBtnClick = async (index: number = 0) => {
	await clickButtonByIndex(DeleteOrganizationPage.deleteButtonCss, index);
};

export const confirmBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.confirmDeleteCss);
};

export const confirmBtnClick = async (index: number = 0) => {
	await clickButtonByIndex(DeleteOrganizationPage.confirmDeleteCss, index);
};

export const selectOrganization = async (index: number) => {
	await clickOrganizationByIndex(DeleteOrganizationPage.selectOrganization, index);
};
