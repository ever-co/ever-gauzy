import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as importExportPage from '../../support/pages/ImportExport.po';
import { ImportExportData } from '../../../src/support/Base/pagedata/ImportExportPageData';

// Converted 1:1 from the plain ImportExportTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the Import and Export settings page', async () => {
	await getPage().goto('/#/pages/settings/import-export');
	await importExportPage.headerTextExist(ImportExportData.headerText);
	await importExportPage.subheaderTextExist(ImportExportData.subheaderText);
	await importExportPage.infoTextExist(ImportExportData.firstInfo);
	await importExportPage.infoTextExist(ImportExportData.secondInfo);
	await importExportPage.infoTextExist(ImportExportData.thirdInfo);
	await importExportPage.importButtonVisible();
	await importExportPage.exportBtnVisible();
	await importExportPage.downloadBtnVisible();
});
