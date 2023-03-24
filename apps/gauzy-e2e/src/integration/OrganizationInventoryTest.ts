import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as organizationInventoryPage from '../support/Base/pages/OrganizationInventory.po';
import { OrganizationInventoryPageData } from '../support/Base/pagedata/OrganizationInventoryPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Organization inventory test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to add new product category', () => {
		cy.visit('/#/pages/organization/inventory');
		organizationInventoryPage.gridBtnExists();
		organizationInventoryPage.gridBtnClick(1);
		organizationInventoryPage.addCategoryOrTypeButtonVisible();
		organizationInventoryPage.clickAddCategoryOrTypeButton(
			OrganizationInventoryPageData.categoryButtonText
		);
		organizationInventoryPage.addButtonVisible();
		organizationInventoryPage.clickAddButton();
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.productCategoryName
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productCategoryDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.verifyCategoryExists(
			OrganizationInventoryPageData.productCategoryName
		);
		organizationInventoryPage.backButtonVisible();
		organizationInventoryPage.clickBackButton();
	});
	it('Should be able to add new product type', () => {
		organizationInventoryPage.clickAddCategoryOrTypeButton(
			OrganizationInventoryPageData.typeButtonText
		);
		organizationInventoryPage.addButtonVisible();
		organizationInventoryPage.clickAddButton();
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.productTypeName
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productTypeDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.verifyTypeExists(
			OrganizationInventoryPageData.productTypeName
		);
		organizationInventoryPage.backButtonVisible();
		organizationInventoryPage.clickBackButton();
	});
	it('Should be able to add new inventory', () => {
		organizationInventoryPage.addButtonVisible();
		organizationInventoryPage.clickAddButton();
		organizationInventoryPage.languageDropdownVisible();
		organizationInventoryPage.clickLanguageDropdown();
		organizationInventoryPage.clickDropdownOption(
			OrganizationInventoryPageData.defaultInventoryLanguage
		);
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.inventoryName
		);
		organizationInventoryPage.codeInputVisible();
		organizationInventoryPage.enterCodeInputData(
			OrganizationInventoryPageData.defaultInventoryCode
		);
		organizationInventoryPage.productTypeDropdownVisible();
		organizationInventoryPage.clickProductTypeDropdown();
		organizationInventoryPage.clickDropdownOption(
			OrganizationInventoryPageData.productTypeName
		);
		organizationInventoryPage.productCategoryDropdownVisible();
		organizationInventoryPage.clickProductCategoryDropdown();
		organizationInventoryPage.clickDropdownOption(
			OrganizationInventoryPageData.productCategoryName
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productInventoryDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.backFromInventoryButtonVisible();
		organizationInventoryPage.clickBackFromInventoryButton();
		organizationInventoryPage.verifyInventoryExists(
			OrganizationInventoryPageData.inventoryName
		);
	});
	it('Should be able to edit inventory', () => {
		organizationInventoryPage.tableRowVisible();
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.editButtonVisible();
		organizationInventoryPage.clickEditButton();
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.productTypeName
		);
		organizationInventoryPage.codeInputVisible();
		organizationInventoryPage.enterCodeInputData(
			OrganizationInventoryPageData.defaultInventoryCode
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productInventoryDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.backFromInventoryButtonVisible();
		organizationInventoryPage.clickBackFromInventoryButton();
	});
	it('Should be able to delete inventory', () => {
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.deleteButtonVisible();
		organizationInventoryPage.clickDeleteButton();
		organizationInventoryPage.confirmDeleteButtonVisible();
		organizationInventoryPage.clickConfirmDeleteButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.verifyInventoryIsDeleted();
	});
	it('Should be able to edit product category', () => {
		organizationInventoryPage.addCategoryOrTypeButtonVisible();
		organizationInventoryPage.clickAddCategoryOrTypeButton(
			OrganizationInventoryPageData.categoryButtonText
		);
		organizationInventoryPage.tableRowVisible();
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.editButtonVisible();
		organizationInventoryPage.clickEditButton();
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.productCategoryName
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productCategoryDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
	});
	it('Should be able to delete product category', () => {
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.deleteButtonVisible();
		organizationInventoryPage.clickDeleteButton();
		organizationInventoryPage.confirmDeleteButtonVisible();
		organizationInventoryPage.clickConfirmDeleteButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.verifyCategoryIsDeleted(
			OrganizationInventoryPageData.productCategoryName
		);
		organizationInventoryPage.backButtonVisible();
		organizationInventoryPage.clickBackButton();
	});
	it('Should be able to edit product type', () => {
		organizationInventoryPage.addCategoryOrTypeButtonVisible();
		organizationInventoryPage.clickAddCategoryOrTypeButton(
			OrganizationInventoryPageData.typeButtonText
		);
		organizationInventoryPage.tableRowVisible();
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.editButtonVisible();
		organizationInventoryPage.clickEditButton();
		organizationInventoryPage.nameInputVisible();
		organizationInventoryPage.enterNameInputData(
			OrganizationInventoryPageData.productTypeName
		);
		organizationInventoryPage.descriptionInputVisible();
		organizationInventoryPage.enterDescriptionInputData(
			OrganizationInventoryPageData.productTypeDescription
		);
		organizationInventoryPage.saveButtonVisible();
		organizationInventoryPage.clickSaveButton();
	});
	it('Should be able to delete product type', () => {
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.tableRowVisible();
		organizationInventoryPage.selectTableRow(0);
		organizationInventoryPage.deleteButtonVisible();
		organizationInventoryPage.clickDeleteButton();
		organizationInventoryPage.confirmDeleteButtonVisible();
		organizationInventoryPage.clickConfirmDeleteButton();
		organizationInventoryPage.waitMessageToHide();
		organizationInventoryPage.verifyTypeIsDeleted(
			OrganizationInventoryPageData.productTypeName
		);
	});
});
