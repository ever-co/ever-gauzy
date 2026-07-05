import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as eventTypesPage from '../../support/pages/EventTypes.po';
import { EventTypePageData } from '../../../src/support/Base/pagedata/EventTypesPageData';

// Converted 1:1 from the plain EventTypesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I add a new event type', async () => {
	await getPage().goto('/#/pages/employees/event-types');
	await eventTypesPage.gridBtnExists();
	await eventTypesPage.gridBtnClick(1);
	await eventTypesPage.addEventTypeButtonVisible();
	await eventTypesPage.clickAddEventTypeButton();
	await eventTypesPage.selectEmployeeDropdownVisible();
	await eventTypesPage.clickSelectEmployeeDropdown();
	await eventTypesPage.selectEmployeeFromDropdown(0);
	await eventTypesPage.titleInputVisible();
	await eventTypesPage.enterTitleInputData(EventTypePageData.defaultEventTitle);
	await eventTypesPage.descriptionInputVisible();
	await eventTypesPage.enterDescriptionInputData(
		EventTypePageData.defaultDescription
	);
	await eventTypesPage.durationInputVisible();
	await eventTypesPage.enterDurationInputData(
		EventTypePageData.defaultDuration
	);
	await eventTypesPage.checkboxVisible();
	await eventTypesPage.clickCheckbox();
	await eventTypesPage.saveButtonVisible();
	await eventTypesPage.clickSaveButton();
});

When('I edit the event type', async () => {
	await eventTypesPage.selectTableRowVisible();
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.editEventTypeButtonVisible();
	await eventTypesPage.clickEditEventTypeButton();
	await eventTypesPage.titleInputVisible();
	await eventTypesPage.enterTitleInputData(EventTypePageData.defaultEventTitle);
	await eventTypesPage.descriptionInputVisible();
	await eventTypesPage.enterDescriptionInputData(
		EventTypePageData.defaultDescription
	);
	await eventTypesPage.durationInputVisible();
	await eventTypesPage.enterDurationInputData(
		EventTypePageData.defaultDuration
	);
	await eventTypesPage.checkboxVisible();
	await eventTypesPage.clickCheckbox();
	await eventTypesPage.saveButtonVisible();
	await eventTypesPage.clickSaveButton();
});

When('I delete the event type', async () => {
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.selectTableRow(0);
	await eventTypesPage.deleteEventTypeButtonVisible();
	await eventTypesPage.clickDeleteEventTypeButton();
	await eventTypesPage.confirmDeleteEventTypeButtonVisible();
	await eventTypesPage.clickConfirmDeleteEventTypeButton();
});
