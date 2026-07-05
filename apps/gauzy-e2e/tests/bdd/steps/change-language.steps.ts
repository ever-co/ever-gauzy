import { Given, When, Then } from '../../support/bdd';
import * as loginPage from '../../support/pages/Login.po';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import * as changeLanguagePage from '../../support/pages/ChangeLanguage.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import { ChangeLanguagePageData } from '../../../src/support/Base/pagedata/ChangeLanguagePageData';
import { CustomCommands } from '../../support/commands';

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

Given('I am logged in as the default user', async () => {
	await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

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
