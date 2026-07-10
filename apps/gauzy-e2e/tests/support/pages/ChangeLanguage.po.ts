import { expect } from '@playwright/test';
import { verifyElementIsVisible, clickButton, verifyByText, waitUntil } from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ChangeLanguage } from '../../../src/support/Base/pageobjects/ChangeLanguagePageObject';

const defaultCommandTimeout = 24_000;

/**
 * The language nb-select lives inside the "Quick Settings" sidebar. Selecting a language (or opening
 * the panel and clicking away) auto-COLLAPSES the sidebar, so it must be re-opened before every round.
 * The sidebar host carries `collapsed` while hidden and `expanded` once open — the inner controls can
 * report "visible" even while collapsed, so we detect state via the sidebar class (mirrors the
 * verified-green SettingsButton.ensurePanelOpen). Best-effort: swallow a missing sidebar class.
 */
const ensurePanelOpen = async () => {
	const sidebar = getPage().locator(ChangeLanguage.settingsSidebarCss);
	const cls = (await sidebar.getAttribute('class').catch(() => '')) || '';
	if (cls.includes('collapsed') || !cls.includes('expanded')) {
		await clickButton(ChangeLanguage.settingsButtonCss);
		await waitUntil(1500);
	}
};

export const verifySettingsButtonVisible = async () => {
	await verifyElementIsVisible(ChangeLanguage.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	// Open the Quick Settings sidebar (idempotent — no-ops if already expanded).
	await ensurePanelOpen();
};

export const verifyLanguageSelectorVisible = async () => {
	// Re-open first: a preceding language pick collapses the panel, hiding the selector.
	await ensurePanelOpen();
	await verifyElementIsVisible(ChangeLanguage.languageDropdownCss);
};

export const clickLanguageSelector = async () => {
	// Make sure the panel is open, then click the nb-select's `button.select-button` trigger to open
	// the option overlay. clickButton uses force + a long timeout, which is enough here — unlike the
	// ng-select controls, this nb-select opens reliably on a click of its select-button.
	await ensurePanelOpen();
	await clickButton(ChangeLanguage.languageSelectButtonCss);
	await waitUntil(1000);
};

export const verifyLanguageOptionsVisible = async () => {
	await verifyElementIsVisible(ChangeLanguage.languageOptionsCss);
};

/**
 * Pick a language option BY CODE PREFIX ("EN " / "BG " / "RU " / "HE ").
 *
 * The Cypress original selected by numeric index (Bulgarian=0, English=1, Hebrew=2, Russian=3),
 * assuming a fixed alphabetical order. The current app renders the option list in a DB-driven order
 * that is NOT guaranteed, so index selection is fragile — match on the language-code prefix instead
 * (the option text is "EN (English)", "BG (Български)", …). Robust and order-independent.
 */
export const clickOnLanguageOption = async (codePrefix: string) => {
	const option = getPage().locator(ChangeLanguage.languageOptionsCss).filter({ hasText: codePrefix }).first();
	await option.click({ force: true, timeout: defaultCommandTimeout });
	// Selecting fires (selectedChange)->switchLanguage(), which re-renders the UI in the new locale and
	// collapses the sidebar. Give the translation swap a beat before the caller asserts on the button.
	await waitUntil(1500);
};

export const verifyLanguageIsChanged = async (language: string) => {
	// The header "+ Create" button label is translated, so it reflects the active language. Assert it
	// CONTAINS the expected translated word (leading "+ " tolerated). verifyByText retries to
	// defaultCommandTimeout, covering the async translate-pipe re-render.
	await verifyByText(ChangeLanguage.createButtonCss, language);
};

/**
 * Best-effort reset back to English so a persisted (DB-saved) preferred language from a prior run
 * doesn't skew the very first assertion, and to leave the account clean for the next spec. Mirrors
 * the normalisation SettingsButtonTest performs. Swallows everything — purely hygienic.
 */
export const resetToEnglish = async (englishWord: string) => {
	try {
		const createButton = getPage().locator(ChangeLanguage.createButtonCss);
		const createBtn = createButton.first();
		// Already English? nothing to do.
		if (await createButton.filter({ hasText: englishWord }).count()) return;
		await ensurePanelOpen();
		await clickButton(ChangeLanguage.languageSelectButtonCss);
		await waitUntil(800);
		await getPage()
			.locator(ChangeLanguage.languageOptionsCss)
			.filter({ hasText: 'EN ' })
			.first()
			.click({ force: true, timeout: defaultCommandTimeout });
		await expect(createBtn).toContainText(englishWord, { timeout: defaultCommandTimeout });
	} catch {
		/* hygiene only — ignore if the reset can't complete */
	}
};
