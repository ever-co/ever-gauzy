import { expect } from '@playwright/test';
import {
	verifyText,
	verifyStateByIndex,
	verifyElementIsVisibleByIndex,
	clickButtonByIndex
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SettingsFeaturesPage } from '../../../src/support/Base/pageobjects/SettingsFeaturesPageObject';

const defaultCommandTimeout = 24_000;

// The UI language is persisted per-user in the DB, so a prior test can leave the
// app in a non-English language. This page verifies English feature labels, so
// normalise the language to English via the Quick Settings sidebar first.
export const ensureEnglishLanguage = async () => {
	const page = getPage();
	const settingsBtn = 'nb-action.toggle-layout:last-of-type';
	const sidebar = 'nb-sidebar.settings-sidebar';
	const languageButton = `${sidebar} nb-select > button.select-button`;
	const optionCss = '.option-list nb-option';

	// Already English? Nothing to do.
	const langBtn = page.locator(languageButton).nth(0);
	if (((await langBtn.textContent().catch(() => '')) || '').includes('EN ')) {
		return;
	}

	// Open the panel if collapsed.
	const cls = (await page.locator(sidebar).getAttribute('class').catch(() => '')) || '';
	if (cls.includes('collapsed') || !cls.includes('expanded')) {
		await page.locator(settingsBtn).first().click({ force: true });
		await page.waitForTimeout(1500);
	}
	// Open language dropdown (index 0) and pick the English option ("EN (...)").
	await page.locator(languageButton).nth(0).click({ force: true });
	await page.waitForTimeout(1200);
	await page.locator(optionCss).filter({ hasText: 'EN ' }).first().click();
	await page.waitForTimeout(2000);
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisibleByIndex(SettingsFeaturesPage.tabButtonCss, 0);
};

export const clickTabButton = async (index: number) => {
	await clickButtonByIndex(SettingsFeaturesPage.tabButtonCss, index);
};

export const verifyHeader = async (text: string) => {
	await verifyText(SettingsFeaturesPage.headerTextCss, text);
};

export const verifySubheader = async (text: string) => {
	await verifyText(SettingsFeaturesPage.subheaderTextCss, text);
};

export const verifyTextExist = async (text: string) => {
	// The features page renders many `span.text` nodes; assert the one that
	// matches (a single-string toContainText against a multi-element locator
	// would require EVERY element to contain the text and therefore fails).
	await expect(
		getPage().locator(SettingsFeaturesPage.textCss).filter({ hasText: text }).first()
	).toContainText(text, { timeout: defaultCommandTimeout });
};

export const verifyMainTextExist = async (text: string) => {
	await expect(
		getPage().locator(SettingsFeaturesPage.mainTextCss).filter({ hasText: text }).first()
	).toContainText(text, { timeout: defaultCommandTimeout });
};

export const verifyCheckboxState = async (index: number, state: string) => {
	// Index 0 is the page-level "select all" master toggle (left unchecked);
	// the individual feature checkboxes start at index 1, so shift by one.
	await verifyStateByIndex(SettingsFeaturesPage.checkboxCss, index + 1, state);
};
