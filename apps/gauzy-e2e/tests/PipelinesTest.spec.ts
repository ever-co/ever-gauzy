import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as pipelinesPage from './support/pages/Pipelines.po';
import { PipelinesPageData } from '../src/support/Base/pagedata/PipelinesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Pipelines test', () => {
	test('Pipelines test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new pipeline', async () => {
			await getPage().goto('/#/pages/sales/pipelines');
			// A hash-only goto() is a Playwright no-op when origin+path are unchanged, so the
			// SPA router can stay on the previous screen. Force the hash route explicitly.
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/sales/pipelines')) {
					location.hash = '#/pages/sales/pipelines';
				}
			});
			await pipelinesPage.gridBtnExists();
			await pipelinesPage.gridBtnClick(1);
			await pipelinesPage.addPipelineButtonVisible();
			await pipelinesPage.clickAddPipelineButton();
			await pipelinesPage.nameInputVisible();
			await pipelinesPage.enterNameInputData(PipelinesPageData.pipelineName);
			await pipelinesPage.descriptionInputVisible();
			await pipelinesPage.enterDescriptionInputData(
				PipelinesPageData.pipelineDescription
			);
			await pipelinesPage.createPipelineButtonVisible();
			await pipelinesPage.clickCreatePipelineButton();
			await pipelinesPage.waitMessageToHide();
			await pipelinesPage.verifyPipelineExists(PipelinesPageData.pipelineName);
		});

		await test.step('Should be able to edit pipeline', async () => {
			await pipelinesPage.tableRowVisible();
			await pipelinesPage.selectTableRow(0);
			await pipelinesPage.editPipelineButtonVisible();
			await pipelinesPage.clickEditPipelineButton();
			await pipelinesPage.nameInputVisible();
			await pipelinesPage.enterNameInputData(PipelinesPageData.editPipelineName);
			await pipelinesPage.descriptionInputVisible();
			await pipelinesPage.enterDescriptionInputData(
				PipelinesPageData.pipelineDescription
			);
			await pipelinesPage.updateButtonVisible();
			await pipelinesPage.clickUpdateButton();
			await pipelinesPage.waitMessageToHide();
			await pipelinesPage.verifyPipelineExists(PipelinesPageData.editPipelineName);
		});

		await test.step('Should be able to delete pipeline', async () => {
			await pipelinesPage.selectTableRow(0);
			await pipelinesPage.deleteButtonVisible();
			await pipelinesPage.clickDeleteButton();
			await pipelinesPage.confirmDeleteButtonVisible();
			await pipelinesPage.clickConfirmDeleteButton();
			await pipelinesPage.waitMessageToHide();
			await pipelinesPage.verifyPipelineIsDeleted(
				PipelinesPageData.editPipelineName
			);
		});
	});
});
