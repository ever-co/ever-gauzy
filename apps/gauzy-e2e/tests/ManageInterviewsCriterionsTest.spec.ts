import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import { ManageInterviewsCriterionsPageData } from '../src/support/Base/pagedata/ManageInterviewsCriterionsPageData';
import * as manageInterviewsCriterionsPage from './support/pages/ManageInterviewsCriterions.po';
import { CustomCommands } from './support/commands';
import * as dashboardPage from './support/pages/Dashboard.po';

test.describe('Manage interviews criterions test', () => {
	test('Manage interviews criterions test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add technology stack', async () => {
			await getPage().goto('/#/pages/employees/candidates/interviews/criterion');
			await manageInterviewsCriterionsPage.technologyInputVisible();
			await manageInterviewsCriterionsPage.enterTechnologyInputData(
				ManageInterviewsCriterionsPageData.technology
			);
			await manageInterviewsCriterionsPage.saveButtonVisible();
			await manageInterviewsCriterionsPage.clickSaveButton(0);
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyTechnologyTextExist(
				ManageInterviewsCriterionsPageData.technology
			);
		});

		await test.step('Should be able to edit technology stack', async () => {
			await manageInterviewsCriterionsPage.editTechnologyButtonVisible();
			await manageInterviewsCriterionsPage.clickEditTechnologyButton();
			await manageInterviewsCriterionsPage.technologyInputVisible();
			await manageInterviewsCriterionsPage.enterTechnologyInputData(
				ManageInterviewsCriterionsPageData.editTechnology
			);
			await manageInterviewsCriterionsPage.saveButtonVisible();
			await manageInterviewsCriterionsPage.clickSaveButton(0);
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyTechnologyTextExist(
				ManageInterviewsCriterionsPageData.editTechnology
			);
		});

		await test.step('Should be able to delete technology stack', async () => {
			await manageInterviewsCriterionsPage.deleteTechnologyButtonVisible();
			await manageInterviewsCriterionsPage.clickDeleteTechnologyButton();
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyTechnologyIsDeleted();
		});

		await test.step('Should be able to add personal quality', async () => {
			await manageInterviewsCriterionsPage.qualityInputVisible();
			await manageInterviewsCriterionsPage.enterQualityInputData(
				ManageInterviewsCriterionsPageData.quality
			);
			await manageInterviewsCriterionsPage.saveButtonVisible();
			await manageInterviewsCriterionsPage.clickSaveButton(1);
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyQualityTextExist(
				ManageInterviewsCriterionsPageData.quality
			);
		});

		await test.step('Should be able to edit personal quality', async () => {
			await manageInterviewsCriterionsPage.editQualityButtonVisible();
			await manageInterviewsCriterionsPage.clickEditQualityButton();
			await manageInterviewsCriterionsPage.qualityInputVisible();
			await manageInterviewsCriterionsPage.enterQualityInputData(
				ManageInterviewsCriterionsPageData.editQuality
			);
			await manageInterviewsCriterionsPage.saveButtonVisible();
			await manageInterviewsCriterionsPage.clickSaveButton(1);
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyQualityTextExist(
				ManageInterviewsCriterionsPageData.editQuality
			);
		});

		await test.step('Should be able to delete personal quality', async () => {
			await manageInterviewsCriterionsPage.deleteQualityButtonVisible();
			await manageInterviewsCriterionsPage.clickDeleteQualityButton();
			await manageInterviewsCriterionsPage.waitMessageToHide();
			await manageInterviewsCriterionsPage.verifyQualityIsDeleted();
		});
	});
});
