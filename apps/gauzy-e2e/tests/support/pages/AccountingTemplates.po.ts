import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitForSpinnerGone,
	waitUntil
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AccountingTemplatesPage } from '../../../src/support/Base/pageobjects/AccountingTemplatesPageObject';

/**
 * Navigate to the Accounting Templates settings screen.
 *
 * A hash-only goto() issued right after login can be a same-document no-op (Playwright doesn't
 * reload and the Angular hash-router never re-renders), leaving the dashboard mounted. Force the
 * hash, settle, then wait for the page header before the caller interacts (mirrors the shared
 * gotoRoute hardening in commands.ts, inlined here since we must not touch shared files).
 */
export const visitAccountingTemplatesPage = async () => {
	const page = getPage();
	const route = '/#/pages/settings/accounting-templates';
	await page.goto(route);
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/settings/accounting-templates')) {
			location.hash = '#/pages/settings/accounting-templates';
		}
	});
	await page.waitForTimeout(800);
	// Wait for the screen's own header so we don't act mid-transition against a lingering overlay.
	await page
		.locator(AccountingTemplatesPage.headerCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await waitForSpinnerGone();
};

export const saveBtnVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.saveBtnCss);
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.languageSelectCss);
};

export const clickLanguageSelect = async () => {
	// The language control is an ng-select (ngx-language-selector [template]="'ng-select'"): it opens on
	// MOUSEDOWN and its option overlay (appendTo="body") can be blocked by a fading cdk backdrop, so a
	// plain click / dispatchClick no-ops. Open it via the keyboard — focus the inner search input and
	// press ArrowDown — which reliably drops the `div.ng-option` list. Retry until an option renders.
	const page = getPage();
	const input = page.locator(AccountingTemplatesPage.languageInputCss).first();
	const option = page.locator(AccountingTemplatesPage.languageDropdownOptionCss);
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) return;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(700);
	}
};

export const languageDropdownOptionVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.languageDropdownOptionCss);
};

export const selectLanguageFromDropdownOptions = async (language: string) => {
	await clickElementByText(AccountingTemplatesPage.languageDropdownOptionCss, language);
	// Selecting fires (selectedLanguageEvent) -> subject$.next(true) -> getTemplate(), which re-fetches
	// and re-renders the preview. Let that settle before the caller opens the template picker.
	await waitUntil(1500);
};

export const templateSelectVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.templateSelectCss);
};

export const clickTemplateSelect = async () => {
	// nb-select opens reliably on a click of its control; wait out any card spinner first so the click
	// doesn't land on an overlay, then open it.
	await waitForSpinnerGone();
	await clickButton(AccountingTemplatesPage.templateSelectCss);
	await waitUntil(500);
};

export const templateDropdownOptionVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.templateDropdownOptionCss);
};

export const selectTemplateFromDropdownOptions = async (template: string) => {
	// The nb-option label is translated ('Invoice'/'Estimate'/'Receipt'); filter by exact-ish text.
	// Options for invoice/estimate/receipt are distinct words so a hasText filter can't cross-match.
	await clickElementByText(AccountingTemplatesPage.templateDropdownOptionCss, template);
	// (selectedChange) -> subject$.next(true) -> getTemplate() re-renders the preview; wait for it to
	// settle so the subsequent verify* calls assert against the freshly rendered template, not the prior.
	await waitUntil(1500);
};

export const verifyLeftTableData = async (text: string) => {
	await verifyText(AccountingTemplatesPage.leftTableDataCss, text);
};

export const verifyRightTableData = async (text: string) => {
	await verifyText(AccountingTemplatesPage.rightTableDataCss, text);
};

export const verifyReceiptNumberAndPaymentData = async (text: string) => {
	await verifyText(AccountingTemplatesPage.receiptNumberAndPaymentMethodDataCss, text);
};

export const verifyMainLogo = async () => {
	// The preview logo <img> only appears once the server-rendered template HTML is bound; give the
	// re-render a beat (mirrors the Cypress waitUntil(5000)) before asserting visibility.
	await waitUntil(3000);
	await verifyElementIsVisible(AccountingTemplatesPage.logoCss);
};
