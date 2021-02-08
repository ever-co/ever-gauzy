import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import { ManageInterviewsCriterionsPageData } from '../support/Base/pagedata/ManageInterviewsCriterionsPageData';
import * as manageInterviewsCriterionsPage from '../support/Base/pages/ManageInterviewsCriterions.po';
import { CustomCommands } from '../support/commands';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Manage employees test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to invite employees', () => {
		cy.visit('/#/pages/employees/candidates/interviews/criterion');
		manageInterviewsCriterionsPage.technologyInputVisible();
		manageInterviewsCriterionsPage.enterTechonologyInputData(
			ManageInterviewsCriterionsPageData.technology
		);
		manageInterviewsCriterionsPage.saveButtonVisible();
		manageInterviewsCriterionsPage.clickSaveButton(0);
		manageInterviewsCriterionsPage.verifyTechnologyTextExist(
			ManageInterviewsCriterionsPageData.technology
		);
	});
});
