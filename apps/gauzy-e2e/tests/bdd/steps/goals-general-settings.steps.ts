import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as goalsGeneralSettingsPage from '../../support/pages/GoalsGeneralSettings.po';
import { GoalsGeneralSettingsPageData } from '../../../src/support/Base/pagedata/GoalsGeneralSettingsPageData';

// Converted 1:1 from the plain GoalsGeneralSettingsTest.spec.ts: the single test() -> one Scenario, its
// single test.step() -> one When step whose body is the verbatim .po call sequence, so runtime
// behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default user`
// Background step is defined once in common.steps.ts. The cross-step `checked`/`notChecked` module vars
// are declared here at module scope exactly as they were at spec top scope.

let checked = 'be.checked';
let notChecked = 'not.checked';

When('I verify the goals general settings', async () => {
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
