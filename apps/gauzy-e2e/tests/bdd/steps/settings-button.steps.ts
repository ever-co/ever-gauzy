import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as settingsButton from '../../support/pages/SettingsButton.po';
import { SettingsButtonData } from '../../../src/support/Base/pagedata/SettingsButtonPageData';

// Quick Settings dropdown order (DOM): 0 = Language, 1 = Themes, 2 = Layout.
const LANGUAGE = 0;
const LAYOUT = 2;

When('I open Quick Settings and verify the language options', async () => {
	await settingsButton.verifySettingsButtonVisible();
	await settingsButton.clickSettingsButton();
	await settingsButton.clickThemesDropdown(LANGUAGE);
	await settingsButton.verifyTextExist(SettingsButtonData.languageEnglish);
	await settingsButton.verifyTextExist(SettingsButtonData.languageBulgarian);
	await settingsButton.verifyTextExist(SettingsButtonData.languageHebrew);
	await settingsButton.verifyTextExist(SettingsButtonData.languageRussian);
	// Normalise the (DB-persisted) language back to English.
	await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
	await settingsButton.verifyLanguageButtonText(
		SettingsButtonData.langButtonEnglish
	);
});

When('I verify the layout options', async () => {
	await settingsButton.clickThemesDropdown(LAYOUT);
	await settingsButton.verifyTextExist(SettingsButtonData.layoutGrid);
	await settingsButton.verifyTextExist(SettingsButtonData.layoutTable);
	await settingsButton.clickKeyboardButtonByKeyCode(9);
	await settingsButton.resetButtonVisible();
});

When('I verify the body light and dark themes via the toggle', async () => {
	// Normalise to the light theme first (toggle is DB-persisted).
	const body = getPage().locator('body');
	const isDark = (await body.getAttribute('class'))?.includes(
		SettingsButtonData.darkTheme
	);
	if (isDark) {
		await settingsButton.clickLightDarkToggle();
	}
	await settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
	await settingsButton.clickLightDarkToggle();
	await settingsButton.verifyBodyTheme(SettingsButtonData.darkTheme);
	await settingsButton.clickLightDarkToggle();
	await settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
});

When('I switch to the Bulgarian language', async () => {
	await settingsButton.clickThemesDropdown(LANGUAGE);
	await settingsButton.clickDropdownOption(SettingsButtonData.languageBulgarian);
	await settingsButton.verifyLanguageButtonText(
		SettingsButtonData.langButtonBulgarian
	);
});

When('I switch to the Russian language', async () => {
	await settingsButton.clickThemesDropdown(LANGUAGE);
	await settingsButton.clickDropdownOption(SettingsButtonData.languageRussian);
	await settingsButton.verifyLanguageButtonText(
		SettingsButtonData.langButtonRussian
	);
});

When('I switch to the Hebrew language', async () => {
	await settingsButton.clickThemesDropdown(LANGUAGE);
	await settingsButton.clickDropdownOption(SettingsButtonData.languageHebrew);
	await settingsButton.verifyLanguageButtonText(
		SettingsButtonData.langButtonHebrew
	);
});

When('I switch back to the English language', async () => {
	await settingsButton.clickThemesDropdown(LANGUAGE);
	await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
	await settingsButton.verifyLanguageButtonText(
		SettingsButtonData.langButtonEnglish
	);
});
