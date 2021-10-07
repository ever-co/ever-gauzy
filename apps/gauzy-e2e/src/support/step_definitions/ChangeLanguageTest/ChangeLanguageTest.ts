import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as changeLanguage from '../../Base/pages/ChangeLanguage.po'
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { ChangeLanguagePageData } from '../../Base/pagedata/ChangeLanguagePageData';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';


// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

//Verify settings bar
Then('User verify settings button is visible', () => {
    changeLanguage.verifySettingsButtonVisible();
});

And('User click settings button', () => {
    changeLanguage.clickSettingsButton();
});

//Change language to Bulgarian
Then('User see language selector', () => {
    changeLanguage.verifyLanguageSelectorVisible();
});

When('User click on language select button', () => {
    changeLanguage.clickLanguageSelector();
})

Then('User see language options', () => {
    changeLanguage.verifyLanguageOptionsVisible();
})

And('User click on Bulgarian language', () => {
    changeLanguage.clickOnLanguageOption(0);
});

Then('User can verify language is changed to Bulgarian', () => {
    changeLanguage.verifyLanguageIsChanged(ChangeLanguagePageData.Bulgarian);
})

//Change language to English
Then('User see language selector', () => {
    changeLanguage.verifyLanguageSelectorVisible();
});

When('User click on language select button', () => {
    changeLanguage.clickLanguageSelector();
})

Then('User see language options', () => {
    changeLanguage.verifyLanguageOptionsVisible();
})

And('User click on English language', () => {
    changeLanguage.clickOnLanguageOption(1);
});

Then('User can verify language is changed to English', () => {
    changeLanguage.verifyLanguageIsChanged(ChangeLanguagePageData.English);
})

//Change language to Russian
Then('User see language selector', () => {
    changeLanguage.verifyLanguageSelectorVisible();
});

When('User click on language select button', () => {
    changeLanguage.clickLanguageSelector();
})

Then('User see language options', () => {
    changeLanguage.verifyLanguageOptionsVisible();
})

And('User click on Russian language', () => {
    changeLanguage.clickOnLanguageOption(3);
});

Then('User can verify language is changed to Russian', () => {
    changeLanguage.verifyLanguageIsChanged(ChangeLanguagePageData.Russian);
})

//Change language to Hebrew
Then('User see language selector', () => {
    changeLanguage.verifyLanguageSelectorVisible();
});

When('User click on language select button', () => {
    changeLanguage.clickLanguageSelector();
})

Then('User see language options', () => {
    changeLanguage.verifyLanguageOptionsVisible();
})

And('User click on Hebrew language', () => {
    changeLanguage.clickOnLanguageOption(2);
});

Then('User can verify language is changed to Hebrew', () => {
    changeLanguage.verifyLanguageIsChanged(ChangeLanguagePageData.Hebrew);
})

