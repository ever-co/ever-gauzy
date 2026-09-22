import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { ManageInterviewsCriterionsPageData } from '../../../src/support/Base/pagedata/ManageInterviewsCriterionsPageData';
import * as manageInterviewsCriterionsPage from '../../support/pages/ManageInterviewsCriterions.po';

When('I add a technology stack criterion', async () => {
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

When('I edit the technology stack criterion', async () => {
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

When('I delete the technology stack criterion', async () => {
	await manageInterviewsCriterionsPage.deleteTechnologyButtonVisible();
	await manageInterviewsCriterionsPage.clickDeleteTechnologyButton();
	await manageInterviewsCriterionsPage.waitMessageToHide();
	await manageInterviewsCriterionsPage.verifyTechnologyIsDeleted();
});

When('I add a personal quality criterion', async () => {
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

When('I edit the personal quality criterion', async () => {
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

When('I delete the personal quality criterion', async () => {
	await manageInterviewsCriterionsPage.deleteQualityButtonVisible();
	await manageInterviewsCriterionsPage.clickDeleteQualityButton();
	await manageInterviewsCriterionsPage.waitMessageToHide();
	await manageInterviewsCriterionsPage.verifyQualityIsDeleted();
});
