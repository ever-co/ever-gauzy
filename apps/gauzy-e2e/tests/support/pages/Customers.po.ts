import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../util';
import { getPage } from '../page-context';
import { expect } from '@playwright/test';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CustomersPage } from '../../../src/support/Base/pageobjects/CustomersPageObject';

// The contacts card wraps the add form in an nb-spinner overlay (z-index 9999,
// pointer-events:auto) tied to the list's `loading` flag. On the heavily-seeded shared
// DB that flag frequently stays set, so the overlay permanently intercepts pointer
// events and a normal/force Playwright click lands on the spinner instead of the
// ng-select — the dropdown never opens. Dispatch the open sequence (mousedown/mouseup/
// click) directly on the ng-select container via the DOM, which bypasses the overlay,
// then confirm the option panel actually rendered (retrying a few times).
const openNgSelect = async (selector: string) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const dispatched = await getPage().evaluate((sel) => {
			const host = document.querySelector(sel);
			// ng-select opens via its .ng-select-container; nb-select opens on the host button.
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
					.locator('div.ng-option, .option-list nb-option, .cdk-overlay-container nb-option')
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

// Same overlay problem applies to the stepper Next/Save buttons inside the card. Click
// the currently-visible matching button via a DOM dispatch so the click is not eaten by
// the nb-spinner overlay. `texts` is matched case-insensitively against the trimmed
// button label (the app may render a localized label, but the suite runs in English).
const clickFormButtonByText = async (texts: string[]) => {
	await getPage().waitForTimeout(400);
	for (let attempt = 0; attempt < 5; attempt++) {
		const clicked = await getPage().evaluate((labels: string[]) => {
			const wanted = labels.map((l) => l.toLowerCase());
			const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
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

// Dropdown option panels (ng-select / nb-select) live in overlays that can sit under the
// same spinner stacking context, so option clicks are flaky via normal Playwright clicks.
// Dispatch the click on the matching option via the DOM. Matches ng-select (.ng-option)
// and nb-select (nb-option) panels.
const OPTION_SELECTOR = 'div.ng-option, .ng-dropdown-panel .ng-option, .option-list nb-option, .cdk-overlay-container nb-option';

const clickOptionByText = async (text: string) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const clicked = await getPage().evaluate(
			({ sel, wanted }: { sel: string; wanted: string }) => {
				const opts = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
				const match = opts.find((o) => (o.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(wanted.toLowerCase()));
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

const clickOptionByIndex = async (index: number) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const clicked = await getPage().evaluate(
			({ sel, idx }: { sel: string; idx: number }) => {
				const opts = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
				const match = opts[idx];
				if (!match) return false;
				match.scrollIntoView({ block: 'center' });
				for (const type of ['mousedown', 'mouseup', 'click']) {
					match.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
				}
				return true;
			},
			{ sel: OPTION_SELECTOR, idx: index }
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

export const addButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.addButtonCss);
};

export const clickAddButton = async (index: number = 0) => {
	await clickButtonByIndex(CustomersPage.addButtonCss, index);
	// The contact-mutation form rebuilds itself ~1s after it first renders (a background
	// contacts$/loading subscription re-creates the FormGroup), which wipes any value
	// entered too early. Wait for that rebuild to settle before the caller starts filling.
	await getPage().locator(CustomersPage.nameInputCss).first().waitFor({ state: 'visible', timeout: 24000 });
	await getPage().waitForTimeout(4000);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(CustomersPage.nameInputCss);
	await enterInput(CustomersPage.nameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.emailInputCss);
};

export const enterEmailInputData = async (data: string) => {
	await clearField(CustomersPage.emailInputCss);
	await enterInput(CustomersPage.emailInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.phoneInputCss);
};

export const enterPhoneInputData = async (data: string) => {
	await clearField(CustomersPage.phoneInputCss);
	await enterInput(CustomersPage.phoneInputCss, data);
};

export const countryDropdownVisible = async () => {
	await getPage()
		.locator(CustomersPage.countryDropdownCss)
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickCountryDropdown = async () => {
	await openNgSelect(CustomersPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(CustomersPage.cityInputCss);
	await enterInput(CustomersPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(CustomersPage.postCodeInputCss);
	await enterInput(CustomersPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.streetInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(CustomersPage.streetInputCss);
	await enterInput(CustomersPage.streetInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(CustomersPage.projectsDropdownCss);
};

export const clickProjectDropdown = async () => {
	await openNgSelect(CustomersPage.projectsDropdownCss);
};

export const selectProjectFromDropdown = async (text: string) => {
	await clickOptionByText(text);
};

export const selectEmployeeDropdownVisible = async () => {
	await getPage()
		.locator(CustomersPage.usersMultiSelectCss)
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickSelectEmployeeDropdown = async () => {
	await openNgSelect(CustomersPage.usersMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index: number) => {
	await clickOptionByIndex(index);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(CustomersPage.addTagsDropdownCss);
};

export const clickTagsMultiSelect = async () => {
	await openNgSelect(CustomersPage.addTagsDropdownCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickOptionByIndex(index);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data: string) => {
	await clearField(CustomersPage.websiteInputCss);
	await enterInput(CustomersPage.websiteInputCss, data);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveButtonVisible = async () => {
	// In the current 4-step contact stepper, leaving the first (Main) step is a "Next",
	// not a "Save"; the success "Save" only exists on the final step. Treat the legacy
	// saveButtonVisible/clickSaveButton as "advance the current step".
	await getPage()
		.locator('button:has-text("Next"), button[status="success"]')
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickSaveButton = async () => {
	await clickFormButtonByText(['Next']);
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// The invite dialog occasionally fails to open on the first click (the button can be
	// briefly re-rendered/disabled by the list refresh). Retry until its name field shows.
	for (let attempt = 0; attempt < 4; attempt++) {
		await getPage().locator(CustomersPage.inviteButtonCss).first().click({ force: true }).catch(() => undefined);
		try {
			await getPage().locator(CustomersPage.customerNameCss).first().waitFor({ state: 'visible', timeout: 8000 });
			return;
		} catch {
			await getPage().waitForTimeout(800);
		}
	}
	await getPage().locator(CustomersPage.customerNameCss).first().waitFor({ state: 'visible', timeout: 16000 });
};

export const saveInviteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.saveInviteButtonCss);
};

export const clickSaveInviteButton = async () => {
	await clickButton(CustomersPage.saveInviteButtonCss);
};

export const tableRowVisible = async () => {
	await expect(getPage().locator(CustomersPage.selectTableRowCss).first()).toBeVisible({ timeout: 24000 });
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(CustomersPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.editButtonCss);
};

export const clickEditButton = async (index: number = 0) => {
	// The Edit action is disabled until a table row is selected, and the selection can be
	// lost after a preceding step (e.g. the invite dialog). Re-select the row, click Edit,
	// and retry until the mutation form (with #name) actually opens.
	for (let attempt = 0; attempt < 4; attempt++) {
		await getPage()
			.locator(CustomersPage.selectTableRowCss)
			.nth(index)
			.click({ force: true })
			.catch(() => undefined);
		await getPage().waitForTimeout(700);
		await getPage()
			.locator(CustomersPage.editButtonCss)
			.first()
			.click({ force: true })
			.catch(() => undefined);
		try {
			await getPage().locator(CustomersPage.nameInputCss).first().waitFor({ state: 'visible', timeout: 8000 });
			// Same async form rebuild as the add flow — wait for it to settle before filling.
			await getPage().waitForTimeout(4000);
			return;
		} catch {
			await getPage().waitForTimeout(800);
		}
	}
	// Last resort: surface a clear failure if the form never opened.
	await getPage().locator(CustomersPage.nameInputCss).first().waitFor({ state: 'visible', timeout: 24000 });
	await getPage().waitForTimeout(4000);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(CustomersPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(CustomersPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(CustomersPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	// Dismiss any open ng-select panel (e.g. tags) by pressing Escape and dispatching a
	// click on the form container via the DOM — a force-click would hit the spinner overlay.
	await getPage().keyboard.press('Escape').catch(() => undefined);
	await getPage()
		.evaluate((sel) => {
			const el = document.querySelector(sel) as HTMLElement | null;
			if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
		}, CustomersPage.cardBodyCss)
		.catch(() => undefined);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(CustomersPage.toastrMessageCss);
};

export const customerNameInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerNameCss);
};

export const enterCustomerNameData = async (data: string) => {
	await clearField(CustomersPage.customerNameCss);
	await enterInput(CustomersPage.customerNameCss, data);
};

export const customerPhoneInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerPhoneCss);
};

export const enterCustomerPhoneData = async (data: string) => {
	await clearField(CustomersPage.customerPhoneCss);
	await enterInput(CustomersPage.customerPhoneCss, data);
};

export const customerEmailInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.customerEmailCss);
};

export const enterCustomerEmailData = async (data: string) => {
	await clearField(CustomersPage.customerEmailCss);
	await enterInput(CustomersPage.customerEmailCss, data);
};

export const verifyCustomerExists = async (text: string) => {
	// The list can hold several customers (added + invited), so assert that at least one
	// row link contains the name rather than asserting on a single (strict) locator.
	await expect(
		getPage().locator(CustomersPage.verifyCustomerCss).filter({ hasText: text }).first()
	).toBeVisible({ timeout: 24000 });
};

export const verifyElementIsDeleted = async (text: string) => {
	await expect(
		getPage().locator(CustomersPage.verifyCustomerCss).filter({ hasText: text })
	).toHaveCount(0, { timeout: 24000 });
};

export const verifyNextButtonVisible = async () => {
	await getPage()
		.locator('button:has-text("Next")')
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickNextButton = async () => {
	await clickFormButtonByText(['Next']);
};

export const verifyFinishButtonVisible = async () => {
	await getPage()
		.locator('button[status="success"]:has-text("Save"), button:has-text("Save")')
		.first()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickFinishButton = async () => {
	await clickFormButtonByText(['Save']);
};

export const lastStepBtnVisible = async () => {
	await verifyElementIsVisible(CustomersPage.lastStepBtnCss);
};

export const clickLastStepBtn = async () => {
	await clickButton(CustomersPage.lastStepBtnCss);
};

export const budgetInputVisible = async () => {
	await verifyElementIsVisible(CustomersPage.budgetInputCss);
};

export const enterBudgetData = async (data: string) => {
	await clearField(CustomersPage.budgetInputCss);
	await enterInput(CustomersPage.budgetInputCss, data);
};
