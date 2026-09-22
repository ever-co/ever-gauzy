import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as fileStoragePage from '../../support/pages/FileStorage.po';
import { FileStoragePageData } from '../../../src/support/Base/pagedata/FileStoragePageData';

// Converted 1:1 from the plain FileStorageTest.spec.ts: the single test() -> one Scenario, its lone
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I add an S3 file provider', async () => {
	await getPage().goto('/#/pages/settings/file-storage');
	await fileStoragePage.verifyHeader(FileStoragePageData.header);
	await fileStoragePage.dropdownVisible();
	await fileStoragePage.clickDropdown();
	await fileStoragePage.dropdownOptionVisible();
	await fileStoragePage.selectOptionFromDropdown(1);
	await fileStoragePage.verifySubheader(FileStoragePageData.subheader);
	await fileStoragePage.accessKeyInputVisible();
	await fileStoragePage.enterAccessKeyInputData(
		FileStoragePageData.accessKeyId
	);
	await fileStoragePage.secretKeyInputVisible();
	await fileStoragePage.enterSecretKeyInputData(
		FileStoragePageData.secretAccessKey
	);
	await fileStoragePage.regionInputVisible();
	await fileStoragePage.enterRegionInputData(FileStoragePageData.region);
	await fileStoragePage.bucketInputVisible();
	await fileStoragePage.enterBucketInputData(FileStoragePageData.bucket);
	await fileStoragePage.saveButtonVisible();
	await fileStoragePage.clickSaveButton();
	await fileStoragePage.waitMessageToHide();
});
