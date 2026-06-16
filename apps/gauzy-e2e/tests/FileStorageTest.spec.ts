import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as fileStoragePage from './support/pages/FileStorage.po';
import { FileStoragePageData } from '../src/support/Base/pagedata/FileStoragePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('File storage test', () => {
	test('File storage test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add S3 file provider', async () => {
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
	});
});
