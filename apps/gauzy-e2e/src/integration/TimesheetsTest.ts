// import * as loginPage from '../support/Base/pages/Login.po';
// import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
// import * as timesheetsPage from '../support/Base/pages/Timesheets.po';
// import * as dashboradPage from '../support/Base/pages/Dashboard.po';
// import { TimesheetsPageData } from '../support/Base/pagedata/TimesheetsPageData';
// import * as addTaskPage from '../support/Base/pages/AddTasks.po';
// import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';

// describe('Timesheets test', () => {
// 	before(() => {
// 		cy.visit('/');
// 		loginPage.verifyTitle();
// 		loginPage.verifyLoginText();
// 		loginPage.clearEmailField();
// 		loginPage.enterEmail(LoginPageData.email);
// 		loginPage.clearPasswordField();
// 		loginPage.enterPassword(LoginPageData.password);
// 		loginPage.clickLoginButton();
// 		dashboradPage.verifyCreateButton();
// 	});
// 	it('Should be able to add time', () => {
// 		cy.visit('/#/pages/organization/projects');
// 		addTaskPage.requestProjectButtonVisible();
// 		addTaskPage.clickRequestProjectButton();
// 		addTaskPage.projectNameInputVisible();
// 		addTaskPage.enterProjectNameInputData(
// 			AddTasksPageData.defaultTaskProject
// 		);
// 		addTaskPage.clickSelectEmployeeDropdown();
// 		addTaskPage.selectEmployeeDropdownOption(1);
// 		addTaskPage.selectEmployeeDropdownOption(2);
// 		addTaskPage.clickKeyboardButtonByKeyCode(9);
// 		addTaskPage.saveProjectButtonVisible();
// 		addTaskPage.clickSaveProjectButton();
// 		cy.visit('/#/pages/employees/timesheets/daily');
// 		timesheetsPage.addTimeButtonVisible();
// 		timesheetsPage.clickAddTimeButton();
// 		timesheetsPage.selectEmployeeDropdownVisible();
// 		timesheetsPage.clickSelectEmployeeDropdown();
// 		timesheetsPage.selectEmployeeFromDropdown(0);
// 		timesheetsPage.dateInputVisible();
// 		timesheetsPage.enterDateData();
// 		timesheetsPage.clickKeyboardButtonByKeyCode(9);
// 		timesheetsPage.selectProjectDropdownVisible();
// 		timesheetsPage.clickSelectProjectDropdown();
// 		timesheetsPage.selectProjectOptionDropdown(
// 			TimesheetsPageData.defaultProjectName
// 		);
// 		timesheetsPage.addTimeLogDescriptionVisible();
// 		timesheetsPage.enterTimeLogDescriptionData(
// 			TimesheetsPageData.defaultDescription
// 		);
// 		timesheetsPage.saveTimeLogButtonVisible();
// 		timesheetsPage.clickSaveTiemLogButton();
// 		// timesheetsPage.viewEmployeeTimeLogButtonVisible();
// 		// timesheetsPage.clickViewEmployeeTimeLogButton();
// 		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
// 		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
// 		// timesheetsPage.editEmployeeTimeLogButtonVisible();
// 		// timesheetsPage.clickEditEmployeeTimeLogButton();
// 		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
// 		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
// 		// timesheetsPage.deleteEmployeeTimeLogButtonVisible();
// 		// timesheetsPage.clickDeleteEmployeeTimeLogButton();
// 		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
// 		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
// 	});
// });
