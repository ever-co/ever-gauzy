import { verifyElementIsVisible, clickButton, waitElementToHide, clickButtonByIndex, verifyElementNotExist } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { JobSearchPage } from '../../../src/support/Base/pageobjects/JobSearchPageObject';

export const searchInputVisible = async () => verifyElementIsVisible(JobSearchPage.searchInputCss);

export const filterButtonVisible = async () => verifyElementIsVisible(JobSearchPage.filterButtonCss);

export const hideAllButtonVisible = async () => verifyElementIsVisible(JobSearchPage.hideAllButtonCss);

export const clickHideAllButton = async () => clickButton(JobSearchPage.hideAllButtonCss);

export const confirmHideButtonVisible = async () => verifyElementIsVisible(JobSearchPage.confirmHideJobsButtonCss);

export const clickConfirmHideButton = async () => clickButton(JobSearchPage.confirmHideJobsButtonCss);

export const waitMessageToHide = async () => waitElementToHide(JobSearchPage.toastrMessageCss);

export const viewButtonVisible = async () => verifyElementIsVisible(JobSearchPage.viewButtonCss);

export const applyButtonVisible = async () => verifyElementIsVisible(JobSearchPage.applyButtonCss);

export const hideButtonVisible = async () => verifyElementIsVisible(JobSearchPage.hideButtonCs);

export const toggleButtonVisible = async () => verifyElementIsVisible(JobSearchPage.nbToggleCss);

export const clickToggleButton = async (index: number) => clickButtonByIndex(JobSearchPage.nbToggleCss, index);

export const refreshButtonVisible = async () => verifyElementIsVisible(JobSearchPage.refreshButtonCss);

export const refreshButtonNotVisible = async () => verifyElementNotExist(JobSearchPage.refreshButtonCss);
