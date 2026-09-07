import { expect } from '@playwright/test';
import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	verifyClassExist,
	clickKeyboardBtnByKeycode,
	waitUntil
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SettingsButton } from '../../../src/support/Base/pageobjects/SettingsButtonPageObject';

const defaultCommandTimeout = 24_000;

// Selecting a Language/Layout option dismisses the whole Quick Settings sidebar,
// so re-open it on demand before each dropdown interaction. The sidebar carries
// the `collapsed` class while hidden and `expanded` once opened — the dropdown
// buttons report visible even while collapsed, so detect via the sidebar class.
const ensurePanelOpen = async () => {
	const sidebar = getPage().locator(SettingsButton.settingsSidebarCss);
	const cls = (await sidebar.getAttribute('class').catch(() => '')) || '';
	if (cls.includes('collapsed') || !cls.includes('expanded')) {
		await clickButton(SettingsButton.settingsButtonCss);
		await waitUntil(1500);
	}
};

export const verifySettingsButtonVisible = async () => {
	await verifyElementIsVisible(SettingsButton.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	await ensurePanelOpen();
};

// index: 0 = Language, 1 = Themes, 2 = Layout
export const clickThemesDropdown = async (index: number) => {
	await ensurePanelOpen();
	await clickButtonByIndex(SettingsButton.dropdownButtonCss, index);
	await waitUntil(1200);
};

/**
 * Language options carry no locale-invariant text anymore (they render as "[flag] Name"), so
 * language entries in the page data are flag asset paths ("flags/gb.svg") matched against the
 * option's <img src>; every other dropdown (theme, layout) still matches by visible text.
 */
const dropdownOption = (match: string) =>
	match.includes('flags/')
		? getPage()
				.locator(SettingsButton.dropdownOptionCss)
				.filter({ has: getPage().locator(`img[src*="${match}"]`) })
		: getPage().locator(SettingsButton.dropdownOptionCss).filter({ hasText: match });

export const verifyTextExist = async (text: string) => {
	// The option list renders many nb-option nodes; assert the one matching `text`.
	await expect(dropdownOption(text).first()).toBeVisible({ timeout: defaultCommandTimeout });
};

export const clickDropdownOption = async (text: string) => {
	await dropdownOption(text).first().click();
	await waitUntil(1500);
};

// Asserts the language dropdown button (index 0) shows the expected caption.
export const verifyLanguageButtonText = async (text: string) => {
	await ensurePanelOpen();
	await expect(
		getPage().locator(SettingsButton.languageButtonCss).nth(0)
	).toContainText(text, { timeout: defaultCommandTimeout });
};

export const resetButtonVisible = async () => {
	await ensurePanelOpen();
	await verifyElementIsVisible(SettingsButton.resetLayoutButtonCss);
};

export const clickLightDarkToggle = async () => {
	await ensurePanelOpen();
	await clickButton(SettingsButton.lightDarkToggleCss);
	await waitUntil(1500);
};

export const verifyBodyTheme = async (someClass: string) => {
	await verifyClassExist(SettingsButton.bodyCss, someClass);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};
