import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as goalsGeneralSettingsPage from './support/pages/GoalsGeneralSettings.po';
import { GoalsGeneralSettingsPageData } from '../src/support/Base/pagedata/GoalsGeneralSettingsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let checked = 'be.checked';
let notChecked = 'not.checked';

test.describe('Goals general settings Test', () => {
	test('Goals general settings Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify goals general settings', async () => {
			await getPage().goto('/#/pages/goals/settings');
			await goalsGeneralSettingsPage.verifyHeaderText(
				GoalsGeneralSettingsPageData.header
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.maxNumberOfEntities
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.employeesOwnObjectives
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.whoOwnObjectives
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.whoOwnKeyResults
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.addKPI
			);
			await goalsGeneralSettingsPage.verifySubheaderText(
				GoalsGeneralSettingsPageData.addTask
			);
			await goalsGeneralSettingsPage.goalsInputVisible();
			await goalsGeneralSettingsPage.enterGoalsInputData(
				GoalsGeneralSettingsPageData.objectives
			);
			await goalsGeneralSettingsPage.keyResultInputVisible();
			await goalsGeneralSettingsPage.enterKeyResultInputData(
				GoalsGeneralSettingsPageData.keyResults
			);
			await goalsGeneralSettingsPage.objectivesDropdownVisible();
			await goalsGeneralSettingsPage.clickObjectivesDropdown();
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.employeesOptionText
			);
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.employeesAndTeamsText
			);
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.teamsText
			);
			await goalsGeneralSettingsPage.clickKeyboardButtonByKeyCode(9);
			await goalsGeneralSettingsPage.keyResultsDropdownVisible();
			await goalsGeneralSettingsPage.clickKeyResultsDropdown();
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.employeesOptionText
			);
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.employeesAndTeamsText
			);
			await goalsGeneralSettingsPage.verifyDropdownText(
				GoalsGeneralSettingsPageData.teamsText
			);
			await goalsGeneralSettingsPage.clickKeyboardButtonByKeyCode(9);
			await goalsGeneralSettingsPage.verifyCheckboxState(0, checked);
			await goalsGeneralSettingsPage.verifyCheckboxState(1, checked);
			await goalsGeneralSettingsPage.verifyCheckboxState(2, checked);
			await goalsGeneralSettingsPage.clickToggleButtonByIndex(2);
			await goalsGeneralSettingsPage.waitMessageToHide();
			await goalsGeneralSettingsPage.verifyCheckboxState(2, notChecked);
			await goalsGeneralSettingsPage.clickToggleButtonByIndex(2);
			await goalsGeneralSettingsPage.waitMessageToHide();
			await goalsGeneralSettingsPage.verifyCheckboxState(2, checked);
		});
	});
});
