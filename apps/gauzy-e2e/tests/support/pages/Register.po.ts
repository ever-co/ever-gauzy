import dayjs from 'dayjs';
import {
	clickButton,
	clickButtonByIndex,
	enterInput,
	getLastElement,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RegisterPage } from '../../../src/support/Base/pageobjects/RegisterPageObject';

// The first-organization onboarding screen renders the organizations-step-form component, wrapped in
// `<nb-card [nbSpinner]="loading">`. On a slow/seeded stack the spinner overlay (pointer-events:auto)
// can eat coordinate clicks even with {force:true}, and the step's ng-select dropdowns (country/timezone,
// appendTo="body") open on MOUSEDOWN — a Playwright force-click lands on a fading backdrop or fails to
// open them. The helpers below dispatch the interaction straight to the element via the DOM so it fires
// regardless of the overlay (same proven approach used by AddOrganization.po for this exact component).

// Open an ng-select / nb-select by dispatching mousedown/mouseup/click on its host, then confirm the
// option panel actually rendered (retrying). ng-select opens via the .ng-select-container; nb-select
// opens on the host button.
const openDropdown = async (selector: string) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const dispatched = await getPage().evaluate((sel) => {
			const host = document.querySelector(sel);
			const container =
				(host?.querySelector('.ng-select-container') as HTMLElement | null) ??
				(host?.querySelector('button') as HTMLElement | null) ??
				(host as HTMLElement | null);
			if (!container) return false;
			container.scrollIntoView({ block: 'center' });
			for (const type of ['mousedown', 'mouseup', 'click']) {
				container.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
			}
			return true;
		}, selector);
		if (dispatched) {
			try {
				await getPage()
					.locator('div.ng-option, .ng-dropdown-panel .ng-option, .option-list nb-option, .cdk-overlay-container nb-option')
					.first()
					.waitFor({ state: 'visible', timeout: 5000 });
				return;
			} catch {
				/* panel didn't render yet — retry */
			}
		}
		await getPage().waitForTimeout(600);
	}
};

// Option panels (ng-select .ng-option / nb-select nb-option) live in overlays that can sit under the
// same spinner stacking context — dispatch the click on the matching option via DOM.
const OPTION_SELECTOR =
	'div.ng-option, .ng-dropdown-panel .ng-option, .option-list nb-option, .cdk-overlay-container nb-option';

const clickOptionByText = async (text: string) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const clicked = await getPage().evaluate(
			({ sel, wanted }: { sel: string; wanted: string }) => {
				const opts = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
				const match = opts.find((o) =>
					(o.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(wanted.toLowerCase())
				);
				if (!match) return false;
				match.scrollIntoView({ block: 'center' });
				for (const type of ['mousedown', 'mouseup', 'click']) {
					match.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
				}
				return true;
			},
			{ sel: OPTION_SELECTOR, wanted: text }
		);
		if (clicked) return true;
		await getPage().waitForTimeout(500);
	}
	return false;
};

// Stepper forward/confirm buttons are subject to the same overlay; click the currently-visible matching
// button via a DOM dispatch. nb-stepper renders only the selected step's content, but we still scope to
// the stepper and only match visible (offsetParent != null), enabled buttons. Case-insensitive label match.
const clickFormButtonByText = async (texts: string[]) => {
	await waitForSpinnerGone();
	await getPage().waitForTimeout(400);
	for (let attempt = 0; attempt < 6; attempt++) {
		const clicked = await getPage().evaluate((labels: string[]) => {
			const wanted = labels.map((l) => l.toLowerCase());
			const root = document.querySelector('nb-stepper') ?? document;
			const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
			const match = buttons.find((b) => {
				if (b.disabled || b.offsetParent === null) return false;
				const t = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
				return wanted.some((w) => t === w || t.includes(w));
			});
			if (!match) return false;
			match.scrollIntoView({ block: 'center' });
			for (const type of ['mousedown', 'mouseup', 'click']) {
				match.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
			}
			return true;
		}, texts);
		if (clicked) return true;
		await getPage().waitForTimeout(500);
	}
	return false;
};

