import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	clearField,
	clickButtonByIndex,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { ManageOrganizationPage } from '../../../src/support/Base/pageobjects/ManageOrganizationPageObject';

// The Manage (edit) form reuses the exact same dropdown components as the Add dialog:
// ga-currency / ga-country / ga-timezone-selector are <ng-select appendTo="body"> (options render
// as div.ng-option in a body-level ng-dropdown-panel and open on MOUSEDOWN), while startWeekOn /
// defaultValueDateType / regionCode / numberFormat / dateFormat are <nb-select> (options render as
// nb-option in a cdk overlay). Both kinds sit in overlays that a fading dialog/spinner backdrop can
// cover, so a coordinate click (even {force:true}) lands on the backdrop. The two helpers below
// dispatch mousedown/mouseup/click straight to the element via the DOM so the open/select fires
// regardless of any overlay — the same proven approach as AddOrganization.po.ts.
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
					.locator(
						'div.ng-option, .ng-dropdown-panel .ng-option, .option-list nb-option, .cdk-overlay-container nb-option'
					)
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

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const manageBtnExists = async () => verifyElementIsVisible(ManageOrganizationPage.manageButtonCss);

// Manage opens the edit form. dispatchClick so a fading row-selection/list backdrop can't intercept
// it, then wait for the Main-tab name input so the caller doesn't race the navigation/render.
export const manageBtnClick = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ManageOrganizationPage.manageButtonCss);
	await getPage()
		.locator(ManageOrganizationPage.organizationNameFieldCss)
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
	await getPage().waitForTimeout(800);
};

export const verifyOrganisationNameField = async () =>
	verifyElementIsVisible(ManageOrganizationPage.organizationNameFieldCss);

export const enterOrganizationName = async (data: string) => {
	await clearField(ManageOrganizationPage.organizationNameFieldCss);
	await enterInput(ManageOrganizationPage.organizationNameFieldCss, data);
};

// Currency is a <ng-select> — open via DOM dispatch and pick from the body-level panel.
export const selectCurrency = async (data: string) => {
	await openDropdown(ManageOrganizationPage.currencyFieldCss);
	await clickOptionByText(data);
};

export const enterOfficialName = async (data: string) => enterInput(ManageOrganizationPage.officialNameFieldCss, data);

export const enterTaxId = async (data: string) => enterInput(ManageOrganizationPage.taxFieldCss, data);

export const tabButtonVisible = async () => verifyElementIsVisible(ManageOrganizationPage.tabButtonCss);

// Switch settings tab (Main=0, Location=1, Settings=2). dispatchClick so a lingering overlay from a
// just-closed dropdown panel can't swallow the tab click.
export const clickTabButton = async (index: number) => {
	await waitForSpinnerGone();
	await clickButtonByIndex(ManageOrganizationPage.tabButtonCss, index);
	await getPage().waitForTimeout(800);
};

export const verifyOrganizationExists = async (text: string) =>
	verifyText(ManageOrganizationPage.verifyOrganizationCss, text);

export const waitMessageToHide = async () => waitElementToHide(ManageOrganizationPage.toastrMessageCss);

export const countryDropdownVisible = async () =>
	getPage().locator(ManageOrganizationPage.countryDropdownCss).first().waitFor({ state: 'attached', timeout: 24000 });

export const clickCountryDropdown = async () => openDropdown(ManageOrganizationPage.countryDropdownCss);

export const selectCountryFromDropdown = async (text: string) => clickOptionByText(text);

export const cityInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.cityInputCss);

export const enterCityInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.cityInputCss);
	await enterInput(ManageOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.postCodeInputCss);

export const enterPostcodeInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.postCodeInputCss);
	await enterInput(ManageOrganizationPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.streetInputCss);

export const enterStreetInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.streetInputCss);
	await enterInput(ManageOrganizationPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.bonusTypeDropdownCss);

export const clickBonusTypeDropdown = async () => openDropdown(ManageOrganizationPage.bonusTypeDropdownCss);

export const selectBonusTypeFromDropdown = async (text: string) => clickOptionByText(text);

export const bonusPercentageInputVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.bonusPercentageCss);

export const enterBonusPercentageInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.bonusPercentageCss);
	await enterInput(ManageOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.expiryPeriodInputCss);

export const enterExpiryPeriodInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.expiryPeriodInputCss);
	await enterInput(ManageOrganizationPage.expiryPeriodInputCss, data);
};

// timeZone is a <ng-select> (ga-timezone-selector) — open via DOM dispatch, options are div.ng-option.
export const timeZoneDropdownVisible = async () =>
	getPage().locator(ManageOrganizationPage.timeZoneDropdownCss).first().waitFor({ state: 'attached', timeout: 24000 });

export const clickTimeZoneDropdown = async () => openDropdown(ManageOrganizationPage.timeZoneDropdownCss);

export const selectTimeZoneFromDropdown = async (text: string) => clickOptionByText(text);

export const startOfWeekDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.startOfWeekDropdownCss);

export const clickStartOfWeekDropdown = async () => openDropdown(ManageOrganizationPage.startOfWeekDropdownCss);

export const selectStartOfWeekFromDropdown = async (text: string) => clickOptionByText(text);

export const dateTypeDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.dateTypeDropdownCss);

export const clickDateTypeDropdown = async () => openDropdown(ManageOrganizationPage.dateTypeDropdownCss);

export const selectDateTypeFromDropdown = async (text: string) => clickOptionByText(text);

export const regionDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.regionCodeDropdownCss);

export const clickRegionDropdown = async () => openDropdown(ManageOrganizationPage.regionCodeDropdownCss);

export const selectRegionFromDropdown = async (text: string) => clickOptionByText(text);

export const numberFormatDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.numberFormatDropdownCss);

export const clickNumberFormatDropdown = async () => openDropdown(ManageOrganizationPage.numberFormatDropdownCss);

export const selectNumberFormatFromDropdown = async (text: string) => clickOptionByText(text);

export const dateFormatDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.dateFormatDropdownCss);

export const clickDateFormatDropdown = async () => openDropdown(ManageOrganizationPage.dateFormatDropdownCss);

export const selectDateFormatFromDropdown = async () => {
	// dateFormat options preview the 'L' moment format. The region selected just before this is
	// English (United States) -> moment 'en' -> 'L' renders as MM/DD/YYYY (not DD/MM/YYYY).
	const today = dayjs().format('MM/DD/YYYY');
	await clickOptionByText(today);
};

export const saveButtonVisible = async () => verifyElementIsVisible(ManageOrganizationPage.saveButtonCss);

// Save the Main tab. dispatchClick so a fading dropdown-panel/overlay can't intercept the click.
export const clickSaveButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(ManageOrganizationPage.saveButtonCss);
};

// Select the (last) grid row to enable the toolbar Manage button. The row click TOGGLES selection,
// so settle first, click once, then poll the real `disabled` attribute of the Manage button and
// only re-click if selection was lost — never rapid re-click.
export const selectTableRow = async () => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ManageOrganizationPage.tableRowCss).last();
	const manageBtn = page.locator(ManageOrganizationPage.manageButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true }).catch(() => {});
		try {
			await manageBtn.waitFor({ state: 'visible', timeout: 3000 });
			const disabled = await manageBtn.getAttribute('disabled');
			if (disabled === null) return; // enabled => row is selected
		} catch {
			/* button not rendered yet — retry */
		}
		await page.waitForTimeout(1000);
	}
};
