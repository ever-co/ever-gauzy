import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as organizationInventoryPage from './support/pages/OrganizationInventory.po';
import { OrganizationInventoryPageData } from '../src/support/Base/pagedata/OrganizationInventoryPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Organization inventory test', () => {
	test('Organization inventory test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new product category', async () => {
			await getPage().goto('/#/pages/organization/inventory');
			await organizationInventoryPage.gridBtnExists();
			await organizationInventoryPage.gridBtnClick(1);
			await organizationInventoryPage.addCategoryOrTypeButtonVisible();
			await organizationInventoryPage.clickAddCategoryOrTypeButton(
				OrganizationInventoryPageData.categoryButtonText
			);
			await organizationInventoryPage.addButtonVisible();
			await organizationInventoryPage.clickAddButton();
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.productCategoryName
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productCategoryDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.verifyCategoryExists(
				OrganizationInventoryPageData.productCategoryName
			);
			await organizationInventoryPage.backButtonVisible();
			await organizationInventoryPage.clickBackButton();
		});

		await test.step('Should be able to add new product type', async () => {
			await organizationInventoryPage.clickAddCategoryOrTypeButton(
				OrganizationInventoryPageData.typeButtonText
			);
			await organizationInventoryPage.addButtonVisible();
			await organizationInventoryPage.clickAddButton();
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.productTypeName
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productTypeDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.verifyTypeExists(
				OrganizationInventoryPageData.productTypeName
			);
			await organizationInventoryPage.backButtonVisible();
			await organizationInventoryPage.clickBackButton();
		});

		await test.step('Should be able to add new inventory', async () => {
			await organizationInventoryPage.addButtonVisible();
			await organizationInventoryPage.clickAddButton();
			await organizationInventoryPage.languageDropdownVisible();
			await organizationInventoryPage.clickLanguageDropdown();
			await organizationInventoryPage.clickDropdownOption(
				OrganizationInventoryPageData.defaultInventoryLanguage
			);
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.inventoryName
			);
			await organizationInventoryPage.codeInputVisible();
			await organizationInventoryPage.enterCodeInputData(
				OrganizationInventoryPageData.defaultInventoryCode
			);
			await organizationInventoryPage.productTypeDropdownVisible();
			await organizationInventoryPage.clickProductTypeDropdown();
			await organizationInventoryPage.clickDropdownOption(
				OrganizationInventoryPageData.productTypeName
			);
			await organizationInventoryPage.productCategoryDropdownVisible();
			await organizationInventoryPage.clickProductCategoryDropdown();
			await organizationInventoryPage.clickDropdownOption(
				OrganizationInventoryPageData.productCategoryName
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productInventoryDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.backFromInventoryButtonVisible();
			await organizationInventoryPage.clickBackFromInventoryButton();
			await organizationInventoryPage.verifyInventoryExists(
				OrganizationInventoryPageData.inventoryName
			);
		});

		await test.step('Should be able to edit inventory', async () => {
			await organizationInventoryPage.tableRowVisible();
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.editButtonVisible();
			await organizationInventoryPage.clickEditButton();
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.productTypeName
			);
			await organizationInventoryPage.codeInputVisible();
			await organizationInventoryPage.enterCodeInputData(
				OrganizationInventoryPageData.defaultInventoryCode
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productInventoryDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.backFromInventoryButtonVisible();
			await organizationInventoryPage.clickBackFromInventoryButton();
		});

		await test.step('Should be able to delete inventory', async () => {
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.deleteButtonVisible();
			await organizationInventoryPage.clickDeleteButton();
			await organizationInventoryPage.confirmDeleteButtonVisible();
			await organizationInventoryPage.clickConfirmDeleteButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.verifyInventoryIsDeleted();
		});

		await test.step('Should be able to edit product category', async () => {
			await organizationInventoryPage.addCategoryOrTypeButtonVisible();
			await organizationInventoryPage.clickAddCategoryOrTypeButton(
				OrganizationInventoryPageData.categoryButtonText
			);
			await organizationInventoryPage.tableRowVisible();
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.editButtonVisible();
			await organizationInventoryPage.clickEditButton();
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.productCategoryName
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productCategoryDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
		});

		await test.step('Should be able to delete product category', async () => {
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.deleteButtonVisible();
			await organizationInventoryPage.clickDeleteButton();
			await organizationInventoryPage.confirmDeleteButtonVisible();
			await organizationInventoryPage.clickConfirmDeleteButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.verifyCategoryIsDeleted(
				OrganizationInventoryPageData.productCategoryName
			);
			await organizationInventoryPage.backButtonVisible();
			await organizationInventoryPage.clickBackButton();
		});

		await test.step('Should be able to edit product type', async () => {
			await organizationInventoryPage.addCategoryOrTypeButtonVisible();
			await organizationInventoryPage.clickAddCategoryOrTypeButton(
				OrganizationInventoryPageData.typeButtonText
			);
			await organizationInventoryPage.tableRowVisible();
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.editButtonVisible();
			await organizationInventoryPage.clickEditButton();
			await organizationInventoryPage.nameInputVisible();
			await organizationInventoryPage.enterNameInputData(
				OrganizationInventoryPageData.productTypeName
			);
			await organizationInventoryPage.descriptionInputVisible();
			await organizationInventoryPage.enterDescriptionInputData(
				OrganizationInventoryPageData.productTypeDescription
			);
			await organizationInventoryPage.saveButtonVisible();
			await organizationInventoryPage.clickSaveButton();
		});

		await test.step('Should be able to delete product type', async () => {
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.tableRowVisible();
			await organizationInventoryPage.selectTableRow(0);
			await organizationInventoryPage.deleteButtonVisible();
			await organizationInventoryPage.clickDeleteButton();
			await organizationInventoryPage.confirmDeleteButtonVisible();
			await organizationInventoryPage.clickConfirmDeleteButton();
			await organizationInventoryPage.waitMessageToHide();
			await organizationInventoryPage.verifyTypeIsDeleted(
				OrganizationInventoryPageData.productTypeName
			);
		});
	});
});
