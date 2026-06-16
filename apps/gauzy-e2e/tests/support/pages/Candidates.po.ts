import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CandidatesPage } from '../../../src/support/Base/pageobjects/CandidatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	await clickButton(CandidatesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await enterInputConditionally(CandidatesPage.emailInputCss, data);
};

export const inviteDateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.dateInputCss);
};

export const enterInviteDateInputData = async () => {
	await clearField(CandidatesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(CandidatesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(CandidatesPage.selectTableRowCss, index);
};

export const sendInviteButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = async () => {
	await clickButton(CandidatesPage.sendInviteButtonCss);
};

export const addCandidateButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addButtonCss);
};

export const clickAddCandidateButton = async (index) => {
	await clickButtonByIndex(CandidatesPage.addButtonCss, index);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.firstNameInputCss);
};

export const enterFirstNameInputData = async (data) => {
	await clearField(CandidatesPage.firstNameInputCss);
	await enterInput(CandidatesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.lastNameInputCss);
};

export const enterLastNameInputData = async (data) => {
	await clearField(CandidatesPage.lastNameInputCss);
	await enterInput(CandidatesPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.usernameInputCss);
};

export const enterUsernameInputData = async (data) => {
	await clearField(CandidatesPage.usernameInputCss);
	await enterInput(CandidatesPage.usernameInputCss, data);
};

export const candidateEmailInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.newCandidateEmailInputCss);
};

export const enterCandidateEmailInputData = async (data) => {
	await clearField(CandidatesPage.newCandidateEmailInputCss);
	await enterInput(CandidatesPage.newCandidateEmailInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await clearField(CandidatesPage.passwordInputCss);
	await enterInput(CandidatesPage.passwordInputCss, data);
};

export const candidateDateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.newCandidateDateInputCss);
};

export const enterCandidateDateInputData = async () => {
	await clearField(CandidatesPage.newCandidateDateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(CandidatesPage.newCandidateDateInputCss, date);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addTagsDropdownCss);
};

export const clickAddTagsDropdown = async () => {
	await clickButton(CandidatesPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(CandidatesPage.tagsDropdownOption, index);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.imageInputCss);
};

export const enterImageInputData = async (data) => {
	await enterInput(CandidatesPage.imageInputCss, data);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.nextButtonCss);
};

export const clickNextButton = async () => {
	await clickButton(CandidatesPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	await clickButton(CandidatesPage.nextStepButtonCss);
};

export const allCurrentCandidatesButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const clickAllCurrentCandidatesButton = async () => {
	await clickButton(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectLastTableRow = async () => {
	await getLastElement(CandidatesPage.selectTableRowCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.editButtonCss);
};

export const includeArchiveButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.checkboxButtonCss);
};

export const clickIncludeArchiveButton = async () => {
	await clickButton(CandidatesPage.checkboxButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(CandidatesPage.editButtonCss);
};

export const archiveButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.archiveButtonCss);
};

export const clickArchiveButton = async () => {
	await clickButton(CandidatesPage.archiveButtonCss);
};

export const rejectButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.rejectButtonCss);
};

export const clickRejectButton = async () => {
	await clickButton(CandidatesPage.rejectButtonCss);
};

export const locationButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.locationButtonCss);
};

export const clickLocationButton = async () => {
	await clickButton(CandidatesPage.locationButtonCss);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(CandidatesPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	await clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(CandidatesPage.cityInputCss);
	await enterInput(CandidatesPage.cityInputCss, data);
};

export const addressOneInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addressOneInputCss);
};

export const enterAddressOneInputData = async (data) => {
	await clearField(CandidatesPage.addressOneInputCss);
	await enterInput(CandidatesPage.addressOneInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(CandidatesPage.postCodeInputCss);
	await enterInput(CandidatesPage.postCodeInputCss, data);
};

export const saveActionButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveActionButton = async () => {
	await clickButton(CandidatesPage.saveActionButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(CandidatesPage.backButtonCss);
};

export const saveEditButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveEditButtonCss);
};

export const clickSaveEditButton = async () => {
	await clickButton(CandidatesPage.saveEditButtonCss);
};

export const ratesButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.ratesButtonCss);
};

export const clickRatesButton = async () => {
	await clickButton(CandidatesPage.ratesButtonCss);
};

export const payPeriodDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = async () => {
	await clickButton(CandidatesPage.payPeriodDropdownCss);
};

export const selectPayPeriodFromDropdown = async (text) => {
	await clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const billRateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.billRateInputCss);
};

export const enterBillRateInputData = async (data) => {
	await clearField(CandidatesPage.billRateInputCss);
	await enterInput(CandidatesPage.billRateInputCss, data);
};

export const saveBillRateButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveBillRateButton = async () => {
	await clickButton(CandidatesPage.saveActionButtonCss);
};

export const experienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.experienceButtonCss);
};

export const clickExperienceButton = async () => {
	await clickButton(CandidatesPage.experienceButtonCss);
};

export const addExperienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addExperienceButtonCss);
};

export const clickAddExperienceButton = async () => {
	await clickButton(CandidatesPage.addExperienceButtonCss);
};

export const schoolNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.schoolNameInputCss);
};

export const enterSchoolNameInputData = async (data) => {
	await clearField(CandidatesPage.schoolNameInputCss);
	await enterInput(CandidatesPage.schoolNameInputCss, data);
};

export const degreeInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.degreeInputCss);
};

export const enterDegreeInputData = async (data) => {
	await clearField(CandidatesPage.degreeInputCss);
	await enterInput(CandidatesPage.degreeInputCss, data);
};

export const saveExperienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveExperienceButtonCss);
};

export const clickSaveExperienceButton = async () => {
	await clickButton(CandidatesPage.saveExperienceButtonCss);
};

export const confirmActionButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.confirmActionButtonCss);
};

export const clickConfirmActionButton = async () => {
	await clickButton(CandidatesPage.confirmActionButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(CandidatesPage.toastrMessageCss);
};

export const verifyCandidateExists = async (text) => {
	await verifyText(CandidatesPage.verifyCandidateCss, text);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(CandidatesPage.verifyCandidateCss);
};

export const verifyBadgeClass = async () => {
	await verifyElementIsVisible(CandidatesPage.badgeCss);
};
