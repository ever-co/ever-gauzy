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
} from '../utils/util';
import { EditEmployeePage } from '../pageobjects/EditEmployeePageObject';

export const selectEmployeeByName = (name) => {
	clickElementByText(EditEmployeePage.employeeCss, name);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(EditEmployeePage.editButtonCss);
};

export const clickEditButton = () => {
	clickButton(EditEmployeePage.editButtonCss);
};

export const usernameInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.usernameInputCss);
};

export const enterUsernameInputData = (data) => {
	clearField(EditEmployeePage.usernameInputCss);
	enterInput(EditEmployeePage.usernameInputCss, data);
};

export const firstNameInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.firstNameInputCss);
};

export const enterFirstNameData = (data) => {
	clearField(EditEmployeePage.firstNameInputCss);
	enterInput(EditEmployeePage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.lastNameInputCss);
};

export const enterLastNameData = (data) => {
	clearField(EditEmployeePage.lastNameInputCss);
	enterInput(EditEmployeePage.lastNameInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.emailInputCss);
};

export const enterEmailData = (data) => {
	clearField(EditEmployeePage.emailInputCss);
	enterInput(EditEmployeePage.emailInputCss, data);
};

export const languageSelectVisible = () => {
	verifyElementIsVisible(EditEmployeePage.preferredLanguageCss);
};

export const chooseLanguage = (data) => {
	clickButton(EditEmployeePage.preferredLanguageCss);
	clickElementByText(EditEmployeePage.dropdownOptionCss, data);
};

export const tabButtonVisible = () => {
	verifyElementIsVisible(EditEmployeePage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(EditEmployeePage.tabButtonCss, index);
};

export const linkedinInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.linkedInInputCss);
};

export const enterLinkedinInputData = (data) => {
	clearField(EditEmployeePage.linkedInInputCss);
	enterInput(EditEmployeePage.linkedInInputCss, data);
};

export const githubInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.githubInputCss);
};

export const enterGithubInputData = (data) => {
	clearField(EditEmployeePage.githubInputCss);
	enterInput(EditEmployeePage.githubInputCss, data);
};

export const upworkInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.upworkInputCss);
};

export const enterUpworkInputData = (data) => {
	clearField(EditEmployeePage.upworkInputCss);
	enterInput(EditEmployeePage.upworkInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.descriptionInputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(EditEmployeePage.descriptionInputCss);
	enterInput(EditEmployeePage.descriptionInputCss, data);
};

export const offerDateInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.offerDateInputCss);
};

export const enterOfferDateData = () => {
	clearField(EditEmployeePage.offerDateInputCss);
	const date = Cypress.moment().add(1, 'days').format('MMM D, YYYY');
	enterInput(EditEmployeePage.offerDateInputCss, date);
};

export const acceptDateInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.acceptDateInputCss);
};

export const enterAcceptDateData = () => {
	clearField(EditEmployeePage.acceptDateInputCss);
	const date = Cypress.moment().add(2, 'days').format('MMM D, YYYY');
	enterInput(EditEmployeePage.acceptDateInputCss, date);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(EditEmployeePage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(EditEmployeePage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(EditEmployeePage.dropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.cityInputCss);
};

export const enterCityInputData = (data) => {
	clearField(EditEmployeePage.cityInputCss);
	enterInput(EditEmployeePage.cityInputCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.postcodeInputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(EditEmployeePage.postcodeInputCss);
	enterInput(EditEmployeePage.postcodeInputCss, data);
};

export const streetInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.addressInputCss);
};

export const enterStreetInputData = (data) => {
	clearField(EditEmployeePage.addressInputCss);
	enterInput(EditEmployeePage.addressInputCss, data);
};

export const payPeriodDropdownVisible = () => {
	verifyElementIsVisible(EditEmployeePage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = () => {
	clickButton(EditEmployeePage.payPeriodDropdownCss);
};

export const selectPayPeriodOption = (text) => {
	clickElementByText(EditEmployeePage.dropdownOptionCss, text);
};

export const weeklyLimitInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.weeklyLimitInputCss);
};

export const enterWeeklyLimitInputData = (data) => {
	clearField(EditEmployeePage.weeklyLimitInputCss);
	enterInput(EditEmployeePage.weeklyLimitInputCss, data);
};

export const billRateInputVisible = () => {
	verifyElementIsVisible(EditEmployeePage.billRateValueInputCss);
};

export const enterBillRateInputData = (data) => {
	clearField(EditEmployeePage.billRateValueInputCss);
	enterInput(EditEmployeePage.billRateValueInputCss, data);
};

export const addProjectOrContactButtonVisible = () => {
	verifyElementIsVisible(EditEmployeePage.addProjectOrContactButtonCss);
};

export const clickAddProjectOrContactButton = () => {
	clickButton(EditEmployeePage.addProjectOrContactButtonCss);
};

export const projectOrContactDropdownVisible = () => {
	verifyElementIsVisible(EditEmployeePage.projectOrContactsDropdownCss);
};

export const clickProjectOrContactDropdown = () => {
	clickButton(EditEmployeePage.projectOrContactsDropdownCss);
};

export const selectProjectOrContactFromDropdown = (index) => {
	clickButtonByIndex(
		EditEmployeePage.projectOrContactDropdownOptionCss,
		index
	);
};

export const saveProjectOrContactButtonVisible = () => {
	verifyElementIsVisible(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const clickSaveProjectOrContactButton = () => {
	clickButton(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const verifyProjectOrContactExist = () => {
	verifyElementIsVisible(EditEmployeePage.verifyProjectOrContactCss);
};

export const saveBtnExists = () => {
	verifyElementIsVisible(EditEmployeePage.saveButtonCss);
};

export const saveBtnClick = () => {
	clickButton(EditEmployeePage.saveButtonCss);
};

export const verifyEmployee = (text) => {
	verifyText(EditEmployeePage.verifyEmployeeCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(EditEmployeePage.toastrMessageCss);
};

//////////////////////////////////////////////////////////////////////////////
export const verifyFirstName = (val) => {
	verifyValue(EditEmployeePage.firstNameInputCss, val);
};

export const verifyLastName = (val) => {
	verifyValue(EditEmployeePage.lastNameInputCss, val);
};

export const verifyEmail = (val) => {
	verifyValue(EditEmployeePage.emailInputCss, val);
};
