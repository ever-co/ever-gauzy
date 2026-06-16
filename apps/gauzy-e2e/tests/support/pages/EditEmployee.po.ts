import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyValue,
	clickButtonByIndex,
	waitElementToHide,
	verifyText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditEmployeePage } from '../../../src/support/Base/pageobjects/EditEmployeePageObject';

export const selectEmployeeByName = async (name: string) => {
	await clickElementByText(EditEmployeePage.employeeCss, name);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.editButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(EditEmployeePage.editButtonCss);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.usernameInputCss);
};

export const enterUsernameInputData = async (data: string) => {
	await clearField(EditEmployeePage.usernameInputCss);
	await enterInput(EditEmployeePage.usernameInputCss, data);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditEmployeePage.firstNameInputCss);
	await enterInput(EditEmployeePage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditEmployeePage.lastNameInputCss);
	await enterInput(EditEmployeePage.lastNameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditEmployeePage.emailInputCss);
	await enterInput(EditEmployeePage.emailInputCss, data);
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.preferredLanguageCss);
};

export const chooseLanguage = async (data: string) => {
	await clickButton(EditEmployeePage.preferredLanguageCss);
	await clickElementByText(EditEmployeePage.dropdownOptionCss, data);
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.tabButtonCss);
};

export const clickTabButton = async (index: number) => {
	await clickButtonByIndex(EditEmployeePage.tabButtonCss, index);
};

export const linkedinInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.linkedInInputCss);
};

export const enterLinkedinInputData = async (data: string) => {
	await clearField(EditEmployeePage.linkedInInputCss);
	await enterInput(EditEmployeePage.linkedInInputCss, data);
};

export const githubInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.githubInputCss);
};

export const enterGithubInputData = async (data: string) => {
	await clearField(EditEmployeePage.githubInputCss);
	await enterInput(EditEmployeePage.githubInputCss, data);
};

export const upworkInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.upworkInputCss);
};

export const enterUpworkInputData = async (data: string) => {
	await clearField(EditEmployeePage.upworkInputCss);
	await enterInput(EditEmployeePage.upworkInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await clearField(EditEmployeePage.descriptionInputCss);
	await enterInput(EditEmployeePage.descriptionInputCss, data);
};

export const offerDateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.offerDateInputCss);
};

export const enterOfferDateData = async () => {
	await clearField(EditEmployeePage.offerDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	await enterInput(EditEmployeePage.offerDateInputCss, date);
};

export const acceptDateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.acceptDateInputCss);
};

export const enterAcceptDateData = async () => {
	await clearField(EditEmployeePage.acceptDateInputCss);
	const date = dayjs().add(2, 'd').format('MMM D, YYYY');
	await enterInput(EditEmployeePage.acceptDateInputCss, date);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(EditEmployeePage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickElementByText(EditEmployeePage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(EditEmployeePage.cityInputCss);
	await enterInput(EditEmployeePage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(EditEmployeePage.postCodeInputCss);
	await enterInput(EditEmployeePage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.addressInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(EditEmployeePage.addressInputCss);
	await enterInput(EditEmployeePage.addressInputCss, data);
};

export const payPeriodDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = async () => {
	await clickButton(EditEmployeePage.payPeriodDropdownCss);
};

export const selectPayPeriodOption = async (text: string) => {
	await clickElementByText(EditEmployeePage.dropdownOptionCss, text);
};

export const weeklyLimitInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.weeklyLimitInputCss);
};

export const enterWeeklyLimitInputData = async (data: string) => {
	await clearField(EditEmployeePage.weeklyLimitInputCss);
	await enterInput(EditEmployeePage.weeklyLimitInputCss, data);
};

export const billRateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.billRateValueInputCss);
};

export const enterBillRateInputData = async (data: string) => {
	await clearField(EditEmployeePage.billRateValueInputCss);
	await enterInput(EditEmployeePage.billRateValueInputCss, data);
};

export const addProjectOrContactButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.addProjectOrContactButtonCss);
};

export const clickAddProjectOrContactButton = async () => {
	await clickButton(EditEmployeePage.addProjectOrContactButtonCss);
};

export const projectOrContactDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.projectOrContactsDropdownCss);
};

export const clickProjectOrContactDropdown = async () => {
	await clickButton(EditEmployeePage.projectOrContactsDropdownCss);
};

export const selectProjectOrContactFromDropdown = async (index: number) => {
	await clickButtonByIndex(EditEmployeePage.projectOrContactDropdownOptionCss, index);
};

export const saveProjectOrContactButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const clickSaveProjectOrContactButton = async () => {
	await clickButton(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const verifyProjectOrContactExist = async () => {
	await verifyElementIsVisible(EditEmployeePage.verifyProjectOrContactCss);
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditEmployeePage.saveButtonCss);
};

export const saveBtnClick = async () => {
	await clickButton(EditEmployeePage.saveButtonCss);
};

export const verifyEmployee = async (text: string) => {
	await verifyText(EditEmployeePage.verifyEmployeeCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EditEmployeePage.toastrMessageCss);
};

//////////////////////////////////////////////////////////////////////////////
export const verifyFirstName = async (val: string) => {
	await verifyValue(EditEmployeePage.firstNameInputCss, val);
};

export const verifyLastName = async (val: string) => {
	await verifyValue(EditEmployeePage.lastNameInputCss, val);
};

export const verifyEmail = async (val: string) => {
	await verifyValue(EditEmployeePage.emailInputCss, val);
};
