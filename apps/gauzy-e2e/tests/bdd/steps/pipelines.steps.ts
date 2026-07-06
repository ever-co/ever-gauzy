import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as pipelinesPage from '../../support/pages/Pipelines.po';
import { PipelinesPageData } from '../../../src/support/Base/pagedata/PipelinesPageData';

// Converted 1:1 from the plain PipelinesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts.

When('I add a new pipeline', async () => {
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

When('I edit the pipeline', async () => {
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

When('I delete the pipeline', async () => {
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
