import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as eventTypesPage from '../support/Base/pages/EventTypes.po';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { EventTypePageData } from '../support/Base/pagedata/EventTypesPageData';
import { CustomCommands } from '../support/commands';

describe('Event types test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Should be able to add new event type', () => {
		cy.visit('/#/pages/employees/event-types');
		eventTypesPage.gridBtnExists();
		eventTypesPage.gridBtnClick(1);
		eventTypesPage.addEventTypeButtonVisible();
		eventTypesPage.clickAddEventTypeButton();
		eventTypesPage.selectEmployeeDropdownVisible();
		eventTypesPage.clickSelectEmployeeDropdown();
		eventTypesPage.selectEmployeeFromDropdown(1);
		eventTypesPage.titleInputVisible();
		eventTypesPage.enterTitleInputData(EventTypePageData.defaultEventTitle);
		eventTypesPage.descriptionInputVisible();
		eventTypesPage.enterDescriptionInputData(
			EventTypePageData.defaultDescription
		);
		eventTypesPage.durationInputVisible();
		eventTypesPage.enterDurationInputData(
			EventTypePageData.defaultDuration
		);
		eventTypesPage.checkboxVisible();
		eventTypesPage.clickCheckbox();
		eventTypesPage.saveButtonVisible();
		eventTypesPage.clickSaveButton();
	});
	it('Should be able to edit event type', () => {
		eventTypesPage.selectTableRowVisible();
		eventTypesPage.selectTableRow(0);
		eventTypesPage.selectTableRow(0);
		eventTypesPage.selectTableRow(0);
		eventTypesPage.editEventTypeButtonVisible();
		eventTypesPage.clickEditEventTypeButton();
		eventTypesPage.titleInputVisible();
		eventTypesPage.enterTitleInputData(EventTypePageData.defaultEventTitle);
		eventTypesPage.descriptionInputVisible();
		eventTypesPage.enterDescriptionInputData(
			EventTypePageData.defaultDescription
		);
		eventTypesPage.durationInputVisible();
		eventTypesPage.enterDurationInputData(
			EventTypePageData.defaultDuration
		);
		eventTypesPage.checkboxVisible();
		eventTypesPage.clickCheckbox();
		eventTypesPage.saveButtonVisible();
		eventTypesPage.clickSaveButton();
	});
	it('Should be able to delete event type', () => {
		eventTypesPage.selectTableRow(0);
		eventTypesPage.selectTableRow(0);
		eventTypesPage.selectTableRow(0);
		eventTypesPage.deleteEventTypeButtonVisible();
		eventTypesPage.clickDeleteEventTypeButton();
		eventTypesPage.confirmDeleteEventTypeButtonVisible();
		eventTypesPage.clickConfirmDeleteEventTypeButton();
	});
});
