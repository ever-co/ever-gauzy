import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickOutsideElement,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { HumanResourcesPage } from '../../../src/support/Base/pageobjects/HumanResourcesPageObject';

// Reads the displayed name of the first employee row on the accounting dashboard. The spec used to
// hard-code the freshly-created faker employee, but that employee never appears here: the accounting
// list comes from findWorkingEmployees(...startedWorkOn <= endDate...) and the shared quick-add
// addEmployee command does NOT set "Date when started work", so the new employee is filtered out.
// We instead drive the flow with whichever employee IS present (the seeded "Default Employee").
export const getFirstEmployeeName = async (): Promise<string> => {
	// The accounting employee list loads asynchronously (aggregate stats + spinner); wait for the row.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	const nameEl = getPage().locator(HumanResourcesPage.employeeRowNameCss).first();
	await nameEl.waitFor({ state: 'visible', timeout: 24_000 });
	const name = await nameEl.innerText();
	return name.trim();
};

// Selects the first employee row, which calls selectEmployee() and navigates to the HR dashboard.
// dispatchClick bypasses any fading cdk-overlay backdrop left by the just-closed add-employee dialog
// (a coordinate click would land on the backdrop). Settle first so the async aggregate stats have
// rendered the row.
export const selectFirstEmployee = async () => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await verifyElementIsVisible(HumanResourcesPage.employeeRowNameCss);
	await dispatchClick(HumanResourcesPage.employeeRowCss);
};

// The accounting row's `a.link-text` renders the FULL user name ("First Last"), but the page-header
// ga-employee-selector label (`ng-select.employee .selector-template span`) renders a SHORTENED form:
// getShortenedName(firstName, lastName, 18) truncates firstName to 9 chars (no suffix) and lastName to
// 9 chars + "." if longer (employee.component.ts + truncate.pipe.ts). So a `hasText: <full name>` filter
// fails whenever either part exceeds 9 chars (e.g. "Valentine Schamberger" -> header "Valentine Schamberg.").
// Replicate that exact truncation from the full name so the assertion matches whatever the header renders.
export const verifyEmployeeName = async (text: string) => {
	const truncate = (value: string, limit: number, ellipsis: string) =>
		value.length > limit ? value.substring(0, limit) + ellipsis : value;
	// user.name is `[firstName, lastName].join(' ')` (user.subscriber.ts) — split into first token + rest.
	const trimmed = text.trim();
	const spaceIdx = trimmed.indexOf(' ');
	const firstName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
	const lastName = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);
	const limit = 18;
	const shortened =
		firstName && lastName
			? `${truncate(firstName, limit / 2, '')} ${truncate(lastName, limit / 2, '.')}`
			: truncate(trimmed, limit, '');
	await verifyText(HumanResourcesPage.employeeNameCss, shortened);
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
	await clickButton(HumanResourcesPage.chartDropdownCss);
};

export const verifyChartOptionText = async (text: string) => {
	await verifyText(HumanResourcesPage.dropdownOptionCss, text);
};

export const clickCardByHeaderText = async (text: string) => {
	// The (click)="handleClick()" handler sits on `.info-block`; clicking it emits openInfo, whose parent
	// handler (openHistoryDialog/openProfitDialog) fetches records then opens an nb-dialog popup.
	// .first() lands on the intended block (DOM order: Income, Expense-w/o-salary, Expenses, Profit;
	// the Profit meta mentions the other titles but appears last).
	//
	// Round 4: a single dispatchEvent('click') was NOT reliably opening the dialog (failure DOM showed a
	// clean HR dashboard, no popup), so open the dialog defensively: settle, then loop — try a real click
	// AND a dispatchEvent (dispatch bypasses any fading cdk-overlay backdrop a just-closed prior popup
	// left; the real click drives the handler when no backdrop is present), then poll for ANY history
	// popup to attach. Retry the click if it didn't open instead of failing on the first miss.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	const block = getPage().locator(HumanResourcesPage.infoBlockCss).filter({ hasText: text }).first();
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
	// an info-block. Fall back to clicking outside, then wait for the popup AND its cdk-overlay backdrop
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
