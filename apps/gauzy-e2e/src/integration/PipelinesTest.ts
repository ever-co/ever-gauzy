import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as pipelinesPage from '../support/Base/pages/Pipelines.po';
import { PipelinesPageData } from '../support/Base/pagedata/PipelinesPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Pipelines test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to add new pipeline', () => {
		cy.visit('/#/pages/sales/pipelines');
		pipelinesPage.gridBtnExists();
		pipelinesPage.gridBtnClick(1);
		pipelinesPage.addPipelineButtonVisible();
		pipelinesPage.clickAddPipelineButton();
		pipelinesPage.nameInputVisible();
		pipelinesPage.enterNameInputData(PipelinesPageData.pipelineName);
		pipelinesPage.descriptionInputVisible();
		pipelinesPage.enterDescriptionInputData(PipelinesPageData.pipelineDescription);
		pipelinesPage.createPipelineButtonVisible();
		pipelinesPage.clickCreatePipelineButton();
		pipelinesPage.waitMessageToHide();
		pipelinesPage.verifyPipelineExists(PipelinesPageData.pipelineName);
	});

	it('Should be able to edit pipeline', () => {
		pipelinesPage.tableRowVisible();
		pipelinesPage.selectTableRow(0);
		pipelinesPage.editPipelineButtonVisible();
		pipelinesPage.clickEditPipelineButton();
		pipelinesPage.nameInputVisible();
		pipelinesPage.enterNameInputData(PipelinesPageData.editPipelineName);
		pipelinesPage.descriptionInputVisible();
		pipelinesPage.enterDescriptionInputData(PipelinesPageData.pipelineDescription);
		pipelinesPage.updateButtonVisible();
		pipelinesPage.clickUpdateButton();
		pipelinesPage.waitMessageToHide();
		pipelinesPage.verifyPipelineExists(PipelinesPageData.editPipelineName);
	});
	it('Should be able to delete pipeline', () => {
		pipelinesPage.selectTableRow(0);
		pipelinesPage.deleteButtonVisible();
		pipelinesPage.clickDeleteButton();
		pipelinesPage.confirmDeleteButtonVisible();
		pipelinesPage.clickConfirmDeleteButton();
		pipelinesPage.waitMessageToHide();
		pipelinesPage.verifyPipelineIsDeleted(PipelinesPageData.editPipelineName);
	});
});
