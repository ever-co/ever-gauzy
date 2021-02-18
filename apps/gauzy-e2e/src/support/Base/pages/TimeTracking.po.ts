import { verifyElementIsVisible, verifyText } from '../utils/util';
import { TimeTrackingPage } from '../pageobjects/TimeTrackingPageObject';

export const headerTextExist = (text) => {
	verifyText(TimeTrackingPage.headerTextCss, text);
};

export const topCardTextExist = (text) => {
	verifyText(TimeTrackingPage.topCardHeaderTextCss, text);
};

export const bottomCardTextExist = (text) => {
	verifyText(TimeTrackingPage.bottomCardHeaderTextCss, text);
};
