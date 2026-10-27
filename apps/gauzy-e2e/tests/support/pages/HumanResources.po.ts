import {
	verifyElementIsVisible,
	verifyText,
	clickOutsideElement,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { expect } from '@playwright/test';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { HumanResourcesPage } from '../../../src/support/Base/pageobjects/HumanResourcesPageObject';

// Reads the displayed name of the first employee row on the accounting dashboard (its Breakdown panel,
// see HumanResourcesPage.employeeRowCss). The flow is driven with whichever employee the list puts first
// and the HR page is then checked for that same name.
export const getFirstEmployeeName = async (): Promise<string> => {
	// The accounting employee list loads asynchronously (aggregate stats + spinner); wait for the row.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	const nameEl = getPage().locator(HumanResourcesPage.employeeRowNameCss).first();
	await nameEl.waitFor({ state: 'visible', timeout: 24_000 });
	const name = await nameEl.innerText();
	return name.trim();
};

// Selects an employee row, which calls selectEmployee() and navigates to the HR dashboard. When `name` is
// given (the one getFirstEmployeeName read) the row is picked by that name, so a re-sort of the breakdown
// in between (its statistics load asynchronously) can't swap in a different employee. dispatchClick
// bypasses any fading cdk-overlay backdrop left by the just-closed add-employee dialog (a coordinate click
// would land on the backdrop), and it is dispatched on the ROW: the name link inside it opens the employee
// edit page instead. Settle first so the async aggregate stats have rendered the row.
export const selectFirstEmployee = async (name?: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	await verifyElementIsVisible(HumanResourcesPage.employeeRowNameCss);
	const rows = page.locator(HumanResourcesPage.employeeRowCss);
	const row = name
		? rows.filter({ has: page.locator('ngx-avatar a.link-text', { hasText: name }) }).first()
		: rows.first();
	await row.dispatchEvent('click');
	await page.waitForURL(/\/pages\/dashboard\/hr/, { timeout: 24_000 }).catch(() => undefined);
};

// The page-header ga-employee-selector label (`ng-select.employee .selector-template span`) renders
// getFullName(item) — the full "First Last" name, the same `user.name` the accounting row shows — since
// 238e1b4e2c ("update topbar selector UI"). It used to render getShortenedName(firstName, lastName, 18)
// (each part cut to 9 chars, "." after a cut last name), which this check had to replicate; matching that
// shortened form against the full label now fails for any name part longer than 9 chars.
export const verifyEmployeeName = async (text: string) => {
	await verifyText(HumanResourcesPage.employeeNameCss, text.trim());
};

export const verifyCardTextExist = async (text: string) => {
	await verifyText(HumanResourcesPage.infoTextCss, text);
};

export const verifyChartDropdownVisible = async () => {
	await verifyElementIsVisible(HumanResourcesPage.chartDropdownCss);
};

export const verifyPopupProfitHeaderText = async (text: string) => {
	await verifyText(HumanResourcesPage.popupProfitHeaderCss, text);
};

export const clickChartDropdown = async () => {
	// The Employee Statistics panel moves down while the KPI tiles above it finish rendering, so the forced
	// coordinate click clickButton() makes (force skips Playwright's "stable" check) landed on the panel
	// header above the select on CI (run 40421871684: clicked at y=416.5, the select settled at ~433) and
	// the option list never opened. Click the select's own button WITHOUT force, so Playwright waits for it
	// to stop moving, and confirm the list opened; re-click only when it did not.
	const page = getPage();
	const trigger = page.locator(`${HumanResourcesPage.chartDropdownCss} button.select-button`).first();
	const firstOption = page.locator(HumanResourcesPage.dropdownOptionCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await trigger.click({ timeout: 24_000 });
		try {
			await firstOption.waitFor({ state: 'visible', timeout: 5_000 });
			return;
		} catch {
			/* the list did not open — click again */
		}
	}
	await expect(firstOption).toBeVisible({ timeout: 5_000 });
};

export const verifyChartOptionText = async (text: string) => {
	await verifyText(HumanResourcesPage.dropdownOptionCss, text);
};

export const clickCardByHeaderText = async (text: string) => {
	// The (click) handler sits on the `.kpi` tile / `.stat-row` row itself (see `infoBlockCss`), calling
	// openHistoryDialog/openProfitDialog, which fetch records then open an nb-dialog popup.
	//
	// The text match is scoped to the card's LABEL span (`infoTextCss`), not run over the card whole:
	// every card also prints its arithmetic as body text, and that arithmetic quotes other cards'
	// headings — the Profit tile's line contains both "Total Income" and "Total Expenses", so a
	// whole-card `hasText` matches it for two of the four queried headings and `.first()` would be
	// picking between them on DOM order alone. Scoped to the label, each heading identifies one card.
	// See the note on `infoBlockCss` in HumanResourcesPageObject.ts.
	//
	// Round 4: a single dispatchEvent('click') was NOT reliably opening the dialog (failure DOM showed a
	// clean HR dashboard, no popup), so open the dialog defensively: settle, then loop — try a real click
	// AND a dispatchEvent (dispatch bypasses any fading cdk-overlay backdrop a just-closed prior popup
	// left; the real click drives the handler when no backdrop is present), then poll for ANY history
	// popup to attach. Retry the click if it didn't open instead of failing on the first miss.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	const block = getPage()
		.locator(HumanResourcesPage.infoBlockCss)
		.filter({ has: getPage().locator(HumanResourcesPage.infoTextCss, { hasText: text }) })
		.first();
	await block.waitFor({ state: 'visible', timeout: 24_000 });

	const popup = getPage().locator(HumanResourcesPage.popupAnyCss).first();
	// One action per attempt (never two back-to-back): if a click opens the dialog, a second action would
	// land on the new cdk-overlay backdrop and close-on-backdrop-click it again. Alternate dispatch / real
	// click across attempts and poll for the popup after each.
	for (let attempt = 0; attempt < 6 && !(await popup.isVisible().catch(() => false)); attempt++) {
		if (attempt % 2 === 0) {
			await block.dispatchEvent('click'); // bypasses any fading backdrop from a just-closed prior popup
		} else {
			await block.click({ force: true, timeout: 10_000 }).catch(() => {}); // drives handler when no backdrop
		}
		await popup.waitFor({ state: 'visible', timeout: 6_000 }).catch(() => {});
		if (!(await popup.isVisible().catch(() => false))) {
			await getPage().waitForLoadState('networkidle').catch(() => {});
			await getPage().waitForTimeout(500);
		}
	}
	// Final assertion so the caller's verify gets a clear, attributable failure if still closed.
	await popup.waitFor({ state: 'visible', timeout: 24_000 });
};

export const verifyPopupHeaderText = async (text: string) => {
	// The records popup title is `{{ translatedType | titlecase }}` — the pagedata passes "INCOME"/
	// "EXPENSES" (upper) but the rendered h5 is title-cased ("Income"/"Expenses"). Playwright hasText
	// is case-sensitive, so match case-insensitively here.
	const header = getPage()
		.locator(HumanResourcesPage.popupHeaderCss)
		.filter({ hasText: new RegExp(text, 'i') })
		.first();
	await header.waitFor({ state: 'visible', timeout: 24_000 });
};

export const verifyPopupTableHeaderText = async (text: string) => {
	await verifyText(HumanResourcesPage.popupTableHederCss, text);
};

export const clickCardBody = async () => {
	// Close the just-verified history popup before opening the next card. Press Escape (NbDialog
	// closeOnEsc defaults to true) — more reliable than a backdrop coordinate click and it can't land on
	// another card. Fall back to clicking outside, then wait for the popup AND its cdk-overlay backdrop
	// to detach so the next clickCardByHeaderText isn't intercepted by a fading backdrop.
	await getPage().keyboard.press('Escape');
	if (await getPage().locator(HumanResourcesPage.popupAnyCss).first().isVisible().catch(() => false)) {
		await clickOutsideElement();
	}
	await getPage()
		.locator(HumanResourcesPage.popupAnyCss)
		.first()
		.waitFor({ state: 'detached', timeout: 10_000 })
		.catch(() => {});
	await getPage().locator('.cdk-overlay-backdrop').first().waitFor({ state: 'detached', timeout: 6_000 }).catch(() => {});
};
