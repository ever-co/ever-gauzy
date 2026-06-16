import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as eventTypesPage from './support/pages/EventTypes.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { EventTypePageData } from '../src/support/Base/pagedata/EventTypesPageData';
import { CustomCommands } from './support/commands';

test.describe('Event types test', () => {
	test('Event types test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new event type', async () => {
			await getPage().goto('/#/pages/employees/event-types');
			await eventTypesPage.gridBtnExists();
			await eventTypesPage.gridBtnClick(1);
			await eventTypesPage.addEventTypeButtonVisible();
			await eventTypesPage.clickAddEventTypeButton();
			await eventTypesPage.selectEmployeeDropdownVisible();
			await eventTypesPage.clickSelectEmployeeDropdown();
			await eventTypesPage.selectEmployeeFromDropdown(1);
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

		await test.step('Should be able to edit event type', async () => {
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

		await test.step('Should be able to delete event type', async () => {
			await eventTypesPage.selectTableRow(0);
			await eventTypesPage.selectTableRow(0);
			await eventTypesPage.selectTableRow(0);
			await eventTypesPage.deleteEventTypeButtonVisible();
			await eventTypesPage.clickDeleteEventTypeButton();
			await eventTypesPage.confirmDeleteEventTypeButtonVisible();
			await eventTypesPage.clickConfirmDeleteEventTypeButton();
		});
	});
});
