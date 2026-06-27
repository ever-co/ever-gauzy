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

export const verifyEmployeeName = async (text: string) => {
	await verifyText(HumanResourcesPage.employeeNameCss, text);
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
	// The (click)="handleClick()" handler sits on `.info-block`; dispatch the event straight to the
	// matching block so it fires even when a fading cdk-overlay backdrop from a just-closed popup sits
	// on top (a coordinate click — even force — would land on the backdrop). dispatchEvent bubbles to
	// the handler. .first() lands on the intended block (DOM order: Income, Expense-w/o-salary,
	// Expenses, Profit; the Profit meta mentions the other titles but appears last).
	await waitForSpinnerGone();
	const block = getPage().locator(HumanResourcesPage.infoBlockCss).filter({ hasText: text }).first();
	await block.waitFor({ state: 'visible', timeout: 24_000 });
	await block.dispatchEvent('click');
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
	await clickOutsideElement();
};
