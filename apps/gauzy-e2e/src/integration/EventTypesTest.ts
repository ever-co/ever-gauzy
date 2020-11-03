import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as eventTypesPage from '../support/Base/pages/EventTypes.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { EventTypePageData } from '../support/Base/pagedata/EventTypesPageData';

describe('Event types test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
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
		eventTypesPage.enterTitleInputData(EventTypePageData.dafaultEventTitle);
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
		eventTypesPage.enterTitleInputData(EventTypePageData.dafaultEventTitle);
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
