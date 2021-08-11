import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as settingsButton from '../../Base/pages/SettingsButton.po';
import { SettingsButtonData } from '../../Base/pagedata/SettingsButtonPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Settings button test
// Verify themes
And('User can see settings button', () => {
	settingsButton.verifySettingsButtonVisible();
});

When('User click on settings button', () => {
	settingsButton.clickSettingsButton();
});

Then('User can click on first dropdown', () => {
	settingsButton.clickThemesDropdown(0);
});

And('User can verify Light theme', () => {
	settingsButton.verifyTextExist(SettingsButtonData.themeButtonLight);
});

And('User can verify Dark theme', () => {
	settingsButton.verifyTextExist(SettingsButtonData.themeButtonDark);
});

And('User can verify Cosmic theme', () => {
	settingsButton.verifyTextExist(SettingsButtonData.themeButtonCosmic);
});

And('User can verify Corporate theme', () => {
	settingsButton.verifyTextExist(SettingsButtonData.themeButtonCorporate);
	settingsButton.clickKeyboardButtonByKeyCode(9);
});

// Verify languages
// When('User click on second dropdown again', () => {
// 	settingsButton.clickThemesDropdown(1);
// });

// Then('User can verify English language', () => {
// 	settingsButton.verifyTextExist(SettingsButtonData.languageEnglish);
// });

// And('User can verify Bulgarian language', () => {
// 	settingsButton.verifyTextExist(SettingsButtonData.languageBulgarian);
// });

// And('User can verify Hebrew language', () => {
// 	settingsButton.verifyTextExist(SettingsButtonData.languageHebrew);
// });

// And('User can verify Russian language', () => {
// 	settingsButton.verifyTextExist(SettingsButtonData.languageRussian);
// 	settingsButton.clickKeyboardButtonByKeyCode(9);
// });

// Verify layout
When('User click on third dropdown', () => {
	settingsButton.clickThemesDropdown(2);
});

Then('User can verify Grid layout', () => {
	settingsButton.verifyTextExist(SettingsButtonData.layoutGrid);
});

And('User can verify Table layout', () => {
	settingsButton.verifyTextExist(SettingsButtonData.layoutTable);
	settingsButton.clickKeyboardButtonByKeyCode(9);
});

And('User can see reset button', () => {
	settingsButton.resetButtonVisible();
});
