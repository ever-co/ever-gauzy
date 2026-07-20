import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	clearField,
	getLastElement,
	dispatchClick
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddOrganizationPage } from '../../../src/support/Base/pageobjects/AddOrganizationPageObject';

// The organizations add dialog (organizations-step-form) is wrapped in
// `<nb-card [nbSpinner]="loading">`; on the heavily-seeded shared DB the loading flag
// can stay set, leaving a full-card spinner overlay (pointer-events:auto) that eats
// coordinate clicks — even {force:true} lands on the spinner. The helpers below dispatch
// the interaction straight to the element via the DOM so it fires regardless of the overlay
// (same proven approach as the Customers/Contacts stepper).

// Open an ng-select / nb-select by dispatching mousedown/mouseup/click on its host, then
// confirm the option panel actually rendered (retrying). ng-select opens via the
// .ng-select-container; nb-select opens on the host button.
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

// Option panels (ng-select .ng-option / nb-select nb-option) live in overlays that can sit
// under the same spinner stacking context — dispatch the click on the matching option via DOM.
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

// Stepper Next/Add buttons are subject to the same overlay; click the currently-visible
// matching button via a DOM dispatch. nb-stepper keeps inactive step buttons in the DOM but
// hidden, so we only match visible (offsetParent != null), enabled buttons. Matched
// case-insensitively against the trimmed label (suite runs in English).
const clickFormButtonByText = async (texts: string[]) => {
	await getPage().waitForTimeout(400);
	for (let attempt = 0; attempt < 5; attempt++) {
		const clicked = await getPage().evaluate((labels: string[]) => {
			const wanted = labels.map((l) => l.toLowerCase());
			// Scope to the stepper only — the organizations list behind the dialog also has a
			// status="success" "Add" toolbar button which (being earlier in document order) would
			// otherwise be matched first on the final step. nb-stepper holds all four step buttons.
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

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addBtnExists = async () => {
	await verifyElementIsVisible(AddOrganizationPage.addButtonCss);
};

export const addBtnClick = async () => {
	// Opens the add-organization dialog. dispatchClick so a fading login/list backdrop can't
	// intercept the click. Then wait for the step-1 name input so the caller doesn't race the
	// dialog/stepper render.
	await dispatchClick(AddOrganizationPage.addButtonCss);
	await getPage()
		.locator(AddOrganizationPage.organizationNameFieldCss)
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
	await getPage().waitForTimeout(1000);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(AddOrganizationPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data: string) => {
	await clearField(AddOrganizationPage.organizationNameFieldCss);
	await enterInput(AddOrganizationPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data: string) => {
	await openDropdown(AddOrganizationPage.currencyFieldCss);
	await clickOptionByText(data);
};

export const enterOfficialName = async (data: string) => {
	await enterInput(AddOrganizationPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data: string) => {
	await enterInput(AddOrganizationPage.taxFieldCss, data);
};

// Advances the stepper. Steps 1-3 expose a "Next" button; the final settings step exposes
// the status="success" "Add" button — match either so the single spec helper covers all four
// calls without the caller needing to know which step it's on.
export const clickOnNextButton = async () => {
	// Steps 1-3 forward button is "Next"; the location step shows "Skip ... and Continue" when
	// the address is blank (we fill it, so normally "Next") — include "Continue" as a safety net;
	// the final settings step's confirm is the "Add" button.
	await clickFormButtonByText(['Next', 'Continue', 'Add']);
};

export const verifyOrganizationExists = async (text: string) => {
	await verifyText(AddOrganizationPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddOrganizationPage.toastrMessageCss);
};

export const countryDropdownVisible = async () => {
	await getPage()
		.locator(AddOrganizationPage.countryDropdownCss)
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickCountryDropdown = async () => {
	await openDropdown(AddOrganizationPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(AddOrganizationPage.cityInputCss);
	await enterInput(AddOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(AddOrganizationPage.postCodeInputCss);
	await enterInput(AddOrganizationPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.streetInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(AddOrganizationPage.streetInputCss);
	await enterInput(AddOrganizationPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = async () => {
	await openDropdown(AddOrganizationPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const bonusPercentageInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = async (data: string) => {
	await clearField(AddOrganizationPage.bonusPercentageCss);
	await enterInput(AddOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = async (data: string) => {
	await clearField(AddOrganizationPage.expiryPeriodInputCss);
	await enterInput(AddOrganizationPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => {
	await getPage()
		.locator(AddOrganizationPage.timeZoneDropdownCss)
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickTimeZoneDropdown = async () => {
	await openDropdown(AddOrganizationPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const startOfWeekDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = async () => {
	await openDropdown(AddOrganizationPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const dateTypeDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = async () => {
	await openDropdown(AddOrganizationPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const regionDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = async () => {
	await openDropdown(AddOrganizationPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const numberFormatDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = async () => {
	await openDropdown(AddOrganizationPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const dateFormatDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = async () => {
	await openDropdown(AddOrganizationPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = async () => {
	// dateFormat options preview the 'L' moment format. The region selected just before this
	// is English (United States) -> moment 'en' -> 'L' renders as MM/DD/YYYY (not DD/MM/YYYY).
	const today = dayjs().format('MM/DD/YYYY');
	await clickOptionByText(today);
};

export const selectTableRow = async () => {
	await getLastElement(AddOrganizationPage.tableRowCss);
};
