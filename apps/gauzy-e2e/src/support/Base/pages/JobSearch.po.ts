import {
	verifyElementIsVisible,
	clickButton,
	waitElementToHide,
	clickButtonByIndex,
	verifyElementNotExist
} from '../utils/util';
import { JobSearchPage } from '../pageobjects/JobSearchPageObject';

export const searchInputVisible = () => {
	verifyElementIsVisible(JobSearchPage.searchInputCss);
};

export const filterButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.filterButtonCss);
};

export const hideAllButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.hideAllButtonCss);
};

export const clickHideAllButton = () => {
	clickButton(JobSearchPage.hideAllButtonCss);
};

export const confirmHideButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.confirmHideJobsButtonCss);
};

export const clickConfirmHideButton = () => {
	clickButton(JobSearchPage.confirmHideJobsButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(JobSearchPage.toastrMessageCss);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.viewButtonCss);
};

export const applyButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.applyButtonCss);
};

export const hideButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.hideButtonCs);
};

export const toggleButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.nbToggleCss);
};

export const clickToggleButton = (index) => {
	clickButtonByIndex(JobSearchPage.nbToggleCss, index);
};

export const refreshButtonVisible = () => {
	verifyElementIsVisible(JobSearchPage.refreshButtonCss);
};

export const refreshButtonNotVisible = () => {
	verifyElementNotExist(JobSearchPage.refreshButtonCss);
};
