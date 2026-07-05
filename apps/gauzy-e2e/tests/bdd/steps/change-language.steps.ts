import { Given, When, Then } from '../../support/bdd';
import * as changeLanguagePage from '../../support/pages/ChangeLanguage.po';
import { ChangeLanguagePageData } from '../../../src/support/Base/pagedata/ChangeLanguagePageData';
// The `Given I am logged in as the default user` step (used by the Background) lives in common.steps.ts.

// Map the human language name from the .feature to the option index/code and to the translated
// "+ Create" button text the app renders once that locale is active — both come from the page data,
// so QA can add a locale to the Examples table without touching this glue.
const languageCode: Record<string, number> = {
	Bulgarian: ChangeLanguagePageData.codeBulgarian,
	Russian: ChangeLanguagePageData.codeRussian,
	Hebrew: ChangeLanguagePageData.codeHebrew,
	English: ChangeLanguagePageData.codeEnglish
};
const translatedCreate: Record<string, string> = {
	Bulgarian: ChangeLanguagePageData.Bulgarian,
	Russian: ChangeLanguagePageData.Russian,
	Hebrew: ChangeLanguagePageData.Hebrew,
	English: ChangeLanguagePageData.English
};

Given('I open the Quick Settings panel', async () => {
	await changeLanguagePage.verifySettingsButtonVisible();
	await changeLanguagePage.clickSettingsButton();
	// Normalise to English first — preferred language is DB-persisted, so a prior run could leave the
	// account in another locale and skew the first assertion.
	await changeLanguagePage.resetToEnglish(ChangeLanguagePageData.English);
});

When('I select {string} as the interface language', async ({}, language: string) => {
	await changeLanguagePage.verifyLanguageSelectorVisible();
	await changeLanguagePage.clickLanguageSelector();
	await changeLanguagePage.verifyLanguageOptionsVisible();
	await changeLanguagePage.clickOnLanguageOption(languageCode[language]);
});

Then('the interface is displayed in {string}', async ({}, language: string) => {
	await changeLanguagePage.verifyLanguageIsChanged(translatedCreate[language]);
});
