import { expect, Locator } from '@playwright/test';
import { verifyText, verifyElementIsVisibleByIndex, clickButtonByIndex } from '../util';
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
	// Trigger renders "[flag] Name"; when English is active the app locale is English,
	// so the caption is always the word "English".
	if (((await langBtn.textContent().catch(() => '')) || '').includes('English')) {
		return;
	}

	// Open the panel if collapsed.
	const cls = (await page.locator(sidebar).getAttribute('class').catch(() => '')) || '';
	if (cls.includes('collapsed') || !cls.includes('expanded')) {
		await page.locator(settingsBtn).first().click({ force: true });
		await page.waitForTimeout(1500);
	}
	// Open language dropdown (index 0) and pick the English option by its flag asset —
	// the option text is locale-dependent now that the "EN (...)" code prefix is gone.
	await page.locator(languageButton).nth(0).click({ force: true });
	await page.waitForTimeout(1200);
	await page.locator(optionCss).filter({ has: page.locator('img[src*="flags/gb.svg"]') }).first().click();
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

// Whole-string match (surrounding whitespace allowed) so e.g. "Employee Approval" does not also
// match "Employee Approval Policy", nor "Task Dashboard" the "Team Task Dashboard" row.
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactText = (text: string) => new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);

// The feature's `section.settings-group`, found by its description line (the same text
// verifyMainTextExist asserts), so a check is bound to a named feature and not to a page index.
const featureGroup = (description: string) => {
	const page = getPage();
	return page
		.locator(SettingsFeaturesPage.featureGroupCss)
		.filter({ has: page.locator('p.group-description', { hasText: exactText(description) }) });
};

// `state` keeps the Cypress-style vocabulary the steps use ('be.checked' / 'not.checked').
const expectCheckedState = async (input: Locator, state: string) => {
	await expect(input).toHaveCount(1, { timeout: defaultCommandTimeout });
	if (state.includes('not')) {
		await expect(input).not.toBeChecked({ timeout: defaultCommandTimeout });
	} else {
		await expect(input).toBeChecked({ timeout: defaultCommandTimeout });
	}
};

// The feature's own master toggle (in its group header).
export const verifyFeatureState = async (description: string, state: string) => {
	await expectCheckedState(
		featureGroup(description).locator(SettingsFeaturesPage.featureToggleInputCss),
		state
	);
};

// One sub-feature checkbox of that feature, found by its label.
export const verifySubFeatureState = async (description: string, subFeature: string, state: string) => {
	const page = getPage();
	await expectCheckedState(
		featureGroup(description)
			.locator(SettingsFeaturesPage.subFeatureCss)
			.filter({ has: page.locator('span.text', { hasText: exactText(subFeature) }) })
			.locator('input.native-input'),
		state
	);
};
