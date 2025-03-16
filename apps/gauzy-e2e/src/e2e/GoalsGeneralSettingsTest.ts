import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as goalsGeneralSettingsPage from '../support/Base/pages/GoalsGeneralSettings.po';
import { GoalsGeneralSettingsPageData } from '../support/Base/pagedata/GoalsGeneralSettingsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let checked = 'be.checked';
let notChecked = 'not.checked';

describe('Goals general settings Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to verify goals general settings', () => {
		cy.visit('/#/pages/goals/settings');
		goalsGeneralSettingsPage.verifyHeaderText(
			GoalsGeneralSettingsPageData.header
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.maxNumberOfEntities
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.employeesOwnObjectives
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.whoOwnObjectives
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.whoOwnKeyResults
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.addKPI
		);
		goalsGeneralSettingsPage.verifySubheaderText(
			GoalsGeneralSettingsPageData.addTask
		);
		goalsGeneralSettingsPage.goalsInputVisible();
		goalsGeneralSettingsPage.enterGoalsInputData(
			GoalsGeneralSettingsPageData.objectives
		);
		goalsGeneralSettingsPage.keyResultInputVisible();
		goalsGeneralSettingsPage.enterKeyResultInputData(
			GoalsGeneralSettingsPageData.keyResults
		);
		goalsGeneralSettingsPage.objectivesDropdownVisible();
		goalsGeneralSettingsPage.clickObjectivesDropdown();
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.employeesOptionText
		);
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.employeesAndTeamsText
		);
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.teamsText
		);
		goalsGeneralSettingsPage.clickKeyboardButtonByKeyCode(9);
		goalsGeneralSettingsPage.keyResultsDropdownVisible();
		goalsGeneralSettingsPage.clickKeyResultsDropdown();
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.employeesOptionText
		);
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.employeesAndTeamsText
		);
		goalsGeneralSettingsPage.verifyDropdownText(
			GoalsGeneralSettingsPageData.teamsText
		);
		goalsGeneralSettingsPage.clickKeyboardButtonByKeyCode(9);
		goalsGeneralSettingsPage.verifyCheckboxState(0, checked);
		goalsGeneralSettingsPage.verifyCheckboxState(1, checked);
		goalsGeneralSettingsPage.verifyCheckboxState(2, checked);
		goalsGeneralSettingsPage.clickToggleButtonByIndex(2);
		goalsGeneralSettingsPage.waitMessageToHide();
		goalsGeneralSettingsPage.verifyCheckboxState(2, notChecked);
		goalsGeneralSettingsPage.clickToggleButtonByIndex(2);
		goalsGeneralSettingsPage.waitMessageToHide();
		goalsGeneralSettingsPage.verifyCheckboxState(2, checked);
	});
});
