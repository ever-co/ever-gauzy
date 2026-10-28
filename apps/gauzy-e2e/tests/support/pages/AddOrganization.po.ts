import dayjs from 'dayjs';
import { expect } from '@playwright/test';
import {
	enterInput,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide,
	clearField,
	getLastElement,
	dispatchClick,
	scopeGridTo
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
					.locator('div.ng-option:not(.ng-option-disabled), .ng-dropdown-panel .ng-option:not(.ng-option-disabled), .option-list nb-option, .cdk-overlay-container nb-option')
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
// ':not(.ng-option-disabled)' is load-bearing: ng-select renders its own 'No items found' / 'Loading…'
// rows with the same ng-option class, so an index/text pick could land on a placeholder ng-select ignores.
const OPTION_SELECTOR =
	'div.ng-option:not(.ng-option-disabled), .ng-dropdown-panel .ng-option:not(.ng-option-disabled), .option-list nb-option, .cdk-overlay-container nb-option';

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
	// Fail closed. Returning false let the caller carry on with the value never
	// committed, so the spec died later somewhere unrelated — the same swallowed
	// failure this file is meant to remove.
	throw new Error(`No selectable option matching "${text}" appeared (placeholders such as "No items found" are excluded by design)`);
};

/** Steps the stepper has moved past: the header indicator marks each one `.done`, so this IS selectedIndex. */
const completedSteps = async (): Promise<number> =>
	getPage()
		.locator(AddOrganizationPage.stepIndicatorDoneCss)
		.count()
		.catch(() => 0);

const visibleToastText = async (): Promise<string> =>
	((await getPage()
		.locator('nb-toast')
		.allInnerTexts()
		.catch(() => [] as string[])) as string[])
		.join(' | ')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Press the organization step form's primary footer action and PROVE it took effect.
 *
 * Shared by every flow that drives ga-organizations-step-form: the Add Organization dialog
 * (add/delete/manage-organization, organization-public-page) and the first-organization onboarding page
 * (register). Since #10608 (ffc762ee8a) the actions are no longer inside nb-stepper: the card footer holds
 * Back / Cancel and ONE primary button — "Continue" ("Skip" on a blank location step) on every step but
 * the last, "Create organization" on the last (step 4 in the dialog, step 5 "Employee" when onboarding).
 * The old helper searched `nb-stepper` for a "Next"/"Add" label, found nothing and returned false
 * SILENTLY, so the stepper never moved and the spec died a step later on `ga-country`.
 *
 * - The button is matched structurally (footer + status="primary"), not by label.
 * - `[disabled]="!canContinue(stepper.selectedIndex)"` reflects the step's form validity, so waiting for
 *   it to be enabled turns an invalid step (a value that never committed) into an error naming the step.
 * - The click is dispatched at the element: the card is `[nbSpinner]="loading"` (onboarding starts loading),
 *   whose overlay would take a coordinate click.
 * - Not the last step: the indicator must advance by one, else this fails here.
 * - Last step: the form must go away (the dialog closes with the values / onboarding routes to
 *   /onboarding/complete), else this fails here with any toast the app raised.
 *
 * @param expected Optional guard for callers that know which action they mean to press.
 */
export const advanceStepForm = async (expected?: 'continue' | 'create'): Promise<void> => {
	const page = getPage();
	const button = page.locator(AddOrganizationPage.stepFormPrimaryButtonCss).first();
	await button.waitFor({ state: 'visible', timeout: 24_000 });

	const total = await page.locator(AddOrganizationPage.stepIndicatorCss).count();
	const current = await completedSteps();
	const isLast = current >= total - 1;
	const label = ((await button.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
	if (expected && (expected === 'create') !== isLast) {
		throw new Error(
			`Expected the organization form's "${expected}" action but it is on step ${current + 1} of ${total} ` +
				`(primary button: "${label}").`
		);
	}

	await expect(
		button,
		`"${label}" on organization step ${current + 1}/${total} stayed disabled — that step's form is invalid`
	).toBeEnabled({ timeout: 24_000 });

	if (!isLast) {
		for (let attempt = 0; attempt < 3; attempt++) {
			if ((await completedSteps()) > current) return;
			await button.dispatchEvent('click');
			try {
				await expect.poll(completedSteps, { timeout: 8_000 }).toBeGreaterThan(current);
				return;
			} catch {
				/* goNext() returned early (the onboarding card was still loading) — press again */
			}
		}
		throw new Error(`"${label}" on organization step ${current + 1}/${total} did not advance the stepper.`);
	}

	await button.dispatchEvent('click');
	try {
		await page.locator(AddOrganizationPage.stepFormCss).first().waitFor({ state: 'detached', timeout: 60_000 });
	} catch {
		throw new Error(
			`"${label}" on the last organization step (${total}/${total}) did not submit — the form is still open. ` +
				`Toasts: ${(await visibleToastText()) || 'none'}`
		);
	}
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

// Advances the stepper: "Continue" on steps 1-3, "Create organization" on the final settings step — the
// single spec helper covers all four calls without the caller needing to know which step it's on.
export const clickOnNextButton = async () => {
	await advanceStepForm();
};

export const verifyOrganizationExists = async (text: string) => {
	// The grid pages at 10 rows over an organization list that grows as the shard runs, so narrow it to the
	// name first (best-effort: a missing filter row leaves the assertion exactly as it was).
	await scopeGridTo(AddOrganizationPage.nameFilterInputCss, text);
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
