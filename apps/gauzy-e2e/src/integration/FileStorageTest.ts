import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as fileStoragePage from '../support/Base/pages/FileStorage.po';
import { FileStoragePageData } from '../support/Base/pagedata/FileStoragePageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('File storage test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add S3 file provider', () => {
		cy.visit('/#/pages/settings/file-storage');
		fileStoragePage.verifyHeader(FileStoragePageData.header);
		fileStoragePage.dropdownVisible();
		fileStoragePage.clickDropdown();
		fileStoragePage.dropdownOptionVisible();
		fileStoragePage.selectOptionFromDropdown(1);
		fileStoragePage.verifySubheader(FileStoragePageData.subheader);
		fileStoragePage.accessKeyInputVisible();
		fileStoragePage.enterAccessKeyInputData(
			FileStoragePageData.accessKeyId
		);
		fileStoragePage.secretKeyInputVisible();
		fileStoragePage.enterSecretKeyInputData(
			FileStoragePageData.secretAccessKey
		);
		fileStoragePage.regioninputVisible();
		fileStoragePage.enterRegionInputData(FileStoragePageData.region);
		fileStoragePage.bucketInputVisible();
		fileStoragePage.enterBucketInputData(FileStoragePageData.bucket);
		fileStoragePage.saveButtonVisible();
		fileStoragePage.clickSaveButton();
		fileStoragePage.waitMessageToHide();
	});
});
