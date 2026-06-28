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
	waitForSpinnerGone,
	dispatchClick,
	verifyText
} from '../util';
import { getPage } from '../page-context';
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
	// no-op open: this is an ng-select (#departmentsSelect, appendTo="body") that opens on MOUSEDOWN.
	// A coordinate/force click only focuses the control (combobox goes [active]) but the cdk overlay
	// panel never renders, so its 'div.ng-option' options never appear (the round-2 timeout). The
	// keyboard open below (in selectProjectOrContactFromDropdown) drives the panel reliably, so this
	// wrapper is intentionally inert to avoid the focus-only click closing/no-opening the panel.
};

export const selectProjectOrContactFromDropdown = async (index: number) => {
	const page = getPage();
	const control = page.locator(EditEmployeePage.projectOrContactsDropdownCss);
	const input = control.locator('input').first();
	const option = page.locator(EditEmployeePage.projectOrContactDropdownOptionCss);
	// Open the ng-select via the keyboard (focus the search input + ArrowDown), NOT a click: ng-select
	// opens on mousedown and a leftover stepper/dialog backdrop swallows a coordinate click, so the
	// option panel never rendered. Retry the focus+ArrowDown until 'div.ng-option' shows, then pick it.
	for (let i = 0; i < 6; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(700);
	}
	await clickButtonByIndex(EditEmployeePage.projectOrContactDropdownOptionCss, index);
};

export const saveProjectOrContactButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const clickSaveProjectOrContactButton = async () => {
	// dispatchClick: the just-closed ng-select panel leaves a fading cdk overlay over this footer "Add"
	// button, so a coordinate click lands on the overlay. Dispatch fires submitForm() directly (the
	// button only gates on form.invalid, which is satisfied once an option is picked).
	await waitForSpinnerGone();
	await dispatchClick(EditEmployeePage.saveProjectOrContactButtonCss);
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
