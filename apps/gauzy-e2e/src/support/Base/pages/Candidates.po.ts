import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	getLastElement
} from '../utils/util';
import { CandidatesPage } from '../pageobjects/CandidatesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(CandidatesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(CandidatesPage.gridButtonCss, index);
};

export const inviteButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.inviteButtonCss);
};

export const clickInviteButton = () => {
	clickButton(CandidatesPage.inviteButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInputConditionally(CandidatesPage.emailInputCss, data);
};

export const inviteDateInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.dateInputCss);
};

export const enterInviteDateInputData = () => {
	clearField(CandidatesPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(CandidatesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const selectTableRowVisible = () => {
	verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(CandidatesPage.selectTableRowCss, index);
};

export const sendInviteButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = () => {
	clickButton(CandidatesPage.sendInviteButtonCss);
};

export const addCandidateButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.addButtonCss);
};

export const clickAddCandidateButton = (index) => {
	clickButtonByIndex(CandidatesPage.addButtonCss, index);
};

export const firstNameInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.firstNameInputCss);
};

export const enterFirstNameInputData = (data) => {
	clearField(CandidatesPage.firstNameInputCss);
	enterInput(CandidatesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.lastNameInputCss);
};

export const enterLastNameInputData = (data) => {
	clearField(CandidatesPage.lastNameInputCss);
	enterInput(CandidatesPage.lastNameInputCss, data);
};

export const usernameInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.usernameInputCss);
};

export const enterUsernameInputData = (data) => {
	clearField(CandidatesPage.usernameInputCss);
	enterInput(CandidatesPage.usernameInputCss, data);
};

export const candidateEmailInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.newCandidateEmailInputCss);
};

export const enterCandidateEmailInputData = (data) => {
	clearField(CandidatesPage.newCandidateEmailInputCss);
	enterInput(CandidatesPage.newCandidateEmailInputCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.passwordInputCss);
};

export const enterPasswordInputData = (data) => {
	clearField(CandidatesPage.passwordInputCss);
	enterInput(CandidatesPage.passwordInputCss, data);
};

export const candidateDateInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.newCandidateDateInputCss);
};

export const enterCandidateDateInputData = () => {
	clearField(CandidatesPage.newCandidateDateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(CandidatesPage.newCandidateDateInputCss, date);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(CandidatesPage.addTagsDropdownCss);
};

export const clickAddTagsDropdown = () => {
	clickButton(CandidatesPage.addTagsDropdownCss);
};

export const selectTagsFromDrodpwon = (index) => {
	clickButtonByIndex(CandidatesPage.tagsDropdownOption, index);
};

export const imageInputvisible = () => {
	verifyElementIsVisible(CandidatesPage.imageInputCss);
};

export const enterImageInputData = (data) => {
	enterInput(CandidatesPage.imageInputCss, data);
};

export const nextButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.nextButtonCss);
};

export const clickNextButton = () => {
	clickButton(CandidatesPage.nextButtonCss);
};

export const nextStepButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.nextStepButtonCss);
};

export const clickNextStepButton = () => {
	clickButton(CandidatesPage.nextStepButtonCss);
};

export const allCurrentCandidatesButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const clickAllCurrentCandidatesButton = () => {
	clickButton(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectLastTableRow = () => {
	getLastElement(CandidatesPage.selectTableRowCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.editButtonCss);
};

export const includeArchiveButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.checkboxButtonCss);
};

export const clickIncludeArchiveButton = () => {
	clickButton(CandidatesPage.checkboxButtonCss);
};

export const clickEditButton = () => {
	clickButton(CandidatesPage.editButtonCss);
};

export const archiveButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.archiveButtonCss);
};

export const clickArchiveButton = () => {
	clickButton(CandidatesPage.archiveButtonCss);
};

export const rejectButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.rejectButtonCss);
};

export const clickRejectButton = () => {
	clickButton(CandidatesPage.rejectButtonCss);
};

export const locationButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.locationButtonCss);
};

export const clickLocationButton = () => {
	clickButton(CandidatesPage.locationButtonCss);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(CandidatesPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(CandidatesPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.cityInputCss);
};

export const enterCityInputData = (data) => {
	clearField(CandidatesPage.cityInputCss);
	enterInput(CandidatesPage.cityInputCss, data);
};

export const addressOneInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.addressOneInputCss);
};

export const enterAddressOneInputData = (data) => {
	clearField(CandidatesPage.addressOneInputCss);
	enterInput(CandidatesPage.addressOneInputCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.postcodeInputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(CandidatesPage.postcodeInputCss);
	enterInput(CandidatesPage.postcodeInputCss, data);
};

export const saveActionButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveActionButton = () => {
	clickButton(CandidatesPage.saveActionButtonCss);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(CandidatesPage.backButtonCss);
};

export const saveEditButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.saveEditButtonCss);
};

export const clickSaveEditButton = () => {
	clickButton(CandidatesPage.saveEditButtonCss);
};

export const ratesButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.ratesButtonCss);
};

export const clickRatesButton = () => {
	clickButton(CandidatesPage.ratesButtonCss);
};

export const payPeriodDropdownVisible = () => {
	verifyElementIsVisible(CandidatesPage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = () => {
	clickButton(CandidatesPage.payPeriodDropdownCss);
};

export const selectPayPeriodFromDropdown = (text) => {
	clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const billRateInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.billRateInputCss);
};

export const enterBillRateInputData = (data) => {
	clearField(CandidatesPage.billRateInputCss);
	enterInput(CandidatesPage.billRateInputCss, data);
};

export const saveBillRateButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveBillRateButton = () => {
	clickButton(CandidatesPage.saveActionButtonCss);
};

export const experienseButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.experienseButtonCss);
};

export const clickExperienseButton = () => {
	clickButton(CandidatesPage.experienseButtonCss);
};

export const addExperienseButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.addExperienceButtonCss);
};

export const clickAddExperienseButton = () => {
	clickButton(CandidatesPage.addExperienceButtonCss);
};

export const schoolNameInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.schoolNameInputCss);
};

export const enterSchoolNameInputData = (data) => {
	clearField(CandidatesPage.schoolNameInputCss);
	enterInput(CandidatesPage.schoolNameInputCss, data);
};

export const degreeInputVisible = () => {
	verifyElementIsVisible(CandidatesPage.degreeInputCss);
};

export const enterDegreeInputData = (data) => {
	clearField(CandidatesPage.degreeInputCss);
	enterInput(CandidatesPage.degreeInputCss, data);
};

export const saveExperienseBittonVisible = () => {
	verifyElementIsVisible(CandidatesPage.saveExperisnceButtonCss);
};

export const clickSaveExperienseButton = () => {
	clickButton(CandidatesPage.saveExperisnceButtonCss);
};

export const confirmActionButtonVisible = () => {
	verifyElementIsVisible(CandidatesPage.confirmActionButtonCss);
};

export const clickConfirmActionButton = () => {
	clickButton(CandidatesPage.confirmActionButtonCss);
};
