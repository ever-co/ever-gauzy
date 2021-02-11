import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import { ManageInterviewsCriterionsPageData } from '../support/Base/pagedata/ManageInterviewsCriterionsPageData';
import * as manageInterviewsCriterionsPage from '../support/Base/pages/ManageInterviewsCriterions.po';
import { CustomCommands } from '../support/commands';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Manage interviews criterions test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add technology stack', () => {
		cy.visit('/#/pages/employees/candidates/interviews/criterion');
		manageInterviewsCriterionsPage.technologyInputVisible();
		manageInterviewsCriterionsPage.enterTechonologyInputData(
			ManageInterviewsCriterionsPageData.technology
		);
		manageInterviewsCriterionsPage.saveButtonVisible();
		manageInterviewsCriterionsPage.clickSaveButton(0);
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyTechnologyTextExist(
			ManageInterviewsCriterionsPageData.technology
		);
	});
	it('Should be able to edit technology stack', () => {
		manageInterviewsCriterionsPage.editTechnologyButtonVisible();
		manageInterviewsCriterionsPage.clickEditTechnologyButton();
		manageInterviewsCriterionsPage.technologyInputVisible();
		manageInterviewsCriterionsPage.enterTechonologyInputData(
			ManageInterviewsCriterionsPageData.editTechnology
		);
		manageInterviewsCriterionsPage.saveButtonVisible();
		manageInterviewsCriterionsPage.clickSaveButton(0);
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyTechnologyTextExist(
			ManageInterviewsCriterionsPageData.editTechnology
		);
	});
	it('Should be able to delete technology stack', () => {
		manageInterviewsCriterionsPage.deleteTechnologyButtonVisible();
		manageInterviewsCriterionsPage.clickDeleteTechnologyButton();
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyTechnologyIsDeleted();
	});
	it('Should be able to add personal quality', () => {
		manageInterviewsCriterionsPage.qualityInputVisible();
		manageInterviewsCriterionsPage.enterQualityInputData(
			ManageInterviewsCriterionsPageData.quality
		);
		manageInterviewsCriterionsPage.saveButtonVisible();
		manageInterviewsCriterionsPage.clickSaveButton(1);
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyQualityTextExist(
			ManageInterviewsCriterionsPageData.quality
		);
	});
	it('Should be able to edit personal quality', () => {
		manageInterviewsCriterionsPage.editQualityButtonVisible();
		manageInterviewsCriterionsPage.clickEditQualityButton();
		manageInterviewsCriterionsPage.qualityInputVisible();
		manageInterviewsCriterionsPage.enterQualityInputData(
			ManageInterviewsCriterionsPageData.editQuality
		);
		manageInterviewsCriterionsPage.saveButtonVisible();
		manageInterviewsCriterionsPage.clickSaveButton(1);
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyQualityTextExist(
			ManageInterviewsCriterionsPageData.editQuality
		);
	});
	it('Should be able to delete personal quality', () => {
		manageInterviewsCriterionsPage.deleteQualityButtonVisible();
		manageInterviewsCriterionsPage.clickDeleteQualityButton();
		manageInterviewsCriterionsPage.waitMessageToHide();
		manageInterviewsCriterionsPage.verifyQualityIsDeleted();
	});
});