export const registerLinkVisible = async () => {
	await verifyElementIsVisible(RegisterPage.registerLinkCss);
};

export const clickRegisterLink = async (index) => {
	await clickButtonByIndex(RegisterPage.registerLinkCss, index);
};

export const enterFullName = async (data) => {
	await enterInput(RegisterPage.fullNameFieldCss, data);
};

export const enterEmail = async (data) => {
	await enterInput(RegisterPage.emailAddressFieldCss, data);
};

export const enterPassword = async (data) => {
	await enterInput(RegisterPage.passwordFieldCss, data);
};

export const enterConfirmPass = async (data) => {
	await enterInput(RegisterPage.confirmPassFieldCss, data);
};

export const clickTermAndConditionCheckBox = async () => {
	await clickButton(RegisterPage.termAndConditionCheckboxCss);
};

export const clickRegisterButton = async () => {
	await clickButton(RegisterPage.registerButtonCss);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(RegisterPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data) => {
	await enterInput(RegisterPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data) => {
	await openDropdown(RegisterPage.currencyFieldCss);
	await clickOptionByText(data);
};

export const enterOfficialName = async (data) => {
	await enterInput(RegisterPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data) => {
	await enterInput(RegisterPage.taxFieldCss, data);
};

// Advances the onboarding stepper. Steps 1-4 expose a localized "Next" button (settle the loading
// spinner first, then DOM-dispatch the click so an overlay/backdrop can't intercept it).
export const clickOnNextButton = async () => {
	await clickFormButtonByText(['Next', 'Continue']);
};

// Step 5 (Register as Employee) confirm — its status="success" "Add" button submits the onboarding
// form (submitEmployeeFeature -> createOrganization), which the app now requires before the
// complete page renders. The original 4-step Cypress flow predates this extra step.
export const clickFinishButton = async () => {
	await clickFormButtonByText(['Add', 'Finish', 'Save']);
};

export const verifyOrganizationExists = async (text) => {
	await verifyText(RegisterPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(RegisterPage.toastrMessageCss);
};

export const countryDropdownVisible = async () => {
	// ng-select host attaches lazily — wait for it to be in the DOM rather than asserting visibility.
	await getPage().locator(RegisterPage.countryDropdownCss).first().waitFor({ state: 'attached', timeout: 24000 });
};

export const clickCountryDropdown = async () => {
	await openDropdown(RegisterPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await enterInput(RegisterPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await enterInput(RegisterPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.streetInputCss);
};

export const enterStreetInputData = async (data) => {
	await enterInput(RegisterPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = async () => {
	await openDropdown(RegisterPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const bonusPercentageInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = async (data) => {
	await enterInput(RegisterPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = async (data) => {
	await enterInput(RegisterPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => {
	await getPage().locator(RegisterPage.timeZoneDropdownCss).first().waitFor({ state: 'attached', timeout: 24000 });
};

export const clickTimeZoneDropdown = async () => {
	await openDropdown(RegisterPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const startOfWeekDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = async () => {
	await openDropdown(RegisterPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const dateTypeDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = async () => {
	await openDropdown(RegisterPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const regionDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = async () => {
	await openDropdown(RegisterPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const numberFormatDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = async () => {
	await openDropdown(RegisterPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = async (text) => {
	await clickOptionByText(text);
};

export const dateFormatDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = async () => {
	await openDropdown(RegisterPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = async () => {
	// dateFormat options preview the moment 'L' format. The region selected just before this is
	// English (United States) -> moment 'en' -> 'L' renders as MM/DD/YYYY (not DD/MM/YYYY).
	const today = dayjs().format('MM/DD/YYYY');
	await clickOptionByText(today);
};

export const selectTableRow = async () => {
	await getLastElement(RegisterPage.tableRowCss);
};

export const verifyLogoExists = async () => {
	await verifyElementIsVisible(RegisterPage.verifyLogoCss);
};
